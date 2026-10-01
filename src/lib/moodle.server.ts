export const MOODLE_URL = "https://lms2.numl.edu.pk";

function flatten(obj: unknown, prefix: string, out: URLSearchParams) {
  if (obj === undefined || obj === null) return;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}[${k}]` : k, out);
    }
  } else {
    out.append(prefix, String(obj));
  }
}

export class MoodleError extends Error {
  code?: string | undefined;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export async function callMoodle<T = any>(
  token: string,
  wsfunction: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const body = new URLSearchParams();
  body.append("wstoken", token);
  body.append("wsfunction", wsfunction);
  body.append("moodlewsrestformat", "json");
  flatten(params, "", body);
  const res = await fetch(`${MOODLE_URL}/webservice/rest/server.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new MoodleError(`Moodle request failed (${res.status})`);
  const data = await res.json();
  if (data && typeof data === "object" && "exception" in data) {
    throw new MoodleError(data.message || "Moodle error", data.errorcode);
  }
  return data as T;
}

export async function getMoodleSession(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: tok } = await supabaseAdmin
    .from("moodle_tokens")
    .select("token")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("moodle_user_id, role, full_name, numl_id")
    .eq("id", userId)
    .maybeSingle();
  if (!tok?.token || !profile) throw new MoodleError("Please sign in again with your NUML account.", "nosession");
  return { token: tok.token, moodleUserId: Number(profile.moodle_user_id), role: profile.role, fullName: profile.full_name, numlId: profile.numl_id };
}

export async function getCourses(token: string, moodleUserId: number) {
  const list = await callMoodle<any[]>(token, "core_enrol_get_users_courses", { userid: moodleUserId });
  return (list || []).map((c) => ({
    id: c.id as number,
    shortname: c.shortname as string,
    fullname: c.fullname as string,
    summary: stripHtml(c.summary || "").slice(0, 300),
    progress: typeof c.progress === "number" ? Math.round(c.progress) : null,
    lastaccess: c.lastaccess as number | null,
    enrolledusercount: c.enrolledusercount as number | undefined,
    category: c.category as number | undefined,
  }));
}

export async function getUpcomingEvents(token: string, limit = 40) {
  const now = Math.floor(Date.now() / 1000);
  const res = await callMoodle<any>(token, "core_calendar_get_action_events_by_timesort", {
    timesortfrom: now - 86400 * 2,
    limitnum: limit,
  });
  return ((res?.events as any[]) || []).map((e) => ({
    id: e.id as number,
    name: e.name as string,
    course: e.course?.fullname as string | undefined,
    courseId: e.course?.id as number | undefined,
    modulename: e.modulename as string | undefined,
    timesort: e.timesort as number,
    url: e.url as string | undefined,
    overdue: !!e.overdue,
    actionable: !!e.action?.actionable,
  }));
}

export function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
