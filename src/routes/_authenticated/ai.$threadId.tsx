import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AiChatBox } from "@/components/ai-chat-box";
import { Loading, ErrorBox } from "@/components/query-state";
import type { ChatMsg } from "@/lib/ai-client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ai/$threadId")({
  validateSearch: z.object({ prompt: z.string().optional() }),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { prompt } = Route.useSearch();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["ai-thread", threadId],
    queryFn: async () => {
      const { data: t, error: te } = await supabase.from("ai_threads").select("id,title").eq("id", threadId).maybeSingle();
      if (te) throw te;
      if (!t) throw new Error("Conversation not found");
      const { data: rows, error: me } = await supabase.from("ai_messages").select("message").eq("thread_id", threadId).order("created_at");
      if (me) throw me;
      return { thread: t, messages: (rows ?? []).map((r) => r.message as unknown as ChatMsg) };
    },
    staleTime: Infinity,
  });

  async function save(msgs: ChatMsg[]) {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user!.id;
    const existing = data?.messages.length ?? 0;
    // Append only new messages (tail beyond what is stored)
    const stored = qc.getQueryData<{ messages: ChatMsg[] }>(["ai-thread", threadId])?.messages.length ?? existing;
    const fresh = msgs.slice(stored);
    if (fresh.length) {
      const base = Date.now();
      const { error } = await supabase.from("ai_messages").insert(
        fresh.map((m, i) => ({ thread_id: threadId, user_id: uid, message: m as any, created_at: new Date(base + i).toISOString() })),
      );
      if (error) { toast.error("Could not save conversation"); return; }
    }
    const firstUser = (msgs.find((m) => m.role === "user")?.content.split("\n")[0] ?? "").slice(0, 60);
    await supabase.from("ai_threads").update({
      updated_at: new Date().toISOString(),
      ...(data?.thread.title === "New conversation" && firstUser ? { title: firstUser } : {}),
    }).eq("id", threadId);
    qc.setQueryData(["ai-thread", threadId], (old: any) => ({ ...old, messages: msgs }));
    qc.invalidateQueries({ queryKey: ["ai-threads"] });
  }

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  return (
    <div className="h-full">
      <AiChatBox key={threadId} initial={data!.messages} onChange={save} autoPrompt={prompt} />
    </div>
  );
}
