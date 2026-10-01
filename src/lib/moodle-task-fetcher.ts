import { callMoodle } from "./moodle.server";
import { stripHtml } from "./moodle.server";

export interface ResolvedTask {
  courseName: string;
  taskName: string;
  dueDate?: number;
  instructions: string;
  attachmentName?: string;
  attachmentContent?: string;
}

async function extractFileContent(
  filename: string,
  fileurl: string,
  token: string,
): Promise<string | undefined> {
  try {
    const fullUrl = fileurl + (fileurl.includes("?") ? "&" : "?") + "token=" + token;
    const res = await fetch(fullUrl);
    if (!res.ok) return undefined;
    const buf = await res.arrayBuffer();
    const lower = filename.toLowerCase();

    if (lower.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const textResult = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
      return (textResult.value || "").slice(0, 30000);
    } else if (lower.endsWith(".pdf")) {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: Buffer.from(buf) });
      const pdfData = await parser.getText();
      return (pdfData.text || "").slice(0, 30000);
    } else if (/\.(txt|py|asm|cpp|c|java|sql|html|css|js|md)$/i.test(lower)) {
      return Buffer.from(buf).toString("utf-8").slice(0, 30000);
    }
  } catch (err) {
    console.warn("Could not download/parse file:", filename, err);
  }
  return undefined;
}

export async function detectAndFetchMoodleTask(
  token: string,
  moodleUserId: number,
  userMessage: string,
): Promise<ResolvedTask | null> {
  const query = userMessage.toLowerCase();

  // Check if user is asking about a lab, assignment, quiz, or task
  const hasTaskKeyword = /\b(lab|assignment|task|quiz|exercise|oel|ccp|homework|project)\b/i.test(query);
  if (!hasTaskKeyword) return null;

  try {
    // 1. Get user's enrolled courses
    const courses = await callMoodle<any[]>(token, "core_enrol_get_users_courses", { userid: moodleUserId });
    if (!courses || courses.length === 0) return null;

    // Filter courses if a specific course is mentioned in the query
    let candidateCourses = courses;
    const courseKeywords = [
      "coal", "ai", "db", "database", "web", "ds", "data structure",
      "dld", "ap", "physics", "se", "software", "algo", "algorithm",
      "math", "algebra", "network", "security", "os", "operating system",
    ];

    const matchedCourses = courses.filter((c) => {
      const short = (c.shortname || "").toLowerCase();
      const full = (c.fullname || "").toLowerCase();
      return courseKeywords.some((term) => query.includes(term) && (short.includes(term) || full.includes(term)));
    });

    if (matchedCourses.length > 0) {
      candidateCourses = matchedCourses;
    }

    // Number matching (e.g., "lab 2", "lab 02", "assignment 1")
    const numMatch = query.match(/\b(?:lab|assignment|task|quiz|exercise|week)\s*(?:task\s*)?#?\s*0?(\d+)\b/i);
    const targetNum = numMatch ? numMatch[1] : null;

    // 2. First search course sections / resources (where lab manuals and handouts are posted)
    for (const c of candidateCourses) {
      try {
        const sections = await callMoodle<any[]>(token, "core_course_get_contents", { courseid: c.id });
        if (Array.isArray(sections)) {
          for (const s of sections) {
            for (const m of (s.modules || [])) {
              const modName = (m.name || "").toLowerCase();
              const isMatch = targetNum
                ? /\b(lab|task|assignment)\b/i.test(modName) && new RegExp(`\\b0?${targetNum}\\b`, "i").test(modName)
                : query.split(/\s+/).filter((w) => w.length > 2).some((w) => modName.includes(w));

              if (isMatch && m.contents && m.contents.length > 0) {
                // Found matched resource file!
                const file = m.contents[0];
                const content = await extractFileContent(file.filename, file.fileurl, token);
                if (content) {
                  return {
                    courseName: c.fullname || c.shortname,
                    taskName: m.name,
                    instructions: stripHtml(m.description || "").trim(),
                    attachmentName: file.filename,
                    attachmentContent: content,
                  };
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("Could not check course contents for course", c.id, err);
      }
    }

    // 3. Fallback: Search assignment submission links
    const courseIds = candidateCourses.map((c) => c.id);
    const params: Record<string, unknown> = {};
    courseIds.forEach((id, idx) => {
      params[`courseids[${idx}]`] = id;
    });

    const assignRes = await callMoodle<any>(token, "mod_assign_get_assignments", params);
    const allAssignments: { course: any; assign: any }[] = [];

    (assignRes?.courses || []).forEach((c: any) => {
      const matchedCourse = candidateCourses.find((cc) => cc.id === c.id);
      (c.assignments || []).forEach((a: any) => {
        allAssignments.push({ course: matchedCourse || c, assign: a });
      });
    });

    let bestAssign: { course: any; assign: any } | null = null;
    if (targetNum) {
      bestAssign = allAssignments.find(({ assign }) => {
        const name = (assign.name || "").toLowerCase();
        return new RegExp(`\\b0?${targetNum}\\b`, "i").test(name);
      }) || null;
    }

    if (!bestAssign) {
      bestAssign = allAssignments.find(({ assign }) => {
        const name = (assign.name || "").toLowerCase();
        return query.split(/\s+/).filter((w) => w.length > 2).filter((w) => name.includes(w)).length >= 2;
      }) || null;
    }

    if (bestAssign) {
      const { course, assign } = bestAssign;
      let attachmentName: string | undefined;
      let attachmentContent: string | undefined;

      const attachments = assign.introattachments || [];
      if (attachments.length > 0) {
        const file = attachments[0];
        attachmentName = file.filename;
        attachmentContent = await extractFileContent(file.filename, file.fileurl, token);
      }

      return {
        courseName: course.fullname || course.shortname,
        taskName: assign.name,
        dueDate: assign.duedate,
        instructions: stripHtml(assign.intro || "").trim(),
        attachmentName,
        attachmentContent,
      };
    }

    return null;
  } catch (e) {
    console.warn("detectAndFetchMoodleTask error:", e);
    return null;
  }
}
