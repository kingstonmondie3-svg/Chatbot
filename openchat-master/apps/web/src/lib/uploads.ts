import type { UploadResponse } from "@openchat/shared";

export async function uploadFiles(files: File[]): Promise<UploadResponse[]> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const res = await fetch("/api/uploads", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Upload failed");
  }

  return res.json();
}
