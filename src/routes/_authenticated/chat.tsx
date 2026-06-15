import { createFileRoute, Outlet, Link, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessagesSquare, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  ssr: false,
  head: () => ({ meta: [{ title: "Lumen Chat" }] }),
  component: ChatLayout,
});

type Thread = { id: string; title: string; updated_at: string };

function ChatLayout() {
  const nav = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeId = pathname.match(/\/chat\/([^/]+)/)?.[1];

  useEffect(() => {
    loadThreads();
  }, []);

  async function loadThreads() {
    const { data, error } = await supabase
      .from("chat_threads")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false });
    if (error) return toast.error(error.message);
    setThreads((data ?? []) as Thread[]);
    setLoading(false);
  }

  async function newThread() {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data, error } = await supabase
      .from("chat_threads")
      .insert({ user_id: user.user.id, title: "New conversation" })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setThreads((p) => [data as Thread, ...p]);
    nav({ to: "/chat/$threadId", params: { threadId: data.id } });
  }

  async function deleteThread(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    await supabase.from("chat_threads").delete().eq("id", id);
    setThreads((p) => p.filter((t) => t.id !== id));
    if (activeId === id) nav({ to: "/chat" });
  }

  return (
    <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
      <aside className="aurora-card hidden flex-col rounded-2xl p-3 md:flex">
        <Button onClick={newThread} className="mb-3">
          <Plus className="h-4 w-4" /> New chat
        </Button>
        <ScrollArea className="flex-1">
          <div className="space-y-1 pr-2">
            {loading && <p className="px-2 text-xs text-muted-foreground">Loading…</p>}
            {!loading && threads.length === 0 && (
              <p className="px-2 text-xs text-muted-foreground">No conversations yet.</p>
            )}
            {threads.map((t) => (
              <Link
                key={t.id}
                to="/chat/$threadId"
                params={{ threadId: t.id }}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors",
                  activeId === t.id
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <MessagesSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{t.title}</span>
                <button
                  onClick={(e) => deleteThread(t.id, e)}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5 hover:text-destructive" />
                </button>
              </Link>
            ))}
          </div>
        </ScrollArea>
      </aside>
      <section className="aurora-card flex min-h-0 flex-col rounded-2xl">
        <Outlet />
      </section>
    </div>
  );
}
