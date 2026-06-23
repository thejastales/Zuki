import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type Body = { messages?: UIMessage[]; threadId?: string };

const SYSTEM_PROMPT = `You are ZUKI — a warm, grounded inner-coach blending the wisdom of Jay Shetty and Dr. Joe Dispenza. 

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

        const body = (await request.json()) as { messages?: UIMessage[]; threadId?: string; timeTravel?: "none" | "future" | "past" };
        if (!Array.isArray(body.messages) || !body.threadId) {
          return new Response("Bad request", { status: 400 });
        }
        const timeTravel = body.timeTravel || "none";

        // verify thread ownership and load contextual info
        const { data: thread } = await supabase
          .from("chat_threads")
          .select("id, book_id, kind, personality, relationship_score")
          .eq("id", body.threadId)
          .maybeSingle() as { data: { id: string; book_id: string | null; kind: string | null; personality?: string; relationship_score?: number } | null };
        if (!thread) return new Response("Thread not found", { status: 404 });

        // Query global user context for the Memory Engine
        let goalsText = "";
        try {
          const { data: goalsData } = await supabase
            .from("goals")
            .select("title, status, notes")
            .order("created_at", { ascending: false });
          if (goalsData && goalsData.length > 0) {
            goalsText = goalsData
              .map((g) => `• Goal: "${g.title}" (status: ${g.status}${g.notes ? `, notes: ${g.notes}` : ""})`)
              .join("\n");
          }
        } catch (e) {
          console.warn("Goals table not ready or missing:", e);
        }

        let memoriesText = "";
        try {
          const { data: memoriesData } = await supabase
            .from("memories")
            .select("content, category, created_at")
            .order("created_at", { ascending: false })
            .limit(20);
          if (memoriesData && memoriesData.length > 0) {
            memoriesText = memoriesData
              .map((m) => `• Memory [Category: ${m.category}]: ${m.content}`)
              .join("\n");
          }
        } catch (e) {
          console.warn("Memories table not ready or missing:", e);
        }

        const { data: booksData } = await supabase
          .from("books")
          .select("title, author, status, current_page, total_pages, final_summary")
          .limit(10);
        const booksText = (booksData ?? [])
          .map((b) => `• Book: "${b.title}"${b.author ? ` by ${b.author}` : ""} (Status: ${b.status}, Progress: ${b.current_page}/${b.total_pages} pp${b.final_summary ? `, Summary: ${b.final_summary}` : ""})`)
          .join("\n");

        const { data: worriesData } = await supabase
          .from("worries")
          .select("content, intensity, status, worry_date")
          .order("worry_date", { ascending: false })
          .limit(10);
        const worriesText = (worriesData ?? [])
          .map((w) => `• Worry parked [${w.worry_date}] (Status: ${w.status}, Intensity: ${w.intensity ?? "N/A"}): ${w.content}`)
          .join("\n");

        const { data: moodsData } = await supabase
          .from("mood_checkins")
          .select("checkin_date, productivity_score, mood")
          .order("checkin_date", { ascending: false })
          .limit(5);
        const moodsText = (moodsData ?? [])
          .map((m) => `• Mood [${m.checkin_date}]: ${m.mood} (Productivity: ${m.productivity_score}/10)`)
          .join("\n");

        const { data: tasksData } = await supabase
          .from("tasks")
          .select("title, status, task_date")
          .eq("status", "completed")
          .order("task_date", { ascending: false })
          .limit(10);
        const achievementsText = (tasksData ?? [])
          .map((t) => `• Completed Intention [${t.task_date}]: ${t.title}`)
          .join("\n");

        const memoryContext = `\n\n--- ZUKI MEMORY ENGINE CONTEXT ---
The user's database records show:

[LONG-TERM GOALS & DREAMS]
${goalsText || "• No goals logged yet. Encourage the user to park their goals (e.g. 'Start a company', 'Write a book', 'Visit Japan')!"}

