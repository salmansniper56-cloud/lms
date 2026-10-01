import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award } from "lucide-react";
import { getBadges } from "@/lib/moodle.functions";
import { Loading, ErrorBox, fmtDate } from "@/components/query-state";
import { PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/badges")({
  head: () => ({ meta: [{ title: "Badges — NUML Scholar" }, { name: "description", content: "Badges you have earned on NUML LMS." }, { property: "og:title", content: "Badges — NUML Scholar" }, { property: "og:description", content: "Badges you have earned on NUML LMS." }] }),
  component: Badges,
});

function Badges() {
  const fn = useServerFn(getBadges);
  const { data, isLoading, error } = useQuery({ queryKey: ["badges"], queryFn: () => fn() });
  return (
    <div className="pb-12">
      <PageHeader title="Badges" subtitle="Achievements awarded to you in NUML courses" />
      {isLoading ? <Loading /> : error ? <ErrorBox error={error} /> : (
        <div className="mx-6 grid gap-5 sm:grid-cols-2 md:mx-10 lg:grid-cols-3">
          {(data ?? []).map((b) => (
            <div key={b.id} className="premium-card p-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold/60 text-gold-foreground shadow-lg"><Award className="h-8 w-8" /></div>
              <h3 className="mt-4 text-lg font-semibold">{b.name}</h3>
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{b.description}</p>
              {b.issued ? <p className="mt-3 text-xs text-muted-foreground">Earned {fmtDate(b.issued)}</p> : null}
            </div>
          ))}
          {data?.length === 0 && <div className="premium-card col-span-full p-10 text-center text-muted-foreground">No badges yet — keep going!</div>}
        </div>
      )}
    </div>
  );
}
