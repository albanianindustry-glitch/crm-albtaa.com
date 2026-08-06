import { prisma } from "@/lib/prisma";

export async function getStaffUserByEmail(email: string) {
  return prisma.staffUser.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { businesses: { select: { id: true } } }
  });
}
