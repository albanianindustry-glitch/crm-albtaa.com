import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface ContactInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

/**
 * Finds an existing Contact by email within this business, or creates
 * one. This is how one client submitting multiple forms over time
 * (or coming back a year later) resolves to a single person rather
 * than duplicate rows. `businessId` is required and always the first
 * argument — never optional — so cross-business leakage is
 * structurally hard to introduce here.
 */
export async function findOrCreateContact(
  businessId: string,
  input: ContactInput,
  tx: Prisma.TransactionClient = prisma
) {
  const email = input.email.toLowerCase().trim();

  const existing = await tx.contact.findUnique({
    where: { businessId_email: { businessId, email } }
  });

  if (existing) {
    // Keep name/phone reasonably fresh if the client gave new values.
    return tx.contact.update({
      where: { id: existing.id },
      data: {
        firstName: input.firstName || existing.firstName,
        lastName: input.lastName || existing.lastName,
        phone: input.phone ?? existing.phone
      }
    });
  }

  return tx.contact.create({
    data: {
      businessId,
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone
    }
  });
}

export async function getContactById(businessId: string, contactId: string) {
  return prisma.contact.findFirst({ where: { id: contactId, businessId } });
}

export async function countRecentSubmissionsByEmail(
  businessId: string,
  email: string,
  sinceMs: number
): Promise<number> {
  const contact = await prisma.contact.findUnique({
    where: { businessId_email: { businessId, email: email.toLowerCase().trim() } },
    select: { id: true }
  });
  if (!contact) return 0;

  return prisma.submission.count({
    where: {
      businessId,
      contactId: contact.id,
      createdAt: { gte: new Date(Date.now() - sinceMs) }
    }
  });
}
