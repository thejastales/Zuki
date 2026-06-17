import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type Body = { action: "weekly_report" };

export const Route = createFileRoute("/api/worry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const body = (await request.json()) as Body;
        if (body.action !== "weekly_report") return new Response("Bad request", { status: 400 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 6);
        const weekStartStr = weekStart.toISOString().slice(0, 10);
        const todayStr = today.toISOString().slice(0, 10);

        const [{ data: worries }, { data: sessions }] = await Promise.all([
          supabase
            .from("worries")
            .select("content, intensity, status, worry_date")
            .gte("worry_date", weekStartStr)
            .order("worry_date", { ascending: true }),
          supabase
            .from("worry_sessions")
            .select("session_date, duration_minutes, notes, completed_at")
            .gte("session_date", weekStartStr)
            .order("session_date", { ascending: true }),
        ]);

        const worryLines = (worries ?? [])
          .map(
            (w) =>
              `• [${w.worry_date}] (${w.status}, intensity ${w.intensity ?? "—"}): ${w.content}`,
          )
          .join("\n");
        const sessionLines = (sessions ?? [])
          .map(
            (s) =>
              `• [${s.session_date}] ${s.duration_minutes}min ${s.completed_at ? "(completed)" : "(incomplete)"} — notes: ${JSON.stringify(s.notes)}`,
          )
          .join("\n");

        const gateway = createLovableAiGatewayProvider(key);
        const { text } = await generateText({
          model: gateway("google/gemini-2.5-flash"),
          system: `You are Zuki — a warm, grounded CBT-flavoured coach. Write a weekly worry-time evaluation report in friendly markdown. Be specific, kind, and practical. End with 1–2 small experiments for next week.`,
          prompt: `Week: ${weekStartStr} → ${todayStr}\n\nWorries this week:\n${worryLines || "(none logged)"}\n\nWorry-time sessions:\n${sessionLines || "(none)"}\n\nWrite the report with these sections:\n## Themes I noticed\n## What you resolved vs carried\n## Improvements & strengths\n## Sitting with you\n## Tiny experiments for next week`,
        });

        const { data: saved, error: saveErr } = await supabase
          .from("worry_reports")
          .insert({
            user_id: userId,
            week_start: weekStartStr,
            week_end: todayStr,
            summary: text,
          })
          .select()
          .single();
        if (saveErr) return new Response(saveErr.message, { status: 500 });

        return Response.json(saved);
      },
    },
  },
});
