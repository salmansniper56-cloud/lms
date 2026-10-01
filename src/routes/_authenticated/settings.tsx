import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { useProfile, initials } from "@/lib/use-profile";
import { useI18n, useTheme } from "@/lib/i18n";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — NUML Scholar" }, { name: "description", content: "Your profile and app preferences." }, { property: "og:title", content: "Settings — NUML Scholar" }, { property: "og:description", content: "Your profile and app preferences." }] }),
  component: Settings,
});

function Settings() {
  const { data: me } = useProfile();
  const { lang, setLang } = useI18n();
  const { dark, toggle } = useTheme();
  return (
    <div className="pb-10">
      <PageHeader title="Profile & settings" />
      <div className="mx-6 max-w-2xl space-y-6 md:mx-10">
        <section className="flex items-center gap-4 premium-card p-6">
          <Avatar className="h-16 w-16">{me?.avatar_url && <AvatarImage src={me.avatar_url} />}<AvatarFallback>{initials(me?.full_name || "")}</AvatarFallback></Avatar>
          <div>
            <div className="text-xl font-semibold">{me?.full_name}</div>
            <div className="text-sm capitalize text-muted-foreground">NUML ID {me?.numl_id} · {me?.role}</div>
            <p className="mt-1 text-xs text-muted-foreground">Profile details sync automatically from NUML LMS. Sign out and back in to refresh them.</p>
          </div>
        </section>
        <section className="divide-y premium-card">
          <div className="flex items-center justify-between p-5"><div><div className="font-medium">Dark mode</div><div className="text-sm text-muted-foreground">Easier on the eyes at night</div></div><Switch checked={dark} onCheckedChange={toggle} /></div>
          <div className="flex items-center justify-between p-5"><div><div className="font-medium">Language</div><div className="text-sm text-muted-foreground">Menu language</div></div>
            <div className="flex gap-2"><Button size="sm" variant={lang === "en" ? "default" : "outline"} onClick={() => setLang("en")}>English</Button><Button size="sm" variant={lang === "ur" ? "default" : "outline"} onClick={() => setLang("ur")}>اردو</Button></div>
          </div>
          <div className="flex items-center justify-between p-5">
            <div>
              <div className="font-medium">Academic Integrity</div>
              <div className="text-sm text-muted-foreground">All submitted work must adhere to NUML's academic integrity policy.</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
