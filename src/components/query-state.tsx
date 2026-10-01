import { Loader2, AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function Loading() {
  return (
    <div className="flex items-center gap-2 px-6 py-10 text-sm text-muted-foreground md:px-10">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading from NUML LMS…
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  const msg = (error as any)?.message || "Something went wrong.";
  return (
    <div className="mx-6 my-6 flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm md:mx-10">
      <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
      <div>
        <p>{msg}</p>
        {/sign in again|invalid token|token/i.test(msg) && (
          <Link to="/auth" className="mt-1 inline-block font-medium underline">Sign in again</Link>
        )}
      </div>
    </div>
  );
}

export function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function relDays(ts: number) {
  const d = Math.round((ts * 1000 - Date.now()) / 86400000);
  if (d < 0) return `${-d}d overdue`;
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `in ${d} days`;
}

const hues = [258, 78, 155, 25, 220, 300];
export function courseCover(id: number) {
  const h = hues[id % hues.length] ?? 258;
  return `linear-gradient(135deg, oklch(0.42 0.1 ${h}), oklch(0.3 0.08 ${(h + 40) % 360}))`;
}
