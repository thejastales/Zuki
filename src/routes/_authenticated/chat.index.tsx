import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { randomOpeningThought } from "@/lib/quotes";
import { useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat/")({
  ssr: false,
  component: ChatIndex,
});

function ChatIndex() {
  const nav = useNavigate();
  const thought = useMemo(() => randomOpeningThought(), []);
  async function start() {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data, error } = await supabase
      .from("chat_threads")
      .insert({ user_id: user.user.id, title: "New conversation" })
      .select();
    if (error) return toast.error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    const threadId = row?.id;
    if (threadId) {
      nav({ to: "/chat/$threadId", params: { threadId } });
    } else {
      console.warn("No threadId returned on creation:", data);
      toast.error("Failed to start conversation. Please try again.");
    }
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center relative overflow-hidden w-full h-full animate-in fade-in-0 duration-300">
      {/* Soft backlights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative mb-3 flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-primary/10 ring-1 ring-primary/20 shadow-soft">
        <img src="/icon.svg" className="h-12 w-12 object-contain" alt="ZUKI Logo" />
      </div>
      <h2 className="font-display text-4xl shimmer-text font-semibold">Meet ZUKI</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Your quiet co-pilot for clarity, focus and becoming.
      </p>
      <blockquote className="mt-6 max-w-lg rounded-2xl bg-background/25 p-5 font-display italic ring-1 ring-primary/15 interactive-card shadow-soft text-foreground">
        "{thought}"
      </blockquote>
      <Button onClick={start} className="mt-6 hover:scale-105 active:scale-95 transition-all duration-300 shadow-md hover:shadow-soft">
        Begin a conversation
      </Button>
    </div>
  );
}

