import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DocPreview } from "@/components/doc-preview";
import { uploadDoc, saveFile, type Doc } from "@/lib/docs";
import { deleteDocument } from "@/lib/cloudinary.functions";
import { formatBytes } from "@/lib/use-profile";
import { FileText, Upload, MoreVertical, Folder, Loader2, Bot } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "My Documents — NUML Scholar" }, { name: "description", content: "Store, preview and share your Word documents." }, { property: "og:title", content: "My Documents — NUML Scholar" }, { property: "og:description", content: "Store, preview and share your Word documents." }] }),
  component: Documents,
});

function Documents() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState("General");
  const [filter, setFilter] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<Doc | null>(null);

  const { data: me } = useQuery({ queryKey: ["uid"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id });
  const { data: docs, isLoading } = useQuery({
    queryKey: ["documents", me],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").eq("owner_id", me!).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Doc[];
    },
  });

  async function onFiles(files: FileList) {
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        await uploadDoc(f, folder);
        toast.success(`Uploaded ${f.name}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      qc.invalidateQueries({ queryKey: ["documents"] });
    }
  }

  async function rename(d: Doc) {
    const name = prompt("New name", d.name);
    if (!name || name === d.name) return;
    await supabase.from("documents").update({ name, updated_at: new Date().toISOString() }).eq("id", d.id);
    qc.invalidateQueries({ queryKey: ["documents"] });
  }
  async function move(d: Doc) {
    const f = prompt("Move to folder", d.folder);
    if (!f) return;
    await supabase.from("documents").update({ folder: f }).eq("id", d.id);
    qc.invalidateQueries({ queryKey: ["documents"] });
  }
  async function remove(d: Doc) {
    if (!confirm(`Delete "${d.name}"?`)) return;
    await deleteDocument({ data: { id: d.id } });
    qc.invalidateQueries({ queryKey: ["documents"] });
  }

  const folders = [...new Set((docs ?? []).map((d) => d.folder))].sort();
  const list = (docs ?? []).filter((d) => (!filter || d.folder === filter) && d.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="pb-10">
      <PageHeader
        title="My Documents"
        subtitle="Word files, organised by folder"
        action={
          <div className="flex items-center gap-2">
            <Input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Folder" className="w-40" />
            <input ref={fileRef} type="file" accept=".docx,.doc" multiple className="hidden" onChange={(e) => e.target.files && onFiles(e.target.files)} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />} Upload DOCX
            </Button>
          </div>
        }
      />

      <div className="mx-6 grid gap-6 md:mx-10 lg:grid-cols-[200px_1fr]">
        <div className="flex gap-1 overflow-x-auto lg:block lg:space-y-1">
          <button onClick={() => setFilter(null)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm lg:w-full ${!filter ? "bg-accent font-medium" : "hover:bg-accent"}`}><Folder className="h-4 w-4" /> All files</button>
          {folders.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm lg:w-full ${filter === f ? "bg-accent font-medium" : "hover:bg-accent"}`}><Folder className="h-4 w-4 text-gold" /> {f}</button>
          ))}
        </div>
        <div>
          <Input placeholder="Search documents…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-sm" />
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : list.length === 0 ? (
            <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">No documents yet. Upload your first Word file.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((d) => (
                <div key={d.id} className="group flex items-start gap-3 rounded-md border bg-card p-4 hover:shadow">
                  <button onClick={() => setPreview(d)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                    <FileText className="h-8 w-8 shrink-0 text-chart-5" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.folder} · {formatBytes(d.size_bytes)} · {new Date(d.created_at).toLocaleDateString()}</div>
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded p-1 hover:bg-accent"><MoreVertical className="h-4 w-4" /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setPreview(d)}>Preview</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => saveFile(d)}>Download</DropdownMenuItem>
                      <DropdownMenuItem asChild><Link to="/ai" search={{ prompt: `I will attach "${d.name}" — please summarise it.` }}><Bot className="mr-1 h-4 w-4" /> Ask AI</Link></DropdownMenuItem>
                      <DropdownMenuItem onClick={() => rename(d)}>Rename</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => move(d)}>Move to folder</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => remove(d)} className="text-destructive">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <DocPreview doc={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
