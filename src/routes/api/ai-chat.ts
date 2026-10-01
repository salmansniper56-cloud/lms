import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(200000) })).max(100),
  mode: z.string().max(40).optional(),
});

export const Route = createFileRoute("/api/ai-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!auth) return Response.json({ error: "Please sign in to use the AI assistant." }, { status: 401 });

        let userId: string | null = null;
        try {
          const { createClient } = await import("@supabase/supabase-js");
          const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
          const sb = createClient(process.env["SUPABASE_URL"]!, key, { auth: { persistSession: false } });
          const { data: u } = await sb.auth.getUser(auth);
          if (u?.user) userId = u.user.id;
        } catch {}

        if (!userId && auth.split(".").length === 3) {
          try {
            const payload = JSON.parse(Buffer.from(auth.split(".")[1], "base64url").toString("utf8"));
            if (payload?.sub) {
              userId = payload.sub;
              if (payload.moodleToken) {
                const { setMoodleSessionCache } = await import("@/lib/moodle.server");
                setMoodleSessionCache(payload.sub, {
                  token: payload.moodleToken,
                  moodleUserId: Number(payload.moodleUserId),
                  role: payload.role || "student",
                  fullName: payload.fullName || "Student",
                  numlId: payload.numlId || "",
                });
              }
            }
          } catch {}
        }

        if (!userId) return Response.json({ error: "Session expired. Please sign in again." }, { status: 401 });

        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

        const apiKey = process.env["NVIDIA_API_KEY"];
        if (!apiKey) {
          return Response.json(
            { error: "The AI assistant is temporarily unavailable. Please try again later." },
            { status: 503 },
          );
        }
        const model = process.env["NVIDIA_MODEL"] || "nvidia/nemotron-3-ultra-550b-a55b";

        // Build Moodle context
        let context = "";
        try {
          const { getMoodleSession, getCourses, getUpcomingEvents } = await import("@/lib/moodle.server");
          const s = await getMoodleSession(userId);
          const [courses, events] = await Promise.all([
            getCourses(s.token, s.moodleUserId),
            getUpcomingEvents(s.token, 30).catch(() => []),
          ]);
          context =
            `User: ${s.fullName} (NUML ID ${s.numlId}), role: ${s.role}.\n` +
            `Today: ${new Date().toUTCString()}\n` +
            `Courses:\n${courses.map((c) => `- ${c.fullname}${c.progress != null ? ` (${c.progress}% complete)` : ""}`).join("\n")}\n` +
            `Upcoming deadlines/events:\n${events
              .map((e) => `- ${e.name} [${e.course ?? ""}] due ${new Date(e.timesort * 1000).toUTCString()}${e.overdue ? " (OVERDUE)" : ""}`)
              .join("\n") || "none"}`;
        } catch {
          context = "Moodle data unavailable right now.";
        }

        const system =
          "You are NUML Scholar, the AI assistant for the National University of Modern Languages LMS. " +
          "Help students and teachers plan and organise study, explain course topics, summarise documents, draft notes, outlines, practice quizzes, " +
          "and for teachers draft announcements, quiz questions and feedback. Use markdown. Be concise and practical. " +
          "Never claim to have submitted or changed anything in Moodle.\n\n" +
          "Live LMS context:\n" + context;

        const upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({
            model,
            stream: true,
            temperature: 0.6,
            messages: [{ role: "system", content: system }, ...parsed.data.messages],
          }),
          signal: request.signal,
        });
        if (!upstream.ok || !upstream.body) {
          const t = await upstream.text().catch(() => "");
          console.error("NVIDIA error", upstream.status, t.slice(0, 500));
          const msg =
            upstream.status === 401 || upstream.status === 403
              ? "The AI assistant is temporarily unavailable. Please try again later."
              : upstream.status === 429
                ? "The AI is busy right now. Please try again in a moment."
                : upstream.status === 404
                  ? `The AI model "${model}" isn't available on your NVIDIA account.`
                  : "The AI service had a problem. Please try again.";
          return Response.json({ error: msg }, { status: upstream.status });
        }
        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" },
        });
      },
    },
  },
});
