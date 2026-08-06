"use client";

import { useEffect, useState, useCallback } from "react";

interface PortalData {
  contact: { firstName: string; lastName: string; email: string };
  business: { name: string; branding: { primaryColor?: string } } | null;
  submission: {
    id: string;
    currentStage: { key: string; label: string } | null;
    documents: { id: string; fileName: string; status: string; documentTypeKey: string; documentTypeLabel: string }[];
  } | null;
  documentTypes: { id: string; key: string; label: string; isRequired: boolean }[];
}

export default function PortalPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/v1/portal/${params.token}`);
      const json = await res.json();
      if (!res.ok) {
        setError(
          json.error === "NOT_FOUND"
            ? "This link is not valid."
            : "This link is no longer active. Please contact us for a new one."
        );
        return;
      }
      setData(json);
    } catch {
      setError("Could not load your request. Please try again.");
    }
  }, [params.token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(documentTypeKey: string, file: File) {
    setUploadingKey(documentTypeKey);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("documentTypeKey", documentTypeKey);
      formData.append("file", file);

      const res = await fetch(`/api/v1/portal/${params.token}/documents`, {
        method: "POST",
        body: formData
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      await load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingKey(null);
    }
  }

  if (error) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <h1>Unable to load</h1>
          <p className="sub">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <p className="sub">Loading…</p>
        </div>
      </div>
    );
  }

  const primaryColor = data.business?.branding?.primaryColor || "#0e1b2e";

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)" }}>
      <div style={{ background: primaryColor, color: "white", padding: "24px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>{data.business?.name}</div>
          <h1 style={{ margin: "4px 0 0", fontSize: "1.3rem" }}>
            Hi {data.contact.firstName}, here&apos;s where things stand
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 24px" }}>
        {data.submission?.currentStage && (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: 18,
              marginBottom: 24
            }}
          >
            <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)", marginBottom: 4 }}>Current status</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{data.submission.currentStage.label}</div>
          </div>
        )}

        {data.documentTypes.length > 0 && (
          <div>
            <h2 style={{ fontSize: "1rem", marginBottom: 12 }}>Documents</h2>
            {uploadError && <div className="error-msg">{uploadError}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {data.documentTypes.map((dt) => {
                const uploaded = data.submission?.documents.filter((d) => d.documentTypeKey === dt.key) ?? [];
                return (
                  <div
                    key={dt.id}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      padding: 16
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                          {dt.label} {dt.isRequired && <span style={{ color: "var(--danger)" }}>*</span>}
                        </div>
                        {uploaded.length > 0 && (
                          <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)", marginTop: 4 }}>
                            {uploaded.map((u) => `${u.fileName} (${u.status.toLowerCase()})`).join(", ")}
                          </div>
                        )}
                      </div>
                      <label
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          padding: "6px 14px",
                          borderRadius: 100,
                          border: "1px solid var(--border)",
                          cursor: "pointer",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {uploadingKey === dt.key ? "Uploading…" : uploaded.length > 0 ? "Upload another" : "Upload"}
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
                          style={{ display: "none" }}
                          disabled={uploadingKey === dt.key}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload(dt.key, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p style={{ marginTop: 32, fontSize: "0.8rem", color: "var(--ink-soft)" }}>
          This link is unique to you. If you didn&apos;t request this, please disregard it.
        </p>
      </div>
    </div>
  );
}