[MEMORIES & PREFERENCES]
${memoriesText || "• No memories or preferences logged yet."}

[CURRENT & COMPLETED BOOKS]
${booksText || "• No books logged."}

[RECENT WORRIES PARKED]
${worriesText || "• No worries logged."}

[RECENT MOOD ENTRIES]
${moodsText || "• No mood entries logged."}

[RECENT COMPLETED INTENTIONS / ACHIEVEMENTS]
${achievementsText || "• No tasks completed recently."}

----------------------------------

--- AUTONOMOUS MEMORY ENGINE INSTRUCTION ---
You have the power to save long-term memories or goals directly into the user's profile.
If the user shares a long-term goal/dream (e.g. "I want to start a company", "write a book", "visit Japan") or a key preference/insight/milestone (e.g. "I want to stop procrastinating", "I feel overwhelmed by presentation tasks", "I read best in the morning"), you MUST append XML-like tag(s) at the absolute end of your response.

Formatting rules:
- To save a memory/preference/insight, append:
  <save_memory category="preference|milestone|insight|general">Memory text description here.</save_memory>
- To save a long-term goal/dream, append:
  <save_goal notes="optional notes like timeframe or context">Goal title here</save_goal>

Example response tail:
"I believe you have the strength to take that first step. Keep it simple.
<save_goal notes="Aiming for next summer">Write a book</save_goal>
<save_memory category="preference">User wants to write a book next summer.</save_memory>"

