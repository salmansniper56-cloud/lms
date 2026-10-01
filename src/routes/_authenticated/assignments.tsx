import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getAllAssignments } from "@/lib/moodle.functions";
import { Loading, ErrorBox, fmtDate } from "@/components/query-state";
import { PageHeader } from "@/components/app-shell";
import { DataTable, StatusBadge } from "@/components/data-table";
import { AssignmentModal, type AssignmentItem } from "@/components/assignment-modal";
import { ClipboardList, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assignments")({
  head: () => ({ meta: [{ title: "Assignments — NUML LMS" }, { name: "description", content: "Every assignment across your NUML courses with submission status." }, { property: "og:title", content: "Assignments — NUML LMS" }, { property: "og:description", content: "Every assignment across your NUML courses with submission status." }] }),
  component: Assignments,
});

type Filter = "all" | "todo" | "submitted" | "overdue";

function Assignments() {
  const fn = useServerFn(getAllAssignments);
  const { data, isLoading, error } = useQuery({ queryKey: ["all-assignments"], queryFn: () => fn() });
  const [f, setF] = useState<Filter>("all");
  const [selected, setSelected] = useState<AssignmentItem | null>(null);
  const now = Date.now() / 1000;

  const state = (a: { status: string; duedate: number }) =>
    a.status === "submitted" ? "submitted" : a.duedate && a.duedate < now ? "overdue" : "todo";

  const list = (data ?? []).filter((a) => f === "all" || state(a) === f);
  const counts: Record<string, number> = { all: data?.length ?? 0, todo: 0, submitted: 0, overdue: 0 };
  (data ?? []).forEach((a) => { const k = state(a); counts[k] = (counts[k] ?? 0) + 1; });
  const tabs: [Filter, string][] = [["all", "All"], ["todo", "To do"], ["overdue", "Overdue"], ["submitted", "Submitted"]];

  return (
    <div className="pb-10">
      <PageHeader title="Assignments" subtitle="View, manage and submit your assignments — all within this portal" />
      {isLoading ? <Loading /> : error ? <ErrorBox error={error} /> : (
        <div className="space-y-3 p-4 md:p-8">
          <div className="flex gap-1 border-b">
            {tabs.map(([k, label]) => (
              <button key={k} onClick={() => setF(k)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${f === k ? "border-gold font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {label} <span className="text-xs text-muted-foreground">({counts[k] ?? 0})</span>
              </button>
            ))}
          </div>
          <DataTable head={["Assignment", "Course", "Due date", "Status", "Grade", ""]} isEmpty={list.length === 0} empty="No assignments in this view.">
            {list.map((a) => {
              const st = state(a);
              return (
                <tr
                  key={a.id}
                  className="cursor-pointer"
                  onClick={() => setSelected({ id: a.id, cmid: a.cmid, name: a.name, course: a.course, courseId: a.courseId, duedate: a.duedate, status: a.status, graded: a.graded, url: a.url })}
                >
                  <td className="font-medium text-primary hover:underline">
                    <span className="flex items-center gap-1.5">
                      <ClipboardList className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {a.name}
                    </span>
                  </td>
                  <td className="max-w-[240px] truncate">
                    <Link
                      to="/courses/$courseId"
                      params={{ courseId: String(a.courseId) }}
                      className="text-muted-foreground hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {a.course}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap text-muted-foreground">{a.duedate ? fmtDate(a.duedate) : "—"}</td>
                  <td><StatusBadge tone={st === "submitted" ? "ok" : st === "overdue" ? "bad" : "warn"}>{st === "submitted" ? "Submitted" : st === "overdue" ? "Overdue" : "Not submitted"}</StatusBadge></td>
                  <td className="whitespace-nowrap">{a.graded ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="text-right text-xs text-primary font-medium">
                    <span className="flex items-center justify-end gap-0.5 hover:underline">
                      {st === "submitted" ? "View" : "Open"} <ChevronRight className="h-3 w-3" />
                    </span>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        </div>
      )}

      <AssignmentModal
        assignment={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
        onSubmitted={() => {}}
      />
    </div>
  );
}
