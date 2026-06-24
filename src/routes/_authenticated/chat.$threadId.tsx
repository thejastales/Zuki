import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, ArrowUp, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { randomOpeningThought } from "@/lib/quotes";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion } from "motion/react";


export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  ssr: false,
  component: ChatThread,
});

function ChatThread() {
  const { threadId } = useParams({ from: "/_authenticated/chat/$threadId" });
  const opening = useMemo(() => randomOpeningThought(), [threadId]);

  // Query session token
  const { data: session } = useQuery({
    queryKey: ["auth_session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });
  const token = session?.access_token ?? null;

export function getMessageText(parts: any): string {
  if (typeof parts === "string") return parts;
  if (Array.isArray(parts)) {
    return parts
      .map((p) => {
        if (p && typeof p === "object") {
          if (p.type === "text" && typeof p.text === "string") {
            return p.text;
          }
          if (typeof p.text === "string") {
            return p.text;
          }
        }
        return typeof p === "string" ? p : "";
      })
      .join("");
  }
  if (parts && typeof parts === "object") {
    if (parts.text && typeof parts.text === "string") return parts.text;
  }
  return "";
}

  // Query chat messages
  const { data: initial = null, isLoading } = useQuery({
    queryKey: ["chat_messages", threadId],
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
        parts: Array.isArray(m.parts) ? (m.parts as UIMessage["parts"]) : [{ type: "text", text: getMessageText(m.parts) }],
      }));
    },
  });

  if (isLoading || initial === null || !token) {
    return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground animate-pulse">Loading conversation…</div>;
  }

  const userName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email?.split("@")[0] || "friend";

  return <ChatWindow key={threadId} threadId={threadId} initial={initial} token={token} opening={opening} userName={userName} />;
}

