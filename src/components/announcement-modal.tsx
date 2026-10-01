import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/components/query-state";
import { Megaphone, MessageSquare, Send, User, Calendar } from "lucide-react";
import { toast } from "sonner";

export interface AnnouncementItem {
  id: number;
  subject: string;
  author: string;
  message: string;
  time: number;
  courseId: number;
  course: string;
  url?: string;
}

interface AnnouncementModalProps {
  announcement: AnnouncementItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AnnouncementModal({ announcement, open, onOpenChange }: AnnouncementModalProps) {
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);

  if (!announcement) return null;

  function handlePostComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    const newComment = {
      id: Date.now(),
      author: "You",
      text: commentText,
      time: "Just now",
    };
    setComments([...comments, newComment]);
    setCommentText("");
    toast.success("Question submitted to instructor.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="border-b bg-card px-6 py-4">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5 text-primary">
              <Megaphone className="h-4 w-4" /> {announcement.course}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {fmtDate(announcement.time)}
            </span>
          </div>
          <DialogTitle className="mt-1.5 text-xl font-semibold leading-tight">
            {announcement.subject}
          </DialogTitle>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" /> Posted by {announcement.author}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="rounded-lg border bg-card p-4 leading-relaxed text-sm text-foreground whitespace-pre-wrap">
            {announcement.message || "No detailed message provided."}
          </div>

          {/* Discussion section */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Class Inquiries & Comments ({comments.length})
            </h4>

            {comments.map((c) => (
              <div key={c.id} className="rounded border bg-muted/20 p-3 text-xs space-y-1">
                <div className="flex items-center justify-between font-semibold">
                  <span>{c.author}</span>
                  <span className="text-muted-foreground font-normal">{c.time}</span>
                </div>
                <p className="text-foreground">{c.text}</p>
              </div>
            ))}

            <form onSubmit={handlePostComment} className="flex gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Ask a question or post a remark..."
                className="flex-1 rounded border bg-background px-3 py-2 text-xs focus:outline-none focus:border-ring"
              />
              <Button size="sm" type="submit">
                <Send className="h-3.5 w-3.5 mr-1" /> Post
              </Button>
            </form>
          </div>
        </div>

        <div className="border-t bg-card px-6 py-3 flex justify-end">
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Close Announcement
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
