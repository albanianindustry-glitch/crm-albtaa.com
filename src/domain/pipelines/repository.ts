import { prisma } from "@/lib/prisma";

export async function getDefaultPipelineWithStages(businessId: string) {
  return prisma.pipeline.findFirst({
    where: { businessId, isDefault: true },
    include: { stages: { orderBy: { order: "asc" } } }
  });
}

export async function getPipelineStageByKey(businessId: string, pipelineId: string, key: string) {
  return prisma.pipelineStage.findUnique({
    where: { pipelineId_key: { pipelineId, key } }
  });
}

export async function listPipelinesForBusiness(businessId: string) {
  return prisma.pipeline.findMany({
    where: { businessId },
    include: { stages: { orderBy: { order: "asc" } } }
  });
}

export async function getStageById(businessId: string, stageId: string) {
  return prisma.pipelineStage.findFirst({ where: { id: stageId, businessId } });
}
