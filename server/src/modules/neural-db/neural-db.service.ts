import type { ClinicalCategory, DatasetSplit, NeuralLabel, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import { assertVerifiedProfessional } from '../contributions/contributions.service.js';
import { userSummarySelect } from '../users/users.select.js';
import type { CreateNeuralSampleInput } from './neural-db.schemas.js';

export const NEURAL_LABEL_NUMERIC_MAP: Record<NeuralLabel, number> = {
  CONTROL: 0,
  ISCHEMIC_STROKE: 1,
  HEMORRHAGIC_STROKE: 2,
  EPILEPTIFORM_SLOWING: 3,
  COGNITIVE_FATIGUE: 4,
};

export const neuralSampleInclude = {
  uploader: { select: userSummarySelect },
  verifiedBy: { select: userSummarySelect },
} satisfies Prisma.NeuralTrainingSampleInclude;

type NeuralSampleRow = Prisma.NeuralTrainingSampleGetPayload<{
  include: typeof neuralSampleInclude;
}>;

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function formatNeuralSample(row: NeuralSampleRow) {
  return {
    id: row.id,
    datasetId: row.datasetId,
    uploaderId: row.uploaderId,
    subjectCode: row.subjectCode,
    clinicalCategory: row.clinicalCategory,
    groundTruthLabel: row.groundTruthLabel,
    split: row.split,
    samplingRateHz: row.samplingRateHz,
    channelsCount: row.channelsCount,
    montage: row.montage,
    signalQualityScore: row.signalQualityScore,
    dar: row.dar,
    bsi: row.bsi,
    tar: row.tar,
    pri: row.pri,
    wpli: row.wpli,
    tpaLockoutTriggered: row.tpaLockoutTriggered,
    spectralBands: safeJsonParse(row.spectralBandsJson, {
      delta: 0.25,
      theta: 0.25,
      alpha: 0.25,
      beta: 0.25,
    }),
    featureVector: safeJsonParse<number[]>(row.featureVectorJson, []),
    waveformPreview: safeJsonParse(row.waveformPreviewJson, {
      time: [] as number[],
      channels: [] as string[],
      filtered: {} as Record<string, number[]>,
    }),
    verifiedById: row.verifiedById,
    deidentifiedConfirmed: row.deidentifiedConfirmed,
    createdAt: row.createdAt,
    uploader: row.uploader,
    verifiedBy: row.verifiedBy,
  };
}

export async function getNeuralDbStats() {
  const [totalSamples, verifiedSamples, byLabelRows, byCategoryRows, bySplitRows, avgAgg] =
    await Promise.all([
      prisma.neuralTrainingSample.count(),
      prisma.neuralTrainingSample.count({ where: { verifiedById: { not: null } } }),
      prisma.neuralTrainingSample.groupBy({
        by: ['groundTruthLabel'],
        _count: { _all: true },
      }),
      prisma.neuralTrainingSample.groupBy({
        by: ['clinicalCategory'],
        _count: { _all: true },
      }),
      prisma.neuralTrainingSample.groupBy({
        by: ['split'],
        _count: { _all: true },
      }),
      prisma.neuralTrainingSample.aggregate({
        _avg: { dar: true, bsi: true, tar: true, wpli: true },
      }),
    ]);

  const byLabel: Record<NeuralLabel, number> = {
    CONTROL: 0,
    ISCHEMIC_STROKE: 0,
    HEMORRHAGIC_STROKE: 0,
    EPILEPTIFORM_SLOWING: 0,
    COGNITIVE_FATIGUE: 0,
  };
  for (const r of byLabelRows) {
    byLabel[r.groundTruthLabel] = r._count._all;
  }

  const byCategory: Record<ClinicalCategory, number> = {
    VASCULAR_STROKE: 0,
    EPILEPSY_ICU: 0,
    SLEEP_COGNITIVE: 0,
    HARDWARE_BCI: 0,
  };
  for (const r of byCategoryRows) {
    byCategory[r.clinicalCategory] = r._count._all;
  }

  const bySplit: Record<DatasetSplit, number> = {
    TRAIN: 0,
    VALIDATION: 0,
    TEST: 0,
    EXTERNAL_HOLDOUT: 0,
  };
  for (const r of bySplitRows) {
    bySplit[r.split] = r._count._all;
  }

  const round3 = (n: number | null | undefined) => Math.round((n ?? 0) * 1000) / 1000;

  return {
    totalSamples,
    verifiedSamples,
    byLabel,
    byCategory,
    bySplit,
    averages: {
      dar: round3(avgAgg._avg.dar),
      bsi: round3(avgAgg._avg.bsi),
      tar: round3(avgAgg._avg.tar),
      wpli: round3(avgAgg._avg.wpli),
    },
  };
}

export async function listNeuralSamples(filters: {
  clinicalCategory?: ClinicalCategory;
  groundTruthLabel?: NeuralLabel;
  split?: DatasetSplit;
  verifiedOnly?: boolean;
}) {
  const rows = await prisma.neuralTrainingSample.findMany({
    where: {
      ...(filters.clinicalCategory ? { clinicalCategory: filters.clinicalCategory } : {}),
      ...(filters.groundTruthLabel ? { groundTruthLabel: filters.groundTruthLabel } : {}),
      ...(filters.split ? { split: filters.split } : {}),
      ...(filters.verifiedOnly ? { verifiedById: { not: null } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: neuralSampleInclude,
  });

  return rows.map(formatNeuralSample);
}

export async function createNeuralSample(uploaderId: string, input: CreateNeuralSampleInput) {
  const row = await prisma.neuralTrainingSample.create({
    data: {
      datasetId: input.datasetId ?? null,
      uploaderId,
      subjectCode: input.subjectCode,
      clinicalCategory: input.clinicalCategory,
      groundTruthLabel: input.groundTruthLabel,
      split: input.split,
      samplingRateHz: input.samplingRateHz,
      channelsCount: input.channelsCount,
      montage: input.montage,
      signalQualityScore: input.signalQualityScore,
      dar: input.dar,
      bsi: input.bsi,
      tar: input.tar,
      pri: input.pri,
      wpli: input.wpli,
      tpaLockoutTriggered: input.tpaLockoutTriggered,
      spectralBandsJson: JSON.stringify(input.spectralBands),
      featureVectorJson: JSON.stringify(input.featureVector),
      waveformPreviewJson: JSON.stringify(input.waveformPreview),
      deidentifiedConfirmed: input.deidentifiedConfirmed,
    },
    include: neuralSampleInclude,
  });

  return formatNeuralSample(row);
}

export async function verifyNeuralSample(
  verifierId: string,
  sampleId: string,
  input: { groundTruthLabel?: NeuralLabel; split?: DatasetSplit },
) {
  await assertVerifiedProfessional(verifierId);

  const existing = await prisma.neuralTrainingSample.findUnique({ where: { id: sampleId } });
  if (!existing) throw notFound('Mẫu dữ liệu Neural DB không tồn tại');

  const updated = await prisma.neuralTrainingSample.update({
    where: { id: sampleId },
    data: {
      verifiedById: verifierId,
      ...(input.groundTruthLabel ? { groundTruthLabel: input.groundTruthLabel } : {}),
      ...(input.split ? { split: input.split } : {}),
    },
    include: neuralSampleInclude,
  });

  return formatNeuralSample(updated);
}

function escapeCsvCell(val: string | number | boolean): string {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function exportNeuralDataset(params: {
  format: 'csv' | 'jsonl';
  clinicalCategory?: ClinicalCategory;
  split?: DatasetSplit;
}) {
  const rows = await prisma.neuralTrainingSample.findMany({
    where: {
      ...(params.clinicalCategory ? { clinicalCategory: params.clinicalCategory } : {}),
      ...(params.split ? { split: params.split } : {}),
    },
    orderBy: { createdAt: 'asc' },
    include: neuralSampleInclude,
  });

  const formatted = rows.map(formatNeuralSample);

  if (params.format === 'jsonl') {
    const lines = formatted.map((s) =>
      JSON.stringify({
        id: s.id,
        subjectCode: s.subjectCode,
        clinicalCategory: s.clinicalCategory,
        groundTruthLabel: s.groundTruthLabel,
        labelId: NEURAL_LABEL_NUMERIC_MAP[s.groundTruthLabel],
        split: s.split,
        verified: Boolean(s.verifiedById),
        samplingRateHz: s.samplingRateHz,
        channelsCount: s.channelsCount,
        biomarkers: {
          dar: s.dar,
          bsi: s.bsi,
          tar: s.tar,
          pri: s.pri,
          wpli: s.wpli,
          tpaLockoutTriggered: s.tpaLockoutTriggered,
        },
        spectralBands: s.spectralBands,
        featureVector: s.featureVector,
      }),
    );
    return {
      contentType: 'application/x-ndjson; charset=utf-8',
      filename: 'neurolink_neural_db.jsonl',
      body: lines.join('\n') + (lines.length ? '\n' : ''),
    };
  }

  const maxFeatures = Math.max(
    80,
    ...formatted.map((s) => (Array.isArray(s.featureVector) ? s.featureVector.length : 0)),
  );
  const featureHeaders = Array.from({ length: maxFeatures }, (_, i) => `f${i}`);
  const header = [
    'sample_id',
    'subject_code',
    'clinical_category',
    'ground_truth_label',
    'label_id',
    'split',
    'verified',
    'dar',
    'bsi',
    'tar',
    'pri',
    'wpli',
    'tpa_lockout',
    ...featureHeaders,
  ].join(',');

  const csvLines = [header];
  for (const s of formatted) {
    const vec = Array.from({ length: maxFeatures }, (_, idx) => {
      const val = s.featureVector[idx];
      return typeof val === 'number' && Number.isFinite(val) ? val : 0;
    });
    const cells: (string | number | boolean)[] = [
      s.id,
      s.subjectCode,
      s.clinicalCategory,
      s.groundTruthLabel,
      NEURAL_LABEL_NUMERIC_MAP[s.groundTruthLabel],
      s.split,
      Boolean(s.verifiedById),
      s.dar,
      s.bsi,
      s.tar,
      s.pri,
      s.wpli,
      s.tpaLockoutTriggered,
      ...vec,
    ];
    csvLines.push(cells.map(escapeCsvCell).join(','));
  }

  return {
    contentType: 'text/csv; charset=utf-8',
    filename: 'neurolink_neural_db.csv',
    body: csvLines.join('\n') + '\n',
  };
}
