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

        // verify thread ownership
        const { data: thread } = await supabase
          .from("chat_threads")
          .select("id")
          .eq("id", body.threadId)
          .maybeSingle();
        if (!thread) return new Response("Thread not found", { status: 404 });

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
          system: SYSTEM_PROMPT,
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
