import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
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
      .select()
      .single();
    if (error) return toast.error(error.message);
    nav({ to: "/chat/$threadId", params: { threadId: data.id } });
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary glow">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="font-display text-3xl">Meet Lumen</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Your quiet co-pilot for clarity, focus and becoming.
      </p>
      <blockquote className="mt-6 max-w-lg rounded-2xl bg-background/30 p-4 font-display italic ring-1 ring-primary/15">
        "{thought}"
      </blockquote>
      <Button onClick={start} className="mt-6">
        Begin a conversation
      </Button>
    </div>
  );
}
