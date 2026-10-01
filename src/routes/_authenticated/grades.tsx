import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getGrades } from "@/lib/moodle.functions";
import { Loading, ErrorBox } from "@/components/query-state";
import { PageHeader } from "@/components/app-shell";
import { DataTable, StatusBadge } from "@/components/data-table";
import { GradebookModal, type GradeItem } from "@/components/gradebook-modal";
import { GraduationCap, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/grades")({
  head: () => ({ meta: [{ title: "Grades — NUML LMS" }, { name: "description", content: "Your grades across all NUML courses." }, { property: "og:title", content: "Grades — NUML LMS" }, { property: "og:description", content: "Your grades across all NUML courses." }] }),
  component: Grades,
});

function Grades() {
  const fn = useServerFn(getGrades);
  const { data, isLoading, error } = useQuery({ queryKey: ["grades"], queryFn: () => fn() });
  const [selected, setSelected] = useState<GradeItem | null>(null);

  return (
    <div className="pb-10">
      <PageHeader title="Grades" subtitle="Course totals and itemized breakdown from the NUML gradebook" />
      {isLoading ? <Loading /> : error ? <ErrorBox error={error} /> : (
        <div className="p-4 md:p-8">
          <DataTable head={["Course", "Grade", "Standing", ""]} isEmpty={data?.length === 0} empty="No grades have been released yet.">
            {(data ?? []).map((g) => (
              <tr key={g.courseId} className="cursor-pointer" onClick={() => setSelected(g)}>
                <td>
                  <Link
                    to="/courses/$courseId"
                    params={{ courseId: String(g.courseId) }}
                    className="font-medium text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {g.course}
                  </Link>
                </td>
                <td className="font-semibold text-lg text-foreground">{g.grade || "—"}</td>
                <td>
                  <StatusBadge tone={g.grade && !g.grade.includes("F") ? "ok" : g.grade ? "bad" : "muted"}>
                    {g.grade && !g.grade.includes("F") ? "Good Standing" : g.grade ? "At Risk" : "Pending"}
                  </StatusBadge>
                </td>
                <td className="text-right text-xs text-primary font-medium">
                  <span className="flex items-center justify-end gap-0.5 hover:underline">
                    Full Report <ChevronRight className="h-3 w-3" />
                  </span>
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      <GradebookModal
        grade={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
      />
    </div>
  );
}
