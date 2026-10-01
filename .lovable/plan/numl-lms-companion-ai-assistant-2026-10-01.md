# NUML LMS Companion + AI Assistant

A modern website that sits on top of the live NUML Moodle (lms2.numl.edu.pk). Users sign in with their normal NUML Moodle username and password and see their real courses, deadlines, grades and files in a cleaner design, with an AI assistant built in.

## How sign-in works
- Login page asks for NUML Moodle username + password.
- We exchange these with Moodle for a personal access key (the same way the official Moodle mobile app logs in). The password is never stored.
- The app detects the user's role (student / teacher / admin) from Moodle and shows the matching dashboard.

## Pages
1. **Landing** – NUML-branded intro, sign-in button.
2. **Login** – Moodle credentials.
3. **Dashboard** – today's deadlines, upcoming events, recent courses, AI "plan my week" card.
4. **Courses** – grid of enrolled courses with progress.
5. **Course detail** – sections, lectures, files, assignments, quizzes, forums (links open in Moodle where editing is needed).
6. **Calendar / Deadlines** – all due dates in one timeline.
7. **Grades** – per course grade overview.
8. **Messages & Notifications** – Moodle notifications feed.
9. **AI Assistant** – full chat page plus a slide-out panel available on every page.
10. **Teacher tools** (teachers) – my courses, participants, submissions to grade, AI drafts for announcements, quizzes and feedback.
11. **Admin overview** (admins) – site info, course/user counts and search where Moodle permissions allow.

## AI assistant abilities
- **Plan & organize**: reads your real deadlines and builds a study schedule / to-do list.
- **Answer questions**: explains course topics, summarizes course content and descriptions.
- **Help with work**: notes, outlines, practice quiz questions.
- **Teacher helpers**: drafts announcements, quiz questions, grading feedback.
- The AI can look up your Moodle data itself (courses, assignments, grades, calendar) while chatting. It will not submit or change anything in Moodle without you confirming.

## NUML Chat Room (separate from Moodle messaging)
- Our own chat space, independent of Moodle's built-in messages.
- Search people by NUML ID (or name) among users who have signed in to this site.
- Send contact requests, accept/block, then chat one-to-one in real time.
- Group chats (e.g. class groups) with typing indicators, read receipts and unread badges.
- Share DOCX files in chat straight from "My Documents" or by upload; counts toward the 25 GB storage.

## Document library (DOCX storage)
- "My Documents" page: upload, preview, download, rename, delete and organize Word files into folders (per course).
- Total storage budget of 25 GB, with a usage bar; each user sees only their own files (teachers can share files to a course).
- AI can read uploaded DOCX files to summarize, answer questions, or draft new documents.

## Design
Everything above is included, plus: dark/light mode, mobile-friendly layout, global search, Urdu/English toggle, profile & settings, offline-friendly caching of recent data, progress charts, and attendance view where Moodle provides it. Before building, I'll show 3 visual directions to choose from.

## AI provider
AI runs on NVIDIA NIM using your own NVIDIA API key (I'll ask you to add it securely). Default model: the largest NIM chat model available (e.g. Llama 3.1 Nemotron Ultra 253B); the model name will be a setting you can change anytime.
Before building, I'll show 3 visual directions to choose from.

## Important limitation
This only works if NUML's Moodle has "mobile app / web services" access enabled (it usually is if the Moodle mobile app works for NUML). If it's disabled, login will fail and the NUML IT team would need to enable it. I'll test this first; if blocked, I'll build with sample data and a clear message.

## Technical details
- Moodle REST calls via server functions (`/login/token.php?service=moodle_mobile_app`, `/webservice/rest/server.php`): `core_webservice_get_site_info`, `core_enrol_get_users_courses`, `core_course_get_contents`, `mod_assign_get_assignments`, `core_calendar_get_action_events_by_timesort`, `gradereport_overview_get_course_grades`, `message_popup_get_popup_notifications`, teacher/admin functions as permitted.
- Moodle token kept in an encrypted, httpOnly session cookie; all Moodle calls proxied server-side (avoids CORS, hides token).
- Lovable Cloud for saving AI chat threads and study plans per user (keyed by Moodle user id + site).
- Lovable Cloud private file storage for DOCX (per-file limit set; a 25 GB total quota tracked in a usage table and enforced on upload). Storage beyond the plan's included amount is billed by usage.
- Chat: profiles table (Moodle user id, NUML ID, name, role), contacts, conversations, members, messages, attachments; realtime updates; access rules so only conversation members read messages/files. NUML ID taken from the Moodle profile (username/idnumber).
- AI via NVIDIA NIM OpenAI-compatible API (`https://integrate.api.nvidia.com/v1`), key stored as secret `NVIDIA_API_KEY`, model name configurable; tools call the Moodle server functions; write actions require approval.
- Threaded AI conversations saved in the database, each with its own page URL.
