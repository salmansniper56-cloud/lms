import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getDashboard } from "@/lib/moodle.functions";
import { Loading, ErrorBox, fmtDate, relDays } from "@/components/query-state";
import { Progress } from "@/components/ui/progress";
import { AssignmentModal, type AssignmentItem } from "@/components/assignment-modal";
import { ClipboardList, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — NUML LMS" }, { name: "description", content: "Your NUML courses and deadlines at a glance." }, { property: "og:title", content: "Dashboard — NUML LMS" }, { property: "og:description", content: "Your NUML courses and deadlines at a glance." }] }),
  component: Dashboard,
});

function Dashboard() {
  const fn = useServerFn(getDashboard);
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: () => fn() });
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentItem | null>(null);

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const events = data.events ?? [];
  const courses = data.courses ?? [];
  const upcoming = events.filter((e) => !e.overdue);
  const overdue = events.filter((e) => e.overdue);
  const rows = [...overdue, ...upcoming].slice(0, 10);

  return (
    <div>
      <div className="border-b bg-card px-4 py-4 md:px-8">
        <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        <h1 className="text-2xl font-semibold">Welcome, {data.fullName || "Student"}</h1>
      </div>

      <div className="grid gap-4 p-4 md:p-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-3 divide-x rounded border bg-card">
            <Stat label="Enrolled courses" value={courses.length} />
            <Stat label="Upcoming deadlines" value={upcoming.length} />
            <Stat label="Overdue" value={overdue.length} warn={overdue.length > 0} />
          </div>

          <section className="premium-card">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <h2 className="section-title">Upcoming deadlines</h2>
              <Link to="/calendar" className="text-xs text-primary hover:underline">Full calendar</Link>
            </div>
            {rows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No upcoming deadlines.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                    <tr><th className="px-4 py-2 font-medium">Activity</th><th className="px-4 py-2 font-medium">Course</th><th className="px-4 py-2 font-medium">Due</th><th className="px-4 py-2 font-medium">Status</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((e) => (
                      <tr key={e.id} className="hover:bg-muted/40">
                        <td className="px-4 py-2">
                          {e.modulename === "assign" ? (
                            <button
                              className="font-medium text-primary hover:underline text-left flex items-center gap-1"
                              onClick={() => setSelectedAssignment({
                                id: e.id,
                                name: e.name,
                                course: e.course,
                                courseId: e.courseId,
                                duedate: e.timesort,
                              })}
                            >
                              <ClipboardList className="h-3.5 w-3.5 shrink-0" /> {e.name}
                            </button>
                          ) : (
                            <Link
                              to="/courses/$courseId"
                              params={{ courseId: String(e.courseId ?? 0) }}
                              className="font-medium hover:underline"
                            >
                              {e.name}
                            </Link>
                          )}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-2 text-muted-foreground">{e.course}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">{fmtDate(e.timesort)}</td>
                        <td className="px-4 py-2">
                          <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ${e.overdue ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"}`}>{relDays(e.timesort)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="premium-card">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <h2 className="section-title">My courses</h2>
              <Link to="/courses" className="text-xs text-primary hover:underline">All courses</Link>
            </div>
            <ul className="divide-y">
              {courses.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <Link to="/courses/$courseId" params={{ courseId: String(c.id) }} className="flex items-center gap-4 px-4 py-2.5 hover:bg-muted/40">
                    <span className="w-24 shrink-0 truncate text-xs font-semibold text-muted-foreground">{c.shortname}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.fullname}</span>
                    {c.progress != null && (
                      <span className="hidden w-32 shrink-0 items-center gap-2 sm:flex"><Progress value={c.progress} className="h-1" /><span className="text-xs text-muted-foreground">{c.progress}%</span></span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="premium-card p-4">
            <h2 className="section-title mb-2">Quick links</h2>
            <ul className="space-y-1.5 text-sm">
              <li><Link to="/assignments" className="text-primary hover:underline">Assignments</Link></li>
              <li><Link to="/grades" className="text-primary hover:underline">Grades overview</Link></li>
              <li><Link to="/quizzes" className="text-primary hover:underline">Quizzes</Link></li>
              <li><Link to="/attendance" className="text-primary hover:underline">Attendance records</Link></li>
              <li><Link to="/notifications" className="text-primary hover:underline">Notifications</Link></li>
              <li><Link to="/documents" className="text-primary hover:underline">My documents</Link></li>
            </ul>
          </section>
          <section className="premium-card p-4">
            <h2 className="section-title mb-1">Study planner</h2>
            <p className="text-sm text-muted-foreground">Get a day-by-day plan built from your deadlines.</p>
            <Link to="/ai" search={{ prompt: "Plan my study week around my upcoming deadlines, day by day." }} className="mt-2 inline-block text-sm font-medium text-primary hover:underline">Create a study plan</Link>
          </section>
        </aside>
      </div>

      <AssignmentModal
        assignment={selectedAssignment}
        open={Boolean(selectedAssignment)}
        onOpenChange={(open) => { if (!open) setSelectedAssignment(null); }}
      />
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="px-4 py-3">
      <div className={`text-2xl font-semibold ${warn ? "text-destructive" : ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function CourseCard({ c }: { c: { id: number; fullname: string; shortname: string; progress: number | null } }) {
  return (
    <Link to="/courses/$courseId" params={{ courseId: String(c.id) }} className="premium-card block p-4 hover:border-primary/40">
      <div className="text-xs font-semibold text-muted-foreground">{c.shortname}</div>
      <h3 className="mt-1 line-clamp-2 text-sm font-semibold">{c.fullname}</h3>
      {c.progress != null && (
        <div className="mt-3 flex items-center gap-2">
          <Progress value={c.progress} className="h-1" />
          <span className="text-xs text-muted-foreground">{c.progress}%</span>
        </div>
      )}
    </Link>
  );
}
