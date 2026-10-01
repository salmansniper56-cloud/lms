import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { signParams } from "@/lib/cloudinary.functions";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/doc-download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });
        const url = new URL(request.url);
        const docId = url.searchParams.get("id");
        if (!docId) return new Response("Missing id", { status: 400 });

        const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          auth: { persistSession: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData } = await supabase.auth.getUser(token);
        if (!userData.user) return new Response("Unauthorized", { status: 401 });

        const { data: doc } = await supabase
          .from("documents")
          .select("name, storage_path, mime_type")
          .eq("id", docId)
          .single();
        if (!doc) return new Response("Not found", { status: 404 });

        const cloudName = process.env["CLOUDINARY_CLOUD_NAME"]!;
        const apiKey = process.env["CLOUDINARY_API_KEY"]!;
        const apiSecret = process.env["CLOUDINARY_API_SECRET"]!;
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = signParams({ public_id: doc.storage_path, timestamp }, apiSecret);
        const body = new URLSearchParams({
          public_id: doc.storage_path,
          api_key: apiKey,
          timestamp: String(timestamp),
          signature,
        });
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/download`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        if (!res.ok) return new Response("Could not fetch file", { status: 502 });
        const bytes = await res.arrayBuffer();
        return new Response(bytes, {
          headers: {
            "Content-Type": doc.mime_type || "application/octet-stream",
            "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.name)}"`,
          },
        });
      },
    },
  },
});
