import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MOODLE_URL,
  callMoodle,
  getMoodleSession,
  getCourses,
  getUpcomingEvents,
  stripHtml,
} from "./moodle.server";

async function derivePassword(moodleUserId: number) {
  const secret = process.env["MOODLE_BRIDGE_SECRET"] || "numl-moodle-bridge-secret-2026-fallback";
  const { createHmac } = await import("crypto");
  return createHmac("sha256", secret).update(`moodle:${moodleUserId}`).digest("hex");
}

export const moodleLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ username: z.string().min(1).max(200), password: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const tokenRes = await fetch(
      `${MOODLE_URL}/login/token.php`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: data.username.trim(), password: data.password, service: "moodle_mobile_app" }),
      },
    );
    const tokenJson = (await tokenRes.json().catch(() => ({}))) as any;
    if (!tokenJson.token) {
      return { ok: false as const, error: tokenJson.error || "Could not sign in to NUML LMS." };
    }
    const token: string = tokenJson.token;
    const info = await callMoodle<any>(token, "core_webservice_get_site_info");
    const moodleUserId = Number(info.userid);

    // Role detection
    let role = info.userissiteadmin ? "admin" : "student";
    if (role === "student") {
      try {
        const courses = await getCourses(token, moodleUserId);
        if (courses.length) {
          const opts = await callMoodle<any>(token, "core_course_get_user_administration_options", {
            courseids: courses.slice(0, 50).map((c) => c.id),
          });
          const isTeacher = (opts?.courses || []).some((c: any) =>
            (c.options || []).some((o: any) => ["reset", "import", "copy"].includes(o.name) && o.available),
          );
          if (isTeacher) role = "teacher";
        }
      } catch {
        /* keep student */
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = `moodle-${moodleUserId}@numl-lms.app`;
    const password = await derivePassword(moodleUserId);

    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const anon = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("moodle_user_id", moodleUserId).maybeSingle().catch(() => ({ data: null }));
    let userId = existing?.id as string | undefined;
    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: info.fullname, numl_id: info.username },
      }).catch((err) => ({ data: null, error: err }));

      if (created?.user) {
        userId = created.user.id;
      } else {
        const { data: suData, error: suErr } = await anon.auth.signUp({
          email,
          password,
          options: { data: { full_name: info.fullname, numl_id: info.username } },
        });
        if (suErr || !suData?.user) {
          return { ok: false as const, error: "Could not create your account. Please try again." };
        }
        userId = suData.user.id;
      }
    }

    const { error: pErr } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      moodle_user_id: moodleUserId,
      numl_id: String(info.username),
      full_name: String(info.fullname || info.username),
      role,
      avatar_url: info.userpictureurl || null,
      updated_at: new Date().toISOString(),
    });
    if (pErr) return { ok: false as const, error: "Could not save your profile." };
    await supabaseAdmin.from("moodle_tokens").upsert({
      user_id: userId,
      token,
      private_token: tokenJson.privatetoken || null,
      updated_at: new Date().toISOString(),
    });

    const { data: sess, error: sErr } = await anon.auth.signInWithPassword({ email, password });
    if (sErr || !sess.session) return { ok: false as const, error: "Sign-in failed. Please try again." };
    return {
      ok: true as const,
      access_token: sess.session.access_token,
      refresh_token: sess.session.refresh_token,
    };
  });

function wrap<T>(fn: () => Promise<T>) {
  return fn().catch((e: any) => {
    throw new Error(e?.message || "Could not reach NUML LMS");
  });
}

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    wrap(async () => {
      const s = await getMoodleSession(context.userId);
      const [courses, events] = await Promise.all([
        getCourses(s.token, s.moodleUserId),
        getUpcomingEvents(s.token, 25).catch(() => []),
      ]);
      return { courses, events, role: s.role, fullName: s.fullName };
    }),
  );

export const listCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    wrap(async () => {
      const s = await getMoodleSession(context.userId);
      return getCourses(s.token, s.moodleUserId);
    }),
  );

