import { NextRequest, NextResponse } from "next/server";
import { validateAccessToken } from "@/domain/tokens/service";
import { uploadDocumentViaPortal } from "@/domain/documents/service";
import { getBusinessById } from "@/domain/businesses/repository";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const tokenResult = await validateAccessToken(params.token);
  if (!tokenResult.valid) {
    const status = tokenResult.reason === "NOT_FOUND" ? 404 : 410;
    return NextResponse.json({ error: tokenResult.reason }, { status });
  }

  if (!tokenResult.submission) {
    return NextResponse.json({ error: "This link is not associated with a request" }, { status: 400 });
  }

  const business = await getBusinessById(tokenResult.submission.businessId);
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const documentTypeKey = formData.get("documentTypeKey");
  const file = formData.get("file");

  if (typeof documentTypeKey !== "string" || !documentTypeKey) {
    return NextResponse.json({ error: "Missing documentTypeKey" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const result = await uploadDocumentViaPortal({
    business,
    submissionId: tokenResult.submission.id,
    documentTypeKey,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileBuffer: buffer
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, documentId: result.documentId });
}
