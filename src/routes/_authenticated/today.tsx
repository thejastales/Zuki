import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Plus, Clock, Trash2, ArrowRight, ArrowLeft, Sparkles, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MOODS, quoteForMood, randomMotivation, type MoodKey } from "@/lib/quotes";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/today")({
  ssr: false,
  head: () => ({ meta: [{ title: "Today — Lumen" }] }),
  component: TodayPage,
});

type Task = {
  id: string;
  title: string;
  notes: string | null;
  scheduled_time: string | null;
  duration_minutes: number | null;
  status: "todo" | "in_progress" | "completed";
  task_date: string;
  sort_order: number;
};

const COLUMNS: { key: Task["status"]; label: string; accent: string }[] = [
  { key: "todo", label: "To Do", accent: "from-[oklch(0.45_0.10_260)] to-transparent" },
  { key: "in_progress", label: "In Progress", accent: "from-[oklch(0.50_0.13_305)] to-transparent" },
  { key: "completed", label: "Completed", accent: "from-[oklch(0.55_0.14_155)] to-transparent" },
];

const today = () => format(new Date(), "yyyy-MM-dd");

function TodayPage() {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const currentDate = useMemo(() => today(), []);

  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");

  // mood check-in states
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [score, setScore] = useState<number[]>([7]);
  const [mood, setMood] = useState<MoodKey>("neutral");

  // mobile tab state
  const [activeTab, setActiveTab] = useState<Task["status"]>("todo");

  const motivation = useMemo(() => randomMotivation(), []);

  // Fetch tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks", currentDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("task_date", currentDate)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  // Fetch mood check-in
  const { data: moodCheckin, isLoading: moodLoading } = useQuery({
    queryKey: ["mood_checkin", currentDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mood_checkins")
        .select("*")
        .eq("checkin_date", currentDate)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Pop up check-in modal if none exists for today
  useEffect(() => {
    if (!moodLoading && !moodCheckin) {
      setCheckinOpen(true);
    }
  }, [moodCheckin, moodLoading]);

  // Mutations
  const addTaskMutation = useMutation({
    mutationFn: async ({ title, time, duration }: { title: string; time: string; duration: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: user.user.id,
          title: title.trim(),
          scheduled_time: time || null,
          duration_minutes: duration ? parseInt(duration) : null,
          task_date: currentDate,
          status: "todo",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", currentDate] });
      setTitle("");
      setTime("");
      setDuration("");
      toast.success("Intention added.");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const moveTaskMutation = useMutation({
    mutationFn: async ({ task, nextStatus }: { task: Task; nextStatus: Task["status"] }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: nextStatus })
        .eq("id", task.id);
      if (error) throw error;
    },
    onMutate: async ({ task, nextStatus }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", currentDate] });
      const previousTasks = queryClient.getQueryData<Task[]>(["tasks", currentDate]);
      if (previousTasks) {
        queryClient.setQueryData<Task[]>(
          ["tasks", currentDate],
          previousTasks.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)),
        );
      }
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks", currentDate], context.previousTasks);
      }
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", currentDate] });
    },
  });

  const removeTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", currentDate] });
      const previousTasks = queryClient.getQueryData<Task[]>(["tasks", currentDate]);
      if (previousTasks) {
        queryClient.setQueryData<Task[]>(
          ["tasks", currentDate],
          previousTasks.filter((t) => t.id !== id),
        );
      }
      return { previousTasks };
    },
    onError: (err, id, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks", currentDate], context.previousTasks);
      }
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", currentDate] });
    },
  });

  const saveCheckinMutation = useMutation({
    mutationFn: async ({ mood, score }: { mood: MoodKey; score: number }) => {
      const q = quoteForMood(mood);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      const { error } = await supabase.from("mood_checkins").upsert(
        {
          user_id: user.user.id,
          checkin_date: currentDate,
          productivity_score: score,
          mood,
          quote: q.text,
          quote_author: q.author,
        },
        { onConflict: "user_id,checkin_date" },
      );
      if (error) throw error;
      return q;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mood_checkin", currentDate] });
      setCheckinOpen(false);
      toast.success("Logged. Have a beautiful day.");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "completed").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    addTaskMutation.mutate({ title, time, duration });
  }

  function handleMove(task: Task, dir: 1 | -1) {
    const order: Task["status"][] = ["todo", "in_progress", "completed"];
    const i = order.indexOf(task.status);
    const nextStatus = order[Math.min(order.length - 1, Math.max(0, i + dir))];
    if (nextStatus === task.status) return;
    moveTaskMutation.mutate({ task, nextStatus });
  }

  function handleRemove(task: Task) {
    removeTaskMutation.mutate(task.id);
  }

  function handleSaveCheckin() {
    saveCheckinMutation.mutate({ mood, score: score[0] });
  }

  const todayQuote = moodCheckin ? { text: moodCheckin.quote ?? "", author: moodCheckin.quote_author ?? "" } : null;

  return (
    <div className="space-y-6">
      {/* hero / quote */}
      <section className="aurora-card relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-primary/80">Today</p>
            <h1 className="font-display text-3xl sm:text-4xl">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">{motivation}</p>
          </div>
          <div className="min-w-[180px] space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Progress</span>
              <span className="font-display text-2xl text-primary">{pct}%</span>
            </div>
            <Progress value={pct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {done} of {total} done
            </p>
          </div>
        </div>
        {todayQuote && todayQuote.text && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-background/30 p-4 ring-1 ring-primary/15">
            <Quote className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-display italic text-foreground">"{todayQuote.text}"</p>
              <p className="mt-1 text-xs text-muted-foreground">— {todayQuote.author}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto shrink-0"
              onClick={() => setCheckinOpen(true)}
            >
              Re-check mood
            </Button>
          </div>
        )}
      </section>

      {/* add task */}
      <form onSubmit={handleAddTask} className="aurora-card flex flex-col gap-2 rounded-2xl p-4 sm:flex-row">
        <Input
          placeholder="What do you want to do today?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 bg-background/40"
        />
        <div className="flex gap-2">
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full bg-background/40 sm:w-32"
          />
          <Input
            type="number"
            min={5}
            step={5}
            placeholder="min"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full bg-background/40 sm:w-24"
          />
        </div>
        <Button type="submit" disabled={addTaskMutation.isPending} className="sm:w-auto shrink-0">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>

      {/* Mobile column selection tabs */}
      {isMobile && (
        <div className="flex rounded-xl bg-secondary/40 p-1 ring-1 ring-border/40">
          {COLUMNS.map((col) => {
            const count = tasks.filter((t) => t.status === col.key).length;
            return (
              <button
                key={col.key}
                type="button"
                onClick={() => setActiveTab(col.key)}
                className={cn(
                  "flex-1 rounded-lg py-2 text-center text-xs font-semibold tracking-wide transition-all",
                  activeTab === col.key
                    ? "bg-primary/15 text-primary glow"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {col.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* board */}
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          if (isMobile && activeTab !== col.key) return null;
          const items = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="aurora-card flex flex-col rounded-2xl p-4">
              <div className={cn("mb-3 -mx-4 -mt-4 rounded-t-2xl bg-gradient-to-b p-4", col.accent)}>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg">{col.label}</h2>
                  <span className="rounded-full bg-background/40 px-2 py-0.5 text-xs text-muted-foreground">
                    {items.length}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {items.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border/50 p-3 text-center text-xs text-muted-foreground">
                    {col.key === "todo" && !tasksLoading ? "Pause. Breathe. Add your first intention." : "Empty"}
                  </p>
                )}
                {items.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "group rounded-xl bg-background/40 p-3 ring-1 ring-border/40 transition-all hover:ring-primary/40",
                      t.status === "completed" && "opacity-60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            t.status === "completed" && "line-through",
                          )}
                        >
                          {t.title}
                        </p>
                        {(t.scheduled_time || t.duration_minutes) && (
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {t.scheduled_time?.slice(0, 5)}
                            {t.duration_minutes ? ` · ${t.duration_minutes}m` : ""}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemove(t)}
                        className="opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                    <div className="mt-2 flex justify-end gap-1">
                      {col.key !== "todo" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleMove(t, -1)}
                          title="Move back"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {col.key !== "completed" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleMove(t, 1)}
                          title="Advance"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* mood check-in dialog */}
      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent className="aurora-card border-0 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              <Sparkles className="mr-2 inline h-5 w-5 text-primary" />
              Before we begin
            </DialogTitle>
            <DialogDescription>
              A small ritual: notice where you are, so today can meet you there.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm text-foreground">How productive does your day feel?</label>
                <span className="font-display text-xl text-primary">{score[0]}</span>
              </div>
              <Slider value={score} onValueChange={setScore} min={1} max={10} step={1} />
              <div className="mt-1 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                <span>Foggy</span>
                <span>Aligned</span>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm text-foreground">What's the overall feeling?</label>
              <div className="grid grid-cols-4 gap-2">
                {MOODS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMood(m.key)}
                    className={cn(
                      "rounded-xl border p-2 text-xs transition-all cursor-pointer",
                      mood === m.key
                        ? "border-primary bg-primary/15 text-foreground glow"
                        : "border-border/50 bg-background/30 text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    <div className="text-lg">{m.emoji}</div>
                    <div>{m.label}</div>
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleSaveCheckin} disabled={saveCheckinMutation.isPending} className="w-full">
              Receive today's quote
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
