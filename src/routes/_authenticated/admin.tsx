import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getAdminOverview } from "@/lib/moodle.functions";
import { supabase } from "@/integrations/supabase/client";
import { Loading, ErrorBox } from "@/components/query-state";
import { PageHeader } from "@/components/app-shell";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — NUML Scholar" }, { name: "description", content: "Site overview and course search for NUML administrators." }, { property: "og:title", content: "Admin — NUML Scholar" }, { property: "og:description", content: "Site overview and course search for NUML administrators." }] }),
  component: Admin,
});

function Admin() {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const fn = useServerFn(getAdminOverview);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin", term], queryFn: () => fn({ data: { q: term } }) });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: async () => (await supabase.from("profiles").select("role")).data ?? [] });
  const counts = (users.data ?? []).reduce<Record<string, number>>((a, u) => ({ ...a, [u.role]: (a[u.role] ?? 0) + 1 }), {});
  return (
    <div className="pb-10">
      <PageHeader title="Admin overview" />
      {isLoading && !data ? <Loading /> : error ? <ErrorBox error={error} /> : data && (
        <div className="mx-6 space-y-6 md:mx-10">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card label="Moodle site" value={data.sitename} sub={`Release ${data.release}`} />
            <Card label="NUML Scholar users" value={String(users.data?.length ?? 0)} sub={`${counts['student'] ?? 0} students · ${counts['teacher'] ?? 0} teachers`} />
            <Card label="Web service functions" value={String(data.functionsAvailable)} sub="available to you" />
          </div>
          <section className="premium-card p-5">
            <h2 className="mb-3 text-lg font-semibold">Search courses</h2>
            <form onSubmit={(e) => { e.preventDefault(); setTerm(q); }}>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Course name or code, then Enter" className="max-w-md" />
            </form>
            {term && <p className="mt-3 text-sm text-muted-foreground">{data.total} results</p>}
            <ul className="mt-2 divide-y">
              {data.results.map((c) => (
                <li key={c.id} className="py-2 text-sm"><Link to="/courses/$courseId" params={{ courseId: String(c.id) }} className="hover:underline text-primary">{c.fullname}</Link> <span className="text-muted-foreground">· {c.shortname}</span></li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="premium-card p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 truncate font-display text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
