import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BookOpen, Bot, CalendarClock, FileText, MessagesSquare, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NUML Scholar — Academic Learning Portal" },
      { name: "description", content: "Sign in with your NUML account to access courses, deadlines, grades, quizzes, attendance and AI-powered study tools." },
      { property: "og:title", content: "NUML Scholar — Academic Learning Portal" },
      { property: "og:description", content: "Courses, deadlines, grades, quizzes, attendance, chat and document management for NUML students and teachers." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: BookOpen, title: "All your courses", text: "Sections, files, assignments and progress — all accessible directly within the portal." },
  { icon: CalendarClock, title: "Never miss a deadline", text: "Every due date across every course in one clear timeline." },
  { icon: Bot, title: "AI Study Assistant", text: "Plans your week, explains topics, drafts notes, quizzes and feedback." },
  { icon: MessagesSquare, title: "Chat Room", text: "Find people by NUML ID, connect, chat in groups and share files." },
  { icon: FileText, title: "Document library", text: "Store, organise and preview your Word files in your own private library." },
  { icon: GraduationCap, title: "For every role", text: "Students, teachers and admins each get the tools they need." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-display text-lg font-bold text-primary-foreground">N</div>
          <span className="font-display text-xl font-semibold">NUML Scholar</span>
        </div>
        <Button asChild><Link to="/auth">Sign in</Link></Button>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="overflow-hidden rounded-3xl p-10 text-primary-foreground md:p-16" style={{ background: "var(--gradient-hero)" }}>
          <p className="mb-4 inline-block rounded-full bg-gold px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gold-foreground">
            National University of Modern Languages
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
            Your complete academic portal — with an AI study partner beside you.
          </h1>
          <p className="mt-6 max-w-2xl text-lg opacity-85">
            Sign in with your NUML credentials to access courses, submit assignments, take quizzes, check grades, and manage your academic life — all in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Link to="/auth">Sign in to NUML Scholar</Link>
            </Button>
          </div>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-md border bg-card p-6">
              <f.icon className="h-6 w-6 text-gold" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        NUML Scholar — National University of Modern Languages · Academic Portal
      </footer>
    </div>
  );
}
