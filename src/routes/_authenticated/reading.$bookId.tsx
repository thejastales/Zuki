import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [book, setBook] = useState<Book | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: b }, { data: ses }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from("books").select("*").eq("id", bookId).maybeSingle(),
        supabase.from("reading_sessions").select("*").eq("book_id", bookId).order("created_at", { ascending: false }),
      ]);
      setToken(s.session?.access_token ?? null);
      setBook(b as Book | null);
      setSessions((ses ?? []) as Session[]);
      if (b) setFrom(String((b as Book).current_page || 0));

      // find or create the book's chat thread
      const { data: existing } = await supabase
        .from("chat_threads")
        .select("id")
        .eq("book_id", bookId)
        .maybeSingle();
      if (existing) {
        setThreadId(existing.id);
      } else if (s.session?.user) {
        const { data: created } = await supabase
          .from("chat_threads")
          .insert({
            user_id: s.session.user.id,
            book_id: bookId,
            title: `Chat: ${(b as Book | null)?.title ?? "book"}`,
          })
          .select("id")
          .single();
        setThreadId(created?.id ?? null);
      }
    })();
  }, [bookId]);

  async function logSession(e: React.FormEvent) {
    e.preventDefault();
    if (!book || !token) return;
    const f = parseInt(from), t = parseInt(to);
    if (isNaN(f) || isNaN(t) || t < f) return toast.error("Check the page range.");
    if (!note.trim()) return toast.error("Add a sentence or two on what you understood.");
    setBusy(true);
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) { setBusy(false); return; }
    const { data: row, error } = await supabase
      .from("reading_sessions")
      .insert({
        user_id: user.user.id,
        book_id: book.id,
        pages_from: f,
        pages_to: t,
        understanding_note: note.trim(),
      })
      .select()
      .single();
    if (error || !row) { toast.error(error?.message ?? "Failed"); setBusy(false); return; }
    setSessions((p) => [row as Session, ...p]);
    setNote("");
    setFrom(String(t));
    setTo("");
    setBook((b) => b ? { ...b, current_page: Math.max(b.current_page, t) } : b);

    // grade via AI (non-blocking-ish, but await for feedback)
    try {
      const res = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "score", bookId: book.id, sessionId: (row as Session).id }),
      });
      if (res.ok) {
        const j = (await res.json()) as { score: number; feedback: string };
        setSessions((p) => p.map((s) => s.id === (row as Session).id ? { ...s, ai_score: j.score, ai_feedback: j.feedback } : s));
      }
    } catch {/* ignore */}
    setBusy(false);
  }

  async function finishBook() {
    if (!book || !token) return;
    if (!confirm("Mark this book as finished? The AI will write a final report and recommend next reads.")) return;
    setFinishing(true);
    try {
      const res = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "finish", bookId: book.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { finalScore: number; finalSummary: string };
      setBook((b) => b ? { ...b, status: "finished", final_score: j.finalScore, final_summary: j.finalSummary } : b);
      toast.success("Book finished. Check your recommendations!");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setFinishing(false);
  }

  if (!book || !token) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const pct = book.total_pages > 0 ? Math.round((book.current_page / book.total_pages) * 100) : 0;
  const scoredSessions = sessions.filter((s) => s.ai_score !== null);
  const overall = scoredSessions.length > 0
    ? Math.round(scoredSessions.reduce((a, s) => a + (s.ai_score ?? 0) * (s.pages_to - s.pages_from + 1), 0) /
        Math.max(1, scoredSessions.reduce((a, s) => a + (s.pages_to - s.pages_from + 1), 0)))
    : null;

  return (
    <div className="space-y-6">
      <button onClick={() => nav({ to: "/reading" })} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to library
      </button>

      <section className="aurora-card rounded-3xl p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary/80">
              <BookOpen className="h-3 w-3" /> {book.status === "finished" ? "Finished" : "Reading"}
            </p>
            <h1 className="font-display text-3xl">{book.title}</h1>
            {book.author && <p className="text-sm text-muted-foreground">{book.author}</p>}
          </div>
          <div className="min-w-[200px] space-y-2">
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
          <div className="mt-5 rounded-2xl bg-background/30 p-4 ring-1 ring-primary/20">
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary/80">
              <Trophy className="h-3 w-3" /> Final report · {book.final_score}/100
            </p>
            <p className="mt-2 text-sm leading-relaxed">{book.final_summary}</p>
          </div>
        )}
      </section>

      {book.status === "reading" && (
        <section className="aurora-card rounded-2xl p-4">
          <h2 className="mb-3 font-display text-lg">Log today's reading</h2>
          <form onSubmit={logSession} className="space-y-3">
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
              <Button type="button" variant="ghost" size="sm" onClick={finishBook} disabled={finishing}>
                {finishing ? "Wrapping up…" : "Mark as finished"}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving & grading…" : "Save & get feedback"}
              </Button>
            </div>
          </form>
        </section>
      )}

      {sessions.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-lg">Your sessions</h2>
          <div className="space-y-2">
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

      {threadId && (
        <section className="aurora-card flex h-[520px] flex-col rounded-2xl">
          <BookChat threadId={threadId} token={token} bookTitle={book.title} />
        </section>
      )}
    </div>
  );
}

function BookChat({ threadId, token, bookTitle }: { threadId: string; token: string; bookTitle: string }) {
  const [initial, setInitial] = useState<UIMessage[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id,role,parts,client_message_id,created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      setInitial(
        (data ?? []).map((m) => ({
          id: m.client_message_id ?? m.id,
          role: m.role as UIMessage["role"],
          parts: m.parts as UIMessage["parts"],
        })),
      );
    })();
  }, [threadId]);

  if (initial === null) return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading chat…</div>;

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
