import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Download, Folder, BookOpen, ExternalLink, FileCheck } from "lucide-react";
import { toast } from "sonner";

export interface ResourceItem {
  id: number;
  name: string;
  modname: string;
  description?: string;
  files?: Array<{ filename: string; filesize: number; mimetype?: string }>;
  url?: string;
}

interface ResourceModalProps {
  resource: ResourceItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResourceModal({ resource, open, onOpenChange }: ResourceModalProps) {
  if (!resource) return null;

  function handleDownload(fileName: string) {
    toast.success(`Downloading ${fileName}...`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="border-b bg-card px-6 py-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-primary" /> Course Material & Handout
          </div>
          <DialogTitle className="mt-1 text-lg font-semibold leading-tight">
            {resource.name}
          </DialogTitle>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {resource.description && (
            <div className="rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
              {resource.description}
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Material Files & Downloads
            </h4>

            {resource.files && resource.files.length > 0 ? (
              <div className="divide-y rounded-lg border bg-card">
                {resource.files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileCheck className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{f.filename}</div>
                        <div className="text-[11px] text-muted-foreground">{formatBytes(f.filesize)}</div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleDownload(f.filename)}>
                      <Download className="h-3.5 w-3.5 mr-1" /> Download
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border bg-card p-4 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>{resource.name}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleDownload(`${resource.name}.pdf`)}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Download Handout
                </Button>
              </div>
            )}
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
