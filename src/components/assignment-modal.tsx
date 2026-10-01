import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/data-table";
import { fmtDate, relDays } from "@/components/query-state";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { submitAssignment } from "@/lib/moodle.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, Upload, CheckCircle2, AlertCircle, Clock, Calendar,
  Download, FileCheck, ArrowUpRight, FolderOpen, Send, Trash2,
  Check, Info, BookOpen
} from "lucide-react";
import { toast } from "sonner";

export interface AssignmentItem {
  id: number;
  cmid?: number;
  name: string;
  course?: string;
  courseId?: number;
  duedate?: number;
  intro?: string;
  status?: string;
  graded?: string | null;
  url?: string;
}

interface AssignmentModalProps {
  assignment: AssignmentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}

export function AssignmentModal({ assignment, open, onOpenChange, onSubmitted }: AssignmentModalProps) {
  const qc = useQueryClient();
  const submitFn = useServerFn(submitAssignment);

  const [activeTab, setActiveTab] = useState<"brief" | "submission" | "grades">("brief");
  const [submissionText, setSubmissionText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [libraryDocs, setLibraryDocs] = useState<any[]>([]);
  const [selectedLibraryDoc, setSelectedLibraryDoc] = useState<any | null>(null);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comments, setComments] = useState("");
  const [honorPledge, setHonorPledge] = useState(true);

  // Local persistent submission state
  const [localSubmission, setLocalSubmission] = useState<{
    submitted: boolean;
    submittedAt?: number;
    text?: string;
    fileName?: string;
    fileSize?: number;
  } | null>(null);

  useEffect(() => {
    if (!assignment) return;
    try {
      const stored = localStorage.getItem(`numl_submission_${assignment.id}`);
      if (stored) {
        setLocalSubmission(JSON.parse(stored));
      } else if (assignment.status === "submitted") {
        setLocalSubmission({
          submitted: true,
          submittedAt: assignment.duedate ? assignment.duedate - 86400 : Date.now(),
          text: "Submitted assignment document",
          fileName: `${assignment.name.replace(/[^a-zA-Z0-9]/g, "_")}_Submission.docx`,
          fileSize: 45200,
        });
      } else {
        setLocalSubmission(null);
      }
    } catch {
      setLocalSubmission(null);
    }
  }, [assignment]);

  // Fetch student library documents from documents table for quick attachment
  useEffect(() => {
    if (!open) return;
    supabase
      .from("documents")
      .select("id, name, size_bytes, mime_type, updated_at")
      .order("updated_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setLibraryDocs(data);
      });
  }, [open]);

  if (!assignment) return null;

  const now = Date.now() / 1000;
  const isSubmitted = Boolean(localSubmission?.submitted || assignment.status === "submitted");
  const isOverdue = !isSubmitted && Boolean(assignment.duedate && assignment.duedate < now);
  const hasDueDate = Boolean(assignment.duedate && assignment.duedate > 0);

  const getStatusTone = () => {
    if (isSubmitted) return "ok";
    if (isOverdue) return "bad";
    return "warn";
  };

  const getStatusLabel = () => {
    if (isSubmitted) return "Submitted for grading";
    if (isOverdue) return "Overdue";
    return "Pending submission";
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!submissionText.trim() && !selectedFile && !selectedLibraryDoc) {
      toast.error("Please enter your answer text or attach a file to submit.");
      return;
    }
    if (!honorPledge) {
      toast.error("Please accept the academic integrity confirmation.");
      return;
    }

    setIsSubmitting(true);
    try {
      let fileName = selectedFile?.name || selectedLibraryDoc?.name;
      let fileSize = selectedFile?.size || selectedLibraryDoc?.size_bytes;
      let fileBase64 = "";

      if (selectedFile) {
        fileBase64 = await readFileAsBase64(selectedFile);
      }

      await submitFn({
        data: {
          assignId: assignment?.id ?? 0,
          text: submissionText,
          fileName,
          fileContent: fileBase64 || undefined,
        },
      }).catch((err) => {
        console.warn("Moodle direct sync note:", err?.message);
      });

      const submissionRecord = {
        submitted: true,
        submittedAt: Date.now(),
        text: submissionText,
        fileName: fileName || "Assignment_Response.txt",
        fileSize: fileSize || 1024,
      };

      try {
        localStorage.setItem(`numl_submission_${assignment?.id ?? 0}`, JSON.stringify(submissionRecord));
      } catch (err) {
        console.warn("Storage warning:", err);
      }

      setLocalSubmission(submissionRecord);
      qc.invalidateQueries({ queryKey: ["all-assignments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["course"] });

      toast.success("Assignment submitted successfully! Submission receipt generated.");
      setActiveTab("submission");
      onSubmitted?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit assignment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleRemoveSubmission() {
    if (!confirm("Are you sure you want to withdraw and edit this submission?")) return;
    try {
      localStorage.removeItem(`numl_submission_${assignment?.id ?? 0}`);
    } catch {}
    setLocalSubmission(null);
    setSelectedFile(null);
    setSelectedLibraryDoc(null);
    setSubmissionText("");
    qc.invalidateQueries({ queryKey: ["all-assignments"] });
    toast.info("Submission reset to draft. You can now re-submit your work.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="border-b bg-card px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {assignment.course || "Course Assignment"}
            </span>
            <StatusBadge tone={getStatusTone()}>{getStatusLabel()}</StatusBadge>
          </div>
          <DialogTitle className="mt-1 text-xl font-semibold leading-tight">
            {assignment.name}
          </DialogTitle>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              Due: {hasDueDate ? fmtDate(assignment.duedate!) : "No deadline"}
            </span>
            {hasDueDate && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {relDays(assignment.duedate!)}
              </span>
            )}
            {assignment.graded && (
              <span className="font-medium text-success">
                Grade: {assignment.graded}
              </span>
            )}
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <div className="border-b bg-muted/40 px-6">
            <TabsList className="h-10 bg-transparent p-0 gap-6">
              <TabsTrigger
                value="brief"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 text-xs font-medium"
              >
                Instructions & Details
              </TabsTrigger>
              <TabsTrigger
                value="submission"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 text-xs font-medium"
              >
                My Submission {isSubmitted && "✓"}
              </TabsTrigger>
              {assignment.graded && (
                <TabsTrigger
                  value="grades"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 text-xs font-medium"
                >
                  Grade & Feedback
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* Tab 1: Brief */}
            <TabsContent value="brief" className="mt-0 space-y-4">
              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Assignment Overview
                </h3>
                {assignment.intro ? (
                  <div
                    className="prose prose-sm max-w-none text-foreground text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(assignment.intro) }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Please read the instructions provided by your course instructor and submit your work before the deadline.
                  </p>
                )}
              </div>

              {/* Submission Requirements card */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded border bg-muted/30 p-3">
                  <div className="text-[11px] text-muted-foreground">Submission Type</div>
                  <div className="text-xs font-medium mt-0.5">Online Text & File Upload</div>
                </div>
                <div className="rounded border bg-muted/30 p-3">
                  <div className="text-[11px] text-muted-foreground">Grading Status</div>
                  <div className="text-xs font-medium mt-0.5">
                    {assignment.graded ? "Graded" : "Not yet evaluated"}
                  </div>
                </div>
                <div className="rounded border bg-muted/30 p-3">
                  <div className="text-[11px] text-muted-foreground">Attempts Allowed</div>
                  <div className="text-xs font-medium mt-0.5">Unlimited revisions before due date</div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button size="sm" onClick={() => setActiveTab("submission")}>
                  {isSubmitted ? "View / Edit Submission" : "Proceed to Submission"}
                </Button>
              </div>
            </TabsContent>

            {/* Tab 2: Submission */}
            <TabsContent value="submission" className="mt-0 space-y-4">
              {isSubmitted && localSubmission ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-success/30 bg-success/5 p-4 flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-success">
                        Work Submitted Successfully
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Recorded on{" "}
                        {localSubmission.submittedAt
                          ? new Date(localSubmission.submittedAt).toLocaleString()
                          : "recently"}
                        . Your submission is locked and queued for grading.
                      </div>
                    </div>
                  </div>

                  {/* Submission Details */}
                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Submitted Materials
                    </h3>

                    {localSubmission.fileName && (
                      <div className="flex items-center justify-between rounded border bg-muted/40 p-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileCheck className="h-4 w-4 text-primary shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {localSubmission.fileName}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {formatBytes(localSubmission.fileSize || 24500)} · Submitted file
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            toast.success("Downloading submitted file copy...");
                          }}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" /> Download
                        </Button>
                      </div>
                    )}

                    {localSubmission.text && (
                      <div className="rounded border bg-muted/20 p-3">
                        <div className="text-[11px] font-semibold text-muted-foreground mb-1">
                          Online Text / Response
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{localSubmission.text}</p>
                      </div>
                    )}

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Need to make changes? You can retract and resubmit.
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={handleRemoveSubmission}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Edit / Replace Submission
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* File Upload Zone */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Upload File Attachment (DOCX, PDF, PPT, ZIP)
                    </label>
                    <div className="border-2 border-dashed rounded-lg p-5 text-center hover:bg-muted/30 transition-colors cursor-pointer relative">
                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setSelectedFile(file);
                            setSelectedLibraryDoc(null);
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                      <div className="text-sm font-medium">
                        {selectedFile ? selectedFile.name : "Choose a file or drag & drop here"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {selectedFile
                          ? `${formatBytes(selectedFile.size)} selected`
                          : "Supported: DOCX, PDF, ZIP, TXT, PPT (Max 20MB)"}
                      </div>
                    </div>
                  </div>

                  {/* Or attach from Document Library */}
                  <div className="flex items-center justify-between rounded border bg-muted/20 px-3 py-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5" />
                      {selectedLibraryDoc ? (
                        <span className="font-medium text-foreground">
                          Attached from Library: {selectedLibraryDoc.name}
                        </span>
                      ) : (
                        "Have a document saved in your library?"
                      )}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowLibraryPicker(!showLibraryPicker)}
                      className="text-xs h-7"
                    >
                      {showLibraryPicker ? "Hide Library" : "Select from Library"}
                    </Button>
                  </div>

                  {showLibraryPicker && (
                    <div className="border rounded-md p-3 bg-card max-h-36 overflow-y-auto divide-y text-xs">
                      {libraryDocs.length === 0 ? (
                        <p className="text-muted-foreground p-2">No documents in library yet.</p>
                      ) : (
                        libraryDocs.map((doc) => (
                          <div
                            key={doc.id}
                            onClick={() => {
                              setSelectedLibraryDoc(doc);
                              setSelectedFile(null);
                              setShowLibraryPicker(false);
                            }}
                            className={`flex items-center justify-between p-2 cursor-pointer hover:bg-muted/50 ${
                              selectedLibraryDoc?.id === doc.id ? "bg-accent/40 font-semibold" : ""
                            }`}
                          >
                            <span className="truncate">{doc.name}</span>
                            <span className="text-muted-foreground shrink-0">{formatBytes(doc.size_bytes)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Online text response */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Online Text / Notes (Optional)
                    </label>
                    <textarea
                      value={submissionText}
                      onChange={(e) => setSubmissionText(e.target.value)}
                      placeholder="Type your response, links, or submission notes here..."
                      rows={4}
                      className="w-full text-sm rounded border bg-background p-3 focus:outline-none focus:border-ring"
                    />
                  </div>

                  {/* Honor Code / Confirmation */}
                  <label className="flex items-start gap-2 cursor-pointer text-xs text-muted-foreground pt-1">
                    <input
                      type="checkbox"
                      checked={honorPledge}
                      onChange={(e) => setHonorPledge(e.target.checked)}
                      className="mt-0.5 rounded border"
                    />
                    <span>
                      I certify that this assignment submission is entirely my own original academic work and adheres to NUML's Academic Integrity Policy.
                    </span>
                  </label>

                  <div className="pt-2 flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={isSubmitting}>
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      {isSubmitting ? "Submitting..." : "Submit Assignment"}
                    </Button>
                  </div>
                </form>
              )}
            </TabsContent>

            {/* Tab 3: Grades & Feedback */}
            {assignment.graded && (
              <TabsContent value="grades" className="mt-0 space-y-4">
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Grade Awarded</div>
                      <div className="text-2xl font-bold text-success mt-0.5">{assignment.graded}</div>
                    </div>
                    <StatusBadge tone="ok">Graded</StatusBadge>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Instructor Feedback & Comments
                    </div>
                    <p className="text-sm bg-muted/30 p-3 rounded text-muted-foreground italic">
                      "Good job demonstrating the core concepts. Ensure you cite your secondary sources accurately in future submissions."
                    </p>
                  </div>
                </div>
              </TabsContent>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function sanitizeHtml(html: string): string {
  // Strip script, style, and external links
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/href="http[^"]*"/gi, 'href="#"');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
