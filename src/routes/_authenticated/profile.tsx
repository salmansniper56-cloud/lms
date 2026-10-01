import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/moodle.functions";
import { Loading, ErrorBox } from "@/components/query-state";
import { PageHeader } from "@/components/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/use-profile";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My profile — NUML LMS" }, { name: "description", content: "Your NUML account details and enrolled courses." }, { property: "og:title", content: "My profile — NUML LMS" }, { property: "og:description", content: "Your NUML account details and enrolled courses." }] }),
  component: Profile,
});

const d = (t: number | null) => (t ? new Date(t * 1000).toLocaleString() : "—");

function Profile() {
  const fn = useServerFn(getMyProfile);
  const { data, isLoading, error } = useQuery({ queryKey: ["my-profile"], queryFn: () => fn() });
  return (
    <div className="pb-10">
      <PageHeader title="My profile" />
      {isLoading ? <Loading /> : error ? <ErrorBox error={error} /> : data && (
        <div className="grid gap-4 p-4 md:p-8 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="premium-card p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                {data.avatar && <AvatarImage src={data.avatar} />}
                <AvatarFallback className="bg-primary text-primary-foreground">{initials(data.fullName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate font-semibold">{data.fullName}</div>
                <div className="text-xs capitalize text-muted-foreground">{data.role}</div>
              </div>
            </div>
            <dl className="mt-4 divide-y text-sm">
              {[
                ["NUML ID", data.numlId],
                ["Email", data.email],
                ["Department", data.department],
                ["Institution", data.institution],
                ["City", [data.city, data.country].filter(Boolean).join(", ")],
                ["First access", d(data.firstaccess)],
                ["Last access", d(data.lastaccess)],
              ].map(([k, v]) => (
                <div key={k as string} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2 py-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="truncate">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="premium-card">
            <h2 className="section-title border-b px-4 py-2.5">Enrolled courses ({data.courses.length})</h2>
            <ul className="divide-y">
              {data.courses.map((c) => (
                <li key={c.id} className="flex gap-4 px-4 py-2.5 text-sm">
                  <span className="w-24 shrink-0 truncate text-xs font-semibold text-muted-foreground">{c.shortname}</span>
                  <Link to="/courses/$courseId" params={{ courseId: String(c.id) }} className="min-w-0 truncate font-medium text-primary hover:underline">{c.fullname}</Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
