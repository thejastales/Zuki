import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessagesSquare, Trash2, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/chat")({
  ssr: false,
  head: () => ({ meta: [{ title: "ZUKI Chat" }] }),
  component: ChatLayout,
});

type Thread = { id: string; title: string; updated_at: string };

function ChatLayout() {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeId = pathname.match(/\/chat\/([^/]+)/)?.[1];

  // Query threads
  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["chat_threads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("id,title,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Thread[];
    },
  });

  // Mutations
  const newThreadMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("chat_threads")
        .insert({ user_id: user.user.id, title: "New conversation" })
        .select();
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as Thread;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chat_threads"] });
      const threadId = (data as any)?.id || (Array.isArray(data) ? (data[0] as any)?.id : undefined);
      if (threadId) {
        nav({ to: "/chat/$threadId", params: { threadId } });
      } else {
        nav({ to: "/chat" });
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteThreadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_threads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ["chat_threads"] });
      if (activeId === id) nav({ to: "/chat" });
      toast.success("Conversation deleted.");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  function handleNewThread() {
    newThreadMutation.mutate();
  }

  function handleDeleteThread(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (confirm("Delete this conversation?")) {
      deleteThreadMutation.mutate(id);
    }
  }

  const sidebarContent = (
    <>
      <Button onClick={handleNewThread} disabled={newThreadMutation.isPending} className="mb-3">
        <Plus className="h-4 w-4" /> New chat
      </Button>
      <ScrollArea className="flex-1">
        <div className="space-y-1 pr-2">
          {isLoading && <p className="px-2 text-xs text-muted-foreground animate-pulse">Loading conversations…</p>}
          {!isLoading && threads.length === 0 && (
            <p className="px-2 text-xs text-muted-foreground italic">No conversations yet.</p>
          )}
          {threads.map((t) => (
            <Link
              key={t.id}
              to="/chat/$threadId"
              params={{ threadId: t.id }}
              onClick={() => setMobileSidebarOpen(false)}
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
                type="button"
                onClick={(e) => handleDeleteThread(t.id, e)}
                className="opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5 hover:text-destructive" />
              </button>
            </Link>
          ))}
        </div>
      </ScrollArea>
    </>
  );

  return (
    <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
      {/* Desktop Sidebar */}
      <aside className="aurora-card hidden flex-col rounded-2xl p-3 md:flex">
        {sidebarContent}
      </aside>

      {/* Main Workspace */}
      <section className="aurora-card flex min-h-0 flex-col rounded-2xl">
        {isMobile && (
          <div className="flex items-center border-b border-border/40 p-3 bg-background/20">
            <Button variant="ghost" size="icon" onClick={() => setMobileSidebarOpen(true)} className="mr-2 cursor-pointer">
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-sm font-semibold tracking-wide">Conversations</span>
          </div>
        )}
        <Outlet />
      </section>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="aurora-card border-r border-border/40 p-3 w-[280px] flex flex-col h-full z-50">
          <SheetHeader className="pb-2 border-b border-border/20 mb-3">
            <SheetTitle className="font-display text-xl">Conversations</SheetTitle>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>
    </div>
  );
}
