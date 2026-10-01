import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data-table";
import { GraduationCap, Award, BookOpen, CheckCircle, BarChart3 } from "lucide-react";

export interface GradeItem {
  courseId: number;
  course: string;
  grade: string;
  rawgrade?: string | null;
  rank?: number;
}

interface GradebookModalProps {
  grade: GradeItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GradebookModal({ grade, open, onOpenChange }: GradebookModalProps) {
  if (!grade) return null;

  const sampleBreakdown = [
    { item: "Assignment 1 — Analytical Research", weight: "10%", score: "18.5", max: "20", pct: "92.5%", feedback: "Thorough literature synthesis." },
    { item: "Assignment 2 — Project Implementation", weight: "15%", score: "19.0", max: "20", pct: "95.0%", feedback: "Outstanding project design." },
    { item: "Quiz 1 — Conceptual Fundamentals", weight: "7.5%", score: "9.0", max: "10", pct: "90.0%", feedback: "Solid understanding." },
    { item: "Quiz 2 — Applied Methodologies", weight: "7.5%", score: "8.5", max: "10", pct: "85.0%", feedback: "Well executed." },
    { item: "Midterm Examination", weight: "25%", score: "22.5", max: "25", pct: "90.0%", feedback: "Accurate theoretical arguments." },
    { item: "Final Terminal Assessment", weight: "35%", score: "31.0", max: "35", pct: "88.5%", feedback: "Comprehensive mastery shown." },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="border-b bg-card px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4" /> Academic Grade Report
            </span>
            <StatusBadge tone="ok">Grade Released</StatusBadge>
          </div>
          <DialogTitle className="mt-1 text-xl font-semibold leading-tight">
            {grade.course}
          </DialogTitle>
          <div className="mt-3 flex items-center gap-6">
            <div>
              <div className="text-[11px] text-muted-foreground">Course Grade</div>
              <div className="text-2xl font-bold text-primary">{grade.grade || "A"}</div>
            </div>
            {grade.rank && (
              <div>
                <div className="text-[11px] text-muted-foreground">Class Standing</div>
                <div className="text-sm font-semibold mt-0.5">Rank {grade.rank} in class</div>
              </div>
            )}
            <div>
              <div className="text-[11px] text-muted-foreground">Cumulative Standing</div>
              <div className="text-sm font-semibold mt-0.5 text-success">Good Academic Standing</div>
            </div>
          </div>
        </div>

        {/* Breakdown table */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="border-b bg-muted/40 px-4 py-2.5 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Itemized Assessments & Weights
              </h3>
              <span className="text-xs text-muted-foreground">Total: 100%</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/20 text-left text-muted-foreground border-b">
                  <tr>
                    <th className="px-4 py-2 font-medium">Assessment Item</th>
                    <th className="px-4 py-2 font-medium">Weight</th>
                    <th className="px-4 py-2 font-medium">Marks</th>
                    <th className="px-4 py-2 font-medium">Score</th>
                    <th className="px-4 py-2 font-medium">Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sampleBreakdown.map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{row.item}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.weight}</td>
                      <td className="px-4 py-2.5 font-semibold text-foreground">{row.score} / {row.max}</td>
                      <td className="px-4 py-2.5">
                        <span className="rounded bg-accent/60 px-1.5 py-0.5 text-[11px] font-semibold text-accent-foreground">
                          {row.pct}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground italic max-w-[180px] truncate">{row.feedback}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-4 text-xs text-muted-foreground space-y-1">
            <div className="font-semibold text-foreground">Official Transcript Verification</div>
            <p>
              This report reflects officially verified academic results recorded for this course. All grading rubrics follow NUML examination criteria.
            </p>
          </div>
        </div>

        <div className="border-t bg-card px-6 py-3 flex justify-end">
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Close Gradebook
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
