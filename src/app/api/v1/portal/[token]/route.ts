import { NextRequest, NextResponse } from "next/server";
import { validateAccessToken } from "@/domain/tokens/service";
import { getBusinessById } from "@/domain/businesses/repository";
import { listDocumentTypesForBusiness } from "@/domain/documents/repository";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const result = await validateAccessToken(params.token);

  if (!result.valid) {
    const status = result.reason === "NOT_FOUND" ? 404 : 410; // 410 Gone for revoked/expired
    return NextResponse.json({ error: result.reason }, { status });
  }

  const business = result.submission ? await getBusinessById(result.submission.businessId) : null;
  const documentTypes = business ? await listDocumentTypesForBusiness(business.id) : [];

  return NextResponse.json({
    contact: {
      firstName: result.contact.firstName,
      lastName: result.contact.lastName,
      email: result.contact.email
    },
    business: business ? { name: business.name, branding: business.branding } : null,
    submission: result.submission
      ? {
          id: result.submission.id,
          currentStage: result.submission.currentStage
            ? { key: result.submission.currentStage.key, label: result.submission.currentStage.label }
            : null,
          documents: result.submission.documents.map(
            (d: { id: string; fileName: string; status: string; documentType: { key: string; label: string } }) => ({
              id: d.id,
              fileName: d.fileName,
              status: d.status,
              documentTypeKey: d.documentType.key,
              documentTypeLabel: d.documentType.label
            })
          )
        }
      : null,
    documentTypes: documentTypes.map((dt: { id: string; key: string; label: string; isRequired: boolean }) => ({
      id: dt.id,
      key: dt.key,
      label: dt.label,
      isRequired: dt.isRequired
    }))
  });
}
