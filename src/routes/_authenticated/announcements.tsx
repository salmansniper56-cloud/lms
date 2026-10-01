import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getAnnouncements } from "@/lib/moodle.functions";
import { Loading, ErrorBox, fmtDate } from "@/components/query-state";
import { PageHeader } from "@/components/app-shell";
import { AnnouncementModal, type AnnouncementItem } from "@/components/announcement-modal";
import { Megaphone, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({ meta: [{ title: "Announcements — NUML LMS" }, { name: "description", content: "Latest announcements from your NUML course teachers." }, { property: "og:title", content: "Announcements — NUML LMS" }, { property: "og:description", content: "Latest announcements from your NUML course teachers." }] }),
  component: Announcements,
});

function Announcements() {
  const fn = useServerFn(getAnnouncements);
  const { data, isLoading, error } = useQuery({ queryKey: ["announcements"], queryFn: () => fn() });
  const [selected, setSelected] = useState<AnnouncementItem | null>(null);

  return (
    <div className="pb-10">
      <PageHeader title="Announcements" subtitle="Posted by your teachers in each course" />
      {isLoading ? <Loading /> : error ? <ErrorBox error={error} /> : (
        <div className="p-4 md:p-8">
          <div className="premium-card divide-y">
            {(data ?? []).map((a) => (
              <article
                key={a.id}
                className="cursor-pointer px-4 py-3 hover:bg-muted/40 transition-colors"
                onClick={() => setSelected(a)}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold text-primary hover:underline">{a.subject}</h2>
                  <span className="text-xs text-muted-foreground">{fmtDate(a.time)}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {a.author} · <Link to="/courses/$courseId" params={{ courseId: String(a.courseId) }} className="hover:underline" onClick={(e) => e.stopPropagation()}>{a.course}</Link>
                </div>
                {a.message && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{a.message}</p>}
                <div className="mt-1.5 flex items-center gap-1 text-xs text-primary font-medium">
                  <Megaphone className="h-3.5 w-3.5" /> Read announcement <ChevronRight className="h-3 w-3" />
                </div>
              </article>
            ))}
            {data?.length === 0 && <p className="p-4 text-sm text-muted-foreground">No announcements yet.</p>}
          </div>
        </div>
      )}

      <AnnouncementModal
        announcement={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
      />
    </div>
  );
}
