import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type Body = { messages?: UIMessage[]; threadId?: string };

const SYSTEM_PROMPT = `You are Lumen — a warm, grounded inner-coach blending the wisdom of Jay Shetty and Dr. Joe Dispenza. 

Your voice: poetic but practical. You speak with calm conviction, never preachy. You believe the user is already becoming who they want to be.

In every response:
- Acknowledge what the user feels before you advise.
- Offer one concrete next move, not a list of ten.
- Weave in manifestation, identity-shift, energy, gratitude, and neuroplasticity language when it fits — naturally, not forced.
- Quote Jay Shetty or Dr. Joe Dispenza ONLY when it lands; never fabricate quotes.
- Keep responses tight: 2–4 short paragraphs unless asked for depth.

You are not a medical professional. If the user describes crisis, gently encourage real human support.`;

const ZUKI_PROMPT = `You are Zuki — a warm, grounded CBT-flavoured worry coach. You help the user contain anxiety by holding "worry time" with them: 20 focused minutes a day to look at worries together instead of fighting them all day.

Your voice: kind, curious, a little playful. Never dismissive. You sit with the user, then gently help them reframe.

In every reply:
- Acknowledge the feeling first.
- Ask one good question OR offer one small reframe — not a lecture.
- When useful, refer to the worries and sessions logged below.
- Keep replies short: 2–4 short paragraphs.

You are not a medical professional. If the user describes crisis or self-harm, kindly encourage real human support.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token) return new Response("Unauthorized", { status: 401 });

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const body = (await request.json()) as Body;
        if (!Array.isArray(body.messages) || !body.threadId) {
          return new Response("Bad request", { status: 400 });
        }

        // verify thread ownership and load any linked book context
        const { data: thread } = await supabase
          .from("chat_threads")
          .select("id, book_id")
          .eq("id", body.threadId)
          .maybeSingle();
        if (!thread) return new Response("Thread not found", { status: 404 });

        let bookSystem = "";
        if (thread.book_id) {
          const [{ data: book }, { data: sessions }] = await Promise.all([
            supabase.from("books").select("title, author, total_pages, current_page").eq("id", thread.book_id).maybeSingle(),
            supabase
              .from("reading_sessions")
              .select("session_date, pages_from, pages_to, understanding_note")
              .eq("book_id", thread.book_id)
              .order("created_at", { ascending: true }),
          ]);
          if (book) {
            const notes = (sessions ?? [])
              .map((s) => `• ${s.session_date} (pp ${s.pages_from}-${s.pages_to}): ${s.understanding_note}`)
              .join("\n");
            bookSystem = `\n\nThe reader is studying the book "${book.title}"${book.author ? ` by ${book.author}` : ""} (page ${book.current_page} of ${book.total_pages}). Your job here is to deepen their understanding of this book — answer questions, explain ideas, quiz them, surface what they may have missed. Stay grounded in this book.\n\nWhat they've logged so far:\n${notes || "(nothing yet)"}\n`;
          }
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // Persist the latest user message
        const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
        if (lastUser) {
          await supabase.from("chat_messages").insert({
            thread_id: body.threadId,
            user_id: userId,
            role: "user",
            parts: lastUser.parts,
            client_message_id: lastUser.id,
          });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: SYSTEM_PROMPT + bookSystem,
          messages: await convertToModelMessages(body.messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
          onFinish: async ({ messages }) => {
            const last = messages[messages.length - 1];
            if (last && last.role === "assistant") {
              await supabase.from("chat_messages").insert({
                thread_id: body.threadId!,
                user_id: userId,
                role: "assistant",
                parts: last.parts,
                client_message_id: last.id,
              });
              await supabase
                .from("chat_threads")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", body.threadId!);
            }
          },
        });
      },
    },
  },
});
