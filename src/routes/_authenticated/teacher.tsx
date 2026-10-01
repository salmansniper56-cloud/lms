import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTeacherOverview } from "@/lib/moodle.functions";
import { Loading, ErrorBox, fmtDate } from "@/components/query-state";
import { PageHeader } from "@/components/app-shell";
import { DataTable, StatusBadge } from "@/components/data-table";
import { useState } from "react";
import { AssignmentModal, type AssignmentItem } from "@/components/assignment-modal";
import { ChevronRight, Bot, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher")({
  head: () => ({ meta: [{ title: "Faculty — NUML LMS" }, { name: "description", content: "Courses, grading queue and teaching tools for NUML faculty." }, { property: "og:title", content: "Faculty — NUML LMS" }, { property: "og:description", content: "Courses, grading queue and teaching tools for NUML faculty." }] }),
  component: Teacher,
});

const drafts = [
  { title: "Draft an announcement", prompt: "Draft a clear, formal class announcement for my students about: " },
  { title: "Prepare quiz questions", prompt: "Create 10 multiple-choice quiz questions with answers on the topic: " },
  { title: "Write grading feedback", prompt: "Write constructive grading feedback for a student assignment. Submission summary: " },
  { title: "Compose a lesson plan", prompt: "Create a detailed lesson plan for a 90-minute university lecture on: " },
];

function Teacher() {
  const fn = useServerFn(getTeacherOverview);
  const { data, isLoading, error } = useQuery({ queryKey: ["teacher"], queryFn: () => fn() });
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentItem | null>(null);
  const now = Date.now() / 1000;
  const pending = (data?.assignments ?? []).reduce((n, a) => n + (a.toGrade ?? 0), 0);
  const students = (data?.courses ?? []).reduce((n, c) => n + (c.enrolledusercount ?? 0), 0);
  const open = (data?.assignments ?? []).filter((a) => a.duedate && a.duedate > now).length;

  return (
    <div className="pb-10">
      <PageHeader title="Faculty dashboard" subtitle="Courses you teach and work waiting for grading" />
      {isLoading ? <Loading /> : error ? <ErrorBox error={error} /> : data && (
        <div className="grid gap-4 p-4 md:p-8 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 space-y-4">
            <div className="grid grid-cols-2 divide-x rounded border bg-card sm:grid-cols-4">
              {[["Courses", data.courses.length], ["Students", students], ["Open assignments", open], ["Submissions to grade", pending]].map(([l, v]) => (
                <div key={l as string} className="px-4 py-3"><div className="text-2xl font-semibold">{v}</div><div className="text-xs text-muted-foreground">{l}</div></div>
              ))}
            </div>

            <section className="space-y-2">
              <h2 className="section-title">Grading queue</h2>
              <DataTable head={["Assignment", "Course", "Due", "To grade", ""]} isEmpty={data.assignments.length === 0} empty="No assignments in your courses.">
                {[...data.assignments].sort((a, b) => (b.toGrade ?? 0) - (a.toGrade ?? 0)).map((a) => (
                  <tr
                    key={a.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedAssignment({
                      id: a.id,
                      name: a.name,
                      course: a.course,
                      duedate: a.duedate,
                    })}
                  >
                    <td className="font-medium text-primary hover:underline">
                      <span className="flex items-center gap-1.5">
                        <ClipboardList className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {a.name}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate text-muted-foreground">{a.course}</td>
                    <td className="whitespace-nowrap text-muted-foreground">{a.duedate ? fmtDate(a.duedate) : "—"}</td>
                    <td>{a.toGrade == null ? <span className="text-muted-foreground">—</span> : <StatusBadge tone={a.toGrade ? "warn" : "ok"}>{a.toGrade ? `${a.toGrade} pending` : "Up to date"}</StatusBadge>}</td>
                    <td className="text-right text-xs text-primary font-medium">
                      <span className="flex items-center justify-end gap-0.5">Review <ChevronRight className="h-3 w-3" /></span>
                    </td>
                  </tr>
                ))}
              </DataTable>
            </section>

            <section className="space-y-2">
              <h2 className="section-title">Course management</h2>
              <DataTable head={["Course", "Students", ""]} isEmpty={data.courses.length === 0}>
                {data.courses.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to="/courses/$courseId" params={{ courseId: String(c.id) }} className="font-medium text-primary hover:underline">{c.fullname}</Link>
                      <div className="text-xs text-muted-foreground">{c.shortname}</div>
                    </td>
                    <td className="text-muted-foreground">{c.enrolledusercount ?? "—"}</td>
                    <td className="text-right">
                      <Link
                        to="/courses/$courseId"
                        params={{ courseId: String(c.id) }}
                        className="text-xs text-primary hover:underline flex items-center justify-end gap-0.5"
                      >
                        Manage course <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </DataTable>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="premium-card p-4">
              <h2 className="section-title mb-2 flex items-center gap-1.5"><Bot className="h-4 w-4" /> AI Drafting Tools</h2>
              <ul className="space-y-1.5 text-sm">
                {drafts.map((d) => <li key={d.title}><Link to="/ai" search={{ prompt: d.prompt }} className="text-primary hover:underline">{d.title}</Link></li>)}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">AI drafts open in the study assistant. Nothing is posted automatically.</p>
            </section>
          </aside>
        </div>
      )}

      <AssignmentModal
        assignment={selectedAssignment}
        open={Boolean(selectedAssignment)}
        onOpenChange={(open) => { if (!open) setSelectedAssignment(null); }}
      />
    </div>
  );
}
