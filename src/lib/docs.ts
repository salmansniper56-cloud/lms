import { supabase } from "@/integrations/supabase/client";
import { getUploadSignature } from "@/lib/cloudinary.functions";

export type Doc = { id: string; name: string; folder: string; size_bytes: number; storage_path: string; created_at: string; owner_id: string; mime_type: string | null };

export async function uploadDoc(file: File, folder = "General"): Promise<Doc> {
  if (!/\.(docx?|DOCX?)$/.test(file.name)) throw new Error("Only Word documents (.docx, .doc) are allowed.");
  if (file.size > 50 * 1024 * 1024) throw new Error("Files must be 50 MB or smaller.");
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user!.id;

  const sig = await getUploadSignature({ data: { folder } });
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/raw/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error("Upload failed. Please try again.");
  const uploaded = (await res.json()) as { public_id: string; bytes: number };

  const { data, error } = await supabase
    .from("documents")
    .insert({ owner_id: uid, name: file.name, folder: folder || "General", storage_path: uploaded.public_id, size_bytes: uploaded.bytes || file.size, mime_type: file.type || null })
    .select("*")
    .single();
  if (error) {
    throw new Error(error.message.includes("Storage limit") ? "Your storage is full. Delete some files to upload more." : error.message);
  }
  return data as Doc;
}

async function authFetch(url: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("Could not download file");
  return res.blob();
}

export async function downloadBlob(docId: string) {
  return authFetch(`/api/doc-download?id=${encodeURIComponent(docId)}`);
}

export async function saveFile(doc: { id: string; name: string }) {
  const blob = await downloadBlob(doc.id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function docToHtml(docId: string) {
  const blob = await downloadBlob(docId);
  const mammoth = await import("mammoth");
  const { value } = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
  return value;
}