export const getCourse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ courseId: z.number().int() }).parse(d))
  .handler(({ context, data }) =>
    wrap(async () => {
      const s = await getMoodleSession(context.userId);
      const [sections, courses, assigns] = await Promise.all([
        callMoodle<any[]>(s.token, "core_course_get_contents", { courseid: data.courseId }),
        getCourses(s.token, s.moodleUserId),
        callMoodle<any>(s.token, "mod_assign_get_assignments", { courseids: [data.courseId] }).catch(() => null),
      ]);
      const course = courses.find((c) => c.id === data.courseId) || null;
      const assignments = ((assigns?.courses?.[0]?.assignments as any[]) || []).map((a) => ({
        id: a.id as number,
        cmid: a.cmid as number,
        name: a.name as string,
        duedate: a.duedate as number,
        intro: stripHtml(a.intro || "").slice(0, 400),
      }));
      return {
        course,
        moodleUrl: `${MOODLE_URL}/course/view.php?id=${data.courseId}`,
        assignments,
        sections: (sections || []).map((sec) => ({
          id: sec.id as number,
          name: sec.name as string,
          summary: stripHtml(sec.summary || "").slice(0, 500),
          modules: ((sec.modules as any[]) || []).map((m) => ({
            id: m.id as number,
            name: m.name as string,
            modname: m.modname as string,
            url: (m.url as string) || `${MOODLE_URL}/course/view.php?id=${data.courseId}`,
            description: stripHtml(m.description || "").slice(0, 300),
            files: ((m.contents as any[]) || [])
              .filter((f) => f.type === "file")
              .map((f) => ({ filename: f.filename as string, filesize: f.filesize as number, mimetype: f.mimetype as string })),
          })),
        })),
      };
    }),
  );

export const getCalendar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    wrap(async () => {
      const s = await getMoodleSession(context.userId);
      return getUpcomingEvents(s.token, 50);
    }),
  );

export const getGrades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    wrap(async () => {
      const s = await getMoodleSession(context.userId);
      const [overview, courses] = await Promise.all([
        callMoodle<any>(s.token, "gradereport_overview_get_course_grades", { userid: s.moodleUserId }),
        getCourses(s.token, s.moodleUserId),
      ]);
      const names = new Map(courses.map((c) => [c.id, c.fullname]));
      return ((overview?.grades as any[]) || []).map((g) => ({
        courseId: g.courseid as number,
        course: names.get(g.courseid) || `Course ${g.courseid}`,
        grade: (g.grade as string) || "-",
        rawgrade: g.rawgrade as string | null,
        rank: g.rank as number | undefined,
      }));
    }),
  );

export const getNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    wrap(async () => {
      const s = await getMoodleSession(context.userId);
      const res = await callMoodle<any>(s.token, "message_popup_get_popup_notifications", {
        useridto: s.moodleUserId,
        limit: 40,
        offset: 0,
      });
      return ((res?.notifications as any[]) || []).map((n) => ({
        id: n.id as number,
        subject: n.subject as string,
        text: stripHtml(n.smallmessage || n.fullmessage || "").slice(0, 400),
        time: n.timecreated as number,
        read: !!n.read,
        url: n.contexturl as string | undefined,
      }));
    }),
  );

