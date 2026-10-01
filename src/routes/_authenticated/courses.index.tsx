import { Link } from "@tanstack/react-router";
import { Progress } from "@/components/ui/progress";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { listCourses } from "@/lib/moodle.functions";
import { Loading, ErrorBox } from "@/components/query-state";
import { PageHeader } from "@/components/app-shell";
import { CourseCard } from "./dashboard";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/courses/")({
  validateSearch: z.object({ q: z.string().optional() }),
  head: () => ({ meta: [{ title: "Courses — NUML Scholar" }, { name: "description", content: "All your enrolled NUML courses." }, { property: "og:title", content: "Courses — NUML Scholar" }, { property: "og:description", content: "All your enrolled NUML courses." }] }),
  component: Courses,
});

function Courses() {
  const { q: initialQ } = Route.useSearch();
  const [q, setQ] = useState(initialQ ?? "");
  useEffect(() => setQ(initialQ ?? ""), [initialQ]);
  const fn = useServerFn(listCourses);
  const { data, isLoading, error } = useQuery({ queryKey: ["courses"], queryFn: () => fn() });
  const list = (data ?? []).filter((c) => (c.fullname + c.shortname).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader title="My courses" subtitle={data ? `${data.length} enrolled` : undefined} action={<Input placeholder="Filter courses" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-64 rounded" />} />
      {isLoading ? <Loading /> : error ? <ErrorBox error={error} /> : (
        <div className="p-4 md:p-8">
          <div className="premium-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr><th className="px-4 py-2 font-medium">Code</th><th className="px-4 py-2 font-medium">Course</th><th className="hidden px-4 py-2 font-medium sm:table-cell">Progress</th><th className="hidden px-4 py-2 font-medium md:table-cell">Last accessed</th></tr>
              </thead>
              <tbody className="divide-y">
                {list.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/40">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold text-muted-foreground">{c.shortname}</td>
                    <td className="px-4 py-2.5"><Link to="/courses/$courseId" params={{ courseId: String(c.id) }} className="font-medium text-primary hover:underline">{c.fullname}</Link></td>
                    <td className="hidden w-40 px-4 py-2.5 sm:table-cell">{c.progress != null ? <div className="flex items-center gap-2"><Progress value={c.progress} className="h-1" /><span className="text-xs text-muted-foreground">{c.progress}%</span></div> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td className="hidden whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground md:table-cell">{c.lastaccess ? new Date(c.lastaccess * 1000).toLocaleDateString() : "Never"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length === 0 && <p className="p-4 text-sm text-muted-foreground">No courses found.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
