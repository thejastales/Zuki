# Reading Dashboard

A new section in your app focused on books: log what you read each day, chat with an AI about it, see how well you understand the book, and get recommendations for what to read next.

## What you'll get

1. **Books list** (`/reading`) — every book you're tracking. Add a new book (title, author, total pages). See current page, % complete, and an "understanding score" per book.

2. **Book detail** (`/reading/$bookId`) — for the selected book:
   - **Today's reading log**: pages read today (from → to), free-text "what I understood today".
   - **Progress bar**: pages read / total pages.
   - **Understanding score** (0–100): AI grades each log entry on depth/clarity and averages them, weighted by pages covered. Shown with a short AI summary of strengths and gaps.
   - **Chat with the book**: an AI tutor that knows the book's title/author and everything you've logged so far. You can ask "explain chapter 3", "quiz me", "what did I miss about X". Each book has its own chat thread.

3. **Finish a book** — when you mark a book finished:
   - AI writes a final "what you understood" report + a comprehension score.
   - AI recommends 3 next books based on your finished books, your notes, and chat history.
   - Recommendations show on the Books list.

4. **Nav** — add a "Reading" link to the existing sidebar/nav alongside Today and Chat.

## Technical details

### Database (one migration)
- `books` — id, user_id, title, author, total_pages, current_page, status (`reading|finished|abandoned`), final_score, final_summary, created_at, finished_at.
- `reading_sessions` — id, user_id, book_id, session_date, pages_from, pages_to, understanding_note, ai_score (0–100), ai_feedback, created_at.
- `book_recommendations` — id, user_id, title, author, reason, created_at.
- All RLS-scoped to `auth.uid()`, with GRANTs to `authenticated` + `service_role`.
- Book chat reuses existing `chat_threads`/`chat_messages` — add nullable `book_id` column to `chat_threads` to scope a thread to a book.

### Server functions (`src/lib/reading.functions.ts`, auth-gated)
- `listBooks`, `createBook`, `getBook`, `updateBookProgress`, `finishBook`.
- `logReadingSession` — saves the log, then calls Lovable AI (`google/gemini-3-flash-preview`) with the book context + note to produce `ai_score` + `ai_feedback`; updates `books.current_page`.
- `getBookSummary` — recomputes overall understanding score from sessions.
- `finishBook` — AI generates final report + 3 recommendations, stored in `book_recommendations`.
- `listRecommendations`.

### Chat route for books
- Reuse `/api/chat` but accept an optional `bookId`; when present, the server prepends a system message with book metadata + all session notes so the assistant is grounded in what the user has read and written.
- `/reading/$bookId` renders the existing AI Elements chat UI, with a thread auto-created per book.

### Routes & files
- `src/routes/_authenticated/reading.index.tsx` — list + add book.
- `src/routes/_authenticated/reading.$bookId.tsx` — detail (log form, progress, chat, finish button).
- `src/lib/reading.functions.ts` — server fns above.
- Update `src/routes/api/chat.ts` to inject book context when `bookId` is provided.
- Update the authenticated layout/nav to add a "Reading" link.

### Models
- All AI calls go through the existing Lovable AI gateway helper (`src/lib/ai-gateway.server.ts`), no new keys.

Shall I build it?
