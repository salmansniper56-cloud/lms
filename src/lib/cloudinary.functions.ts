import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHash } from "crypto";

function cloudConfig() {
  const cloudName = process.env["CLOUDINARY_CLOUD_NAME"]!;
  const apiKey = process.env["CLOUDINARY_API_KEY"]!;
  const apiSecret = process.env["CLOUDINARY_API_SECRET"]!;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloud storage is not configured.");
  return { cloudName, apiKey, apiSecret };
}

export function signParams(params: Record<string, string | number>, apiSecret: string) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}

export const getUploadSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { folder: string }) => input)
  .handler(async ({ data, context }) => {
    const { cloudName, apiKey, apiSecret } = cloudConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `numl/${context.userId}/${data.folder.replace(/[^\w\-]+/g, "_") || "General"}`;
    const signature = signParams({ folder, timestamp }, apiSecret);
    return { cloudName, apiKey, timestamp, folder, signature };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("documents")
      .select("id, storage_path")
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .single();
    if (error || !doc) throw new Error("Document not found.");
    const { cloudName, apiKey, apiSecret } = cloudConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signParams({ public_id: doc.storage_path, timestamp }, apiSecret);
    const body = new URLSearchParams({
      public_id: doc.storage_path,
      api_key: apiKey,
      timestamp: String(timestamp),
      signature,
    });
    await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/destroy`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }).catch(() => null);
    const { error: delErr } = await context.supabase.from("documents").delete().eq("id", data.id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });
