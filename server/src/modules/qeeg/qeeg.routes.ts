import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError, badRequest } from '../../lib/errors.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { createPersonalDataset } from '../eeg/eeg-access.service.js';
import {
  clinicalCategories,
  datasetSplits,
  neuralLabels,
} from '../neural-db/neural-db.schemas.js';
import { createNeuralSample } from '../neural-db/neural-db.service.js';
import {
  analyzeCaseTs,
  analyzeCsvTs,
  CLINICAL_CATEGORIES,
  generateClinicalPdfFallback,
  getBuiltInCases,
  resolveCaseId,
  type QeegAnalysisResult,
} from './qeeg-dsp.engine.js';

export const qeegRouter = Router();

export const MAX_CONCURRENT_QEEG_JOBS = 4;
export const MAX_QEEG_QUEUE_SIZE = 12;
const PYTHON_UPSTREAM_TIMEOUT_MS = 15000;

let activeQeegJobs = 0;
const qeegWaitQueue: Array<() => void> = [];

export function getQeegConcurrencyStats() {
  return {
    activeJobs: activeQeegJobs,
    queuedJobs: qeegWaitQueue.length,
    maxConcurrent: MAX_CONCURRENT_QEEG_JOBS,
    maxQueue: MAX_QEEG_QUEUE_SIZE,
  };
}

async function runWithQeegSemaphore<T>(task: () => Promise<T>): Promise<T> {
  if (activeQeegJobs >= MAX_CONCURRENT_QEEG_JOBS) {
    if (qeegWaitQueue.length >= MAX_QEEG_QUEUE_SIZE) {
      throw new AppError(
        429,
        'RATE_LIMITED',
        'Hệ thống phân tích qEEG đang quá tải luồng xử lý, vui lòng thử lại sau giây lát.',
      );
    }
    await new Promise<void>((resolve) => {
      qeegWaitQueue.push(resolve);
    });
  } else {
    activeQeegJobs += 1;
  }

  try {
    return await task();
  } finally {
    const nextWaiter = qeegWaitQueue.shift();
    if (nextWaiter) {
      nextWaiter();
    } else {
      activeQeegJobs = Math.max(0, activeQeegJobs - 1);
    }
  }
}

