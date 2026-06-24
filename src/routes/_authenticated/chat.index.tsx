import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { randomOpeningThought } from "@/lib/quotes";
import { useMemo } from "react";
import { toast } from "sonner";
import { motion } from "motion/react";

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
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-1 flex-col items-center justify-center p-8 text-center relative overflow-hidden w-full h-full"
    >
      {/* Soft backlights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Custom hand-drawn cloud spirit companion doodle */}
      <div className="relative flex items-center justify-center h-24 w-28 shrink-0 overflow-visible animate-float mb-2">
        {/* Soft background light */}
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl animate-pulse scale-90" />
        
        <svg viewBox="0 0 120 100" className="w-20 h-16 stroke-primary/50 stroke-[1.5] fill-primary/5 drop-shadow-sm select-none pointer-events-none">
          {/* Cloud body */}
          <path d="M30,70 Q10,70 15,50 Q10,25 35,30 Q45,10 70,15 Q95,10 95,35 Q115,35 105,60 Q110,80 85,75 Q70,90 45,80 Q25,85 30,70 Z" />
          {/* Soft closed eyes */}
          <path d="M40,50 Q45,55 50,50" strokeLinecap="round" />
          <path d="M70,50 Q75,55 80,50" strokeLinecap="round" />
          {/* Smiling mouth */}
          <path d="M56,60 Q60,64 64,60" strokeLinecap="round" />
          {/* Rosy cheeks */}
          <circle cx="36" cy="56" r="3" className="fill-accent/40 stroke-none" />
          <circle cx="84" cy="56" r="3" className="fill-accent/40 stroke-none" />
        </svg>
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
    </motion.div>
  );
}

