import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type Action =
  | { action: "score"; bookId: string; sessionId: string }
  | { action: "finish"; bookId: string };

function getSupabase(token: string) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/reading")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = getSupabase(token);
        const { data: userData } = await supabase.auth.getUser(token);
        if (!userData.user) return new Response("Unauthorized", { status: 401 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const body = (await request.json()) as Action;

        if (body.action === "score") {
          const { data: session } = await supabase
            .from("reading_sessions")
            .select("*, books(title, author, total_pages)")
            .eq("id", body.sessionId)
            .maybeSingle();
          if (!session) return new Response("Not found", { status: 404 });

          const book = (session as { books: { title: string; author: string | null; total_pages: number } }).books;
          const prompt = `You are a reading-comprehension coach. Grade what the reader understood from today's session.

Book: "${book.title}"${book.author ? ` by ${book.author}` : ""}
Pages read today: ${session.pages_from}–${session.pages_to} (${session.pages_to - session.pages_from + 1} pages)

Reader's notes on what they understood:
"""
${session.understanding_note}
"""

Return STRICT JSON only, no prose, no markdown:
{"score": <0-100 integer>, "feedback": "<2-3 sentence specific feedback: what they grasped well, what to revisit. Encouraging tone.>"}`;

          const { text } = await generateText({ model, prompt });
          const parsed = extractJson(text) as { score?: number; feedback?: string } | null;
          const score = Math.max(0, Math.min(100, Math.round(parsed?.score ?? 60)));
          const feedback = parsed?.feedback ?? "Keep going — log a bit more detail next time so I can help more.";

          await supabase
            .from("reading_sessions")
            .update({ ai_score: score, ai_feedback: feedback })
            .eq("id", body.sessionId);

          // bump book current_page if needed
          await supabase
            .from("books")
            .update({ current_page: session.pages_to })
            .eq("id", body.bookId)
            .lt("current_page", session.pages_to);

          return Response.json({ score, feedback });
        }

        if (body.action === "finish") {
          const [{ data: book }, { data: sessions }, { data: pastBooks }] = await Promise.all([
            supabase.from("books").select("*").eq("id", body.bookId).maybeSingle(),
            supabase
              .from("reading_sessions")
              .select("session_date, pages_from, pages_to, understanding_note, ai_score")
              .eq("book_id", body.bookId)
              .order("created_at", { ascending: true }),
            supabase
              .from("books")
              .select("title, author")
              .eq("status", "finished")
              .neq("id", body.bookId),
          ]);
          if (!book) return new Response("Not found", { status: 404 });

          const notes = (sessions ?? [])
            .map(
              (s) =>
                `[${s.session_date} • pp ${s.pages_from}-${s.pages_to} • score ${s.ai_score ?? "?"}]\n${s.understanding_note}`,
            )
            .join("\n\n");
          const finishedList =
            (pastBooks ?? []).map((b) => `- ${b.title}${b.author ? " — " + b.author : ""}`).join("\n") ||
            "(none yet)";

          const prompt = `The reader just finished a book. Produce a final comprehension report and recommend 3 next books.

Book: "${book.title}"${book.author ? ` by ${book.author}` : ""} (${book.total_pages} pages)

All reading-session notes (in order):
"""
${notes || "(no notes recorded)"}
"""

Previously finished books (for taste signal):
${finishedList}

Return STRICT JSON only, no prose, no markdown:
{
  "final_score": <0-100 integer for overall comprehension>,
  "final_summary": "<3-5 sentences: key ideas the reader internalized, blind spots, what to revisit>",
  "recommendations": [
    {"title": "...", "author": "...", "reason": "<1-2 sentences why this fits the reader>"},
    {"title": "...", "author": "...", "reason": "..."},
    {"title": "...", "author": "...", "reason": "..."}
  ]
}`;

          const { text } = await generateText({ model, prompt });
          const parsed = extractJson(text) as {
            final_score?: number;
            final_summary?: string;
            recommendations?: { title: string; author?: string; reason?: string }[];
          } | null;

          const finalScore = Math.max(0, Math.min(100, Math.round(parsed?.final_score ?? 70)));
          const finalSummary = parsed?.final_summary ?? "You completed this book — well done.";
          const recs = (parsed?.recommendations ?? []).slice(0, 3);

          await supabase
            .from("books")
            .update({
              status: "finished",
              final_score: finalScore,
              final_summary: finalSummary,
              finished_at: new Date().toISOString(),
              current_page: book.total_pages,
            })
            .eq("id", body.bookId);

          if (recs.length > 0) {
            await supabase.from("book_recommendations").insert(
              recs.map((r) => ({
                user_id: userData.user!.id,
                source_book_id: body.bookId,
                title: r.title,
                author: r.author ?? null,
                reason: r.reason ?? null,
              })),
            );
          }

          return Response.json({ finalScore, finalSummary, recommendations: recs });
        }

        return new Response("Bad action", { status: 400 });
      },
    },
  },
});
