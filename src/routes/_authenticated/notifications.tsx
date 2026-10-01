import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getNotifications } from "@/lib/moodle.functions";
import { Loading, ErrorBox, fmtDate } from "@/components/query-state";
import { PageHeader } from "@/components/app-shell";
import { Bell, BellDot, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — NUML Scholar" }, { name: "description", content: "Your NUML LMS notifications." }, { property: "og:title", content: "Notifications — NUML Scholar" }, { property: "og:description", content: "Your NUML LMS notifications." }] }),
  component: Notifications,
});

function Notifications() {
  const fn = useServerFn(getNotifications);
  const { data, isLoading, error } = useQuery({ queryKey: ["notifications"], queryFn: () => fn() });

  const unread = (data ?? []).filter((n) => !n.read).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "All caught up"}
      />
      {isLoading ? <Loading /> : error ? <ErrorBox error={error} /> : (
        <ul className="mx-4 mb-10 space-y-2 md:mx-8">
          {(data ?? []).map((n) => (
            <li
              key={n.id}
              className={`rounded-md border bg-card p-4 transition-colors ${n.read ? "opacity-70" : "border-l-4 border-l-gold"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  {n.read
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    : <BellDot className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  }
                  <span className="font-medium text-sm">{n.subject}</span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(n.time)}</span>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground pl-6">{n.text}</p>
            </li>
          ))}
          {data?.length === 0 && <p className="text-sm text-muted-foreground">You're all caught up.</p>}
        </ul>
      )}
    </div>
  );
}
