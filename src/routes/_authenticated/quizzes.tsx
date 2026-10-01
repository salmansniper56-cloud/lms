import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getQuizzes } from "@/lib/moodle.functions";
import { Loading, ErrorBox, fmtDate } from "@/components/query-state";
import { PageHeader } from "@/components/app-shell";
import { DataTable, StatusBadge } from "@/components/data-table";
import { QuizModal, type QuizItem } from "@/components/quiz-modal";
import { HelpCircle, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/quizzes")({
  head: () => ({ meta: [{ title: "Quizzes — NUML LMS" }, { name: "description", content: "Quizzes across your NUML courses with open and close times." }, { property: "og:title", content: "Quizzes — NUML LMS" }, { property: "og:description", content: "Quizzes across your NUML courses with open and close times." }] }),
  component: Quizzes,
});

function Quizzes() {
  const fn = useServerFn(getQuizzes);
  const { data, isLoading, error } = useQuery({ queryKey: ["quizzes"], queryFn: () => fn() });
  const [selected, setSelected] = useState<QuizItem | null>(null);
  const now = Date.now() / 1000;

  return (
    <div className="pb-10">
      <PageHeader title="Quizzes" subtitle="Attempt and review all your course quizzes within this portal" />
      {isLoading ? <Loading /> : error ? <ErrorBox error={error} /> : (
        <div className="p-4 md:p-8">
          <DataTable head={["Quiz", "Course", "Opens", "Closes", "Time limit", "Status", ""]} isEmpty={data?.length === 0} empty="No quizzes in your courses.">
            {(data ?? []).map((q) => {
              const st = q.open && q.open > now ? "upcoming" : q.close && q.close < now ? "closed" : "open";
              return (
                <tr
                  key={q.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(q)}
                >
                  <td className="font-medium text-primary hover:underline">
                    <span className="flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {q.name}
                    </span>
                  </td>
                  <td className="max-w-[220px] truncate">
                    <Link
                      to="/courses/$courseId"
                      params={{ courseId: String(q.courseId) }}
                      className="text-muted-foreground hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {q.course}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap text-muted-foreground">{q.open ? fmtDate(q.open) : "—"}</td>
                  <td className="whitespace-nowrap text-muted-foreground">{q.close ? fmtDate(q.close) : "—"}</td>
                  <td className="text-muted-foreground">{q.timelimit ? `${Math.round(q.timelimit / 60)} min` : "None"}</td>
                  <td><StatusBadge tone={st === "open" ? "ok" : st === "upcoming" ? "warn" : "muted"}>{st === "open" ? "Open" : st === "upcoming" ? "Upcoming" : "Closed"}</StatusBadge></td>
                  <td className="text-right text-xs text-primary font-medium">
                    <span className="flex items-center justify-end gap-0.5 hover:underline">
                      {st === "closed" ? "Review" : "Attempt"} <ChevronRight className="h-3 w-3" />
                    </span>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        </div>
      )}

      <QuizModal
        quiz={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
      />
    </div>
  );
}
