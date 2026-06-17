import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { Sparkles, Timer, Play, Square, Check, ArrowRight, FileText, MessageCircleHeart } from "lucide-react";
import { pickDailyQuote, type WorryQuote } from "@/lib/worry-quotes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/worry")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Worry Time — Lumen" },
      {
        name: "description",
        content:
          "Park your worries during the day and meet them in a focused 20-minute Worry Time, guided by Zuki.",
      },
    ],
  }),
  component: WorryDashboard,
});

type Worry = {
  id: string;
  content: string;
  intensity: number | null;
  status: string;
  worry_date: string;
  created_at: string;
};

type WorryReport = {
  id: string;
  week_start: string;
  week_end: string;
  summary: string;
  created_at: string;
};

const DEFAULT_MINUTES = 20;
const TIMER_KEY = "lumen:worryTimer";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function WorryDashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [worries, setWorries] = useState<Worry[]>([]);
  const [reports, setReports] = useState<WorryReport[]>([]);
  const [input, setInput] = useState("");
  const [intensity, setIntensity] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Timer state
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [reflections, setReflections] = useState<Record<string, string>>({});
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      const [{ data: w }, { data: r }] = await Promise.all([
        supabase
          .from("worries")
          .select("id, content, intensity, status, worry_date, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("worry_reports")
          .select("id, week_start, week_end, summary, created_at")
          .order("created_at", { ascending: false }),
      ]);
      setWorries(w ?? []);
      setReports(r ?? []);
      setLoading(false);
    })();
  }, []);

  // restore timer
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TIMER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { endsAt: number; sessionId: string | null };
        if (parsed.endsAt > Date.now()) {
          setEndsAt(parsed.endsAt);
          sessionIdRef.current = parsed.sessionId;
        } else {
          localStorage.removeItem(TIMER_KEY);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!endsAt) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [endsAt]);

  // auto-complete when timer hits zero
  useEffect(() => {
    if (endsAt && now >= endsAt) {
      void completeSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, now]);

  const todaysWorries = useMemo(
    () => worries.filter((w) => w.worry_date === todayStr()),
    [worries],
  );
  const quote: WorryQuote = useMemo(
    () => pickDailyQuote(`${userId ?? "anon"}-${todayStr()}`),
    [userId],
  );

  async function addWorry(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || !userId) return;
    const optimistic: Worry = {
      id: `tmp-${Date.now()}`,
      content: input.trim(),
      intensity: intensity === "" ? null : Number(intensity),
      status: "open",
      worry_date: todayStr(),
      created_at: new Date().toISOString(),
    };
    setWorries((w) => [optimistic, ...w]);
    setInput("");
    setIntensity("");
    const { data, error } = await supabase
      .from("worries")
      .insert({
        user_id: userId,
        content: optimistic.content,
        intensity: optimistic.intensity,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      setWorries((w) => w.filter((x) => x.id !== optimistic.id));
      return;
    }
    setWorries((w) => w.map((x) => (x.id === optimistic.id ? (data as Worry) : x)));
  }

  async function setStatus(id: string, status: "resolved" | "carried" | "open") {
    setWorries((w) => w.map((x) => (x.id === id ? { ...x, status } : x)));
    const { error } = await supabase.from("worries").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
  }

  async function startTimer(minutes = DEFAULT_MINUTES) {
    if (!userId) return;
    const ends = Date.now() + minutes * 60 * 1000;
    const { data, error } = await supabase
      .from("worry_sessions")
      .insert({ user_id: userId, duration_minutes: minutes, notes: {} })
      .select()
      .single();
    if (error) return toast.error(error.message);
    sessionIdRef.current = data.id;
    setEndsAt(ends);
    setReflections({});
    try {
      localStorage.setItem(TIMER_KEY, JSON.stringify({ endsAt: ends, sessionId: data.id }));
    } catch {}
    toast.success(`Worry time started — ${minutes} minutes.`);
  }

  async function completeSession() {
    if (!sessionIdRef.current) {
      setEndsAt(null);
      localStorage.removeItem(TIMER_KEY);
      return;
    }
    const id = sessionIdRef.current;
    sessionIdRef.current = null;
    setEndsAt(null);
    try {
      localStorage.removeItem(TIMER_KEY);
    } catch {}
    const { error } = await supabase
      .from("worry_sessions")
      .update({ notes: reflections, completed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Worry time complete. Breathe out.");
  }

  async function endEarly() {
    await completeSession();
  }

  async function generateWeekly() {
    setGenerating(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("Sign in again");
      const res = await fetch("/api/worry", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "weekly_report" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const report = (await res.json()) as WorryReport;
      setReports((r) => [report, ...r]);
      toast.success("Zuki wrote your weekly report.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  const nav = useNavigate();
  async function openZuki() {
    if (!userId) return;
    // try to reuse the most recent worry thread
    const { data: existing } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("kind", "worry")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let id = existing?.id;
    if (!id) {
      const { data, error } = await supabase
        .from("chat_threads")
        .insert({ user_id: userId, title: "Zuki — worries", kind: "worry" })
        .select()
        .single();
      if (error) return toast.error(error.message);
      id = data.id;
    }
    nav({ to: "/chat/$threadId", params: { threadId: id! } });
  }

  const remainingMs = endsAt ? Math.max(0, endsAt - now) : 0;
  const mm = Math.floor(remainingMs / 60000);
  const ss = Math.floor((remainingMs % 60000) / 1000);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading your worry space…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl">Worry Time</h1>
        <p className="text-sm text-muted-foreground">
          Park worries as they come. Meet them all together in one calm window.
        </p>
      </div>

      {/* Daily motivational quote */}
      <Card className="aurora-card border-primary/20 p-5">
        <p className="text-xs uppercase tracking-widest text-primary/80">Today's spark</p>
        <p className="mt-2 font-display text-xl italic leading-snug">"{quote.quote}"</p>
        <p className="mt-1 text-sm text-muted-foreground">— {quote.author}</p>
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-primary/5 p-3 text-sm">
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="font-medium text-foreground">Try today:</span> {quote.implement}
          </span>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Add + list */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">Today's worries</h2>
            <span className="text-xs text-muted-foreground">{todaysWorries.length} logged</span>
          </div>
          <form onSubmit={addWorry} className="mt-3 space-y-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What's nagging at you right now? Park it here."
              rows={2}
              className="bg-background/40"
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={5}
                value={intensity}
                onChange={(e) =>
                  setIntensity(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="1–5"
                className="w-24 bg-background/40"
              />
              <span className="text-xs text-muted-foreground">intensity (optional)</span>
              <Button type="submit" className="ml-auto" disabled={!input.trim()}>
                Park it
              </Button>
            </div>
          </form>

          <ScrollArea className="mt-4 h-72 pr-2">
            <div className="space-y-2">
              {todaysWorries.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nothing parked yet — that's okay. Add worries as they pop up.
                </p>
              )}
              {todaysWorries.map((w) => (
                <div
                  key={w.id}
                  className={cn(
                    "rounded-xl border border-border/40 bg-background/30 p-3",
                    w.status === "resolved" && "opacity-60",
                  )}
                >
                  <p className="text-sm">{w.content}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {w.intensity && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                        intensity {w.intensity}
                      </span>
                    )}
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {w.status}
                    </span>
                    <div className="ml-auto flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setStatus(w.id, "resolved")}
                      >
                        <Check className="mr-1 h-3 w-3" /> resolved
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setStatus(w.id, "carried")}
                      >
                        carry over
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Timer + reflections */}
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl">Worry Time session</h2>
          </div>

          {!endsAt ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                Sit with your worries for 20 focused minutes. Outside this window, gently park
                anything that comes up.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => startTimer(20)} className="gap-2">
                  <Play className="h-4 w-4" /> Start 20 min
                </Button>
                <Button variant="outline" onClick={() => startTimer(10)}>
                  10 min
                </Button>
                <Button variant="outline" onClick={() => startTimer(30)}>
                  30 min
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-5xl tabular-nums">
                  {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
                </span>
                <Button size="sm" variant="ghost" onClick={endEarly} className="gap-1">
                  <Square className="h-3.5 w-3.5" /> end early
                </Button>
              </div>
              <ScrollArea className="h-56 pr-2">
                <div className="space-y-2">
                  {todaysWorries.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No worries parked today. Use this window to free-write instead.
                    </p>
                  )}
                  {todaysWorries.map((w) => (
                    <div key={w.id} className="rounded-xl bg-background/30 p-3">
                      <p className="text-sm">{w.content}</p>
                      <Textarea
                        rows={2}
                        placeholder="A response, reframe, or next step…"
                        value={reflections[w.id] ?? ""}
                        onChange={(e) =>
                          setReflections((r) => ({ ...r, [w.id]: e.target.value }))
                        }
                        className="mt-2 bg-background/40 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </Card>
      </div>

      {/* Zuki + weekly */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl">Talk to Zuki</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            A warm CBT-flavoured coach who already knows the worries you've logged this week.
          </p>
          <Button onClick={openZuki} className="mt-3 gap-2">
            <MessageCircleHeart className="h-4 w-4" /> Open Zuki chat
          </Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl">Weekly evaluation</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Zuki reviews your past week of worries and sessions and writes you a report.
          </p>
          <Button
            onClick={generateWeekly}
            disabled={generating}
            className="mt-3"
            variant="secondary"
          >
            {generating ? "Zuki is reflecting…" : "Generate this week's report"}
          </Button>

          {reports.length > 0 && (
            <Accordion type="single" collapsible className="mt-4">
              {reports.map((r) => (
                <AccordionItem key={r.id} value={r.id}>
                  <AccordionTrigger className="text-sm">
                    {r.week_start} → {r.week_end}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="prose prose-sm prose-invert max-w-none whitespace-pre-wrap text-sm">
                      {r.summary}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </Card>
      </div>
    </div>
  );
}
