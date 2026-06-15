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

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  ssr: false,
  component: ChatThread,
});

function ChatThread() {
  const { threadId } = useParams({ from: "/_authenticated/chat/$threadId" });
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const opening = useMemo(() => randomOpeningThought(), [threadId]);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      setToken(s.session?.access_token ?? null);
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id,role,parts,client_message_id,created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) {
        toast.error(error.message);
        setInitial([]);
        return;
      }
      setInitial(
        (data ?? []).map((m) => ({
          id: m.client_message_id ?? m.id,
          role: m.role as UIMessage["role"],
          parts: m.parts as UIMessage["parts"],
        })),
      );
    })();
  }, [threadId]);

  if (initial === null || !token) {
    return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  return <ChatWindow key={threadId} threadId={threadId} initial={initial} token={token} opening={opening} />;
}

function ChatWindow({
  threadId,
  initial,
  token,
  opening,
}: {
  threadId: string;
  initial: UIMessage[];
  token: string;
  opening: string;
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    // Auto-title from first user message
    if (messages.length === 0) {
      const title = text.slice(0, 60);
      await supabase.from("chat_threads").update({ title }).eq("id", threadId);
    }
    await sendMessage({ text });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-border/40 p-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className="font-display text-lg leading-tight">Lumen</p>
          <p className="text-xs text-muted-foreground">Calm clarity, on demand</p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
          {messages.length === 0 && (
            <div className="rounded-2xl bg-background/30 p-5 ring-1 ring-primary/20">
              <p className="text-xs uppercase tracking-widest text-primary/80">A thought to begin</p>
              <p className="mt-2 font-display text-lg italic">"{opening}"</p>
              <p className="mt-3 text-sm text-muted-foreground">
                Tell me what's on your mind, what you're avoiding, or what you'd love today to become.
              </p>
            </div>
          )}
          {messages.map((m) => {
            const text = m.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
            const isUser = m.role === "user";
            return (
              <div key={m.id} className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
                {!isUser && (
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground",
                  )}
                >
                  {text}
                </div>
              </div>
            );
          })}
          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 animate-pulse text-primary" /> Lumen is reflecting…
            </div>
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
            placeholder="Ask Lumen anything…"
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
    </div>
  );
}
