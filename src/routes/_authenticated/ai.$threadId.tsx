import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AiChatBox } from "@/components/ai-chat-box";
import { Loading, ErrorBox } from "@/components/query-state";
import type { ChatMsg } from "@/lib/ai-client";
import { toast } from "sonner";

import {
  getStoredThread,
  saveStoredThreadMessages,
  createStoredThread,
  type StoredThread,
} from "@/lib/ai-history";

export const Route = createFileRoute("/_authenticated/ai/$threadId")({
  validateSearch: z.object({ prompt: z.string().optional() }),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { prompt } = Route.useSearch();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["ai-thread", threadId],
    queryFn: async () => {
      let t = getStoredThread(threadId);
      if (!t) {
        t = createStoredThread("New conversation", prompt);
      }
      return { thread: t, messages: t.messages ?? [] };
    },
    staleTime: 0,
  });

  async function save(msgs: ChatMsg[]) {
    saveStoredThreadMessages(threadId, msgs);
    const updated = getStoredThread(threadId);
    qc.setQueryData(["ai-thread", threadId], {
      thread: updated,
      messages: msgs,
    });
    qc.invalidateQueries({ queryKey: ["ai-threads"] });
  }

  if (isLoading) return <Loading />;
  return (
    <div className="h-full">
      <AiChatBox
        key={threadId}
        initial={data?.messages ?? []}
        onChange={save}
        autoPrompt={prompt}
      />
    </div>
  );
}
