import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { myId } from "@/lib/chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DocPreview } from "@/components/doc-preview";
import { uploadDoc, type Doc } from "@/lib/docs";
import { formatBytes } from "@/lib/use-profile";
import { ArrowLeft, FileText, Paperclip, Send, Upload, CheckCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat/$conversationId")({
  component: ConversationPage,
});

type Msg = { id: string; sender_id: string; body: string; document_id: string | null; created_at: string };

function ConversationPage() {
  const { conversationId } = Route.useParams();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [typing, setTyping] = useState<string | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [preview, setPreview] = useState<Doc | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTyped = useRef(0);
  const { data: me } = useQuery({ queryKey: ["uid"], queryFn: myId });

  const meta = useQuery({
    queryKey: ["conv-meta", conversationId],
    queryFn: async () => {
      const { data: c } = await supabase.from("conversations").select("*").eq("id", conversationId).maybeSingle();
      const { data: mems } = await supabase.from("conversation_members").select("user_id,last_read_at").eq("conversation_id", conversationId);
      const ids = (mems ?? []).map((m) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("id,full_name,numl_id").in("id", ids);
      return { conv: c, members: mems ?? [], profiles: new Map((profs ?? []).map((p) => [p.id, p])) };
    },
  });

  const msgs = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at").limit(500);
      if (error) throw error;
      return data as Msg[];
    },
  });

  const docIds = [...new Set((msgs.data ?? []).map((m) => m.document_id).filter(Boolean))] as string[];
  const docs = useQuery({
    queryKey: ["chat-docs", conversationId, docIds.join(",")],
    enabled: docIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("documents").select("*").in("id", docIds);
      return new Map((data ?? []).map((d) => [d.id, d as Doc]));
    },
  });

  // realtime messages + typing
  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel(`conv:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (p) => {
        qc.setQueryData<Msg[]>(["messages", conversationId], (old) => (old?.some((m) => m.id === (p.new as Msg).id) ? old : [...(old ?? []), p.new as Msg]));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_members", filter: `conversation_id=eq.${conversationId}` }, () => {
        qc.invalidateQueries({ queryKey: ["conv-meta", conversationId] });
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.user === me) return;
        setTyping(payload.name);
        setTimeout(() => setTyping(null), 2500);
      })
      .subscribe();
    chanRef.current = ch;
    return () => { supabase.removeChannel(ch); chanRef.current = null; };
  }, [conversationId, me, qc]);

  // mark read
  useEffect(() => {
    if (!me || !msgs.data) return;
    supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", conversationId).eq("user_id", me).then(() => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    });
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.data?.length, me, conversationId, qc]);

  async function send(body: string, documentId: string | null = null) {
    if (!body.trim() && !documentId) return;
    setText("");
    const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: me!, body: body.trim(), document_id: documentId });
    if (error) toast.error(error.message);
  }

  function onType(v: string) {
    setText(v);
    if (Date.now() - lastTyped.current > 1500 && chanRef.current && me) {
      lastTyped.current = Date.now();
      const name = meta.data?.profiles.get(me)?.full_name ?? "Someone";
      chanRef.current.send({ type: "broadcast", event: "typing", payload: { user: me, name } });
    }
  }

  const c = meta.data?.conv;
  const others = (meta.data?.members ?? []).filter((m) => m.user_id !== me);
  const title = c?.is_group ? c.title : others.map((o) => meta.data?.profiles.get(o.user_id)?.full_name).join(", ");
  const lastMine = [...(msgs.data ?? [])].reverse().find((m) => m.sender_id === me);
  const seen = lastMine && others.length > 0 && others.every((o) => o.last_read_at >= lastMine.created_at);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-5 py-3">
        <Link to="/chat" className="md:hidden"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <div className="font-semibold">{title || "Chat"}</div>
          <div className="text-xs text-muted-foreground">{typing ? `${typing} is typing…` : c?.is_group ? `${meta.data?.members.length} members` : others.map((o) => meta.data?.profiles.get(o.user_id)?.numl_id).join(", ")}</div>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-5">
        {(msgs.data ?? []).map((m) => {
          const mine = m.sender_id === me;
          const doc = m.document_id ? docs.data?.get(m.document_id) : null;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-md px-4 py-2 text-sm ${mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted"}`}>
                {c?.is_group && !mine && <div className="mb-0.5 text-xs font-semibold opacity-70">{meta.data?.profiles.get(m.sender_id)?.full_name}</div>}
                {m.document_id && (
                  <button onClick={() => doc && setPreview(doc)} className="mb-1 flex items-center gap-2 rounded-lg bg-background/20 p-2 text-left">
                    <FileText className="h-6 w-6" />
                    <div><div className="font-medium">{doc?.name ?? "Document"}</div>{doc && <div className="text-xs opacity-70">{formatBytes(doc.size_bytes)} · tap to open</div>}</div>
                  </button>
                )}
                {m.body && <div className="whitespace-pre-wrap">{m.body}</div>}
                <div className="mt-0.5 text-right text-[10px] opacity-60">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            </div>
          );
        })}
        {seen && <div className="flex justify-end text-[11px] text-muted-foreground"><CheckCheck className="mr-1 h-3.5 w-3.5" /> Seen</div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex items-center gap-2 border-t p-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => setPickOpen(true)} aria-label="Share document"><Paperclip className="h-4 w-4" /></Button>
        <Input value={text} onChange={(e) => onType(e.target.value)} placeholder="Write a message…" autoFocus />
        <Button type="submit" size="icon" disabled={!text.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
      </form>
      <DocPicker open={pickOpen} onOpenChange={setPickOpen} me={me} onPick={(d) => { setPickOpen(false); send("", d.id); }} />
      <DocPreview doc={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function DocPicker({ open, onOpenChange, me, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; me?: string | undefined; onPick: (d: Doc) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["documents", me],
    enabled: open && !!me,
    queryFn: async () => (await supabase.from("documents").select("*").eq("owner_id", me!).order("created_at", { ascending: false })).data as Doc[],
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Share a document</DialogTitle></DialogHeader>
        <input ref={fileRef} type="file" accept=".docx,.doc" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            const d = await uploadDoc(f, "Shared in chat");
            qc.invalidateQueries({ queryKey: ["documents"] });
            onPick(d);
          } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
        }} />
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}><Upload className="mr-1 h-4 w-4" /> Upload new DOCX</Button>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {(data ?? []).map((d) => (
            <button key={d.id} onClick={() => onPick(d)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-accent">
              <FileText className="h-5 w-5 text-chart-5" />
              <div className="min-w-0"><div className="truncate text-sm font-medium">{d.name}</div><div className="text-xs text-muted-foreground">{d.folder} · {formatBytes(d.size_bytes)}</div></div>
            </button>
          ))}
          {data?.length === 0 && <p className="text-sm text-muted-foreground">No documents in your library yet.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