Note: Do not output duplicate goals or memories if they are already in the context list above. Be highly selective. Output tags only for new or updated goals/memories.
`;

        let extraSystem = "";
        let basePrompt = SYSTEM_PROMPT;

        // Apply selected personality prompt
        const selectedPersona = (thread as any).personality || "mentor";
        let personaPrompt = SYSTEM_PROMPT;
        if (selectedPersona === "big_sister") {
          personaPrompt = `You are ZUKI — acting as the user's wise Big Sister. Your tone is warm, protective, incredibly supportive, and real. You cheer them on, tell them the truth kindly, and help them navigate their day like family. Keep replies close, warm, and authentic. Acknowledge feelings first, then give them a sisterly nudge or reframe.`;
        } else if (selectedPersona === "wise_monk") {
          personaPrompt = `You are ZUKI — acting as a Wise Monk. Your tone is extremely calm, quiet, and minimalist. Focus on mindfulness, breath, the present moment, non-attachment, and inner peace. Share tiny zen wisdoms or parables if appropriate. Keep responses brief and spacious.`;
        } else if (selectedPersona === "therapist") {
          personaPrompt = `You are ZUKI — acting as a CBT Therapist. You are deeply empathetic, reflective, and non-judgmental. Help the user reframe cognitive distortions, ask thoughtful open-ended questions, and explore anxieties with clinical calm. Encourage self-reflection and sit with their pain before guiding them.`;
        } else if (selectedPersona === "coach") {
          personaPrompt = `You are ZUKI — acting as a High-Performance Life Coach. Your tone is motivating, structured, action-oriented, and focused on breaking procrastination. Pushes the user to complete intentions, optimize their day, and build strong habits. Emphasize clarity, commitment, and progress.`;
        }

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
            extraSystem = `\n\nThe reader is studying the book "${book.title}"${book.author ? ` by ${book.author}` : ""} (page ${book.current_page} of ${book.total_pages}). Your job here is to deepen their understanding of this book — answer questions, explain ideas, quiz them, surface what they may have missed. Stay grounded in this book.\n\nWhat they've logged so far:\n${notes || "(nothing yet)"}\n`;
          }
        } else if (thread.kind === "worry") {
          basePrompt = ZUKI_PROMPT + `\n\nFor this session, adopt the voice and style of the [${selectedPersona.toUpperCase()}] persona, but keep your primary focus on guiding the user through worry time.`;
          const since = new Date();
          since.setDate(since.getDate() - 7);
          const sinceStr = since.toISOString().slice(0, 10);
          const [{ data: worries }, { data: wsessions }] = await Promise.all([
            supabase
              .from("worries")
              .select("content, intensity, status, worry_date")
              .gte("worry_date", sinceStr)
              .order("worry_date", { ascending: true }),
            supabase
              .from("worry_sessions")
              .select("session_date, duration_minutes, notes, completed_at")
              .gte("session_date", sinceStr)
              .order("session_date", { ascending: true }),
          ]);
          const wLines = (worries ?? [])
            .map((w) => `• [${w.worry_date}] (${w.status}, intensity ${w.intensity ?? "—"}): ${w.content}`)
            .join("\n");
          const sLines = (wsessions ?? [])
            .map((s) => `• [${s.session_date}] ${s.duration_minutes}min ${s.completed_at ? "(done)" : "(incomplete)"}: ${JSON.stringify(s.notes)}`)
            .join("\n");
          extraSystem = `\n\nThe user's last 7 days of worries:\n${wLines || "(none logged)"}\n\nTheir worry-time sessions:\n${sLines || "(none yet)"}\n`;
        } else {
          basePrompt = personaPrompt;
        }

        const key = process.env.LOVABLE_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || "mock-key";

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

        let timeTravelPrompt = "";
        if (timeTravel === "future") {
          timeTravelPrompt = `\n\n--- TEMPORAL RIFT: FUTURE SELF ---\nIMPORTANT: You are now simulating the user's FUTURE SELF from 10 years in the future. Speak to them as their future self — wise, warm, accomplished, looking back on their present struggles with peace and deep gratitude. Reference their current goals, worries, and books from the memory engine context as things you remember going through. Help them see how it all worked out.`;
        } else if (timeTravel === "past") {
          timeTravelPrompt = `\n\n--- TEMPORAL RIFT: PAST SELF ---\nIMPORTANT: You are now simulating the user's PAST SELF (their inner child). Speak to them as their childhood self — curious, innocent, questioning, and proud of who they have become. Ask about their current worries and marvel at their achievements from the memory engine context.`;
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: basePrompt + memoryContext + timeTravelPrompt + extraSystem,
          messages: await convertToModelMessages(body.messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
          onFinish: async ({ messages, text }) => {
            const last = messages[messages.length - 1];
            if (last && last.role === "assistant") {
              await supabase.from("chat_messages").insert({
                thread_id: body.threadId!,
                user_id: userId,
                role: "assistant",
                parts: last.parts,
                client_message_id: last.id,
              });

              // Increment relationship score on new message
              const newScore = Math.min(100, ((thread as any).relationship_score ?? 10) + 1);
              await supabase
                .from("chat_threads")
                .update({ 
                  updated_at: new Date().toISOString(),
                  relationship_score: newScore
                })
                .eq("id", body.threadId!);

              // Parse and save memories
              const memoryRegex = /<save_memory\s+category="([^"]+)">([\s\S]*?)<\/save_memory>/gi;
              let mMatch;
              while ((mMatch = memoryRegex.exec(text)) !== null) {
                const category = mMatch[1];
                const content = mMatch[2].trim();
                if (content) {
                  try {
                    await supabase.from("memories").insert({
                      user_id: userId,
                      content,
                      category,
                    });
                  } catch (e) {
                    console.warn("Error saving extracted memory (table may not exist yet):", e);
                  }
                }
              }

              // Parse and save goals
              const goalRegex = /<save_goal(?:\s+notes="([^"]+)")?>([\s\S]*?)<\/save_goal>/gi;
              let gMatch;
              while ((gMatch = goalRegex.exec(text)) !== null) {
                const notes = gMatch[1] || null;
                const title = gMatch[2].trim();
                if (title) {
                  try {
                    await supabase.from("goals").insert({
                      user_id: userId,
                      title,
                      notes,
                      status: "active",
                    });
                  } catch (e) {
                    console.warn("Error saving extracted goal (table may not exist yet):", e);
                  }
                }
              }
            }
          },
        });
      },
    },
  },
});
