## 1. Fix the login flow

The runtime error `Cannot create property '_interval' on number '22'` comes from `src/hooks/use-water-reminder.ts` — in browsers `setTimeout` returns a number, so attaching `._interval` to it throws. This crash bubbles up through the `_authenticated` layout right after sign-in, which is why the email/password login appears broken (auth succeeds, then the app crashes on `/today`).

Fix: rewrite the hook to keep the interval id in a normal variable inside the effect (no property attached to the timeout id). Also harden the auth page so a stale/invalid session doesn't block re-login.

## 2. New "Worry Time" dashboard

Route: `/worry` (under `_authenticated`), added to the sidebar nav as **Worry Time**.

Sections on the page:

- **Morning motivation** — a real-life, actionable motivational quote shown once per day at the top (rotates daily, deterministic per date so it doesn't change on refresh). Sourced from a curated list of real people (athletes, founders, authors, etc.) with an "implement today" one-liner.
- **Today's worries** — quick add input + list of worries logged today (text, optional intensity 1–5). Each worry can be marked "resolved" or "carried over."
- **Start Worry Time** — a 20-minute timer (configurable default 20). While running, the day's worries are displayed as cards you can journal a short response into. When the timer ends, the session is saved with notes.
- **Zuki chat** — an inline chatbot named **Zuki** scoped to worries. Reuses the existing chat infra; threads tagged with `kind = 'worry'`. Zuki's system prompt: warm, CBT-flavored coach that helps reframe worries, references today's/this week's entries.
- **Weekly evaluation** — once 7 days of data exist (or on-demand "Generate weekly report" button each Sunday/after 7 sessions), Zuki produces a markdown report: themes, recurring worries, resolved vs carried, improvements, encouragement. Stored and listed in a "Past reports" accordion.

## 3. Database (new migration)

- `worries` — `user_id`, `content`, `intensity` (1–5, nullable), `status` ('open' | 'resolved' | 'carried'), `worry_date`, timestamps.
- `worry_sessions` — `user_id`, `session_date`, `duration_minutes`, `notes` (jsonb: `{ worryId: reflection }`), `completed_at`.
- `worry_reports` — `user_id`, `week_start`, `week_end`, `summary` (markdown), `created_at`.
- Extend `chat_threads` with a nullable `kind` text column (`'book' | 'worry' | null`) so Zuki threads are scoped (already has `book_id`; this is a parallel scoping signal for non-book contexts).
- RLS + GRANTs per the standard pattern (`auth.uid() = user_id`, `authenticated` + `service_role`).

## 4. Server endpoints

`src/routes/api/worry.ts` (createFileRoute server route, `requireSupabaseAuth`-equivalent via existing pattern):
- `POST action=weekly_report` — pulls last 7 days of worries + sessions, calls Lovable AI gateway, returns + stores the report.
- `POST action=daily_quote` — returns today's motivational quote (deterministic by date + user, drawn from curated real-life list).

Chat: extend `src/routes/api/chat.ts` so when a thread's `kind = 'worry'`, the system prompt injects Zuki's persona + the last 7 days of worries and sessions for grounding.

## 5. Files to create / edit

**Create**
- `src/routes/_authenticated/worry.tsx` — dashboard UI (quote, worries list, timer, Zuki chat, weekly report panel).
- `src/routes/api/worry.ts` — report + daily quote endpoints.
- `src/lib/worry-quotes.ts` — curated real-life motivational quotes with "implement today" notes.
- `supabase/migrations/<ts>_worry_time.sql` — tables, RLS, grants, `chat_threads.kind` column.

**Edit**
- `src/hooks/use-water-reminder.ts` — fix the timer cleanup bug (root cause of broken login).
- `src/routes/_authenticated/route.tsx` — add Worry Time nav item.
- `src/routes/api/chat.ts` — Zuki persona + worry-context injection when `kind = 'worry'`.
- `src/integrations/supabase/types.ts` — regenerated after migration.

## Technical notes

- Timer runs purely client-side with `setInterval`; persists `startedAt` to `localStorage` so a refresh keeps the countdown.
- Daily quote selection: `hash(userId + YYYY-MM-DD) % quotes.length` so it's stable per user per day.
- Weekly report uses `google/gemini-2.5-flash` via the existing AI gateway helper — no new secrets.
- Zuki always responds in markdown; UI renders with the existing `react-markdown` setup used by the book chat.
