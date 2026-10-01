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
  .inputValidator((input: { id: string; storage_path?: string; resource_type?: string }) => input)
  .handler(async ({ data, context }) => {
    let storagePath = data.storage_path;
    if (!storagePath) {
      try {
        const { data: doc } = await context.supabase
          .from("documents")
          .select("id, storage_path")
          .eq("id", data.id)
          .maybeSingle();
        if (doc) storagePath = doc.storage_path;
      } catch {}
    }

    if (storagePath) {
      try {
        const { cloudName, apiKey, apiSecret } = cloudConfig();
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = signParams({ public_id: storagePath, timestamp }, apiSecret);
        const resourceType = data.resource_type || "raw";
        await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            public_id: storagePath,
            api_key: apiKey,
            timestamp: String(timestamp),
            signature,
          }),
        }).catch(() => null);
      } catch {}
    }

    try {
      await context.supabase.from("documents").delete().eq("id", data.id);
    } catch {}

    return { ok: true };
  });
