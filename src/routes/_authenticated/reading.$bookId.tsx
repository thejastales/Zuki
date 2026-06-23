import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, Sparkles, Square, Trophy, BookOpen, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/reading/$bookId")({
  ssr: false,
  component: BookDetail,
});

type Book = {
  id: string;
  title: string;
  author: string | null;
  total_pages: number;
  current_page: number;
  status: "reading" | "finished" | "abandoned";
  final_score: number | null;
  final_summary: string | null;
  cover_url?: string | null;
};

type Session = {
  id: string;
  session_date: string;
  pages_from: number;
  pages_to: number;
  understanding_note: string;
  ai_score: number | null;
  ai_feedback: string | null;
  created_at: string;
};

function BookDetail() {
  const { bookId } = useParams({ from: "/_authenticated/reading/$bookId" });
  const nav = useNavigate();
  const queryClient = useQueryClient();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);

  // Get active session token
  const { data: session } = useQuery({
    queryKey: ["auth_session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });
  const token = session?.access_token ?? null;

  // Get book details
  const { data: book = null, isLoading: bookLoading } = useQuery({
    queryKey: ["book", bookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("id", bookId)
        .maybeSingle();
      if (error) throw error;
      return data as Book | null;
    },
  });

  // Get reading sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["reading_sessions", bookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reading_sessions")
        .select("*")
        .eq("book_id", bookId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Session[];
    },
  });

  // Sync "from" page field when book details load
  useEffect(() => {
    if (book) {
      setFrom(String(book.current_page || 0));
    }
  }, [book]);

  // Get or Create associated Chat Thread
  const { data: threadId = null, isLoading: threadLoading } = useQuery({
    queryKey: ["book_chat_thread", bookId],
    enabled: !!book && !!session?.user,
    queryFn: async () => {
      // Find existing
      const { data: existing } = await supabase
        .from("chat_threads")
        .select("id")
        .eq("book_id", bookId)
        .maybeSingle();
      if (existing) {
        return existing.id;
      }
      // Create new
      const { data: created, error } = await supabase
        .from("chat_threads")
        .insert({
          user_id: session!.user.id,
          book_id: bookId,
          title: `Chat: ${book?.title ?? "book"}`,
        })
        .select("id")
        .single();
      if (error) throw error;
      return created.id;
    },
  });

  // Get book insights
  const { data: insights = null, refetch: refetchInsights } = useQuery({
    queryKey: ["book_insights", bookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("book_insights")
        .select("*")
        .eq("book_id", bookId)
        .maybeSingle();
      if (error) return null;
      return data;
    }
  });

  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Authentication token is missing.");
      const res = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "generate_insights", bookId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
    onSuccess: () => {
      refetchInsights();
      toast.success("Zuki compiled your book insights! 📚✨");
    },
    onError: (err) => {
      toast.error(err.message);
    }
  });

  // Mutations
  const logSessionMutation = useMutation({
    mutationFn: async ({ f, t, note }: { f: number; t: number; note: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      const { data: row, error } = await supabase
        .from("reading_sessions")
        .insert({
          user_id: user.user.id,
          book_id: bookId,
          pages_from: f,
          pages_to: t,
          understanding_note: note.trim(),
        })
        .select()
        .single();
      if (error) throw error;
      return row as Session;
    },
    onSuccess: async (row) => {
      queryClient.invalidateQueries({ queryKey: ["reading_sessions", bookId] });
      queryClient.invalidateQueries({ queryKey: ["book", bookId] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      setNote("");
      setTo("");
      toast.success("Reading session logged.");

      // AI grading (handled in background non-blocking-ish)
      if (token) {
        try {
          const res = await fetch("/api/reading", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: "score", bookId, sessionId: row.id }),
          });
          if (res.ok) {
            queryClient.invalidateQueries({ queryKey: ["reading_sessions", bookId] });
          }
        } catch (e) {
          console.error("Failed to fetch AI evaluation: ", e);
        }
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const finishBookMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Authentication token is missing.");
      const res = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "finish", bookId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { finalScore: number; finalSummary: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book", bookId] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["book_recommendations"] });
      setShowCelebration(true);
      toast.success("Book completed! Recommending next reads.");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  function handleLogSession(e: React.FormEvent) {
    e.preventDefault();
    if (!book) return;
    const f = parseInt(from), t = parseInt(to);
    if (isNaN(f) || isNaN(t) || t < f) return toast.error("Check the page range.");
    if (!note.trim()) return toast.error("Add a sentence or two on what you understood.");
    logSessionMutation.mutate({ f, t, note: note.trim() });
  }

  function handleFinishBook() {
    if (!book) return;
    if (!confirm("Mark this book as finished? The AI will write a final report and recommend next reads.")) return;
    finishBookMutation.mutate();
  }

  const loading = bookLoading || sessionsLoading || threadLoading;
  if (loading) return <p className="text-sm text-muted-foreground">Loading book details…</p>;
  if (!book || !token) return <p className="text-sm text-muted-foreground">Book not found.</p>;

  const pct = book.total_pages > 0 ? Math.round((book.current_page / book.total_pages) * 100) : 0;
  const scoredSessions = sessions.filter((s) => s.ai_score !== null);
  const overall = scoredSessions.length > 0
    ? Math.round(scoredSessions.reduce((a, s) => a + (s.ai_score ?? 0) * (s.pages_to - s.pages_from + 1), 0) /
        Math.max(1, scoredSessions.reduce((a, s) => a + (s.pages_to - s.pages_from + 1), 0)))
    : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-6"
    >
      <button onClick={() => nav({ to: "/reading" })} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
        <ArrowLeft className="h-3 w-3" /> Back to library
      </button>

      <section className="aurora-card rounded-3xl p-6 relative overflow-hidden interactive-card shadow-soft">
        <div className="flex flex-col gap-6 md:flex-row items-center md:items-start">
          <BookCover title={book.title} author={book.author} coverUrl={book.cover_url} size="large" />
          <div className="flex-1 min-w-0 flex flex-col justify-between h-full space-y-4 w-full">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between w-full">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary/80">
                  <BookOpen className="h-3 w-3" /> {book.status === "finished" ? "Finished" : "Reading"}
                </p>
                <h1 className="font-display text-3xl mt-1">{book.title}</h1>
                {book.author && <p className="text-sm text-muted-foreground mt-0.5">{book.author}</p>}
              </div>
              <div className="min-w-[200px] space-y-2 w-full sm:w-auto">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">Progress</span>
                  <span className="font-display text-2xl text-primary">{pct}%</span>
                </div>
                <Progress value={pct} className="h-2" />
                <p className="text-xs text-muted-foreground">{book.current_page} / {book.total_pages} pages</p>
                {overall !== null && (
                  <div className="mt-2 flex items-center justify-between rounded-xl bg-background/30 px-3 py-2 ring-1 ring-primary/15">
                    <span className="text-xs text-muted-foreground">Understanding</span>
                    <span className="font-display text-primary">{overall}/100</span>
                  </div>
                )}
              </div>
            </div>

            {book.status === "finished" && book.final_summary && (
              <div className="mt-5 rounded-2xl bg-background/30 p-4 ring-1 ring-primary/20 animate-in fade-in-0 duration-300 w-full">
                <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-semibold">
                  <Trophy className="h-3 w-3 text-accent animate-bounce" /> Final report · {book.final_score}/100
                </p>
                <p className="mt-2 text-sm leading-relaxed">{book.final_summary}</p>
              </div>
            )}
          </div>
        </div>
      </section>


      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          {book.status === "reading" && (
            <section className="aurora-card rounded-2xl p-4">
              <h2 className="mb-3 font-display text-lg">Log today's reading</h2>
              <form onSubmit={handleLogSession} className="space-y-3">
                <div className="flex gap-2">
                  <Input type="number" placeholder="From page" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-background/40" />
                  <Input type="number" placeholder="To page" value={to} onChange={(e) => setTo(e.target.value)} className="bg-background/40" />
                </div>
                <Textarea
                  placeholder="What did you understand from today's reading? Ideas, quotes that hit, questions you still have…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  className="bg-background/40"
                />
                <div className="flex justify-between">
                  <Button type="button" variant="ghost" size="sm" onClick={handleFinishBook} disabled={finishBookMutation.isPending}>
                    {finishBookMutation.isPending ? "Wrapping up…" : "Mark as finished"}
                  </Button>
                  <Button type="submit" disabled={logSessionMutation.isPending}>
                    {logSessionMutation.isPending ? "Saving & grading…" : "Save & get feedback"}
                  </Button>
                </div>
              </form>
            </section>
          )}

          {/* Zuki Reading Insights */}
          <div className="aurora-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" /> ZUKI Reading Insights
              </h3>
              {insights && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => generateInsightsMutation.mutate()} 
                  disabled={generateInsightsMutation.isPending}
                  className="text-xs h-7 px-2 cursor-pointer"
                >
                  {generateInsightsMutation.isPending ? "Refreshing..." : "🔄 Refresh"}
                </Button>
              )}
            </div>

            {!insights ? (
              <div className="text-center py-6 space-y-3 border border-dashed border-border/40 rounded-xl">
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Zuki can analyze this book and generate reflection prompts, quotes, and personal applications connecting its ideas to your goals and worries.
                </p>
                <Button 
                  onClick={() => generateInsightsMutation.mutate()} 
                  disabled={generateInsightsMutation.isPending}
                  size="sm"
                  className="text-xs cursor-pointer"
                >
                  {generateInsightsMutation.isPending ? "Generating ZUKI Insights..." : "Generate Reading Insights"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Key Ideas */}
                {insights.key_ideas?.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase tracking-widest text-primary font-bold">Key Ideas</span>
                    <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1 pl-1">
                      {insights.key_ideas.map((idea: string, i: number) => (
                        <li key={i}>{idea}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Personal Applications */}
                {insights.personal_applications?.length > 0 && (
                  <div className="space-y-1 p-3 rounded-xl bg-primary/5 border border-primary/20">
                    <span className="text-[9px] uppercase tracking-widest text-accent font-bold">Personal Connection</span>
                    <ul className="list-disc list-inside text-xs text-foreground/90 space-y-1 pl-1">
                      {insights.personal_applications.map((app: string, i: number) => (
                        <li key={i}>{app}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Reflection Prompts */}
                {insights.reflection_prompts?.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Reflection Prompts</span>
                    <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1 pl-1">
                      {insights.reflection_prompts.map((p: string, i: number) => (
                        <li key={i} className="italic">"{p}"</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Quotes */}
                {insights.quotes?.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase tracking-widest text-rose-300 font-bold">Quotes worth remembering</span>
                    <div className="space-y-2 pl-1">
                      {insights.quotes.map((q: string, i: number) => (
                        <p key={i} className="text-xs italic text-muted-foreground pl-3 border-l-2 border-rose-300/40">"{q}"</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {sessions.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-display text-lg">Your sessions</h2>
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {sessions.map((s) => (
                  <div key={s.id} className="aurora-card rounded-2xl p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm">
                        <span className="text-muted-foreground">{s.session_date} · </span>
                        pp {s.pages_from}–{s.pages_to}
                      </p>
                      {s.ai_score !== null && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{s.ai_score}/100</span>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{s.understanding_note}</p>
                    {s.ai_feedback && (
                      <p className="mt-2 flex items-start gap-2 rounded-xl bg-background/30 p-3 text-xs text-muted-foreground ring-1 ring-primary/10">
                        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> {s.ai_feedback}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div>
          {threadId && (
            <section className="aurora-card flex h-[580px] flex-col rounded-2xl lg:sticky lg:top-4">
              <BookChat threadId={threadId} token={token} bookTitle={book.title} />
            </section>
          )}
        </div>
      </div>

      {/* Book Finished Celebration Overlay */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md select-none animate-in fade-in-0 duration-500">
          {/* Confetti particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 45 }).map((_, idx) => {
              const left = Math.random() * 100;
              const delay = Math.random() * 3;
              const durationClass = idx % 3 === 0 ? "animate-confetti-slow" : idx % 3 === 1 ? "animate-confetti-medium" : "animate-confetti-fast";
              const colors = ["bg-primary", "bg-accent", "bg-amber-400", "bg-purple-400", "bg-emerald-400", "bg-blue-400"];
              const randomColor = colors[Math.floor(Math.random() * colors.length)];
              const size = Math.random() * 10 + 6;
              const rotation = Math.random() * 360;
              return (
                <div
                  key={idx}
                  className={cn("absolute rounded-sm opacity-80", randomColor, durationClass)}
                  style={{
                    left: `${left}%`,
                    top: `-20px`,
                    width: `${size}px`,
                    height: `${size}px`,
                    animationDelay: `${delay}s`,
                    transform: `rotate(${rotation}deg)`
                  }}
                />
              );
            })}
          </div>

          {/* Celebration Card */}
          <div className="aurora-card max-w-md w-full mx-4 rounded-3xl p-8 text-center relative overflow-hidden interactive-card glow animate-in zoom-in-95 duration-500 border border-primary/45">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-accent/5 pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-accent/15 text-accent flex items-center justify-center glow animate-bounce">
                <Trophy className="h-8 w-8 text-accent" />
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold">Milestone Unlocked</p>
                <h2 className="font-display text-3xl sm:text-4xl text-foreground font-bold">Book Completed!</h2>
              </div>
              <p className="text-muted-foreground text-sm max-w-sm mt-1">
                "Every book completed is a chapter added to the story of who you are becoming."
              </p>
              <div className="w-full h-px bg-border/20 my-2" />
              <div className="text-left w-full bg-background/25 rounded-2xl p-4 border border-primary/20">
                <span className="text-xs text-muted-foreground uppercase tracking-wider block">Finished Book</span>
                <span className="font-display text-lg font-semibold text-foreground mt-0.5 block truncate">{book?.title}</span>
                {book?.author && <span className="text-xs text-muted-foreground block">— {book.author}</span>}
              </div>
              <Button onClick={() => setShowCelebration(false)} className="w-full mt-2 glow">
                View final report & scores
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function BookCover({ title, author, coverUrl, size = "small" }: { title: string; author: string | null; coverUrl?: string | null; size?: "small" | "large" }) {
  const [imgFailed, setImgFailed] = useState(false);
  const getHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  const hash = getHash(title);
  
  const gradients = [
    "from-[oklch(0.20_0.04_250)] to-[oklch(0.35_0.08_290)]", // Lavender Dusk
    "from-[oklch(0.22_0.04_180)] to-[oklch(0.32_0.08_150)]", // Forest Sage
    "from-[oklch(0.20_0.05_20)] to-[oklch(0.33_0.08_40)]",   // Clay Rose
    "from-[oklch(0.18_0.03_280)] to-[oklch(0.28_0.07_310)]", // Deep Iris
    "from-[oklch(0.23_0.03_90)] to-[oklch(0.33_0.06_70)]",   // Ochre Wheat
    "from-[oklch(0.19_0.04_220)] to-[oklch(0.30_0.08_240)]", // Ocean Teal
  ];

  const gradient = gradients[hash % gradients.length];
  const isLarge = size === "large";

  if (coverUrl && !imgFailed) {
    return (
      <div 
        className={cn(
          "relative rounded-xl overflow-hidden bg-zinc-950 flex flex-col justify-between border border-primary/20 shadow-md shrink-0",
          isLarge ? "h-64 w-44" : "h-28 w-20"
        )}
      >
        <img 
          src={coverUrl} 
          alt={title} 
          className="w-full h-full object-cover" 
          onError={() => setImgFailed(true)}
        />
        {/* Visual book crease/spine line */}
        <div className="absolute left-2 top-0 bottom-0 w-[1px] bg-white/10 shadow-[1px_0_3px_rgba(0,0,0,0.3)] pointer-events-none" />
        {/* Decorative design frame */}
        <div className="absolute inset-1.5 border border-white/5 rounded-lg pointer-events-none" />
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "relative rounded-xl overflow-hidden bg-gradient-to-br flex flex-col justify-between p-3 text-center border border-primary/20 shadow-md shrink-0",
        gradient,
        isLarge ? "h-64 w-44" : "h-28 w-20"
      )}
    >
      {/* Visual book crease/spine line */}
      <div className="absolute left-2 top-0 bottom-0 w-[1px] bg-white/10 shadow-[1px_0_3px_rgba(0,0,0,0.3)] pointer-events-none" />
      
      {/* Decorative design frame */}
      <div className="absolute inset-1.5 border border-white/5 rounded-lg pointer-events-none" />
      
      <div className="mt-1 space-y-0.5 relative z-10">
        <p className={cn("font-display font-semibold text-white leading-tight text-center break-words", isLarge ? "text-lg pt-4" : "text-[10px] line-clamp-3")}>
          {title}
        </p>
      </div>
      
      {author && (
        <p className={cn("font-sans font-light text-white/70 relative z-10 truncate text-center", isLarge ? "text-xs pb-2" : "text-[8px]")}>
          {author}
        </p>
      )}
    </div>
  );
}

function BookChat({ threadId, token, bookTitle }: { threadId: string; token: string; bookTitle: string }) {
  const { data: initial = null, isLoading } = useQuery({
    queryKey: ["book_chat_messages", threadId],
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
    return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading chat…</div>;
  }

  return <BookChatWindow threadId={threadId} token={token} bookTitle={bookTitle} initial={initial} />;
}

function BookChatWindow({ threadId, token, bookTitle, initial }: { threadId: string; token: string; bookTitle: string; initial: UIMessage[] }) {
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
    <>
      <div className="flex items-center gap-3 border-b border-border/40 p-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className="font-display text-lg leading-tight">Talk about this book</p>
          <p className="text-xs text-muted-foreground">Quiz me, explain a chapter, surface what I missed.</p>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="space-y-4 p-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ask anything about <em>{bookTitle}</em> — e.g. "quiz me on what I read so far" or "what's the key idea of chapter 3?"
            </p>
          )}
          {messages.map((m) => {
            const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
            const isUser = m.role === "user";
            return (
              <div key={m.id} className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  isUser ? "bg-primary text-primary-foreground" : "bg-background/40 ring-1 ring-border/40",
                )}>
                  {text}
                </div>
              </div>
            );
          })}
          {status === "submitted" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 animate-pulse text-primary" /> Thinking…
            </div>
          )}
        </div>
      </ScrollArea>
      <form onSubmit={submit} className="border-t border-border/40 p-3">
        <div className="flex items-end gap-2 rounded-2xl bg-background/40 p-2 ring-1 ring-border/50 focus-within:ring-primary/50">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Ask about this book…"
            rows={1}
            className="min-h-[40px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
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
    </>
  );
}
