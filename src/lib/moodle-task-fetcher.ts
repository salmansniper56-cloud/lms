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

export async function detectAndFetchMoodleTask(
  token: string,
  moodleUserId: number,
  userMessage: string,
): Promise<ResolvedTask | null> {
  const query = userMessage.toLowerCase();

  // Check if user is asking about a lab, assignment, quiz, or task
  const hasTaskKeyword = /\b(lab|assignment|task|quiz|exercise|oel|ccp|homework)\b/i.test(query);
  if (!hasTaskKeyword) return null;

  try {
    // 1. Get user's enrolled courses
    const courses = await callMoodle<any[]>(token, "core_enrol_get_users_courses", { userid: moodleUserId });
    if (!courses || courses.length === 0) return null;

    // Filter courses if a specific course is mentioned in the query
    let candidateCourses = courses;
    const mentionedCourse = courses.filter((c) => {
      const short = (c.shortname || "").toLowerCase();
      const full = (c.fullname || "").toLowerCase();
      // Match common acronyms/terms like "coal", "ai", "db", "database", "web", "ds", "dld", "ap"
      const terms = ["coal", "ai", "db", "database", "web", "ds", "dld", "ap", "se", "software", "algo", "algebra"];
      for (const term of terms) {
        if (query.includes(term) && (short.includes(term) || full.includes(term))) {
          return true;
        }
      }
      return false;
    });

    if (mentionedCourse.length > 0) {
      candidateCourses = mentionedCourse;
    }

    // 2. Fetch assignments for candidate courses
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

    if (allAssignments.length === 0) return null;

    // 3. Find the best matching assignment
    // Check for number match (e.g., "lab 2", "lab 02", "assignment 1")
    const numMatch = query.match(/\b(?:lab|assignment|task|quiz)\s*(?:task\s*)?#?\s*0?(\d+)\b/i);
    const targetNum = numMatch ? numMatch[1] : null;

    let bestMatch: { course: any; assign: any } | null = null;

    if (targetNum) {
      // Look for assignment whose name contains this number
      bestMatch = allAssignments.find(({ assign }) => {
        const name = (assign.name || "").toLowerCase();
        const regex = new RegExp(`\\b0?${targetNum}\\b`, "i");
        return regex.test(name);
      }) || null;
    }

    // Fallback: match by title similarity
    if (!bestMatch) {
      bestMatch = allAssignments.find(({ assign }) => {
        const name = (assign.name || "").toLowerCase();
        const words = query.split(/\s+/).filter((w) => w.length > 2);
        return words.filter((w) => name.includes(w)).length >= 2;
      }) || null;
    }

    if (!bestMatch) {
      // If user said "solve this course lab 2" and no number was matched, pick the most recent lab
      bestMatch = allAssignments.find(({ assign }) => /lab/i.test(assign.name)) || allAssignments[0];
    }

    if (!bestMatch) return null;

    const { course, assign } = bestMatch;
    const task: ResolvedTask = {
      courseName: course.fullname || course.shortname || "NUML Course",
      taskName: assign.name,
      dueDate: assign.duedate,
      instructions: stripHtml(assign.intro || "").trim(),
    };

    // 4. Download and parse attachment if available
    const attachments = assign.introattachments || [];
    if (attachments.length > 0) {
      const file = attachments[0];
      task.attachmentName = file.filename;

      try {
        const fileUrl = file.fileurl + (file.fileurl.includes("?") ? "&" : "?") + "token=" + token;
        const res = await fetch(fileUrl);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const lowerName = file.filename.toLowerCase();

          if (lowerName.endsWith(".pdf")) {
            const { PDFParse } = await import("pdf-parse");
            const parser = new PDFParse({ data: Buffer.from(buf) });
            const pdfData = await parser.getText();
            task.attachmentContent = (pdfData.text || "").slice(0, 25000);
          } else if (lowerName.endsWith(".docx")) {
            const mammoth = await import("mammoth");
            const textResult = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
            task.attachmentContent = (textResult.value || "").slice(0, 25000);
          } else if (/\.(txt|py|asm|cpp|c|java|sql|html|css|js|md)$/i.test(lowerName)) {
            task.attachmentContent = Buffer.from(buf).toString("utf-8").slice(0, 25000);
          } else {
            task.attachmentContent = `[Attached file: ${file.filename} (${file.mimetype || "unknown type"}, size: ${Math.round(file.filesize / 1024)} KB)]`;
          }
        }
      } catch (err) {
        console.warn("Could not download/parse assignment attachment:", err);
      }
    }

    return task;
  } catch (e) {
    console.warn("detectAndFetchMoodleTask error:", e);
    return null;
  }
}
