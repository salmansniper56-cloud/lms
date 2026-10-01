import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data-table";
import { fmtDate } from "@/components/query-state";
import { Clock, CheckCircle2, AlertTriangle, Play, RotateCcw, Award, ChevronRight, ChevronLeft, HelpCircle } from "lucide-react";
import { toast } from "sonner";

export interface QuizItem {
  id: number;
  name: string;
  course?: string;
  courseId?: number;
  open?: number;
  close?: number;
  timelimit?: number;
  attempts?: number;
  url?: string;
}

interface QuizModalProps {
  quiz: QuizItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}

interface Question {
  id: number;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const SAMPLE_QUESTIONS: Question[] = [
  {
    id: 1,
    text: "Which of the following best describes the primary objective of this course module?",
    options: [
      "To understand core theoretical frameworks and practical applications",
      "To memorize historical definitions without analysis",
      "To replace standard examination criteria",
      "None of the above"
    ],
    correctIndex: 0,
    explanation: "Core theoretical understanding combined with applied methodologies forms the foundation of this academic curriculum."
  },
  {
    id: 2,
    text: "According to standard university academic guidelines, when must coursework be finalized?",
    options: [
      "After final semester grades are published",
      "Prior to the stated cut-off deadline on the course syllabus",
      "At any time before graduation",
      "Only during faculty office hours"
    ],
    correctIndex: 1,
    explanation: "Coursework and assessments must be submitted strictly before the syllabus cut-off timestamp."
  },
  {
    id: 3,
    text: "Which methodology is recommended for synthesizing research data in modern study assignments?",
    options: [
      "Qualitative and quantitative mixed-methods triangulation",
      "Unverified web opinion summaries",
      "Omission of citation references",
      "Relying solely on informal peer notes"
    ],
    correctIndex: 0,
    explanation: "Triangulating empirical qualitative and quantitative evidence provides rigorous academic validity."
  },
  {
    id: 4,
    text: "True or False: Academic integrity policies require all sources and references to be properly cited.",
    options: ["True", "False"],
    correctIndex: 0,
    explanation: "All academic submissions require complete and transparent attribution of scholarly sources."
  }
];

export function QuizModal({ quiz, open, onOpenChange, onCompleted }: QuizModalProps) {
  const [mode, setMode] = useState<"overview" | "taking" | "results">("overview");
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(1200); // 20 mins default
  const [score, setScore] = useState<number | null>(null);
  const [pastAttempts, setPastAttempts] = useState<any[]>([]);

  useEffect(() => {
    if (!quiz) return;
    try {
      const stored = localStorage.getItem(`numl_quiz_attempts_${quiz.id}`);
      if (stored) {
        setPastAttempts(JSON.parse(stored));
      } else {
        setPastAttempts([]);
      }
    } catch {
      setPastAttempts([]);
    }
    setMode("overview");
    setSelectedAnswers({});
    setCurrentQIndex(0);
  }, [quiz, open]);

  // Timer countdown
  useEffect(() => {
    if (mode !== "taking") return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          finishQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [mode]);

  if (!quiz) return null;

  const now = Date.now() / 1000;
  const isUpcoming = Boolean(quiz.open && quiz.open > now);
  const isClosed = Boolean(quiz.close && quiz.close < now);
  const isOpen = !isUpcoming && !isClosed;

  function startAttempt() {
    setMode("taking");
    setCurrentQIndex(0);
    setSelectedAnswers({});
    setTimeLeft(quiz?.timelimit ? quiz.timelimit : 900); // default 15 mins
  }

  function handleSelectOption(qId: number, optIndex: number) {
    setSelectedAnswers((prev) => ({ ...prev, [qId]: optIndex }));
  }

  function finishQuiz() {
    let correctCount = 0;
    SAMPLE_QUESTIONS.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctIndex) {
        correctCount++;
      }
    });

    const calculatedScore = Math.round((correctCount / SAMPLE_QUESTIONS.length) * 100);
    setScore(calculatedScore);

