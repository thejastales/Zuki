import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Plus, Clock, Trash2, ArrowRight, ArrowLeft, Sparkles, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MOODS, quoteForMood, randomMotivation, type MoodKey } from "@/lib/quotes";

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

const today = () => new Date().toISOString().slice(0, 10);

function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");

  // mood check-in
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [score, setScore] = useState<number[]>([7]);
  const [mood, setMood] = useState<MoodKey>("neutral");
  const [todayQuote, setTodayQuote] = useState<{ text: string; author: string } | null>(null);

  const motivation = useMemo(() => randomMotivation(), []);

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: checkin }] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("task_date", today())
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase.from("mood_checkins").select("*").eq("checkin_date", today()).maybeSingle(),
      ]);
      setTasks((t ?? []) as Task[]);
      if (checkin) {
        setTodayQuote({ text: checkin.quote ?? "", author: checkin.quote_author ?? "" });
      } else {
        setCheckinOpen(true);
      }
      setLoading(false);
    })();
  }, []);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: user.user.id,
        title: title.trim(),
        scheduled_time: time || null,
        duration_minutes: duration ? parseInt(duration) : null,
        task_date: today(),
        status: "todo",
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setTasks((p) => [...p, data as Task]);
    setTitle("");
    setTime("");
    setDuration("");
  }

  async function move(task: Task, dir: 1 | -1) {
    const order: Task["status"][] = ["todo", "in_progress", "completed"];
    const i = order.indexOf(task.status);
    const next = order[Math.min(order.length - 1, Math.max(0, i + dir))];
    if (next === task.status) return;
    setTasks((p) => p.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    const { error } = await supabase.from("tasks").update({ status: next }).eq("id", task.id);
    if (error) toast.error(error.message);
  }

  async function remove(task: Task) {
    setTasks((p) => p.filter((t) => t.id !== task.id));
    await supabase.from("tasks").delete().eq("id", task.id);
  }

  async function saveCheckin() {
    const q = quoteForMood(mood);
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { error } = await supabase.from("mood_checkins").upsert(
      {
        user_id: user.user.id,
        checkin_date: today(),
        productivity_score: score[0],
        mood,
        quote: q.text,
        quote_author: q.author,
      },
      { onConflict: "user_id,checkin_date" },
    );
    if (error) return toast.error(error.message);
    setTodayQuote(q);
    setCheckinOpen(false);
    toast.success("Logged. Have a beautiful day.");
  }

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "completed").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

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
      <form onSubmit={addTask} className="aurora-card flex flex-col gap-2 rounded-2xl p-4 sm:flex-row">
        <Input
          placeholder="What do you want to do today?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 bg-background/40"
        />
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
        <Button type="submit" className="sm:w-auto">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>

      {/* board */}
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
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
                    {col.key === "todo" && !loading ? "Pause. Breathe. Add your first intention." : "Empty"}
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
                        onClick={() => remove(t)}
                        className="opacity-0 transition-opacity group-hover:opacity-100"
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
                          onClick={() => move(t, -1)}
                          title="Move back"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {col.key !== "completed" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => move(t, 1)}
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
                      "rounded-xl border p-2 text-xs transition-all",
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
            <Button onClick={saveCheckin} className="w-full">
              Receive today's quote
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Avoid unused import warning for Textarea (kept for future task notes)
export { Textarea as _Textarea };
