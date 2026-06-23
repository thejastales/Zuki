import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { Sparkles, Timer, Play, Square, Check, ArrowRight, FileText, MessageCircleHeart, ArrowUp } from "lucide-react";
import { pickDailyQuote, type WorryQuote } from "@/lib/worry-quotes";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/worry")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Worry Time — ZUKI" },
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
const TIMER_KEY = "zuki:worryTimer";

const todayStr = () => format(new Date(), "yyyy-MM-dd");

function WorryDashboard() {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [input, setInput] = useState("");
  const [intensity, setIntensity] = useState<number | "">("");

  // Zuki Chat sliding drawer state
  const [zukiChatOpen, setZukiChatOpen] = useState(false);

  // Mobile navigation tabs state
  const [activeDashboardTab, setActiveDashboardTab] = useState<"worries" | "zuki">("worries");

  // Timer state
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [reflections, setReflections] = useState<Record<string, string>>({});
  const sessionIdRef = useRef<string | null>(null);

  // Get active session token and user ID
  const { data: session } = useQuery({
    queryKey: ["auth_session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });
  const token = session?.access_token ?? null;
  const userId = session?.user?.id ?? null;

  // Fetch worries list
  const { data: worries = [], isLoading: worriesLoading } = useQuery({
    queryKey: ["worries"],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worries")
        .select("id, content, intensity, status, worry_date, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Worry[];
    },
  });

  // Fetch worry reports list
  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ["worry_reports"],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worry_reports")
        .select("id, week_start, week_end, summary, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WorryReport[];
    },
  });

  // restore timer state from local storage on mount
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
      void handleCompleteSession();
    }
  }, [endsAt, now]);

  const todaysWorries = useMemo(
    () => worries.filter((w) => w.worry_date === todayStr()),
    [worries],
  );

  const quote: WorryQuote = useMemo(
    () => pickDailyQuote(`${userId ?? "anon"}-${todayStr()}`),
    [userId],
  );

  // Get/Create CBT Worry Chat Thread ID when zukiChatOpen is true
  const { data: zukiThreadId = null } = useQuery({
    queryKey: ["zuki_thread"],
    enabled: zukiChatOpen && !!userId,
    queryFn: async () => {
      const { data: existing } = await supabase
        .from("chat_threads")
        .select("id")
        .eq("kind", "worry")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) return existing.id;

      const { data, error } = await supabase
        .from("chat_threads")
        .insert({ user_id: userId!, title: "Zuki — worries", kind: "worry" })
        .select()
        .single();
      if (error) throw error;
      return data.id;
    },
  });

  // Mutations
  const addWorryMutation = useMutation({
    mutationFn: async ({ content, intensity }: { content: string; intensity: number | null }) => {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("worries")
        .insert({
          user_id: userId,
          content,
          intensity,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Worry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worries"] });
      setInput("");
      setIntensity("");
      toast.success("Worry parked.");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const setStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "resolved" | "carried" | "open" }) => {
      const { error } = await supabase.from("worries").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["worries"] });
      const previous = queryClient.getQueryData<Worry[]>(["worries"]);
      if (previous) {
        queryClient.setQueryData<Worry[]>(
          ["worries"],
          previous.map((w) => (w.id === id ? { ...w, status } : w)),
        );
      }
      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["worries"], context.previous);
      }
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["worries"] });
    },
  });

  const startTimerMutation = useMutation({
    mutationFn: async (minutes: number) => {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("worry_sessions")
        .insert({ user_id: userId, duration_minutes: minutes, notes: {} })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data, minutes) => {
      const ends = Date.now() + minutes * 60 * 1000;
      sessionIdRef.current = data.id;
      setEndsAt(ends);
      setReflections({});
      try {
        localStorage.setItem(TIMER_KEY, JSON.stringify({ endsAt: ends, sessionId: data.id }));
      } catch {}
      toast.success(`Worry time started — ${minutes} minutes.`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const completeSessionMutation = useMutation({
    mutationFn: async () => {
      if (!sessionIdRef.current) return;
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
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Worry time complete. Breathe out.");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const generateWeeklyMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Not authenticated");
      const res = await fetch("/api/worry", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "weekly_report" }),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as WorryReport;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worry_reports"] });
      toast.success("Zuki wrote your weekly report.");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Event Handlers
  function handleAddWorry(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || !userId) return;
    addWorryMutation.mutate({
      content: input.trim(),
      intensity: intensity === "" ? null : Number(intensity),
    });
  }

  function handleSetStatus(id: string, status: "resolved" | "carried" | "open") {
    setStatusMutation.mutate({ id, status });
  }

  function handleStartTimer(minutes = DEFAULT_MINUTES) {
    startTimerMutation.mutate(minutes);
  }

  function handleCompleteSession() {
    completeSessionMutation.mutate();
  }

  const remainingMs = endsAt ? Math.max(0, endsAt - now) : 0;
  const mm = Math.floor(remainingMs / 60000);
  const ss = Math.floor((remainingMs % 60000) / 1000);

  const loading = worriesLoading || reportsLoading;
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
      <Card className="aurora-card border-primary/25 p-5 interactive-card shadow-soft">
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

      {/* Mobile view sub-tabs */}
      {isMobile && (
        <div className="flex rounded-xl bg-secondary/40 p-1 ring-1 ring-border/40">
          <button
            type="button"
            onClick={() => setActiveDashboardTab("worries")}
            className={cn(
              "flex-1 rounded-lg py-2 text-center text-xs font-semibold tracking-wide transition-all",
              activeDashboardTab === "worries"
                ? "bg-primary/15 text-primary glow"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            My Worries & Timer
          </button>
          <button
            type="button"
            onClick={() => setActiveDashboardTab("zuki")}
            className={cn(
              "flex-1 rounded-lg py-2 text-center text-xs font-semibold tracking-wide transition-all",
              activeDashboardTab === "zuki"
                ? "bg-primary/15 text-primary glow"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Zuki Coach & Reports
          </button>
        </div>
      )}

      {/* Row 1: Worries Log & Timer Session */}
      {(!isMobile || activeDashboardTab === "worries") && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Add + list */}
          <Card className="aurora-card p-5 interactive-card shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">Today's worries</h2>
              <span className="text-xs text-muted-foreground">{todaysWorries.length} logged</span>
            </div>
            <form onSubmit={handleAddWorry} className="mt-3 space-y-2">
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
                <Button type="submit" className="ml-auto" disabled={!input.trim() || addWorryMutation.isPending}>
                  Park it
                </Button>
              </div>
            </form>

            <ScrollArea className="mt-4 h-72 pr-2">
              <div className="space-y-2">
                {todaysWorries.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    Nothing parked yet — that's okay. Add worries as they pop up.
                  </p>
                )}
                {todaysWorries.map((w) => (
                  <div
                    key={w.id}
                    className={cn(
                      "rounded-xl border border-border/40 bg-background/30 p-3 transition-opacity duration-200",
                      w.status === "resolved" && "opacity-60",
                    )}
                  >
                    <p className="text-sm">{w.content}</p>
                    <div className="mt-2 flex items-center gap-2">
                      {w.intensity && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] tracking-wide font-medium">
                          intensity {w.intensity}
                        </span>
                      )}
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] tracking-wide font-semibold text-primary">
                        {w.status}
                      </span>
                      <div className="ml-auto flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSetStatus(w.id, "resolved")}
                        >
                          <Check className="mr-1 h-3 w-3" /> resolved
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSetStatus(w.id, "carried")}
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
          <Card className="aurora-card p-5 interactive-card shadow-soft">
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-primary animate-pulse" />
              <h2 className="font-display text-xl">Worry Time session</h2>
            </div>

            {!endsAt ? (
              <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="space-y-3 flex-1">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Sit with your worries for 20 focused minutes. Outside this window, gently park
                    anything that comes up.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={() => handleStartTimer(20)} className="gap-2 cursor-pointer">
                      <Play className="h-4 w-4" /> Start 20 min
                    </Button>
                    <Button variant="outline" onClick={() => handleStartTimer(10)} className="cursor-pointer">
                      10 min
                    </Button>
                    <Button variant="outline" onClick={() => handleStartTimer(30)} className="cursor-pointer">
                      30 min
                    </Button>
                  </div>
                </div>
                {/* Zen stack stone doodle inside the card */}
                <div className="relative flex items-center justify-center h-28 w-24 shrink-0 overflow-visible animate-balance">
                  {/* Concentric ripples */}
                  <div className="absolute inset-0 rounded-full border border-primary/10 animate-ripple scale-95" />
                  <div className="absolute -inset-2 rounded-full border border-primary/5 animate-ripple delay-500 scale-105" />
                  
                  <svg viewBox="0 0 100 120" className="w-16 h-20 stroke-primary/40 stroke-[1.5] fill-primary/5 drop-shadow-md">
                    {/* Base stone */}
                    <ellipse cx="50" cy="95" rx="35" ry="14" />
                    {/* Middle stone */}
                    <ellipse cx="48" cy="70" rx="27" ry="11" />
                    {/* Upper stone */}
                    <ellipse cx="52" cy="48" rx="19" ry="8" />
                    {/* Top stone */}
                    <ellipse cx="50" cy="30" rx="12" ry="5.5" />
                    {/* Balance vertical string guide */}
                    <path d="M50,15 L50,105" strokeDasharray="3 4" className="stroke-primary/20" />
                  </svg>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-6 animate-in fade-in zoom-in-95 duration-500">
                <div className="flex flex-col items-center justify-center py-6">
                  {/* Breath visualizer ring container */}
                  {(() => {
                    const cycle = 15 - (Math.floor(remainingMs / 1000) % 16);
                    const phase = cycle < 4 ? "Inhale" : cycle < 8 ? "Hold" : cycle < 12 ? "Exhale" : "Rest";
                    const scale = (phase === "Inhale" || phase === "Hold") ? 1.15 : 0.85;
                    return (
                      <div className="relative flex h-44 w-44 items-center justify-center">
                        {/* Pulsing breathing ring */}
                        <div 
                          className="absolute inset-0 rounded-full border border-primary/30 blur-[2px]" 
                          style={{ 
                            transform: `scale(${scale})`, 
                            transition: 'transform 4s cubic-bezier(0.4, 0, 0.2, 1)',
                            willChange: 'transform'
                          }}
                        />
                        {/* Secondary soft outer ring */}
                        <div 
                          className="absolute -inset-2 rounded-full border border-primary/10 opacity-50 blur-[6px]" 
                          style={{ 
                            transform: `scale(${scale})`, 
                            transition: 'transform 4s cubic-bezier(0.4, 0, 0.2, 1)',
                            willChange: 'transform'
                          }}
                        />
                        
                        {/* Centered content */}
                        <div className="z-10 flex flex-col items-center text-center">
                          <span className="font-display text-4xl tabular-nums tracking-tighter text-foreground shimmer-text">
                            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
                          </span>
                          <span className="mt-2 text-[10px] font-mono tracking-[0.2em] text-primary/80 uppercase animate-pulse">
                            {phase}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={handleCompleteSession} 
                    className="mt-4 gap-1 text-xs text-destructive hover:bg-destructive/15 rounded-xl cursor-pointer"
                  >
                    <Square className="h-3 w-3" /> end early
                  </Button>
                </div>
                
                <div className="h-px bg-border/20" />
                
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Reflections on your worries</h3>
                <ScrollArea className="h-44 pr-2">
                  <div className="space-y-2">
                    {todaysWorries.length === 0 && (
                      <p className="text-sm text-muted-foreground italic text-center py-4">
                        No worries parked today. Use this window to free-write instead.
                      </p>
                    )}
                    {todaysWorries.map((w) => (
                      <div key={w.id} className="rounded-xl bg-background/30 p-3 border border-border/20 transition-all hover:border-primary/20">
                        <p className="text-sm font-medium">{w.content}</p>
                        <Textarea
                          rows={2}
                          placeholder="A response, reframe, or next step…"
                          value={reflections[w.id] ?? ""}
                          onChange={(e) =>
                            setReflections((r) => ({ ...r, [w.id]: e.target.value }))
                          }
                          className="mt-2 bg-background/40 text-sm focus-visible:ring-primary/40"
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Row 2: Zuki Trigger & Weekly Reports */}
      {(!isMobile || activeDashboardTab === "zuki") && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="aurora-card p-5 flex flex-col justify-between interactive-card shadow-soft">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary glow" />
                <h2 className="font-display text-xl">Talk to Zuki</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                A warm CBT-flavoured coach who already knows the worries you've logged this week. Open Zuki right here on this screen.
              </p>
            </div>
            <Button onClick={() => setZukiChatOpen(true)} className="mt-4 gap-2 w-full sm:w-auto self-start">
              <MessageCircleHeart className="h-4 w-4" /> Open Zuki chat panel
            </Button>
          </Card>

          <Card className="aurora-card p-5 interactive-card shadow-soft">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl">Weekly evaluation</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Zuki reviews your past week of worries and sessions and writes you a report.
            </p>
            <Button
              onClick={() => generateWeeklyMutation.mutate()}
              disabled={generateWeeklyMutation.isPending}
              className="mt-4"
              variant="secondary"
            >
              {generateWeeklyMutation.isPending ? "Zuki is reflecting…" : "Generate this week's report"}
            </Button>

            {reports.length > 0 && (
              <Accordion type="single" collapsible className="mt-4">
                {reports.map((r) => (
                  <AccordionItem key={r.id} value={r.id}>
                    <AccordionTrigger className="text-sm font-medium">
                      {r.week_start} → {r.week_end}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="prose prose-sm prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                        {r.summary}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </Card>
        </div>
      )}

      {/* CBT Coach Zuki Slide-over Sheet */}
      <Sheet open={zukiChatOpen} onOpenChange={setZukiChatOpen}>
        <SheetContent side="right" className="aurora-card border-l border-border/40 p-6 sm:max-w-md w-full flex flex-col h-full z-50">
          <SheetHeader className="pb-4 border-b border-border/20">
            <SheetTitle className="font-display text-2xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary glow" /> Zuki Chat
            </SheetTitle>
            <p className="text-xs text-muted-foreground">Your CBT coach. Reflection & cognitive reframing.</p>
          </SheetHeader>
          <div className="flex-1 min-h-0 pt-2">
            {zukiThreadId && token ? (
              <ZukiChat threadId={zukiThreadId} token={token} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground animate-pulse">
                Initializing coach session…
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ZukiChat({ threadId, token }: { threadId: string; token: string }) {
  const { data: initial = null, isLoading } = useQuery({
    queryKey: ["zuki_chat_messages", threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id,role,parts,client_message_id,created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m) => ({
        id: m.client_message_id ?? m.id,
        role: m.role as UIMessage["role"],
        parts: m.parts as UIMessage["parts"],
      }));
    },
  });

  if (isLoading || initial === null) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-8 animate-pulse">Loading Zuki Chat…</div>;
  }

  return <ZukiChatWindow threadId={threadId} token={token} initial={initial} />;
}

function ZukiChatWindow({ threadId, token, initial }: { threadId: string; token: string; initial: UIMessage[] }) {
  const transport = useMemo(
    () => new DefaultChatTransport({
      api: "/api/chat",
      headers: { Authorization: `Bearer ${token}` },
      body: { threadId },
    }),
    [threadId, token],
  );
  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initial,
    transport,
    onError: (e) => toast.error(e.message),
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const isLoading = status === "submitted" || status === "streaming";

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 pr-2">
        <div ref={scrollRef} className="space-y-4 py-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground italic leading-relaxed">
              Hello! I'm Zuki. I'm here to help you parse and reframe the worries you've parked today. How are you feeling?
            </p>
          )}
          {messages.map((m) => {
            const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
            const isUser = m.role === "user";
            return (
              <div key={m.id} className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  isUser ? "bg-primary text-primary-foreground" : "bg-background/80 ring-1 ring-border/40 text-foreground",
                )}>
                  {text}
                </div>
              </div>
            );
          })}
          {status === "submitted" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
              <Sparkles className="h-3 w-3 text-primary animate-pulse" /> Zuki is reflecting…
            </div>
          )}
        </div>
      </ScrollArea>
      <form onSubmit={submit} className="border-t border-border/40 pt-3">
        <div className="flex items-end gap-2 rounded-2xl bg-background/40 p-2 ring-1 ring-border/50 focus-within:ring-primary/50">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Talk to Zuki…"
            rows={2}
            className="min-h-[40px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm"
          />
          {isLoading ? (
            <Button type="button" size="icon-sm" variant="secondary" onClick={() => stop()}>
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button type="submit" size="icon-sm" disabled={!input.trim()}>
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
