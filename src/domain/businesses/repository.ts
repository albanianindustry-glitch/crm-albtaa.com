import { prisma } from "@/lib/prisma";
import { SessionPayload } from "@/lib/auth/session";

export async function listBusinessesForStaff(session: SessionPayload) {
  return prisma.business.findMany({
    where: {
      isActive: true,
      ...(session.businessIds.length > 0 ? { id: { in: session.businessIds } } : {})
    },
    orderBy: { name: "asc" }
  });
}

export async function getBusinessBySlug(slug: string) {
  return prisma.business.findUnique({ where: { slug } });
}

export async function getBusinessById(id: string) {
  return prisma.business.findUnique({ where: { id } });
}

export async function getBusinessByApiKeyHash(hash: string) {
  return prisma.business.findUnique({ where: { apiKeyHash: hash } });
}

export async function listAllActiveBusinessIds(): Promise<string[]> {
  const businesses = await prisma.business.findMany({ where: { isActive: true }, select: { id: true } });
  return businesses.map((b: { id: string }) => b.id);
}

export async function listBusinessesByIds(ids: string[]) {
  return prisma.business.findMany({ where: { id: { in: ids } } });
}
