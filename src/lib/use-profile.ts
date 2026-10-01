import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  numl_id: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  moodle_user_id: number;
};

export function useProfile() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      try {
        const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
        if (data) return data as Profile;
      } catch {}

      const meta = u.user.user_metadata || {};
      return {
        id: u.user.id,
        numl_id: meta.numl_id || "",
        full_name: meta.full_name || u.user.email?.split("@")[0] || "Student",
        role: meta.role || "student",
        avatar_url: meta.avatar_url || null,
        moodle_user_id: meta.moodle_user_id || 0,
      } as Profile;
    },
    staleTime: 60_000,
  });
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return `${n.toFixed(n < 10 ? 1 : 0)} ${u[i]}`;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
}