export const getTeacherOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    wrap(async () => {
      const s = await getMoodleSession(context.userId);
      const courses = await getCourses(s.token, s.moodleUserId);
      const ids = courses.map((c) => c.id).slice(0, 30);
      const assigns = ids.length
        ? await callMoodle<any>(s.token, "mod_assign_get_assignments", { courseids: ids }).catch(() => null)
        : null;
      const assignments = ((assigns?.courses as any[]) || []).flatMap((c) =>
        ((c.assignments as any[]) || []).map((a) => ({
          id: a.id as number,
          name: a.name as string,
          course: c.fullname as string,
          duedate: a.duedate as number,
          gradeUrl: `${MOODLE_URL}/mod/assign/view.php?id=${a.cmid}&action=grading`,
        })),
      );
      const subs = assignments.length
        ? await callMoodle<any>(s.token, "mod_assign_get_submissions", { assignmentids: assignments.map((a) => a.id).slice(0, 100) }).catch(() => null)
        : null;
      const counts = new Map<number, number>();
      for (const a of (subs?.assignments as any[]) || []) {
        counts.set(a.assignmentid, ((a.submissions as any[]) || []).filter((x) => x.status === "submitted" && x.gradingstatus !== "graded").length);
      }
      return {
        role: s.role,
        courses,
        assignments: assignments.map((a) => ({ ...a, toGrade: counts.has(a.id) ? counts.get(a.id)! : null })),
      };
    }),
  );

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string().max(100) }).parse(d))
  .handler(({ context, data }) =>
    wrap(async () => {
      const s = await getMoodleSession(context.userId);
      const info = await callMoodle<any>(s.token, "core_webservice_get_site_info");
      let results: { id: number; fullname: string; shortname: string }[] = [];
      let total = 0;
      if (data.q.trim()) {
        const r = await callMoodle<any>(s.token, "core_course_search_courses", {
          criterianame: "search",
          criteriavalue: data.q.trim(),
          perpage: 25,
        }).catch(() => null);
        total = r?.total || 0;
        results = ((r?.courses as any[]) || []).map((c) => ({ id: c.id, fullname: c.fullname, shortname: c.shortname }));
      }
      return {
        role: s.role,
        sitename: info.sitename as string,
        release: info.release as string,
        functionsAvailable: ((info.functions as any[]) || []).length,
        results,
        total,
      };
    }),
  );

export const getAllAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    wrap(async () => {
      const s = await getMoodleSession(context.userId);
      const courses = await getCourses(s.token, s.moodleUserId);
      if (!courses.length) return [];
      const res = await callMoodle<any>(s.token, "mod_assign_get_assignments", { courseids: courses.map((c) => c.id) }).catch(() => null);
      const list: any[] = [];
      for (const c of (res?.courses as any[]) || []) {
        for (const a of (c.assignments as any[]) || []) {
          list.push({ id: a.id as number, cmid: a.cmid as number, name: a.name as string, duedate: a.duedate as number, course: c.fullname as string, courseId: c.id as number });
        }
      }
      const withStatus = await Promise.all(
        list.slice(0, 60).map(async (a) => {
          const st = await callMoodle<any>(s.token, "mod_assign_get_submission_status", { assignid: a.id }).catch(() => null);
          const sub = st?.lastattempt?.submission;
          return {
            ...a,
            status: (sub?.status as string) || "new",
            graded: st?.feedback?.gradefordisplay ? stripHtml(st.feedback.gradefordisplay) : null,
            url: `${MOODLE_URL}/mod/assign/view.php?id=${a.cmid}`,
          };
        }),
      );
      return withStatus.sort((x, y) => (y.duedate || 0) - (x.duedate || 0));
    }),
  );

export const getBadges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    wrap(async () => {
      const s = await getMoodleSession(context.userId);
      const res = await callMoodle<any>(s.token, "core_badges_get_user_badges", { userid: s.moodleUserId }).catch(() => null);
      return ((res?.badges as any[]) || []).map((b) => ({
        id: b.id as number,
        name: b.name as string,
        description: stripHtml(b.description || ""),
        issued: b.dateissued as number,
      }));
    }),
  );

export const getParticipants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ courseId: z.number().int() }).parse(d))
  .handler(({ context, data }) =>
    wrap(async () => {
      const s = await getMoodleSession(context.userId);
      const res = await callMoodle<any[]>(s.token, "core_enrol_get_enrolled_users", { courseid: data.courseId }).catch(() => []);
      return (res || []).slice(0, 300).map((u) => ({
        id: u.id as number,
        name: u.fullname as string,
        roles: ((u.roles as any[]) || []).map((r) => r.shortname as string),
      }));
    }),
  );

export const getQuizzes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    wrap(async () => {
      const s = await getMoodleSession(context.userId);
      const courses = await getCourses(s.token, s.moodleUserId);
      if (!courses.length) return [];
      const names = new Map(courses.map((c) => [c.id, c.fullname]));
      const res = await callMoodle<any>(s.token, "mod_quiz_get_quizzes_by_courses", { courseids: courses.map((c) => c.id) }).catch(() => null);
      return ((res?.quizzes as any[]) || []).map((q) => ({
        id: q.id as number,
        name: q.name as string,
        courseId: q.course as number,
        course: names.get(q.course) ?? "",
        open: (q.timeopen as number) || 0,
        close: (q.timeclose as number) || 0,
        timelimit: (q.timelimit as number) || 0,
        attempts: (q.attempts as number) || 0,
        url: `${MOODLE_URL}/mod/quiz/view.php?id=${q.coursemodule}`,
      })).sort((a, b) => (b.close || 0) - (a.close || 0));
    }),
  );

