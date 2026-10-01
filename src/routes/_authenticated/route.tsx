import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) return { user: data.user };
    } catch {}

    const local = typeof window !== 'undefined' ? localStorage.getItem('numl_user') : null;
    if (local) {
      try {
        return { user: JSON.parse(local) };
      } catch {}
    }
    throw redirect({ to: '/auth' });
  },
  component: AppShell,
});
