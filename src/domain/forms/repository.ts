import { prisma } from "@/lib/prisma";

/**
 * Returns the currently active Form + its latest FormVersion + that
 * version's FormFields, for a given business + form slug. This is
 * what the public submission endpoint validates incoming payloads
 * against, and what the (future) form-builder settings UI edits.
 */
export async function getActiveFormWithFields(businessId: string, formSlug: string) {
  const form = await prisma.form.findFirst({
    where: { businessId, slug: formSlug, isActive: true },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: { fields: { orderBy: { order: "asc" } } }
      }
    }
  });

  if (!form || form.versions.length === 0) return null;

  const latestVersion = form.versions[0];
  return { form, formVersion: latestVersion, fields: latestVersion.fields };
}
