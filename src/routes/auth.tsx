import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { moodleLogin } from "@/lib/moodle.functions";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — NUML Scholar" },
      { name: "description", content: "Sign in with your NUML LMS username and password." },
      { property: "og:title", content: "Sign in — NUML Scholar" },
      { property: "og:description", content: "Use your NUML LMS account to sign in." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const login = useServerFn(moodleLogin);
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await login({ data: { username, password } });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      setError(err?.message || "Could not reach NUML LMS.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between p-12 text-primary-foreground md:flex" style={{ background: "var(--gradient-hero)" }}>
        <Link to="/" className="font-display text-2xl font-semibold">NUML Scholar</Link>
        <div>
          <h2 className="text-4xl font-semibold leading-tight">One sign-in. All of NUML LMS.</h2>
          <p className="mt-4 max-w-md opacity-80">Your courses, deadlines and grades — all within the NUML Scholar academic portal.</p>
        </div>
        <p className="text-sm opacity-60">National University of Modern Languages</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="text-3xl font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Use your NUML LMS username and password.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="u">Username / NUML ID</Label>
            <Input id="u" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p">Password</Label>
            <Input id="p" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
          </Button>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> Your password is sent only to NUML LMS and is never stored.
          </p>
        </form>
      </div>
    </div>
  );
}
