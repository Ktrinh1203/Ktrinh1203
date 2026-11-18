import { prisma } from '../../lib/prisma.js';
import { forbidden, notFound } from '../../lib/errors.js';
import type {
  CreateCheckInInput,
  CreateWorkBlockInput,
  UpdateWorkBlockInput,
} from './self-service.schemas.js';

export async function getSelfServiceOverview(userId: string) {
  const [checkIns, workPlan] = await Promise.all([
    prisma.healthCheckIn.findMany({
      where: { userId },
      orderBy: { recordedDate: 'desc' },
      take: 30,
    }),
    prisma.workingPlanBlock.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
    }),
  ]);

  return { checkIns, workPlan };
}

export async function addHealthCheckIn(userId: string, input: CreateCheckInInput) {
  if (input.neuralSampleId) {
    const sample = await prisma.neuralTrainingSample.findUnique({
      where: { id: input.neuralSampleId },
      select: { id: true },
    });
    if (!sample) throw notFound('Mẫu điện não đính kèm không tồn tại.');
  }

  return prisma.healthCheckIn.create({
    data: {
      userId,
      neuralSampleId: input.neuralSampleId ?? null,
      focusScore: input.focusScore,
      fatigueIndexTar: input.fatigueIndexTar,
      hemisphericBsi: input.hemisphericBsi,
      alphaPeakHz: input.alphaPeakHz,
      sleepHours: input.sleepHours,
      stressLevel: input.stressLevel,
      notes: input.notes,
    },
  });
}

export async function addWorkPlanBlock(userId: string, input: CreateWorkBlockInput) {
  return prisma.workingPlanBlock.create({
    data: {
      userId,
      dayOfWeek: input.dayOfWeek,
      timeSlot: input.timeSlot,
      title: input.title,
      blockType: input.blockType,
      eegRationale: input.eegRationale,
    },
  });
}

export async function updateWorkPlanBlock(
  userId: string,
  blockId: string,
  input: UpdateWorkBlockInput,
) {
  const existing = await prisma.workingPlanBlock.findUnique({ where: { id: blockId } });
  if (!existing) throw notFound('Khối lịch làm việc không tồn tại.');
  if (existing.userId !== userId) {
    throw forbidden('Bạn không có quyền chỉnh sửa khối lịch làm việc của người dùng khác.');
  }

  return prisma.workingPlanBlock.update({
    where: { id: blockId },
    data: {
      ...(input.dayOfWeek !== undefined ? { dayOfWeek: input.dayOfWeek } : {}),
      ...(input.timeSlot !== undefined ? { timeSlot: input.timeSlot } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.blockType !== undefined ? { blockType: input.blockType } : {}),
      ...(input.eegRationale !== undefined ? { eegRationale: input.eegRationale } : {}),
      ...(input.completed !== undefined ? { completed: input.completed } : {}),
    },
  });
}

export async function deleteWorkPlanBlock(userId: string, blockId: string) {
  const existing = await prisma.workingPlanBlock.findUnique({ where: { id: blockId } });
  if (!existing) throw notFound('Khối lịch làm việc không tồn tại.');
  if (existing.userId !== userId) {
    throw forbidden('Bạn không có quyền xóa khối lịch làm việc của người dùng khác.');
  }

  await prisma.workingPlanBlock.delete({ where: { id: blockId } });
}
