import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/data-table";
import { UserCheck, CheckCircle2, AlertCircle, KeyRound, Calendar } from "lucide-react";
import { toast } from "sonner";

export interface AttendanceRecordItem {
  id: number;
  name: string;
  course: string;
  courseId: number;
}

interface AttendanceModalProps {
  record: AttendanceRecordItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AttendanceModal({ record, open, onOpenChange }: AttendanceModalProps) {
  const [pin, setPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasMarkedToday, setHasMarkedToday] = useState(false);

  useEffect(() => {
    if (!record) return;
    try {
      const todayKey = `numl_attend_${record.courseId}_${new Date().toDateString()}`;
      setHasMarkedToday(Boolean(localStorage.getItem(todayKey)));
    } catch {
      setHasMarkedToday(false);
    }
    setPin("");
  }, [record, open]);

  if (!record) return null;

  const mockSessions = [
    { num: 16, date: "Today", time: "09:00 - 10:30 AM", status: hasMarkedToday ? "Present" : "Active Now", remarks: hasMarkedToday ? "Self-verified via portal" : "Open for check-in" },
    { num: 15, date: "Sep 28, 2026", time: "09:00 - 10:30 AM", status: "Present", remarks: "Regular lecture" },
    { num: 14, date: "Sep 25, 2026", time: "09:00 - 10:30 AM", status: "Present", remarks: "Lab demonstration" },
    { num: 13, date: "Sep 21, 2026", time: "09:00 - 10:30 AM", status: "Late", remarks: "Arrived 10 mins late" },
    { num: 12, date: "Sep 18, 2026", time: "09:00 - 10:30 AM", status: "Present", remarks: "Regular lecture" },
    { num: 11, date: "Sep 14, 2026", time: "09:00 - 10:30 AM", status: "Present", remarks: "Group seminar" },
    { num: 10, date: "Sep 11, 2026", time: "09:00 - 10:30 AM", status: "Absent", remarks: "Unexcused" },
  ];

  function handleMarkAttendance(e: React.FormEvent) {
    e.preventDefault();
    if (pin.trim().length < 4) {
      toast.error("Please enter a valid 4-digit session code provided by your instructor.");
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setHasMarkedToday(true);
      try {
        localStorage.setItem(`numl_attend_${record?.courseId}_${new Date().toDateString()}`, "true");
      } catch {}
      toast.success("Attendance marked successfully! Your status is verified as Present.");
    }, 600);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="border-b bg-card px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <UserCheck className="h-4 w-4" /> Official Attendance Register
            </span>
            <StatusBadge tone="ok">89% Attendance (Good Standing)</StatusBadge>
          </div>
          <DialogTitle className="mt-1 text-xl font-semibold leading-tight">
            {record.course}
          </DialogTitle>
          <div className="mt-2 text-xs text-muted-foreground">
            Register: {record.name} · Eligible for Semester End-Term Examinations
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Check-in box */}
          <div className="rounded-lg border bg-accent/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-accent-foreground flex items-center gap-1.5">
                <KeyRound className="h-4 w-4 text-gold" /> Lecture Self Check-in
              </span>
              <span className="text-xs text-muted-foreground">Active Session: 09:00 - 10:30 AM</span>
            </div>

            {hasMarkedToday ? (
              <div className="flex items-center gap-2 text-success text-xs font-semibold py-1">
                <CheckCircle2 className="h-4 w-4" /> You are marked Present for today's session.
              </div>
            ) : (
              <form onSubmit={handleMarkAttendance} className="flex gap-2 mt-2">
                <Input
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter 4-digit class code"
                  maxLength={6}
                  className="max-w-[200px] h-9 text-xs"
                />
                <Button size="sm" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Verifying..." : "Mark Present"}
                </Button>
              </form>
            )}
          </div>

          {/* Session history */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="border-b bg-muted/40 px-4 py-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Session Log History
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/20 text-left text-muted-foreground border-b">
                  <tr>
                    <th className="px-4 py-2 font-medium">Session #</th>
                    <th className="px-4 py-2 font-medium">Date & Time</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mockSessions.map((s) => (
                    <tr key={s.num} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-semibold">Lecture {s.num}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{s.date} · {s.time}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge tone={s.status === "Present" ? "ok" : s.status === "Late" ? "warn" : s.status === "Active Now" ? "warn" : "bad"}>
                          {s.status}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{s.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="border-t bg-card px-6 py-3 flex justify-end">
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
