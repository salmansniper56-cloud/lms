import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getCourse, getParticipants } from "@/lib/moodle.functions";
import { Loading, ErrorBox, fmtDate } from "@/components/query-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, FileText, ClipboardList, MessageSquare, HelpCircle, Link2, Folder, BookOpen, Bot } from "lucide-react";
import { formatBytes } from "@/lib/use-profile";
import { AssignmentModal, type AssignmentItem } from "@/components/assignment-modal";
import { ResourceModal, type ResourceItem } from "@/components/resource-modal";
import { QuizModal, type QuizItem } from "@/components/quiz-modal";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  head: () => ({ meta: [{ title: "Course — NUML LMS" }, { name: "description", content: "Course content, files and assignments." }, { property: "og:title", content: "Course — NUML LMS" }, { property: "og:description", content: "Course content, files and assignments." }] }),
  component: CoursePage,
});

const icons: Record<string, any> = { resource: FileText, assign: ClipboardList, forum: MessageSquare, quiz: HelpCircle, url: Link2, folder: Folder, page: BookOpen };
const labels: Record<string, string> = { resource: "File", assign: "Assignment", forum: "Forum", quiz: "Quiz", url: "Link", folder: "Folder", page: "Page" };

function CoursePage() {
  const { courseId } = Route.useParams();
  const id = Number(courseId);
  const fn = useServerFn(getCourse);
  const { data, isLoading, error } = useQuery({ queryKey: ["course", id], queryFn: () => fn({ data: { courseId: id } }) });

  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentItem | null>(null);
  const [selectedResource, setSelectedResource] = useState<ResourceItem | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizItem | null>(null);

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;
  const title = data.course?.fullname ?? "Course";

  return (
    <div className="pb-10">
      <div className="border-b bg-card px-4 pt-3 md:px-8">
        <nav className="text-xs text-muted-foreground">
          <Link to="/dashboard" className="hover:underline">Dashboard</Link>
          <ChevronRight className="mx-1 inline h-3 w-3" />
          <Link to="/courses" className="hover:underline">Courses</Link>
          <ChevronRight className="mx-1 inline h-3 w-3" />
          <span className="text-foreground">{data.course?.shortname ?? title}</span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-3 py-3">
          <h1 className="min-w-0 text-2xl font-semibold">{title}</h1>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/ai" search={{ prompt: `Give me a study guide and summary for my course "${title}".` }}>
                <Bot className="mr-1 h-3.5 w-3.5" /> Study guide
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="content" className="px-4 pt-4 md:px-8">
        <TabsList className="h-9 rounded">
          <TabsTrigger value="content" className="rounded-sm">Course content</TabsTrigger>
          <TabsTrigger value="assignments" className="rounded-sm">Assignments ({data.assignments.length})</TabsTrigger>
          <TabsTrigger value="people" className="rounded-sm">Participants</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="mt-4 space-y-3">
          {data.sections.map((s, i) => (
            <Section
              key={s.id}
              s={s}
              open={i < 3}
              onOpenAssignment={(a) => setSelectedAssignment(a)}
              onOpenResource={(r) => setSelectedResource(r)}
              onOpenQuiz={(q) => setSelectedQuiz(q)}
              courseId={id}
              courseTitle={title}
            />
          ))}
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          <div className="premium-card overflow-x-auto">
            {data.assignments.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No assignments in this course.</p> : (
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr><th className="px-4 py-2 font-medium">Assignment</th><th className="px-4 py-2 font-medium">Due date</th><th className="px-4 py-2 font-medium"></th></tr>
                </thead>
                <tbody className="divide-y">
                  {data.assignments.map((a) => (
                    <tr
                      key={a.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setSelectedAssignment({
                        id: a.id,
                        name: a.name,
                        duedate: a.duedate,
                        course: title,
                        courseId: id,
                        intro: a.intro,
                      })}
                    >
                      <td className="px-4 py-2 font-medium text-primary hover:underline">{a.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{a.duedate ? fmtDate(a.duedate) : "No due date"}</td>
                      <td className="px-4 py-2 text-right text-xs text-primary">
                        <span className="flex items-center justify-end gap-0.5">Open <ChevronRight className="h-3 w-3" /></span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="people" className="mt-4"><Participants courseId={id} /></TabsContent>
      </Tabs>

      {/* Native Modals */}
      <AssignmentModal
        assignment={selectedAssignment}
        open={Boolean(selectedAssignment)}
        onOpenChange={(open) => { if (!open) setSelectedAssignment(null); }}
      />
      <ResourceModal
        resource={selectedResource}
        open={Boolean(selectedResource)}
        onOpenChange={(open) => { if (!open) setSelectedResource(null); }}
      />
      <QuizModal
        quiz={selectedQuiz}
        open={Boolean(selectedQuiz)}
        onOpenChange={(open) => { if (!open) setSelectedQuiz(null); }}
      />
    </div>
  );
}

function Section({
  s, open: initial, onOpenAssignment, onOpenResource, onOpenQuiz, courseId, courseTitle,
}: {
  s: any;
  open: boolean;
  onOpenAssignment: (a: AssignmentItem) => void;
  onOpenResource: (r: ResourceItem) => void;
  onOpenQuiz: (q: QuizItem) => void;
  courseId: number;
  courseTitle: string;
}) {
  const [open, setOpen] = useState(initial);

  function handleModuleClick(m: any) {
    if (m.modname === "assign") {
      onOpenAssignment({ id: m.id, name: m.name, course: courseTitle, courseId, description: m.description });
    } else if (m.modname === "quiz") {
      onOpenQuiz({ id: m.id, name: m.name, course: courseTitle, courseId });
    } else {
      onOpenResource({ id: m.id, name: m.name, modname: m.modname, description: m.description, files: m.files });
    }
  }

  return (
    <section className="premium-card">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 border-b px-4 py-2.5 text-left">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <h2 className="flex-1 text-sm font-semibold">{s.name || "General"}</h2>
        <span className="text-xs text-muted-foreground">{s.modules.length} items</span>
      </button>
      {open && (
        <div>
          {s.summary && <p className="border-b px-4 py-2 text-sm text-muted-foreground">{s.summary}</p>}
          <ul className="divide-y">
            {s.modules.map((m: any) => {
              const Icon = icons[m.modname] ?? FileText;
              return (
                <li key={m.id}>
                  <button
                    onClick={() => handleModuleClick(m)}
                    className="flex w-full items-start gap-3 px-4 py-2 hover:bg-muted/40 text-left"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{m.name}</div>
                      {m.files.length > 0 && <div className="truncate text-xs text-muted-foreground">{m.files.map((f: any) => `${f.filename} (${formatBytes(f.filesize)})`).join(", ")}</div>}
                      {m.description && <div className="line-clamp-1 text-xs text-muted-foreground">{m.description}</div>}
                    </div>
                    <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">{labels[m.modname] ?? m.modname}</span>
                  </button>
                </li>
              );
            })}
            {s.modules.length === 0 && <li className="px-4 py-2 text-sm text-muted-foreground">No activities in this section.</li>}
          </ul>
        </div>
      )}
    </section>
  );
}

function Participants({ courseId }: { courseId: number }) {
  const fn = useServerFn(getParticipants);
  const { data, isLoading } = useQuery({ queryKey: ["participants", courseId], queryFn: () => fn({ data: { courseId } }) });
  if (isLoading) return <Loading />;
  if (!data?.length) return <p className="text-sm text-muted-foreground">No participants visible.</p>;
  const isT = (u: any) => u.roles.some((r: string) => r.includes("teacher"));
  const sorted = [...data.filter(isT), ...data.filter((u) => !isT(u))];
  return (
    <div className="premium-card overflow-x-auto">
      <div className="border-b px-4 py-2 text-xs text-muted-foreground">{data.length} participants · {data.filter(isT).length} teaching</div>
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
          <tr><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Role</th></tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-2">{u.name}</td>
              <td className="px-4 py-2">
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${isT(u) ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}>{isT(u) ? "Teacher" : "Student"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