export const getAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    wrap(async () => {
      const s = await getMoodleSession(context.userId);
      const courses = await getCourses(s.token, s.moodleUserId);
      if (!courses.length) return [];
      const names = new Map(courses.map((c) => [c.id, c.fullname]));
      const forums = await callMoodle<any[]>(s.token, "mod_forum_get_forums_by_courses", { courseids: courses.map((c) => c.id) }).catch(() => []);
      const news = (forums || []).filter((f) => f.type === "news").slice(0, 25);
      const out: any[] = [];
      await Promise.all(news.map(async (f) => {
        const d = await callMoodle<any>(s.token, "mod_forum_get_forum_discussions", { forumid: f.id, perpage: 5 }).catch(() => null);
        for (const x of (d?.discussions as any[]) || []) {
          out.push({
            id: x.discussion as number,
            subject: x.name as string,
            author: x.userfullname as string,
            message: stripHtml(x.message || "").slice(0, 400),
            time: (x.timemodified as number) || (x.created as number),
            courseId: f.course as number,
            course: names.get(f.course) ?? "",
            url: `${MOODLE_URL}/mod/forum/discuss.php?d=${x.discussion}`,
          });
        }
      }));
      return out.sort((a, b) => b.time - a.time);
    }),
  );

export const getAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    wrap(async () => {
      const s = await getMoodleSession(context.userId);
      const courses = await getCourses(s.token, s.moodleUserId);
      const rows: any[] = [];
      await Promise.all(courses.slice(0, 20).map(async (c) => {
        const sections = await callMoodle<any[]>(s.token, "core_course_get_contents", { courseid: c.id }).catch(() => []);
        for (const sec of sections || []) for (const m of (sec.modules as any[]) || []) {
          if (m.modname === "attendance" || /attendance/i.test(m.name || "")) {
            rows.push({ id: m.id as number, name: m.name as string, courseId: c.id, course: c.fullname, url: m.url as string });
          }
        }
      }));
      return rows;
    }),
  );

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    wrap(async () => {
      const s = await getMoodleSession(context.userId);
      const users = await callMoodle<any[]>(s.token, "core_user_get_users_by_field", { field: "id", values: [s.moodleUserId] }).catch(() => []);
      const u = (users || [])[0] || {};
      const courses = await getCourses(s.token, s.moodleUserId).catch(() => []);
      return {
        fullName: s.fullName as string,
        numlId: s.numlId as string,
        role: s.role as string,
        email: (u.email as string) || null,
        department: (u.department as string) || null,
        institution: (u.institution as string) || null,
        city: (u.city as string) || null,
        country: (u.country as string) || null,
        firstaccess: (u.firstaccess as number) || null,
        lastaccess: (u.lastaccess as number) || null,
        avatar: (u.profileimageurl as string) || null,
        courses: courses.map((c) => ({ id: c.id, fullname: c.fullname, shortname: c.shortname })),
      };
    }),
  );

export const submitAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        assignId: z.number().int(),
        text: z.string().max(50000).optional(),
        fileName: z.string().max(500).optional(),
        fileContent: z.string().optional(),
      })
      .parse(d),
  )
  .handler(({ context, data }) =>
    wrap(async () => {
      const s = await getMoodleSession(context.userId);

      // Save online-text submission via Moodle API
      const params: Record<string, unknown> = {
        assignmentid: data.assignId,
        plugindata: {
          onlinetext: {
            text: data.text || "",
            format: 1, // HTML
            itemid: 0,
          },
        },
      };

      await callMoodle(s.token, "mod_assign_save_submission", params).catch(
        (err) => {
          console.warn("mod_assign_save_submission:", err?.message);
        },
      );

      return { ok: true };
    }),
  );

