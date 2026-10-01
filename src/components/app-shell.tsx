import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  BookOpen, Bell, Bot, CalendarClock, FileText, GraduationCap, LayoutDashboard, LogOut, Menu,
  MessagesSquare, Moon, ClipboardCheck, Award, Search, Settings, Shield, Sun, Presentation, HelpCircle, UserCheck, Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, initials } from "@/lib/use-profile";
import { useI18n, useTheme } from "@/lib/i18n";
import { AiChatBox } from "./ai-chat-box";
import { useQueryClient } from "@tanstack/react-query";
import { getStoredThread, saveStoredThreadMessages } from "@/lib/ai-history";
import type { ChatMsg } from "@/lib/ai-client";

type NavItem = { to: string; label: string; icon: any };

export function AppShell() {
  const { data: me } = useProfile();
  const { t, lang, setLang } = useI18n();
  const { dark, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [q, setQ] = useState("");
  const [quickMessages, setQuickMessages] = useState<ChatMsg[]>(() => {
    return getStoredThread("quick_chat")?.messages ?? [];
  });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const groups: { label: string; items: NavItem[] }[] = [
    { label: "Learning", items: [
      { to: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
      { to: "/courses", label: t("courses"), icon: BookOpen },
      { to: "/assignments", label: t("assignments"), icon: ClipboardCheck },
      { to: "/quizzes", label: "Quizzes", icon: HelpCircle },
      { to: "/calendar", label: t("calendar"), icon: CalendarClock },
      { to: "/grades", label: t("grades"), icon: GraduationCap },
      { to: "/attendance", label: "Attendance", icon: UserCheck },
      { to: "/badges", label: t("badges"), icon: Award },
    ] },
    { label: "Communication", items: [
      { to: "/announcements", label: "Announcements", icon: Megaphone },
      { to: "/notifications", label: t("notifications"), icon: Bell },
      { to: "/chat", label: t("chat"), icon: MessagesSquare },
      { to: "/documents", label: t("documents"), icon: FileText },
    ] },
    ...(me?.role === "teacher" || me?.role === "admin"
      ? [{ label: "Faculty", items: [
          { to: "/teacher", label: "Faculty dashboard", icon: Presentation },
          ...(me?.role === "admin" ? [{ to: "/admin", label: t("admin"), icon: Shield }] : []),
        ] }]
      : []),
    { label: "Other", items: [
      { to: "/ai", label: t("ai"), icon: Bot },
      { to: "/settings", label: t("settings"), icon: Settings },
    ] },
  ];

  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth" });
  }

  const Side = (
    <div className="sidebar-premium flex h-full flex-col text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gold font-display text-base font-bold text-gold-foreground">N</div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-tight">NUML LMS</div>
          <div className="truncate text-[11px] opacity-60">National University of Modern Languages</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-2" dir={lang === "ur" ? "rtl" : "ltr"}>
        {groups.map((g) => (
          <div key={g.label} className="mb-1">
            <div className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider opacity-45">{g.label}</div>
            {g.items.map((n) => (
              <Link
                key={n.to}
                to={n.to as any}
                onClick={() => setMobileOpen(false)}
                className="relative flex items-center gap-2.5 px-4 py-1.5 text-[13px] opacity-80 hover:bg-sidebar-accent hover:opacity-100"
                activeProps={{ className: "nav-active !opacity-100 font-semibold text-sidebar-primary" }}
              >
                <n.icon className="h-[15px] w-[15px] shrink-0" /> {n.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border px-4 py-2 text-[11px] opacity-50">NUML Scholar · Academic Portal</div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-56 shrink-0 lg:block">{Side}</aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0">{Side}</SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b bg-card px-3 md:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Menu"><Menu className="h-5 w-5" /></Button>
          <form
            className="relative mx-auto w-full max-w-lg"
            onSubmit={(e) => { e.preventDefault(); navigate({ to: "/courses", search: { q } }); }}
          >
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search courses"
              className="h-9 w-full rounded border bg-background pl-8 pr-3 text-sm outline-none focus:border-ring"
            />
          </form>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button variant="ghost" size="icon" asChild aria-label="Notifications"><Link to="/notifications"><Bell className="h-4 w-4" /></Link></Button>
            <Button variant="ghost" size="icon" asChild aria-label="Messages"><Link to="/chat"><MessagesSquare className="h-4 w-4" /></Link></Button>
            <Button variant="ghost" size="icon" onClick={() => setAiOpen(true)} aria-label="Study assistant" title="Study assistant"><Bot className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => setLang(lang === "en" ? "ur" : "en")}>{lang === "en" ? "اردو" : "EN"}</Button>
            <DropdownMenu>
              <DropdownMenuTrigger className="ml-1 flex items-center gap-2 rounded px-1.5 py-1 hover:bg-muted">
                <Avatar className="h-7 w-7">
                  {me?.avatar_url && <AvatarImage src={me.avatar_url} />}
                  <AvatarFallback className="bg-primary text-[11px] text-primary-foreground">{initials(me?.full_name || "")}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-32 truncate text-sm font-medium md:block">{me?.full_name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="truncate">{me?.full_name}</div>
                  <div className="truncate text-xs font-normal capitalize text-muted-foreground">{me?.role} · {me?.numl_id}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/profile"><UserCheck className="mr-2 h-4 w-4" />My profile</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/settings"><Settings className="mr-2 h-4 w-4" />{t("settings")}</Link></DropdownMenuItem>
                <DropdownMenuItem onClick={toggle}>{dark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}{dark ? "Light mode" : "Dark mode"}</DropdownMenuItem>
                <DropdownMenuItem className="sm:hidden" onClick={() => setLang(lang === "en" ? "ur" : "en")}>{lang === "en" ? "اردو" : "English"}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" />{t("signout")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto pb-16 lg:pb-0">
          <Outlet />
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t bg-card lg:hidden" aria-label="Main">
          {[
            { to: "/dashboard", label: "Home", icon: LayoutDashboard },
            { to: "/courses", label: "Courses", icon: BookOpen },
            { to: "/assignments", label: "Tasks", icon: ClipboardCheck },
            { to: "/chat", label: "Chat", icon: MessagesSquare },
            { to: "/documents", label: "Files", icon: FileText },
          ].map((n) => (
            <Link key={n.to} to={n.to} className="flex flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground" activeProps={{ className: "text-primary font-semibold" }}>
              <n.icon className="h-5 w-5" />{n.label}
            </Link>
          ))}
        </nav>
      </div>
      <Sheet open={aiOpen} onOpenChange={setAiOpen}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
          <SheetHeader className="border-b p-4 flex flex-row items-center justify-between">
            <SheetTitle>Study assistant</SheetTitle>
            <Button variant="ghost" size="sm" asChild onClick={() => setAiOpen(false)}>
              <Link to="/ai" className="text-xs text-primary hover:underline">
                Open full page
              </Link>
            </Button>
          </SheetHeader>
          <div className="min-h-0 flex-1">
            <AiChatBox
              compact
              initial={quickMessages}
              onChange={(msgs) => {
                setQuickMessages(msgs);
                saveStoredThreadMessages("quick_chat", msgs);
                qc.invalidateQueries({ queryKey: ["ai-threads"] });
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string | undefined; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b bg-card px-4 py-4 md:px-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
