import type { ReactNode } from "react";

export function DataTable({ head, children, empty, isEmpty }: { head: ReactNode[]; children: ReactNode; empty?: string; isEmpty?: boolean }) {
  return (
    <div className="premium-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
          <tr>{head.map((h, i) => <th key={i} className="whitespace-nowrap px-4 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y [&_td]:px-4 [&_td]:py-2.5 [&_tr:hover]:bg-muted/40">{children}</tbody>
      </table>
      {isEmpty && <p className="p-4 text-sm text-muted-foreground">{empty ?? "Nothing to show."}</p>}
    </div>
  );
}

export function StatusBadge({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted"; children: ReactNode }) {
  const cls = { ok: "bg-success/15 text-success", warn: "bg-accent text-accent-foreground", bad: "bg-destructive/10 text-destructive", muted: "bg-muted text-muted-foreground" }[tone];
  return <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

/** @deprecated No longer redirects externally — kept for import compatibility */
export function MoodleLink({ href }: { href: string }) {
  return null;
}
