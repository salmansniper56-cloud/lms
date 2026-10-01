<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- Moodle (lms2.numl.edu.pk) is reached only from server code in `src/lib/moodle.server.ts` / `moodle.functions.ts`; Moodle tokens live in the service-only `moodle_tokens` table — never sent to the browser.
- Sign-in bridges Moodle to Lovable Cloud auth: one auth user per Moodle user, password derived by HMAC with `MOODLE_BRIDGE_SECRET` — keeps RLS keyed on `auth.uid()`.
- AI chat streams through the `/api/ai-chat` server route to NVIDIA NIM (`NVIDIA_API_KEY`, optional `NVIDIA_MODEL`) — user chose NIM over the built-in gateway.
- DOCX files live in the private `documents` bucket under `<uid>/…`; sharing works via chat messages referencing `documents` rows (`can_read_document`).
- DOCX parsing (mammoth) runs in the browser, not the Worker — avoids server runtime limits.
