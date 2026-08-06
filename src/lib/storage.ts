import { createClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_DOCUMENTS_BUCKET || "documents";

let client: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    // Service role key — server-only, never exposed to the client.
    // Required because documents must not be publicly listable/
    // readable; access goes through signed URLs we generate here.
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
    }
    client = createClient(url, key);
  }
  return client;
}

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp"
]);

export function validateUpload(mimeType: string, sizeBytes: number): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: `File type ${mimeType} is not allowed.` };
  }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: "File exceeds the 15MB size limit." };
  }
  return { ok: true };
}

export async function uploadDocumentFile(
  storagePath: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, fileBuffer, {
    contentType: mimeType,
    upsert: false
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function getSignedDownloadUrl(storagePath: string, expiresInSeconds = 300): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data) throw new Error(`Failed to create signed URL: ${error?.message}`);
  return data.signedUrl;
}

export function buildStoragePath(businessSlug: string, submissionId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${businessSlug}/${submissionId}/${Date.now()}-${safeName}`;
}
