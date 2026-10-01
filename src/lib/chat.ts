import { supabase } from "@/integrations/supabase/client";

export async function myId() {
  const { data } = await supabase.auth.getUser();
  return data.user!.id;
}

export async function findOrCreateDm(otherId: string) {
  const me = await myId();
  const { data: mine } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", me);
  const ids = (mine ?? []).map((m) => m.conversation_id);
  if (ids.length) {
    const { data: shared } = await supabase
      .from("conversation_members")
      .select("conversation_id, conversations!inner(is_group)")
      .eq("user_id", otherId)
      .in("conversation_id", ids);
    const dm = (shared ?? []).find((s: any) => !s.conversations?.is_group);
    if (dm) return dm.conversation_id;
  }
  return createConversation([otherId], false, null);
}

export async function createConversation(memberIds: string[], isGroup: boolean, title: string | null) {
  const me = await myId();
  const id = crypto.randomUUID();
  const { error } = await supabase.from("conversations").insert({ id, is_group: isGroup, title, created_by: me });
  if (error) throw error;
  const rows = [me, ...memberIds.filter((m) => m !== me)].map((u) => ({ conversation_id: id, user_id: u }));
  const { error: e2 } = await supabase.from("conversation_members").insert(rows);
  if (e2) throw e2;
  return id;
}