function ChatWindow({
  threadId,
  initial,
  token,
  opening,
  userName,
}: {
  threadId: string;
  initial: UIMessage[];
  token: string;
  opening: string;
  userName: string;
}) {
  const queryClient = useQueryClient();
  const [timeTravel, setTimeTravel] = useState<'none' | 'future' | 'past'>('none');

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: { Authorization: `Bearer ${token}` },
        body: { threadId, timeTravel },
      }),
    [threadId, token, timeTravel],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initial,
    transport,
    onError: (e) => toast.error(e.message),
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentDate = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  // Query today's worries and completed tasks counts
  const { data: stats = { worriesCount: 0, completedCount: 0 } } = useQuery({
    queryKey: ["today_stats_for_chat", currentDate],
    queryFn: async () => {
      // Query worries count for today
      const { count: worriesCount, error: worryError } = await supabase
        .from("worries")
        .select("*", { count: "exact", head: true })
        .eq("worry_date", currentDate);

      // Query completed tasks count for today
      const { count: completedCount, error: taskError } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("task_date", currentDate)
        .eq("status", "completed");

      if (worryError) console.error("Error fetching worries count:", worryError);
      if (taskError) console.error("Error fetching tasks count:", taskError);

      return {
        worriesCount: worriesCount ?? 0,
        completedCount: completedCount ?? 0,
      };
    },
  });

  // Query thread details (personality and relationship score)
  const { data: threadDetails } = useQuery({
    queryKey: ["chat_thread_details", threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("personality, relationship_score")
        .eq("id", threadId)
        .maybeSingle();
      if (error) throw error;
      return data as { personality: string; relationship_score: number } | null;
    },
  });

  const updatePersonalityMutation = useMutation({
    mutationFn: async (persona: string) => {
      const { error } = await supabase
        .from("chat_threads")
        .update({ personality: persona })
        .eq("id", threadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat_thread_details", threadId] });
      toast.success("Zuki's personality evolved.");
    },
    onError: (err) => {
      toast.error(err.message);
    }
  });

  const currentPersona = threadDetails?.personality || "mentor";
  const relationshipScore = threadDetails?.relationship_score ?? 10;

  const PERSONALITIES = [
    { key: "mentor", label: "Mentor", desc: "Jay Shetty & Joe Dispenza vibes", icon: "✨" },
    { key: "big_sister", label: "Big Sister", desc: "Warm, protective, keeps it real", icon: "🧸" },
    { key: "wise_monk", label: "Wise Monk", desc: "Mindful, spacious, peaceful", icon: "🧘" },
    { key: "therapist", label: "Therapist", desc: "Reflective, CBT framework", icon: "🧠" },
    { key: "coach", label: "Coach", desc: "Action-driven, procrastination-busting", icon: "⚡" },
  ];

  const relationshipLevel = useMemo(() => {
    if (relationshipScore < 25) return { label: "Acquaintance", level: 1, color: "text-muted-foreground", progress: relationshipScore / 25 };
    if (relationshipScore < 50) return { label: "Friend", level: 2, color: "text-primary", progress: (relationshipScore - 25) / 25 };
    if (relationshipScore < 75) return { label: "Trusted Companion", level: 3, color: "text-accent", progress: (relationshipScore - 50) / 25 };
    return { label: "Inner Circle", level: 4, color: "text-rose-400 shimmer-text font-bold", progress: (relationshipScore - 75) / 25 };
  }, [relationshipScore]);

  const promptChips = [
    { label: "Help me plan my day ☀️", text: "I need some help planning my day with clean, clear intentions." },
    { label: "Reframe a worry 🌿", text: "I have a worry that's bugging me. Can you help me reframe it?" },
    { label: "Check in on my energy 🌸", text: "I'd love to check in on my energy and manifest my goals for today." },
    { label: "A moment of gratitude ✨", text: "I want to take a moment for gratitude and set a positive tone." }
  ];

  async function handleChipClick(chipText: string) {
    if (status === "submitted" || status === "streaming") return;
    const title = chipText.slice(0, 60);
    await supabase.from("chat_threads").update({ title }).eq("id", threadId);
    queryClient.invalidateQueries({ queryKey: ["chat_threads"] });
    await sendMessage({ text: chipText });
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  const isLoading = status === "submitted" || status === "streaming";

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    // Auto-title from first user message and invalidate threads list query
    if (messages.length === 0) {
      const title = text.slice(0, 60);
      await supabase.from("chat_threads").update({ title }).eq("id", threadId);
      queryClient.invalidateQueries({ queryKey: ["chat_threads"] });
    }
    await sendMessage({ text });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border/40 p-4 gap-3 bg-background/20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[oklch(0.83_0.08_290)] to-[oklch(0.65_0.12_340)] shadow-lg glow animate-float">
            {/* Inner pulse */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[oklch(0.83_0.08_290)] to-[oklch(0.65_0.12_340)] opacity-70 animate-ping" style={{ animationDuration: "3s" }} />
            <Sparkles className="relative z-10 h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-display text-lg leading-tight">ZUKI</p>
              <span className={cn("text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20", relationshipLevel.color)}>
                {relationshipLevel.label} (Lvl {relationshipLevel.level})
              </span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <span>Voice: <strong>{PERSONALITIES.find(p => p.key === currentPersona)?.label}</strong></span>
              <span>•</span>
              <span>Relationship Progress: {relationshipScore}%</span>
            </p>
          </div>
        </div>

        {/* Dynamic Controls Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Persona selector select box */}
          <div className="relative">
            <select
              value={currentPersona}
              onChange={(e) => updatePersonalityMutation.mutate(e.target.value)}
              className="text-xs rounded-xl bg-background/50 border border-primary/20 pl-3 pr-8 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary glow appearance-none cursor-pointer"
            >
              {PERSONALITIES.map(p => (
                <option key={p.key} value={p.key} className="bg-popover text-foreground text-xs">
                  {p.icon} {p.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
              <svg className="fill-current h-3 w-3" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
          </div>

          {/* Time travel selector buttons */}
          <div className="flex rounded-xl bg-secondary/50 p-0.5 border border-border/40">
            <button
              onClick={() => setTimeTravel("none")}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-[9px] uppercase tracking-wider font-semibold transition-all cursor-pointer",
                timeTravel === "none"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Current
            </button>
            <button
              onClick={() => {
                setTimeTravel("past");
                toast.success("Temporal rift opened: Connecting with past self...");
              }}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-[9px] uppercase tracking-wider font-semibold transition-all cursor-pointer",
                timeTravel === "past"
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Chat with your child self"
            >
              🧒 Past
            </button>
            <button
              onClick={() => {
                setTimeTravel("future");
                toast.success("Temporal rift opened: Connecting with future self...");
              }}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-[9px] uppercase tracking-wider font-semibold transition-all cursor-pointer",
                timeTravel === "future"
                  ? "bg-rose-500 text-white shadow-sm glow"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Chat with your wise future self"
            >
              🌙 Future
            </button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-background/30 p-5 ring-1 ring-primary/20 animate-in fade-in-0 duration-300">
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative h-6 w-6 rounded-full bg-gradient-to-tr from-[oklch(0.83_0.08_290)] to-[oklch(0.65_0.12_340)] shadow-sm">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[oklch(0.83_0.08_290)] to-[oklch(0.65_0.12_340)] opacity-40 animate-ping" style={{ animationDuration: "3s" }} />
                    <Sparkles className="relative z-10 h-3 w-3 text-white m-1.5" />
                  </div>
                  <span className="text-xs uppercase tracking-widest text-primary/80 font-semibold">Zuki Chat</span>
                </div>
                <p className="font-display text-lg">
                  Welcome back, {userName} 🌙
                </p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  You parked <span className="text-primary font-semibold">{stats.worriesCount}</span> {stats.worriesCount === 1 ? "worry" : "worries"} today and have completed <span className="text-accent font-semibold">{stats.completedCount}</span> {stats.completedCount === 1 ? "intention" : "intentions"}. Shall we look at them together?
                </p>
                <div className="mt-4 border-t border-border/20 pt-3">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">A thought to begin</p>
                  <p className="font-display text-base italic text-foreground/90">"{opening}"</p>
                </div>
              </div>

              {/* Prompt Starter Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in-0 slide-in-from-bottom-3 duration-500 delay-150">
                {promptChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleChipClick(chip.text)}
                    className="rounded-xl border border-primary/20 bg-background/40 p-3.5 text-left text-xs sm:text-sm transition-all duration-300 hover:scale-[1.02] hover:bg-primary/10 hover:border-primary/50 active:scale-95 text-foreground hover:text-primary glow cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => {
            const rawText = getMessageText(m.parts);
            // Strip any XML save_memory or save_goal tags from output
            const text = rawText.replace(/<save_(memory|goal)[\s\S]*?<\/save_(memory|goal)>/gi, "").trim();
            if (!text) return null;
            const isUser = m.role === "user";
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}
              >
                {!isUser && (
                  <div className="relative mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[oklch(0.83_0.08_290)] to-[oklch(0.65_0.12_340)] shadow-md">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[oklch(0.83_0.08_290)] to-[oklch(0.65_0.12_340)] opacity-50 animate-ping" style={{ animationDuration: "3s" }} />
                    <Sparkles className="relative z-10 h-3.5 w-3.5 text-white animate-pulse" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground bg-background/40 ring-1 ring-border/20",
                  )}
                >
                  {text}
                </div>
              </motion.div>
            );
          })}
          {status === "submitted" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="flex gap-3 justify-start"
            >
              <div className="relative mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[oklch(0.83_0.08_290)] to-[oklch(0.65_0.12_340)] shadow-md">
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[oklch(0.83_0.08_290)] to-[oklch(0.65_0.12_340)] opacity-50 animate-ping" style={{ animationDuration: "3s" }} />
                <Sparkles className="relative z-10 h-3.5 w-3.5 text-white animate-pulse" />
              </div>
              <div className="flex items-center gap-1 whitespace-pre-wrap rounded-2xl px-4 py-3 bg-background/40 ring-1 ring-border/20">
                <span className="h-2 w-2 rounded-full bg-primary/80 animate-dot-1" />
                <span className="h-2 w-2 rounded-full bg-primary/80 animate-dot-2" />
                <span className="h-2 w-2 rounded-full bg-primary/80 animate-dot-3" />
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={submit} className="border-t border-border/40 p-3">
        <div className="relative mx-auto flex max-w-2xl items-end gap-2 rounded-2xl bg-background/40 p-2 ring-1 ring-border/50 focus-within:ring-primary/50">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Ask ZUKI anything…"
            rows={1}
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
