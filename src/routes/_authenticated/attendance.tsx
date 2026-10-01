import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getAttendance } from "@/lib/moodle.functions";
import { Loading, ErrorBox } from "@/components/query-state";
import { PageHeader } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { AttendanceModal, type AttendanceRecordItem } from "@/components/attendance-modal";
import { UserCheck, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Attendance — NUML LMS" }, { name: "description", content: "Attendance registers for each of your NUML courses." }, { property: "og:title", content: "Attendance — NUML LMS" }, { property: "og:description", content: "Attendance registers for each of your NUML courses." }] }),
  component: Attendance,
});

function Attendance() {
  const fn = useServerFn(getAttendance);
  const { data, isLoading, error } = useQuery({ queryKey: ["attendance"], queryFn: () => fn() });
  const [selected, setSelected] = useState<AttendanceRecordItem | null>(null);

  return (
    <div className="pb-10">
      <PageHeader title="Attendance" subtitle="View session records and mark your attendance for active lectures" />
      {isLoading ? <Loading /> : error ? <ErrorBox error={error} /> : (
        <div className="space-y-2 p-4 md:p-8">
          <DataTable head={["Course", "Register", ""]} isEmpty={data?.length === 0} empty="None of your courses has an attendance register yet.">
            {(data ?? []).map((r) => (
              <tr key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                <td>
                  <Link
                    to="/courses/$courseId"
                    params={{ courseId: String(r.courseId) }}
                    className="font-medium text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.course}
                  </Link>
                </td>
                <td className="text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {r.name}
                  </span>
                </td>
                <td className="text-right text-xs text-primary font-medium">
                  <span className="flex items-center justify-end gap-0.5 hover:underline">
                    View & Check in <ChevronRight className="h-3 w-3" />
                  </span>
                </td>
              </tr>
            ))}
          </DataTable>
          <p className="text-xs text-muted-foreground">Session history and self check-in are available within the portal.</p>
        </div>
      )}

      <AttendanceModal
        record={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
      />
    </div>
  );
}
