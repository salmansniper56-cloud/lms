import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCalendar } from "@/lib/moodle.functions";
import { Loading, ErrorBox, relDays } from "@/components/query-state";
import { PageHeader } from "@/components/app-shell";
import { useState } from "react";
import { AssignmentModal, type AssignmentItem } from "@/components/assignment-modal";
import { QuizModal, type QuizItem } from "@/components/quiz-modal";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Deadlines — NUML Scholar" }, { name: "description", content: "Every due date across your courses." }, { property: "og:title", content: "Deadlines — NUML Scholar" }, { property: "og:description", content: "Every due date across your courses." }] }),
  component: CalendarPage,
});

function CalendarPage() {
  const fn = useServerFn(getCalendar);
  const { data, isLoading, error } = useQuery({ queryKey: ["calendar"], queryFn: () => fn() });
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentItem | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizItem | null>(null);

  const groups = new Map<string, NonNullable<typeof data>>();
  (data ?? []).forEach((e) => {
    const k = new Date(e.timesort * 1000).toDateString();
    groups.set(k, [...(groups.get(k) ?? []), e]);
  });

  function handleEventClick(e: any) {
    if (e.modulename === "assign") {
      setSelectedAssignment({
        id: e.id,
        name: e.name,
        course: e.course,
        courseId: e.courseId,
        duedate: e.timesort,
      });
    } else if (e.modulename === "quiz") {
      setSelectedQuiz({ id: e.id, name: e.name, course: e.course, courseId: e.courseId });
    } else if (e.courseId) {
      // navigate via link below
    }
  }

  return (
    <div>
      <PageHeader title="Calendar & deadlines" subtitle="Every upcoming deadline across your courses" />
      {isLoading ? <Loading /> : error ? <ErrorBox error={error} /> : (
        <div className="space-y-6 px-6 pb-10 md:px-10">
          {groups.size === 0 && <p className="text-sm text-muted-foreground">No upcoming events.</p>}
          {[...groups.entries()].map(([day, evs]) => (
            <div key={day} className="grid gap-4 md:grid-cols-[160px_1fr]">
              <div>
                <div className="font-display text-lg font-semibold">{new Date(day).toLocaleDateString(undefined, { weekday: "long" })}</div>
                <div className="text-sm text-muted-foreground">{new Date(day).toLocaleDateString(undefined, { day: "numeric", month: "long" })}</div>
              </div>
              <div className="space-y-2">
                {evs.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => handleEventClick(e)}
                    className={`w-full flex items-center justify-between gap-3 rounded-md border-l-4 bg-card p-4 hover:shadow text-left transition-shadow ${e.overdue ? "border-l-destructive" : "border-l-gold"}`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{e.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{e.course} · {new Date(e.timesort * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {e.modulename}</div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{relDays(e.timesort)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AssignmentModal
        assignment={selectedAssignment}
        open={Boolean(selectedAssignment)}
        onOpenChange={(open) => { if (!open) setSelectedAssignment(null); }}
      />
      <QuizModal
        quiz={selectedQuiz}
        open={Boolean(selectedQuiz)}
        onOpenChange={(open) => { if (!open) setSelectedQuiz(null); }}
      />
    </div>
  );
}
