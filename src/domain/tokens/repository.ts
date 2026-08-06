import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface CreateAccessTokenInput {
  contactId: string;
  submissionId?: string;
  tokenHash: string;
  expiresAt?: Date | null;
}

export async function createAccessToken(input: CreateAccessTokenInput) {
  return prisma.accessToken.create({ data: input });
}

export async function findTokenByHash(tokenHash: string) {
  return prisma.accessToken.findUnique({
    where: { tokenHash },
    include: {
      contact: true,
      submission: { include: { currentStage: true, form: true, documents: { include: { documentType: true } } } }
    }
  });
}

export async function markTokenUsed(tokenId: string) {
  return prisma.accessToken.update({
    where: { id: tokenId },
    data: { lastUsedAt: new Date(), useCount: { increment: 1 } }
  });
}

export async function revokeAllTokensForContact(
  contactId: string,
  tx: Prisma.TransactionClient = prisma
) {
  return tx.accessToken.updateMany({
    where: { contactId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}
