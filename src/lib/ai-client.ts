import { supabase } from "@/integrations/supabase/client";

export type ChatMsg = { role: "user" | "assistant"; content: string };

export async function streamAi(
  messages: ChatMsg[],
  onDelta: (text: string) => void,
  signal?: AbortSignal | undefined,
): Promise<void> {
  let token: string | null | undefined = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
  } catch {}
  if (!token && typeof window !== "undefined") {
    token = localStorage.getItem("numl_token");
  }

  const res = await fetch("/api/ai-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
    body: JSON.stringify({ messages }),
    signal: signal ?? null,
  });
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || "AI request failed");
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let fullContent = "";
  let fullReasoning = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const l = line.trim();
      if (!l.startsWith("data:")) continue;
      const payload = l.slice(5).trim();
      if (payload === "[DONE]") {
        if (!fullContent && fullReasoning) {
          onDelta(fullReasoning);
        }
        return;
      }
      try {
        const j = JSON.parse(payload);
        const delta = j.choices?.[0]?.delta;
        const d = delta?.content;
        const r = delta?.reasoning_content;

        if (d) {
          fullContent += d;
          onDelta(d);
        } else if (r) {
          fullReasoning += r;
        }
      } catch {
        /* partial */
      }
    }
  }

  if (!fullContent && fullReasoning) {
    onDelta(fullReasoning);
  }
}