async function proxyJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const base = env.QEEG_SERVICE_URL.replace(/\/+$/, '');
    const res = await fetch(`${base}${path}`, {
      ...init,
      signal: AbortSignal.timeout(PYTHON_UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function proxyBinary(
  path: string,
): Promise<{ status: number; buffer: Buffer; contentType: string; disposition?: string } | null> {
  try {
    const base = env.QEEG_SERVICE_URL.replace(/\/+$/, '');
    const res = await fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(PYTHON_UPSTREAM_TIMEOUT_MS),
    });
    if (res.status === 400 || res.status === 404) {
      return {
        status: res.status,
        buffer: Buffer.alloc(0),
        contentType: 'application/json',
      };
    }
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    if (buffer.length < 100) return null;
    return {
      status: res.status,
      buffer,
      contentType: res.headers.get('content-type') || 'application/pdf',
      disposition: res.headers.get('content-disposition') || undefined,
    };
  } catch {
    return null;
  }
}

const analyzeCaseSchema = z.object({
  caseId: z.string().trim().min(1, 'Vui lòng chọn mã ca bệnh qEEG').max(100),
  timeWindowSec: z.number().min(2).max(30).optional().default(10),
  notch50Hz: z.boolean().optional().default(true),
  fastScore: z.number().int().min(0).max(6).optional(),
});

const analyzeCsvSchema = z.object({
  filename: z.string().trim().min(1, 'Thiếu tên tệp CSV').max(255),
  csvText: z.string().min(16, 'Nội dung CSV quá ngắn').max(1_800_000),
  samplingRateHz: z.number().min(50).max(4000).optional(),
  forceSamplingRate: z.boolean().optional(),
  clinicalCategory: z.enum(clinicalCategories).optional().default('HARDWARE_BCI'),
});

const saveToPlatformSchema = z.object({
  title: z.string().trim().min(3, 'Tiêu đề bản ghi tối thiểu 3 ký tự').max(200),
  clinicalCategory: z.enum(clinicalCategories),
  groundTruthLabel: z.enum(neuralLabels),
  split: z.enum(datasetSplits).optional().default('TRAIN'),
  subjectCode: z.string().trim().min(2).max(60).optional(),
  clinicalNote: z.string().trim().max(1000).optional(),
  deidentifiedConfirmed: z.boolean().refine((v) => v === true, {
    message: 'Bắt buộc xác nhận đã khử danh tính bệnh nhân trước khi lưu lên nền tảng.',
  }),
  analysis: z.object({
    samplingRateHz: z.number().int().min(50).max(4000),
    channelsCount: z.number().int().min(1).max(256),
    montage: z.string().trim().min(2).max(200),
    biomarkers: z.object({
      meanDar: z.number().finite(),
      meanTar: z.number().finite(),
      meanBsi: z.number().finite(),
      pri: z.number().finite(),
      wpli: z.number().finite(),
      signalQualityScore: z.number().finite(),
      tpaLockoutTriggered: z.boolean(),
    }),
    bandPowers: z.object({
      delta: z.number().finite(),
      theta: z.number().finite(),
      alpha: z.number().finite(),
      beta: z.number().finite(),
    }),
    featureVector80: z.array(z.number().finite()).min(1).max(256),
    waveforms: z.object({
      time: z.array(z.number().finite()).max(2000),
      channels: z.array(z.string().trim().min(1)).max(32),
      filtered: z.record(z.string(), z.array(z.number().finite()).max(2000)),
    }),
  }),
});

qeegRouter.get('/health', async (_req, res) => {
  const py = await proxyJson<{ status: string; engineSource?: string; categories?: string[] }>(
    '/api/qeeg/health',
  );
  if (py && py.status === 'ok') {
    res.json({
      status: 'ok',
      engineSource: 'python_qeeg_service',
      categories: Array.isArray(py.categories) ? py.categories : CLINICAL_CATEGORIES,
      concurrency: getQeegConcurrencyStats(),
    });
    return;
  }

  res.json({
    status: 'ok',
    engineSource: 'ts_dsp_fallback',
    categories: CLINICAL_CATEGORIES,
    concurrency: getQeegConcurrencyStats(),
  });
});

qeegRouter.get('/cases', async (_req, res) => {
  const py = await proxyJson<{ cases?: unknown[] }>('/api/qeeg/cases');
  if (py && Array.isArray(py.cases) && py.cases.length > 0) {
    res.json({ cases: py.cases });
    return;
  }
  res.json({ cases: getBuiltInCases() });
});

qeegRouter.post('/analyze-case', async (req, res) => {
  const input = analyzeCaseSchema.parse(req.body);
  const result = await runWithQeegSemaphore(async () => {
    const py = await proxyJson<QeegAnalysisResult>('/api/qeeg/analyze-case', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (py && py.status === 'SUCCESS' && Array.isArray(py.featureVector80)) {
      return { ...py, engineSource: 'python_qeeg_service' as const };
    }

    const tsResult = analyzeCaseTs(input);
    if (!tsResult) {
      throw badRequest(`Mã kịch bản qEEG không hợp lệ: ${input.caseId}`);
    }
    return tsResult;
  });

  res.json(result);
});

qeegRouter.post('/analyze-csv', async (req, res) => {
  const input = analyzeCsvSchema.parse(req.body);
  const result = await runWithQeegSemaphore(async () => {
    const py = await proxyJson<QeegAnalysisResult>('/api/qeeg/analyze-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (py && py.status === 'SUCCESS' && Array.isArray(py.featureVector80)) {
      return { ...py, engineSource: 'python_qeeg_service' as const };
    }

    try {
      return analyzeCsvTs(input);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể phân tích file CSV điện não';
      throw badRequest(msg);
    }
  });

  res.json(result);
});

qeegRouter.get('/export-pdf-summary', async (req, res) => {
  const rawCaseId = typeof req.query.caseId === 'string' ? req.query.caseId.trim() : '';
  if (!rawCaseId) {
    throw badRequest('Thiếu tham số caseId để xuất báo cáo PDF.');
  }
  const normalizedId = resolveCaseId(rawCaseId);

  const pdfPayload = await runWithQeegSemaphore(async () => {
    const pyPdf = await proxyBinary(
      `/api/qeeg/export-pdf-summary?caseId=${encodeURIComponent(normalizedId)}`,
    );
    if (pyPdf) {
      if (pyPdf.status === 404) {
        throw new AppError(
          404,
          'QEEG_CASE_NOT_FOUND',
          `Không tìm thấy ca chuẩn '${rawCaseId}' để xuất báo cáo PDF.`,
        );
      }
      if (pyPdf.status === 400) {
        throw badRequest(`Tham số xuất báo cáo PDF không hợp lệ: ${rawCaseId}`);
      }
      return {
        buffer: pyPdf.buffer,
        contentType: pyPdf.contentType,
        disposition:
          pyPdf.disposition || `attachment; filename="NeuroLink_qEEG_${normalizedId}.pdf"`,
      };
    }

    const fallbackAnalysis = analyzeCaseTs({ caseId: normalizedId });
    if (!fallbackAnalysis) {
      throw new AppError(
        404,
        'QEEG_CASE_NOT_FOUND',
        `Không tìm thấy ca chuẩn '${rawCaseId}' để xuất báo cáo PDF.`,
      );
    }
    const pdfBuffer = generateClinicalPdfFallback(fallbackAnalysis);
    return {
      buffer: pdfBuffer,
      contentType: 'application/pdf',
      disposition: `attachment; filename="NeuroLink_qEEG_${fallbackAnalysis.caseId}.pdf"`,
    };
  });

  res.setHeader('Content-Type', pdfPayload.contentType);
  res.setHeader('Content-Disposition', pdfPayload.disposition);
  res.send(pdfPayload.buffer);
});

qeegRouter.post('/save-to-platform', requireAuth, async (req, res) => {
  const auth = getAuth(req);
  const input = saveToPlatformSchema.parse(req.body);

  const dataset = await createPersonalDataset(auth.userId, {
    title: input.title,
    duration: '10 giây (qEEG Epoch)',
    samplingRate: `${input.analysis.samplingRateHz} Hz`,
    channelsCount: input.analysis.channelsCount,
    montage: input.analysis.montage,
    filter: '0.5 - 45 Hz · Notch 50 Hz · CAR',
    clinicalNote:
      input.clinicalNote ||
      `Phân tích qEEG (${input.clinicalCategory}): DAR=${input.analysis.biomarkers.meanDar.toFixed(2)}, BSI=${input.analysis.biomarkers.meanBsi.toFixed(3)}, TAR=${input.analysis.biomarkers.meanTar.toFixed(2)}.`,
  });

  const sample = await createNeuralSample(auth.userId, {
    datasetId: dataset.id,
    subjectCode: input.subjectCode || dataset.patientCode,
    clinicalCategory: input.clinicalCategory,
    groundTruthLabel: input.groundTruthLabel,
    split: input.split,
    samplingRateHz: input.analysis.samplingRateHz,
    channelsCount: input.analysis.channelsCount,
    montage: input.analysis.montage,
    signalQualityScore: input.analysis.biomarkers.signalQualityScore,
    dar: input.analysis.biomarkers.meanDar,
    bsi: input.analysis.biomarkers.meanBsi,
    tar: input.analysis.biomarkers.meanTar,
    pri: input.analysis.biomarkers.pri,
    wpli: input.analysis.biomarkers.wpli,
    tpaLockoutTriggered: input.analysis.biomarkers.tpaLockoutTriggered,
    spectralBands: input.analysis.bandPowers,
    featureVector: input.analysis.featureVector80,
    waveformPreview: input.analysis.waveforms,
    deidentifiedConfirmed: input.deidentifiedConfirmed,
  });

  res.status(201).json({ dataset, sample });
});
