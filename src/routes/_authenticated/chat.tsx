import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { initials } from "@/lib/use-profile";
import { createConversation, findOrCreateDm, myId } from "@/lib/chat";
import { Search, UserPlus, Check, X, Users, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat Room — NUML Scholar" }, { name: "description", content: "Find people by NUML ID, chat and share documents." }, { property: "og:title", content: "Chat Room — NUML Scholar" }, { property: "og:description", content: "Find people by NUML ID, chat and share documents." }] }),
  component: ChatLayout,
});

type P = { id: string; full_name: string; numl_id: string; role: string; avatar_url: string | null };

function PersonRow({ p, right }: { p: P; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent">
      <Avatar className="h-9 w-9">{p.avatar_url && <AvatarImage src={p.avatar_url} />}<AvatarFallback className="text-xs">{initials(p.full_name)}</AvatarFallback></Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{p.full_name}</div>
        <div className="truncate text-xs capitalize text-muted-foreground">{p.numl_id} · {p.role}</div>
      </div>
      {right}
    </div>
  );
}

function ChatLayout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [groupOpen, setGroupOpen] = useState(false);
  const { data: me } = useQuery({ queryKey: ["uid"], queryFn: myId });

  const convs = useQuery({
    queryKey: ["conversations"],
    enabled: !!me,
    queryFn: async () => {
      const { data: mems } = await supabase.from("conversation_members").select("conversation_id,last_read_at").eq("user_id", me!);
      const ids = (mems ?? []).map((m) => m.conversation_id);
      if (!ids.length) return [];
      const [{ data: cs }, { data: allMembers }, { data: lastMsgs }] = await Promise.all([
        supabase.from("conversations").select("*").in("id", ids).order("updated_at", { ascending: false }),
        supabase.from("conversation_members").select("conversation_id,user_id").in("conversation_id", ids),
        supabase.from("messages").select("conversation_id,body,created_at,sender_id,document_id").in("conversation_id", ids).order("created_at", { ascending: false }).limit(500),
      ]);
      const otherIds = [...new Set((allMembers ?? []).map((m) => m.user_id).filter((u) => u !== me))];
      const { data: profs } = otherIds.length ? await supabase.from("profiles").select("id,full_name,numl_id,role,avatar_url").in("id", otherIds) : { data: [] as P[] };
      const pmap = new Map((profs ?? []).map((p) => [p.id, p as P]));
      return (cs ?? []).map((c) => {
        const others = (allMembers ?? []).filter((m) => m.conversation_id === c.id && m.user_id !== me).map((m) => pmap.get(m.user_id)).filter(Boolean) as P[];
        const readAt = mems!.find((m) => m.conversation_id === c.id)!.last_read_at;
        const msgs = (lastMsgs ?? []).filter((m) => m.conversation_id === c.id);
        const unread = msgs.filter((m) => m.sender_id !== me && m.created_at > readAt).length;
        const last = msgs[0];
        return { ...c, others, unread, last, name: c.is_group ? c.title || "Group" : others[0]?.full_name || "Chat" };
      });
    },
  });

  const contacts = useQuery({
    queryKey: ["contacts"],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("*");
      const ids = [...new Set((data ?? []).flatMap((c) => [c.requester_id, c.addressee_id]).filter((u) => u !== me))];
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id,full_name,numl_id,role,avatar_url").in("id", ids) : { data: [] as P[] };
      const pmap = new Map((profs ?? []).map((p) => [p.id, p as P]));
      return (data ?? []).map((c) => ({ ...c, other: pmap.get(c.requester_id === me ? c.addressee_id : c.requester_id)!, incoming: c.addressee_id === me })).filter((c) => c.other);
    },
  });

  const search = useQuery({
    queryKey: ["people-search", q],
    enabled: q.trim().length >= 2 && !!me,
    queryFn: async () => {
      const term = q.trim().replace(/[%,()]/g, "");
      const { data } = await supabase.from("profiles").select("id,full_name,numl_id,role,avatar_url").or(`numl_id.ilike.%${term}%,full_name.ilike.%${term}%`).neq("id", me!).limit(20);
      return (data ?? []) as P[];
    },
  });

  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel("chat-sidebar")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => qc.invalidateQueries({ queryKey: ["conversations"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, () => qc.invalidateQueries({ queryKey: ["contacts"] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_members" }, () => qc.invalidateQueries({ queryKey: ["conversations"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me, qc]);

  const contactOf = (id: string) => contacts.data?.find((c) => c.other.id === id);

  async function request(p: P) {
    const { error } = await supabase.from("contacts").insert({ requester_id: me!, addressee_id: p.id });
    if (error) toast.error(error.message.includes("duplicate") ? "Request already sent" : error.message);
    else toast.success(`Request sent to ${p.full_name}`);
    qc.invalidateQueries({ queryKey: ["contacts"] });
  }
  async function respond(id: string, status: "accepted" | "blocked" | "delete") {
    if (status === "delete") await supabase.from("contacts").delete().eq("id", id);
    else await supabase.from("contacts").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["contacts"] });
  }
  async function openDm(p: P) {
    try {
      const id = await findOrCreateDm(p.id);
      qc.invalidateQueries({ queryKey: ["conversations"] });
      navigate({ to: "/chat/$conversationId", params: { conversationId: id } });
    } catch (e: any) { toast.error(e.message); }
  }

  const accepted = (contacts.data ?? []).filter((c) => c.status === "accepted");
  const incoming = (contacts.data ?? []).filter((c) => c.status === "pending" && c.incoming);

  const inConv = useRouterState({ select: (r) => r.location.pathname !== "/chat" && r.location.pathname !== "/chat/" });
  return (
    <div className="flex h-full">
      <aside className={`${inConv ? "hidden md:flex" : "flex"} w-full md:max-w-sm shrink-0 flex-col border-r bg-card`}>
        <div className="flex items-center justify-between p-4 pb-2">
          <h1 className="text-xl font-semibold">Chat Room</h1>
          <Button size="sm" variant="outline" onClick={() => setGroupOpen(true)}><Users className="mr-1 h-4 w-4" /> New group</Button>
        </div>
        <Tabs defaultValue="chats" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-4">
            <TabsTrigger value="chats">Chats</TabsTrigger>
            <TabsTrigger value="people">Find people</TabsTrigger>
            <TabsTrigger value="requests">Requests {incoming.length > 0 && <span className="ml-1 rounded-full bg-gold px-1.5 text-[10px] text-gold-foreground">{incoming.length}</span>}</TabsTrigger>
          </TabsList>
          <TabsContent value="chats" className="min-h-0 flex-1 overflow-y-auto px-2">
            {(convs.data ?? []).map((c) => (
              <Link key={c.id} to="/chat/$conversationId" params={{ conversationId: c.id }} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-accent" activeProps={{ className: "bg-accent" }}>
                <Avatar className="h-10 w-10">
                  {!c.is_group && c.others[0]?.avatar_url && <AvatarImage src={c.others[0].avatar_url} />}
                  <AvatarFallback className="text-xs">{c.is_group ? <Users className="h-4 w-4" /> : initials(c.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2"><span className="truncate text-sm font-medium">{c.name}</span>{c.last && <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(c.last.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}</div>
                  <div className="flex justify-between gap-2"><span className="truncate text-xs text-muted-foreground">{c.last ? (c.last.document_id ? "📎 Document" : c.last.body) : "No messages yet"}</span>{c.unread > 0 && <span className="shrink-0 rounded-full bg-gold px-1.5 text-[10px] font-semibold text-gold-foreground">{c.unread}</span>}</div>
                </div>
              </Link>
            ))}
            {convs.data?.length === 0 && <p className="p-4 text-sm text-muted-foreground">No chats yet. Find people by their NUML ID to start.</p>}
            {accepted.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <p className="px-2 pb-1 text-xs font-semibold uppercase text-muted-foreground">Contacts</p>
                {accepted.map((c) => <PersonRow key={c.id} p={c.other} right={<Button size="icon" variant="ghost" onClick={() => openDm(c.other)}><MessageCircle className="h-4 w-4" /></Button>} />)}
              </div>
            )}
          </TabsContent>
          <TabsContent value="people" className="min-h-0 flex-1 overflow-y-auto px-2">
            <div className="relative px-2 pb-2">
              <Search className="absolute left-5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by NUML ID or name" className="pl-9" />
            </div>
            {q.trim().length < 2 && <p className="px-3 text-xs text-muted-foreground">Type at least 2 characters. Only people who have signed in to NUML Scholar appear here.</p>}
            {(search.data ?? []).map((p) => {
              const c = contactOf(p.id);
              return (
                <PersonRow key={p.id} p={p} right={
                  c?.status === "accepted" ? <Button size="sm" onClick={() => openDm(p)}>Message</Button>
                  : c?.status === "pending" ? <span className="text-xs text-muted-foreground">{c.incoming ? "Wants to connect" : "Requested"}</span>
                  : c?.status === "blocked" ? <span className="text-xs text-muted-foreground">Blocked</span>
                  : <Button size="sm" variant="outline" onClick={() => request(p)}><UserPlus className="mr-1 h-4 w-4" /> Connect</Button>
                } />
              );
            })}
            {search.data?.length === 0 && <p className="px-3 text-sm text-muted-foreground">No one found.</p>}
          </TabsContent>
          <TabsContent value="requests" className="min-h-0 flex-1 overflow-y-auto px-2">
            {incoming.length === 0 && <p className="p-3 text-sm text-muted-foreground">No pending requests.</p>}
            {incoming.map((c) => (
              <PersonRow key={c.id} p={c.other} right={
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => respond(c.id, "accepted")} aria-label="Accept"><Check className="h-4 w-4 text-success" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => respond(c.id, "delete")} aria-label="Decline"><X className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => respond(c.id, "blocked")}>Block</Button>
                </div>
              } />
            ))}
          </TabsContent>
        </Tabs>
      </aside>
      <div className={`${inConv ? "block" : "hidden md:block"} min-w-0 flex-1`}><Outlet /></div>
      <NewGroupDialog open={groupOpen} onOpenChange={setGroupOpen} contacts={accepted.map((c) => c.other)} onCreate={async (title, ids) => {
        try {
          const id = await createConversation(ids, true, title);
          qc.invalidateQueries({ queryKey: ["conversations"] });
          setGroupOpen(false);
          navigate({ to: "/chat/$conversationId", params: { conversationId: id } });
        } catch (e: any) { toast.error(e.message); }
      }} />
    </div>
  );
}

function NewGroupDialog({ open, onOpenChange, contacts, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; contacts: P[]; onCreate: (title: string, ids: string[]) => void }) {
  const [title, setTitle] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New group chat</DialogTitle></DialogHeader>
        <Input placeholder="Group name (e.g. BSCS-5A)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="max-h-72 overflow-y-auto">
          {contacts.length === 0 && <p className="text-sm text-muted-foreground">Add contacts first to build a group.</p>}
          {contacts.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-2">
              <Checkbox checked={sel.includes(p.id)} onCheckedChange={(v) => setSel(v ? [...sel, p.id] : sel.filter((s) => s !== p.id))} />
              <div className="flex-1"><PersonRow p={p} /></div>
            </label>
          ))}
        </div>
        <Button disabled={!title.trim() || sel.length === 0} onClick={() => onCreate(title.trim(), sel)}>Create group</Button>
      </DialogContent>
    </Dialog>
  );
}
