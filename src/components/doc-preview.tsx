import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { docToHtml, saveFile } from "@/lib/docs";

export function DocPreview({ doc, onClose }: { doc: { id: string; name: string } | null; onClose: () => void }) {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setHtml(null);
    setErr(null);
    if (!doc) return;
    if (!doc.name.toLowerCase().endsWith(".docx")) { setErr("Preview is available for .docx files. Download to open."); return; }
    docToHtml(doc.id).then(setHtml).catch((e) => setErr(e.message));
  }, [doc]);
  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
        <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 pr-8">
          <DialogTitle className="truncate">{doc?.name}</DialogTitle>
          {doc && <Button size="sm" variant="outline" onClick={() => saveFile(doc)}><Download className="mr-1 h-4 w-4" /> Download</Button>}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-card p-6">
          {err ? <p className="text-sm text-muted-foreground">{err}</p> : html === null ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            // Mammoth produces sanitized semantic HTML from the docx
            <div className="docx-preview text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