    const newAttempt = {
      attemptNumber: pastAttempts.length + 1,
      date: Date.now(),
      score: calculatedScore,
      correct: correctCount,
      total: SAMPLE_QUESTIONS.length,
      status: calculatedScore >= 60 ? "Passed" : "Needs Improvement",
    };

    const updated = [newAttempt, ...pastAttempts];
    setPastAttempts(updated);
    try {
      localStorage.setItem(`numl_quiz_attempts_${quiz?.id ?? 0}`, JSON.stringify(updated));
    } catch {}

    setMode("results");
    toast.success(`Quiz completed! You scored ${calculatedScore}%.`);
    onCompleted?.();
  }

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="border-b bg-card px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {quiz.course || "Course Quiz"}
            </div>
            <DialogTitle className="mt-0.5 text-xl font-semibold leading-tight">
              {quiz.name}
            </DialogTitle>
          </div>
          {mode === "taking" ? (
            <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-sm font-semibold text-primary">
              <Clock className="h-4 w-4 animate-pulse" />
              {formatTimer(timeLeft)}
            </div>
          ) : (
            <StatusBadge tone={isOpen ? "ok" : isUpcoming ? "warn" : "muted"}>
              {isOpen ? "Open" : isUpcoming ? "Upcoming" : "Closed"}
            </StatusBadge>
          )}
        </div>

        {/* Content depending on mode */}
        <div className="flex-1 overflow-y-auto p-6">
          {mode === "overview" && (
            <div className="space-y-6">
              {/* Instructions Card */}
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Assessment Information
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded border bg-muted/20 p-2.5">
                    <span className="text-muted-foreground block text-[11px]">Time Limit</span>
                    <span className="font-semibold text-sm">
                      {quiz.timelimit ? `${Math.round(quiz.timelimit / 60)} minutes` : "15 minutes"}
                    </span>
                  </div>
                  <div className="rounded border bg-muted/20 p-2.5">
                    <span className="text-muted-foreground block text-[11px]">Questions</span>
                    <span className="font-semibold text-sm">{SAMPLE_QUESTIONS.length} Questions</span>
                  </div>
                  <div className="rounded border bg-muted/20 p-2.5">
                    <span className="text-muted-foreground block text-[11px]">Grading Method</span>
                    <span className="font-semibold text-sm">Highest Grade</span>
                  </div>
                  <div className="rounded border bg-muted/20 p-2.5">
                    <span className="text-muted-foreground block text-[11px]">Attempts</span>
                    <span className="font-semibold text-sm">Multiple Allowed</span>
                  </div>
                </div>

                <div className="rounded bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed">
                  <p className="font-medium text-foreground mb-1">Assessment Rules:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>This assessment runs directly within the NUML LMS portal.</li>
                    <li>Once you click Start Attempt, the countdown timer will begin automatically.</li>
                    <li>You can navigate between questions and review your answers before submitting.</li>
                  </ul>
                </div>
              </div>

              {/* Past Attempts Table */}
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Summary of your previous attempts
                </h3>
                {pastAttempts.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    No attempts have been recorded yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                        <tr>
                          <th className="py-2 px-3 font-medium">Attempt</th>
                          <th className="py-2 px-3 font-medium">Date</th>
                          <th className="py-2 px-3 font-medium">Score</th>
                          <th className="py-2 px-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {pastAttempts.map((att) => (
                          <tr key={att.attemptNumber}>
                            <td className="py-2 px-3 font-semibold">Attempt {att.attemptNumber}</td>
                            <td className="py-2 px-3 text-muted-foreground">
                              {new Date(att.date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                            </td>
                            <td className="py-2 px-3 font-bold text-foreground">{att.score}%</td>
                            <td className="py-2 px-3">
                              <StatusBadge tone={att.score >= 60 ? "ok" : "warn"}>
                                {att.status}
                              </StatusBadge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button size="sm" onClick={startAttempt} disabled={isClosed}>
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  {pastAttempts.length > 0 ? "Re-attempt Quiz" : "Start Quiz Attempt"}
                </Button>
              </div>
            </div>
          )}

          {mode === "taking" && (
            <div className="space-y-6">
              {/* Question Navigation Bar */}
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Question {currentQIndex + 1} of {SAMPLE_QUESTIONS.length}
                </span>
                <div className="flex gap-1.5">
                  {SAMPLE_QUESTIONS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentQIndex(i)}
                      className={`h-7 w-7 rounded text-xs font-semibold transition-colors ${
                        currentQIndex === i
                          ? "bg-primary text-primary-foreground"
                          : selectedAnswers[SAMPLE_QUESTIONS[i].id] !== undefined
                          ? "bg-accent text-accent-foreground border border-primary/20"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Question */}
              {(() => {
                const q = SAMPLE_QUESTIONS[currentQIndex];
                return (
                  <div className="space-y-4">
                    <p className="text-base font-semibold leading-relaxed text-foreground">
                      {q.text}
                    </p>

                    <div className="space-y-2 pt-2">
                      {q.options.map((opt, optIndex) => {
                        const isSelected = selectedAnswers[q.id] === optIndex;
                        return (
                          <div
                            key={optIndex}
                            onClick={() => handleSelectOption(q.id, optIndex)}
                            className={`flex items-start gap-3 rounded-lg border p-3.5 text-sm cursor-pointer transition-all ${
                              isSelected
                                ? "border-primary bg-primary/5 font-medium text-foreground shadow-sm"
                                : "hover:bg-muted/40 text-muted-foreground"
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-muted-foreground/30"
                              }`}
                            >
                              {String.fromCharCode(65 + optIndex)}
                            </span>
                            <span className="flex-1 leading-normal">{opt}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Bottom Nav Controls */}
              <div className="flex items-center justify-between border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentQIndex === 0}
                  onClick={() => setCurrentQIndex((i) => i - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>

                {currentQIndex < SAMPLE_QUESTIONS.length - 1 ? (
                  <Button size="sm" onClick={() => setCurrentQIndex((i) => i + 1)}>
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={finishQuiz}>
                    Submit All and Finish
                  </Button>
                )}
              </div>
            </div>
          )}

          {mode === "results" && (
            <div className="space-y-6">
              {/* Score banner */}
              <div className="rounded-xl border bg-card p-6 text-center space-y-2 shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <Award className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold">Attempt Completed</h3>
                <div className="text-3xl font-extrabold text-foreground">{score}%</div>
                <p className="text-xs text-muted-foreground">
                  Your grade has been saved and updated in your academic record.
                </p>
              </div>

              {/* Answers review */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Review of Questions & Answers
                </h4>
                {SAMPLE_QUESTIONS.map((q, idx) => {
                  const userAns = selectedAnswers[q.id];
                  const isCorrect = userAns === q.correctIndex;
                  return (
                    <div
                      key={q.id}
                      className={`rounded-lg border p-4 space-y-2 text-xs ${
                        isCorrect ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 font-semibold text-sm">
                        <span>{idx + 1}. {q.text}</span>
                        <StatusBadge tone={isCorrect ? "ok" : "bad"}>
                          {isCorrect ? "Correct" : "Incorrect"}
                        </StatusBadge>
                      </div>
                      <div className="text-muted-foreground">
                        Your answer: <span className="font-semibold text-foreground">{userAns !== undefined ? q.options[userAns] : "Not answered"}</span>
                      </div>
                      {!isCorrect && (
                        <div className="text-success font-medium">
                          Correct answer: {q.options[q.correctIndex]}
                        </div>
                      )}
                      <p className="text-muted-foreground pt-1 border-t text-[11px] italic">
                        {q.explanation}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setMode("overview")}>
                  Return to Overview
                </Button>
                <Button size="sm" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
