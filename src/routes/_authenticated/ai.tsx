import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

import {
  getStoredThreads,
  getStoredThread,
  createStoredThread,
  deleteStoredThread,
  saveStoredThreadMessages,
  type StoredThread,
} from "@/lib/ai-history";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({
    meta: [
      { title: "AI Assistant — NUML Scholar" },
      { name: "description", content: "Plan, study and draft with NUML Scholar AI." },
      { property: "og:title", content: "AI Assistant — NUML Scholar" },
      { property: "og:description", content: "Plan, study and draft with NUML Scholar AI." },
    ],
  }),
  component: AiLayout,
});

export function useThreads() {
  return useQuery({
    queryKey: ["ai-threads"],
    queryFn: async (): Promise<StoredThread[]> => {
      // Return local stored threads
      return getStoredThreads();
    },
  });
}

export async function createThread(title = "New conversation", initialPrompt?: string): Promise<string> {
  const t = createStoredThread(title, initialPrompt);
  return t.id;
}

function AiLayout() {
  const { data: threads } = useThreads();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function newThread() {
    const id = await createThread();
    qc.invalidateQueries({ queryKey: ["ai-threads"] });
    navigate({ to: "/ai/$threadId", params: { threadId: id } });
  }

  async function del(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    deleteStoredThread(id);
    qc.invalidateQueries({ queryKey: ["ai-threads"] });
    navigate({ to: "/ai" });
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col border-r bg-card">
        <div className="p-3">
          <Button onClick={newThread} className="w-full">
            <Plus className="mr-1 h-4 w-4" /> New chat
          </Button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {(threads ?? []).map((t) => (
            <div key={t.id} className="group flex items-center rounded-lg hover:bg-accent">
              <Link
                to="/ai/$threadId"
                params={{ threadId: t.id }}
                className="min-w-0 flex-1 truncate px-3 py-2 text-sm"
                activeProps={{ className: "font-semibold bg-accent/80 text-primary" }}
              >
                {t.title || "New conversation"}
              </Link>
              <button
                onClick={(e) => del(e, t.id)}
                className="px-2 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
          {(threads ?? []).length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground text-center">No previous chats yet.</p>
          )}
        </div>
      </aside>
      <div className="min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
