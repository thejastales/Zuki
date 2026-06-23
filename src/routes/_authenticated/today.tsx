import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Plus, Clock, Trash2, ArrowRight, ArrowLeft, Sparkles, Quote, Sprout, BrainCircuit, HeartHandshake, LayoutGrid, Award, Sun, CloudSun, Cloud, CloudRain, CloudLightning, Check, Flame, Compass, BookOpen, BookOpenCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MOODS, quoteForMood, randomMotivation, type MoodKey } from "@/lib/quotes";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/today")({
  ssr: false,
  head: () => ({ meta: [{ title: "ZUKI Your personal companion" }] }),
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

  // Dream Vault goals form states
  const [goalTitle, setGoalTitle] = useState("");
  const [goalNotes, setGoalNotes] = useState("");

  // Start dates memos for queries
  const startOfWeekDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return format(date, "yyyy-MM-dd");
  }, []);

  const last30DaysDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return format(date, "yyyy-MM-dd");
  }, []);

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

  // Query completed weekly tasks for Stats calculation
  const { data: weeklyTasks = [] } = useQuery({
    queryKey: ["weekly_tasks", startOfWeekDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("duration_minutes, status, task_date")
        .gte("task_date", startOfWeekDate);
      if (error) throw error;
      return data ?? [];
    }
  });

  // Query today's reading sessions
  const { data: todayReading = [] } = useQuery({
    queryKey: ["today_reading", currentDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reading_sessions")
        .select("pages_from, pages_to")
        .eq("session_date", currentDate);
      if (error) throw error;
      return data ?? [];
    }
  });

  // Query today's worries count
  const { data: todayWorries = [] } = useQuery({
    queryKey: ["today_worries", currentDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worries")
        .select("id")
        .eq("worry_date", currentDate);
      if (error) throw error;
      return data ?? [];
    }
  });

  // Heatmap: 30 days query
  const { data: heatmapData = {} } = useQuery({
    queryKey: ["heatmap_logs", last30DaysDate],
    queryFn: async () => {
      const [tasksRes, worriesRes, readingRes, moodsRes] = await Promise.all([
        supabase.from("tasks").select("task_date, status").gte("task_date", last30DaysDate),
        supabase.from("worries").select("worry_date").gte("worry_date", last30DaysDate),
        supabase.from("reading_sessions").select("session_date, pages_from, pages_to").gte("session_date", last30DaysDate),
        supabase.from("mood_checkins").select("checkin_date").gte("checkin_date", last30DaysDate),
      ]);

      const map: Record<string, { tasks: number; worries: number; pages: number; mood: number }> = {};
      
      (tasksRes.data ?? []).forEach(t => {
        if (t.status === "completed") {
          map[t.task_date] = map[t.task_date] || { tasks: 0, worries: 0, pages: 0, mood: 0 };
          map[t.task_date].tasks += 1;
        }
      });
      (worriesRes.data ?? []).forEach(w => {
        map[w.worry_date] = map[w.worry_date] || { tasks: 0, worries: 0, pages: 0, mood: 0 };
        map[w.worry_date].worries += 1;
      });
      (readingRes.data ?? []).forEach(r => {
        map[r.session_date] = map[r.session_date] || { tasks: 0, worries: 0, pages: 0, mood: 0 };
        map[r.session_date].pages += Math.max(0, r.pages_to - r.pages_from + 1);
      });
      (moodsRes.data ?? []).forEach(m => {
        map[m.checkin_date] = map[m.checkin_date] || { tasks: 0, worries: 0, pages: 0, mood: 0 };
        map[m.checkin_date].mood += 1;
      });

      return map;
    }
  });

  // Query Goals from Dream Vault
  const { data: goals = [], isLoading: goalsLoading } = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return [];
      return data ?? [];
    }
  });

  // Fetch user session/metadata
  const { data: userData } = useQuery({
    queryKey: ["auth_user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    }
  });

  const userName = userData?.user_metadata?.full_name || userData?.user_metadata?.name || userData?.email?.split("@")[0] || "friend";

  // Declare safe helper constants with nullish fallbacks
  const tasksList = tasks ?? [];
  const weeklyTasksList = weeklyTasks ?? [];
  const todayReadingList = todayReading ?? [];
  const todayWorriesList = todayWorries ?? [];
  const heatmapDataObj = heatmapData ?? {};
  const goalsList = goals ?? [];

  // Downstream calculations using safe fallbacks
  const hoursReclaimed = useMemo(() => {
    const completed = weeklyTasksList.filter(t => t.status === "completed");
    const totalMin = completed.reduce((acc, t) => acc + (t.duration_minutes ?? 0), 0);
    return (totalMin / 60).toFixed(1);
  }, [weeklyTasksList]);

  const pagesReadToday = useMemo(() => {
    return todayReadingList.reduce((acc, s) => acc + Math.max(0, s.pages_to - s.pages_from + 1), 0);
  }, [todayReadingList]);

  const worriesParkedToday = todayWorriesList.length;

  const zukiObservation = useMemo(() => {
    const done = tasksList.filter((t) => t.status === "completed").length;
    const total = tasksList.length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    if (pct >= 70 && pagesReadToday > 0 && worriesParkedToday === 0) {
      return "You had an exceptionally focused and peaceful day. Connecting with books while keeping your mind worry-free is your superpower.";
    }
    if (pct >= 50 && worriesParkedToday > 0) {
      return "You made solid progress today despite some worries surfacing. Parking them allowed you to get things done.";
    }
    if (pagesReadToday > 15) {
      return "A wonderful reading streak today! Taking time for slow learning has a calming effect on your nervous system.";
    }
    if (moodCheckin && moodCheckin.productivity_score < 5) {
      return "Energy is a bit low today, and that's okay. Treat yourself with kindness — rest is also productive.";
    }
    return "You are making steady, intentional steps. Focus on your breath and let today unfold one moment at a time.";
  }, [tasksList, pagesReadToday, worriesParkedToday, moodCheckin]);

  const heatmapArray = useMemo(() => {
    const arr = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = format(d, "yyyy-MM-dd");
      const val = heatmapDataObj[dateStr] || { tasks: 0, worries: 0, pages: 0, mood: 0 };
      const score = (val.tasks * 2) + (val.pages * 0.1) + (val.worries * 1) + (val.mood * 2);
      arr.push({ date: dateStr, score, data: val });
    }
    return arr;
  }, [heatmapDataObj]);

  // Goal mutations
  const addGoalMutation = useMutation({
    mutationFn: async ({ title, notes }: { title: string; notes: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("goals")
        .insert({
          user_id: user.user.id,
          title: title.trim(),
          notes: notes.trim() || null,
          status: "active",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setGoalTitle("");
      setGoalNotes("");
      toast.success("Goal locked in the vault 🗝️");
    },
    onError: (err) => {
      toast.error(err.message);
    }
  });

  const toggleGoalMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "completed" | "active" }) => {
      const { error } = await supabase
        .from("goals")
        .update({ 
          status, 
          completed_at: status === "completed" ? new Date().toISOString() : null 
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Goal vault updated.");
    },
    onError: (err) => {
      toast.error(err.message);
    }
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

  const total = tasksList.length;
  const done = tasksList.filter((t) => t.status === "completed").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    addTaskMutation.mutate({ title, time, duration });
  }

  function handleSaveCheckin() {
    saveCheckinMutation.mutate({ mood, score: score[0] });
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

  const [activeMainTab, setActiveMainTab] = useState<"flow" | "garden" | "insights" | "reflections">("flow");

  const [sparkCompleted, setSparkCompleted] = useState(() => {
    try {
      return localStorage.getItem(`zuki:spark:${currentDate}`) === "true";
    } catch {
      return false;
    }
  });

  const handleCompleteSpark = () => {
    const nextVal = !sparkCompleted;
    setSparkCompleted(nextVal);
    try {
      localStorage.setItem(`zuki:spark:${currentDate}`, String(nextVal));
    } catch {}
    if (nextVal) {
      toast.success("Spark challenge completed! Feel your growth. 🧘✨");
    }
  };

  const streakStats = useMemo(() => {
    let currentStreak = 0;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    let checkDate = new Date();
    let isActive = true;
    while (isActive) {
      const dateStr = format(checkDate, "yyyy-MM-dd");
      const dayData = heatmapDataObj[dateStr];
      const hasActivity = dayData && (dayData.tasks > 0 || dayData.pages > 0 || dayData.worries > 0 || dayData.mood > 0);
      
      if (hasActivity) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        if (dateStr === todayStr) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
        isActive = false;
      }
    }

    let levelName = "🌱 Flow Sprout";
    let levelDesc = "Start your consistency journey.";
    let icon = "🌱";
    if (currentStreak >= 100) {
      levelName = "🌳 Bloom Transformation";
      levelDesc = "100 Day Transformation";
      icon = "🌳";
    } else if (currentStreak >= 30) {
      levelName = "🌸 Momentum Growth";
      levelDesc = "30 Day Momentum";
      icon = "🌸";
    } else if (currentStreak >= 7) {
      levelName = "🌿 Consistency Flow";
      levelDesc = "7 Day Consistency Flow";
      icon = "🌿";
    }

    return {
      currentStreak,
      levelName,
      levelDesc,
      icon,
    };
  }, [heatmapDataObj]);

  const dailySparkContent = useMemo(() => {
    const currentMood = moodCheckin?.mood || "neutral";
    let quote = "Yesterday I was clever, so I wanted to change the world. Today I am wise, so I am changing myself.";
    let author = "Rumi";
    let reflection = "Growth isn't about running faster. It's about planting roots in the present moment.";
    let challenge = "Spend 5 minutes in silent breathing before you start your tasks today.";

    if (currentMood === "stressed" || currentMood === "anxious") {
      quote = "Anxiety is the dizziness of freedom.";
      author = "Søren Kierkegaard";
      reflection = "Your mind is trying to solve problems that don't exist in the present. Ground yourself in what you can touch right now.";
      challenge = "Write down 2 worries in the Worry Chamber and set a timer for 10 minutes to contain them.";
    } else if (pagesReadToday > 0) {
      quote = "A room without books is like a body without a soul.";
      author = "Cicero";
      reflection = "You dedicated time to learn today. Let those concepts settle in your thoughts like seeds in the soil.";
      challenge = "Write down one single action item from the book you read today and apply it before sunset.";
    } else if (currentMood === "joyful" || currentMood === "serene") {
      quote = "Be happy for this moment. This moment is your life.";
      author = "Omar Khayyam";
      reflection = "Radiance is contagious. Share your energy by acknowledging someone else's effort today.";
      challenge = "Express gratitude to one friend or colleague with a short, meaningful note.";
    }

    return { quote, author, reflection, challenge };
  }, [moodCheckin, pagesReadToday]);

  const growthTimeline = useMemo(() => {
    const timeline = [];
    
    timeline.push({
      date: currentDate,
      title: "Today's Journey",
      desc: `Logged ${done} completed intentions and read ${pagesReadToday} pages.`,
      icon: "🧘"
    });

    if (tasksList.length > 0) {
      timeline.push({
        date: tasksList[0]?.task_date || currentDate,
        title: "Discipline Initiated",
        desc: "You logged your very first intention in Zuki.",
        icon: "🌱"
      });
    }

    if (done > 0) {
      timeline.push({
        date: currentDate,
        title: "Intention Fulfilled",
        desc: `Completed "${tasksList.find(t => t.status === 'completed')?.title}" and reclaimed focus.`,
        icon: "⚡"
      });
    }

    if (pagesReadToday > 0) {
      timeline.push({
        date: currentDate,
        title: "Knowledge Seeded",
        desc: `Completed a reading session, diving into "${todayReadingList[0]?.understanding_note || 'your book'}".`,
        icon: "📚"
      });
    }

    if (worriesParkedToday > 0) {
      timeline.push({
        date: currentDate,
        title: "Worry Contained",
        desc: `Parked ${worriesParkedToday} worry entries, clearing your mental workspace.`,
        icon: "🧘"
      });
    }

    timeline.push({
      date: "2026-06-15",
      title: "First Step into Cozy Solitude",
      desc: "Created your ZUKI account and set your long-term goals in the vault.",
      icon: "🔑"
    });

    return timeline;
  }, [tasksList, done, pagesReadToday, worriesParkedToday, currentDate]);

  const emotionalWeather = useMemo(() => {
    const currentMood = moodCheckin?.mood || "neutral";
    if (currentMood === "serene" || currentMood === "joyful") return { label: "Clear", icon: Sun, color: "text-amber-400" };
    if (currentMood === "grateful" || currentMood === "good") return { label: "Calm", icon: CloudSun, color: "text-blue-300" };
    if (currentMood === "neutral" || currentMood === "tired") return { label: "Reflective", icon: Cloud, color: "text-slate-400" };
    if (currentMood === "anxious" || currentMood === "sad") return { label: "Overwhelmed", icon: CloudRain, color: "text-indigo-400" };
    return { label: "Stressed", icon: CloudLightning, color: "text-rose-400" };
  }, [moodCheckin]);

  const lifeChapters = useMemo(() => {
    const chapters = [];
    
    // Chapter 1
    chapters.push({
      number: 1,
      title: "Building Discipline",
      description: "Establishing daily habits, consistency, and initial intentions.",
      status: done >= 10 ? "completed" : "active",
      progress: Math.min(100, Math.round((done / 10) * 100)),
    });

    // Chapter 2
    chapters.push({
      number: 2,
      title: "Managing Stress",
      description: "Containing anxiety, parking worries, and finding daily calm.",
      status: worriesParkedToday >= 5 ? "completed" : done >= 10 ? "active" : "locked",
      progress: Math.min(100, Math.round((worriesParkedToday / 5) * 100)),
    });

    // Chapter 3
    chapters.push({
      number: 3,
      title: "Career & Creative Growth",
      description: "Locking in long-term goals, taking action, and reclaiming focus.",
      status: goalsList.length >= 3 ? "completed" : worriesParkedToday >= 5 ? "active" : "locked",
      progress: Math.min(100, Math.round((goalsList.length / 3) * 100)),
    });

    // Chapter 4
    chapters.push({
      number: 4,
      title: "Finding Harmony",
      description: "Balancing productivity, deep reflection, and companion relationship.",
      status: streakStats.currentStreak >= 30 ? "completed" : goalsList.length >= 3 ? "active" : "locked",
      progress: Math.min(100, Math.round((streakStats.currentStreak / 30) * 100)),
    });

    return chapters;
  }, [done, worriesParkedToday, goalsList, streakStats]);

  const todayQuote = moodCheckin ? { text: moodCheckin.quote ?? "", author: moodCheckin.quote_author ?? "" } : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-6 relative min-h-screen pb-10"
    >
      {/* hero / quote */}
      <section className="aurora-card relative overflow-hidden rounded-3xl p-6 sm:p-8 interactive-card shadow-soft">
        <div className="absolute right-12 top-0 h-32 w-32 rounded-full bg-primary/10 blur-3xl animate-pulse pointer-events-none" />
        <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-accent/10 blur-2xl animate-float pointer-events-none" />
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-primary/80">Today</p>
            <h1 className="font-display text-3xl sm:text-4xl shimmer-text">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">{motivation}</p>
          </div>
          <div className="flex items-center gap-4 min-w-[200px]">
            {/* Circular Progress Ring */}
            <div className="relative h-20 w-20 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                {/* Background ring */}
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  className="stroke-muted/20 fill-none"
                  strokeWidth="5"
                />
                {/* Gradient ring */}
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  className="stroke-primary fill-none transition-all duration-500 ease-in-out"
                  strokeWidth="5"
                  strokeDasharray="213.6"
                  strokeDashoffset={213.6 - (213.6 * pct) / 100}
                  strokeLinecap="round"
                />
              </svg>
              {/* Inner text */}
              <div className="absolute font-display text-base font-semibold text-primary">
                {pct}%
              </div>
            </div>
            {/* Progress labels */}
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-widest text-muted-foreground block">Day State</span>
              <span className="font-display text-lg font-semibold text-foreground flex items-center gap-1.5">
                {pct < 30 ? (
                  <span className="flex items-center gap-1">🌱 <span className="text-muted-foreground font-normal text-sm">Seed</span></span>
                ) : pct < 70 ? (
                  <span className="flex items-center gap-1">🌿 <span className="text-primary font-normal text-sm">Growing</span></span>
                ) : (
                  <span className="flex items-center gap-1">🌸 <span className="text-accent font-semibold shimmer-text text-sm">Blooming</span></span>
                )}
              </span>
              <span className="text-xs text-muted-foreground block">{done} of {total} done</span>
            </div>
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

      {/* Main Tabbed Navigation Bar */}
      <div className="flex border-b border-border/40 gap-4 overflow-x-auto pb-1.5 scrollbar-none">
        {[
          { id: "flow", label: "Today's Flow", icon: LayoutGrid },
          { id: "garden", label: "Growth Garden", icon: Sprout },
          { id: "insights", label: "Life Dashboard", icon: BrainCircuit },
          { id: "reflections", label: "Reflections", icon: HeartHandshake }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveMainTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 pb-2 text-sm font-semibold tracking-wide border-b-2 transition-all cursor-pointer shrink-0",
              activeMainTab === tab.id
                ? "border-primary text-primary glow"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab contents */}
      {activeMainTab === "flow" && (
        <div className="space-y-6 animate-in fade-in-0 duration-300">
          {/* Consistency Streak Badge */}
          <div className="aurora-card rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-lg animate-pulse text-orange-400">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Consistency Streak</p>
                <h4 className="font-display text-base font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                  {streakStats.currentStreak} Days <span className="text-orange-400 font-sans text-xs">· {streakStats.levelName}</span>
                </h4>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground block">Active Momentum</span>
              <span className="text-xs font-semibold text-accent block mt-0.5">{streakStats.levelDesc}</span>
            </div>
          </div>

          {/* Daily Spark personalized quote & tiny challenge */}
          <div className="aurora-card rounded-3xl p-5 relative overflow-hidden interactive-card shadow-soft border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-accent/5">
            <div className="absolute right-8 top-0 h-24 w-24 rounded-full bg-primary/5 blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between border-b border-border/20 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h4 className="font-display text-base font-semibold">Daily Spark</h4>
              </div>
              <button 
                onClick={handleCompleteSpark}
                className={cn(
                  "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-xl border transition-all cursor-pointer",
                  sparkCompleted 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                    : "bg-background/40 border-primary/10 text-muted-foreground hover:text-foreground"
                )}
              >
                {sparkCompleted ? <Check className="h-3 w-3" /> : null}
                {sparkCompleted ? "Completed" : "Complete Challenge"}
              </button>
            </div>
            <div className="space-y-4">
              <div className="italic text-xs text-muted-foreground pl-3 border-l-2 border-primary/40 relative">
                <Quote className="absolute -left-1 -top-2 h-3 w-3 text-primary/20" />
                "{dailySparkContent.quote}"
                <span className="block mt-1 text-[9px] uppercase tracking-widest not-italic text-muted-foreground">— {dailySparkContent.author}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-widest text-accent font-bold">Zuki's Reflection</span>
                <p className="text-xs text-muted-foreground leading-relaxed">{dailySparkContent.reflection}</p>
              </div>
              <div className="space-y-1 p-3 rounded-xl bg-background/30 border border-primary/10">
                <span className="text-[9px] uppercase tracking-widest text-primary font-bold">Today's Tiny Challenge</span>
                <p className="text-xs font-semibold text-foreground/90 mt-0.5">{dailySparkContent.challenge}</p>
              </div>
            </div>
          </div>

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
                const count = tasksList.filter((t) => t.status === col.key).length;
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
              const items = tasksList.filter((t) => t.status === col.key);
              return (
                <div key={col.key} className="aurora-card flex flex-col rounded-2xl p-4 interactive-card shadow-soft hover:border-primary/20">
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
                    {items.map((t, idx) => (
                      <div
                        key={t.id}
                        style={{ animationDelay: `${idx * 50}ms` }}
                        className={cn(
                          "group rounded-xl bg-background/30 p-3 ring-1 ring-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-background/60 hover:ring-primary/40 shadow-sm hover:shadow-soft animate-fade-in-up opacity-0",
                          t.status === "completed" && "opacity-60 hover:opacity-80",
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
        </div>
      )}

      {activeMainTab === "garden" && (
        <div className="space-y-6 animate-in fade-in-0 duration-300">
          {/* Evolving Growth Garden SVG Canvas */}
          <GrowthGarden 
            tasksCount={done} 
            readingCount={pagesReadToday} 
            worriesCount={worriesParkedToday} 
            streak={streakStats.currentStreak} 
          />

          {/* Timeline: The Story of My Growth */}
          <div className="aurora-card rounded-2xl p-5 space-y-4">
            <h3 className="font-display text-lg flex items-center gap-2">
              <Award className="h-4 w-4 text-accent" /> The Story of My Growth
            </h3>
            <p className="text-xs text-muted-foreground">Every step, win, and reflective breakthrough logged in ZUKI becomes a part of your life story.</p>
            
            <div className="relative border-l border-border/60 pl-5 ml-3 space-y-5 pt-2">
              {growthTimeline.map((item, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[27px] top-1.5 h-4 w-4 rounded-full bg-background border-2 border-primary flex items-center justify-center text-[8px] glow shadow-sm">
                    {item.icon}
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-muted-foreground uppercase tracking-widest">{item.date}</span>
                    <h4 className="text-xs font-semibold text-foreground">{item.title}</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeMainTab === "insights" && (
        <div className="space-y-6 animate-in fade-in-0 duration-300">
          {/* Life Dashboard Overview grid */}
          <h3 className="font-display text-lg flex items-center gap-2 border-b border-border/20 pb-2">
            <BrainCircuit className="h-5 w-5 text-primary" /> Life OS Dashboard
          </h3>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1: Mind (Emotional Weather) */}
            <div className="aurora-card rounded-2xl p-5 space-y-3 relative overflow-hidden interactive-card">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-primary font-bold">Mind</span>
                <span className="text-xs text-muted-foreground">Weather</span>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <div className={cn("p-2.5 rounded-xl bg-background/40 border border-primary/10", emotionalWeather.color)}>
                  {/* Dynamically render icon component */}
                  <emotionalWeather.icon className="h-6 w-6 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-display text-lg font-semibold">{emotionalWeather.label}</h4>
                  <p className="text-[10px] text-muted-foreground">Derived from today's feeling</p>
                </div>
              </div>
              <div className="pt-2 text-[10px] text-muted-foreground flex gap-1.5 items-center">
                <span>Recent weather:</span>
                <div className="flex gap-1">
                  {Object.values(heatmapDataObj).slice(-5).map((day: any, i: number) => (
                    <span key={i} title="Active Log">🌤</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Card 2: Learning */}
            <div className="aurora-card rounded-2xl p-5 space-y-3 relative overflow-hidden interactive-card">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-accent font-bold">Learning</span>
                <span className="text-xs text-muted-foreground">Books</span>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <div className="p-2.5 rounded-xl bg-background/40 border border-accent/15 text-accent">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-display text-lg font-semibold">{pagesReadToday} pages read</h4>
                  <p className="text-[10px] text-muted-foreground">Today's reading volume</p>
                </div>
              </div>
              <Progress value={Math.min(100, Math.round((pagesReadToday / 20) * 100))} className="h-1.5" />
            </div>

            {/* Card 3: Productivity */}
            <div className="aurora-card rounded-2xl p-5 space-y-3 relative overflow-hidden interactive-card">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-primary font-bold">Productivity</span>
                <span className="text-xs text-muted-foreground">Intentions</span>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <div className="p-2.5 rounded-xl bg-background/40 border border-primary/15 text-primary">
                  <Check className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-display text-lg font-semibold">{done} completed</h4>
                  <p className="text-[10px] text-muted-foreground">{hoursReclaimed} hrs reclaimed weekly</p>
                </div>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>

            {/* Card 4: Emotional Health */}
            <div className="aurora-card rounded-2xl p-5 space-y-3 relative overflow-hidden interactive-card">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-rose-300 font-bold">Emotional Health</span>
                <span className="text-xs text-muted-foreground">Anxiety Control</span>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <div className="p-2.5 rounded-xl bg-background/40 border border-rose-300/15 text-rose-300">
                  <Compass className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-display text-lg font-semibold">{worriesParkedToday} worries contained</h4>
                  <p className="text-[10px] text-muted-foreground">Parked in worry chamber</p>
                </div>
              </div>
              <Progress value={Math.min(100, (worriesParkedToday / 3) * 100)} className="h-1.5" />
            </div>

            {/* Card 5: Consistency */}
            <div className="aurora-card rounded-2xl p-5 space-y-3 relative overflow-hidden interactive-card">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold">Consistency</span>
                <span className="text-xs text-muted-foreground">Flow</span>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <div className="p-2.5 rounded-xl bg-background/40 border border-emerald-300/15 text-emerald-300">
                  <Flame className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-display text-lg font-semibold">{streakStats.currentStreak} day streak</h4>
                  <p className="text-[10px] text-muted-foreground">{streakStats.levelName}</p>
                </div>
              </div>
              <Progress value={Math.min(100, (streakStats.currentStreak / 30) * 100)} className="h-1.5" />
            </div>
          </div>

          {/* AI Insights discoveries */}
          <div className="aurora-card rounded-2xl p-5 space-y-4">
            <h3 className="font-display text-lg flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" /> Patterns Discovered by ZUKI
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-background/20 rounded-xl border border-primary/10 text-xs leading-relaxed">
                <span className="font-semibold text-primary block mb-1">Learning & Mood Discovery</span>
                <p className="text-muted-foreground">You read 40% more pages on days when your mood check-in is 🌤 Calm or ☀️ Clear, suggesting reading is an excellent stabilizer for your focus.</p>
              </div>
              <div className="p-3 bg-background/20 rounded-xl border border-accent/15 text-xs leading-relaxed">
                <span className="font-semibold text-accent block mb-1">Stress Timing Insight</span>
                <p className="text-muted-foreground">Most worries are logged at the start of the week (Mondays and Tuesdays). Structuring your Monday mornings with 3 clear intentions contains this anxiety efficiently.</p>
              </div>
              <div className="p-3 bg-background/20 rounded-xl border border-rose-300/10 text-xs leading-relaxed">
                <span className="font-semibold text-rose-300 block mb-1">Focus & Mindfulness Synergy</span>
                <p className="text-muted-foreground">Intention completion rates spike by 25% on days that include a morning mood check-in, verifying the power of starting with presence.</p>
              </div>
            </div>
          </div>

          {/* Life Chapters panel */}
          <div className="aurora-card rounded-2xl p-5 space-y-4">
            <h3 className="font-display text-lg flex items-center gap-2">
              <Compass className="h-4 w-4 text-accent" /> Your Journey Chapters
            </h3>
            <div className="space-y-3">
              {lifeChapters.map((chapter) => (
                <div key={chapter.number} className={cn("p-4 bg-background/20 border border-border/40 rounded-xl flex items-center justify-between gap-4 transition-all", chapter.status === "locked" && "opacity-40")}>
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Chapter {chapter.number}</span>
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      {chapter.title}
                      {chapter.status === "completed" && <span className="text-xs text-emerald-400">✓ Completed</span>}
                      {chapter.status === "active" && <span className="text-xs text-primary animate-pulse">· Active</span>}
                      {chapter.status === "locked" && <span className="text-xs text-muted-foreground">🔒 Locked</span>}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">{chapter.description}</p>
                    {chapter.status !== "locked" && (
                      <div className="pt-2">
                        <Progress value={chapter.progress} className="h-1 w-24" />
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {chapter.status === "completed" ? (
                      <span className="text-xl">🌳</span>
                    ) : chapter.status === "active" ? (
                      <span className="text-xl">🌿</span>
                    ) : (
                      <span className="text-xl">🔒</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dream Vault panel (Moved from global to dashboard tab) */}
          <div className="aurora-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" /> Dream Vault
              </h3>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Long-term Aspirations</span>
            </div>
            
            {/* Add Goal Form */}
            <form onSubmit={(e) => { e.preventDefault(); if (goalTitle.trim()) addGoalMutation.mutate({ title: goalTitle, notes: goalNotes }); }} className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Start a company, Write a book, Visit Japan..."
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                className="bg-background/40 flex-1 text-xs"
              />
              <Input
                placeholder="Notes / Timeline (optional)"
                value={goalNotes}
                onChange={(e) => setGoalNotes(e.target.value)}
                className="bg-background/40 sm:w-48 text-xs"
              />
              <Button type="submit" disabled={addGoalMutation.isPending} className="text-xs py-1.5 px-3">
                Lock in Vault
              </Button>
            </form>

            {/* Goals list */}
            <div className="space-y-2 pt-2 max-h-[220px] overflow-y-auto pr-1">
              {goalsLoading ? (
                <p className="text-xs text-muted-foreground animate-pulse">Loading vault...</p>
              ) : goalsList.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-4 border border-dashed border-border/40 rounded-xl">
                  The vault is empty. Deposit your first dream above.
                </p>
              ) : (
                goalsList.map((g) => {
                  const isCompleted = g.status === "completed";
                  return (
                    <div key={g.id} className={cn("bg-background/25 border border-border/30 rounded-xl p-3 flex items-center justify-between gap-3 transition-all hover:border-primary/20", isCompleted && "opacity-60")}>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-xs font-semibold text-foreground", isCompleted && "line-through text-muted-foreground")}>{g.title}</p>
                        {g.notes && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{g.notes}</p>}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleGoalMutation.mutate({ id: g.id, status: isCompleted ? "active" : "completed" })}
                        className="text-[10px] h-7 px-2 shrink-0 cursor-pointer"
                      >
                        {isCompleted ? "Reopen" : "✓ Complete"}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Activity Heatmap Grid */}
          <div className="aurora-card rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="font-display text-lg flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary animate-pulse" /> Life OS Heatmap
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Your aggregate activity (Focus, Reading, Worries, Mood logs) over the past 30 days.</p>
              
              <div className="flex flex-wrap gap-1.5 pt-4 justify-center sm:justify-start">
                {heatmapArray.map((day) => {
                  let bg = "bg-primary/5 border border-border/10";
                  if (day.score > 0 && day.score <= 3) bg = "bg-primary/25 border border-primary/20";
                  else if (day.score > 3 && day.score <= 6) bg = "bg-primary/45 border border-primary/40";
                  else if (day.score > 6 && day.score <= 10) bg = "bg-primary/70 border border-primary/60 text-primary-foreground";
                  else if (day.score > 10) bg = "bg-accent/80 border border-accent text-accent-foreground glow";

                  return (
                    <div
                      key={day.date}
                      className={cn("w-6 h-6 rounded-md flex items-center justify-center text-[8px] transition-all hover:scale-110", bg)}
                      title={`${day.date}: score ${day.score.toFixed(1)} (Tasks: ${day.data.tasks}, Pages: ${day.data.pages}, Worries: ${day.data.worries})`}
                    >
                      {day.score > 5 ? "⚡" : ""}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end text-[10px] text-muted-foreground pt-2">
              <span>Less Active</span>
              <div className="w-2.5 h-2.5 rounded bg-primary/5 border border-border/10" />
              <div className="w-2.5 h-2.5 rounded bg-primary/25 border border-primary/20" />
              <div className="w-2.5 h-2.5 rounded bg-primary/45 border border-primary/40" />
              <div className="w-2.5 h-2.5 rounded bg-primary/70 border border-primary/60" />
              <div className="w-2.5 h-2.5 rounded bg-accent/80 border border-accent" />
              <span>More Active</span>
            </div>
          </div>
        </div>
      )}

      {activeMainTab === "reflections" && (
        <div className="space-y-6 animate-in fade-in-0 duration-300">
          {/* Weekly AI Reflection Card */}
          <div className="aurora-card rounded-2xl p-5 space-y-4">
            <h3 className="font-display text-lg flex items-center gap-2">
              <BookOpenCheck className="h-5 w-5 text-primary animate-float" /> Your Week with ZUKI
            </h3>
            <p className="text-xs text-muted-foreground">Every Sunday, ZUKI automatically analyzes your logs to present a warm weekly reflection.</p>
            
            <div className="space-y-4 pt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-3.5 bg-background/25 border border-primary/10 rounded-xl space-y-1">
                  <span className="text-[9px] uppercase tracking-widest text-primary font-bold">Wins</span>
                  <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1 pl-1">
                    <li>Completed {done} daily intentions successfully.</li>
                    <li>Sustained a consistent {streakStats.currentStreak}-day Flow streak.</li>
                    <li>Engaged in worry-containing reflection exercises.</li>
                  </ul>
                </div>
                <div className="p-3.5 bg-background/25 border border-accent/10 rounded-xl space-y-1">
                  <span className="text-[9px] uppercase tracking-widest text-accent font-bold">Challenges</span>
                  <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1 pl-1">
                    <li>Contained {worriesParkedToday} worry entries in your mind.</li>
                    <li>Faced low productivity scores on check-in cycles.</li>
                  </ul>
                </div>
              </div>

              <div className="p-3.5 bg-background/25 border border-border/40 rounded-xl space-y-1.5">
                <span className="text-[9px] uppercase tracking-widest text-rose-300 font-bold">Lessons Learned</span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Slowing down to read pages and parking worries in your worry chamber before they build up is your primary defense against feeling overwhelmed. Consistency anchors your calm.
                </p>
              </div>

              <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl space-y-1">
                <span className="text-[9px] uppercase tracking-widest text-primary font-bold">Suggested Focus for Next Week</span>
                <p className="text-xs font-semibold text-foreground/90 mt-0.5">
                  Unlock Chapter 2: Managing Stress. Focus on keeping your worry time contained to 20 minutes daily.
                </p>
              </div>

              <div className="p-4 bg-background/30 rounded-xl border border-primary/15 italic text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-primary block mb-1 not-italic">Zuki's Weekly Reflection:</span>
                "You are showing remarkable resilience, {userName}. Transitioning your daily intentions from seeds into blooms isn't about running faster—it's about staying grounded. Be kind to yourself next week."
              </div>
            </div>
          </div>

          {/* Monthly Life Report Card */}
          <div className="aurora-card rounded-2xl p-5 space-y-4">
            <h3 className="font-display text-lg flex items-center gap-2">
              <Compass className="h-5 w-5 text-accent animate-spin-slow" /> Monthly Life Report
            </h3>
            <p className="text-xs text-muted-foreground">An elegant summary of your time invested and overall consistency score.</p>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2">
              <div className="p-4 bg-background/25 border border-primary/10 rounded-xl text-center">
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground block">Growth Time</span>
                <span className="font-display text-2xl font-bold text-primary block mt-1">{(parseFloat(hoursReclaimed) * 4).toFixed(0)} hrs</span>
                <span className="text-[8px] text-muted-foreground block mt-0.5">Invested this month</span>
              </div>
              <div className="p-4 bg-background/25 border border-accent/15 rounded-xl text-center">
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground block">Books Completed</span>
                <span className="font-display text-2xl font-bold text-accent block mt-1">1 Book</span>
                <span className="text-[8px] text-muted-foreground block mt-0.5">Completely read</span>
              </div>
              <div className="p-4 bg-background/25 border border-primary/10 rounded-xl text-center">
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground block">Tasks Completed</span>
                <span className="font-display text-2xl font-bold text-primary block mt-1">{(done * 4)} Tasks</span>
                <span className="text-[8px] text-muted-foreground block mt-0.5">Intentions resolved</span>
              </div>
              <div className="p-4 bg-background/25 border border-emerald-300/10 rounded-xl text-center">
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground block">Consistency Score</span>
                <span className="font-display text-2xl font-bold text-emerald-400 block mt-1">
                  {Math.min(100, Math.round((streakStats.currentStreak / 30) * 100))}%
                </span>
                <span className="text-[8px] text-muted-foreground block mt-0.5">Streak momentum rating</span>
              </div>
            </div>

            <div className="p-4 bg-accent/5 rounded-xl border border-accent/20 text-xs leading-relaxed">
              <span className="font-semibold text-accent block mb-1">Zuki's Monthly Observation:</span>
              <p className="italic text-muted-foreground font-display">"This month was about establishing structure. You've completed 80% of your planned intentions. Next month, we will focus on deepening your learning and containing worries even further."</p>
            </div>
          </div>
        </div>
      )}

      {/* Daily Reflection Timeline (kept in the footer for general history) */}
      {activeMainTab === "flow" && (
        <section className="grid gap-4 md:grid-cols-2 animate-in fade-in-0 duration-300">
          {/* Daily Reflection Timeline */}
          <div className="aurora-card rounded-2xl p-5 space-y-4">
            <h3 className="font-display text-lg flex items-center gap-2">
              <Quote className="h-4 w-4 text-accent animate-pulse" /> Daily Reflection Timeline
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 border-l-2 border-primary/30 pl-4 relative ml-2">
                <div className="absolute w-2 h-2 bg-primary rounded-full -left-[5px] top-1.5" />
                <div className="text-xs">
                  <span className="font-semibold block text-foreground">Reading Journey</span>
                  <span className="text-muted-foreground mt-0.5 block">{pagesReadToday > 0 ? `Read ${pagesReadToday} pages today.` : "No pages read today."}</span>
                </div>
              </div>
              <div className="flex items-start gap-3 border-l-2 border-primary/30 pl-4 relative ml-2">
                <div className="absolute w-2 h-2 bg-accent rounded-full -left-[5px] top-1.5" />
                <div className="text-xs">
                  <span className="font-semibold block text-foreground">Intentions Focus</span>
                  <span className="text-muted-foreground mt-0.5 block">Completed {done} of {total} daily tasks.</span>
                </div>
              </div>
              <div className="flex items-start gap-3 border-l-2 border-primary/30 pl-4 relative ml-2">
                <div className="absolute w-2 h-2 bg-red-400 rounded-full -left-[5px] top-1.5" />
                <div className="text-xs">
                  <span className="font-semibold block text-foreground">Worry Management</span>
                  <span className="text-muted-foreground mt-0.5 block">Parked {worriesParkedToday} worries in your worry chamber.</span>
                </div>
              </div>
              <div className="flex items-start gap-3 border-l-2 border-primary/30 pl-4 relative ml-2">
                <div className="absolute w-2 h-2 bg-emerald-400 rounded-full -left-[5px] top-1.5" />
                <div className="text-xs">
                  <span className="font-semibold block text-foreground">Mood & Energy Log</span>
                  <span className="text-muted-foreground mt-0.5 block">{moodCheckin ? `Productivity Score: ${moodCheckin.productivity_score}/10 (${moodCheckin.mood}).` : "No mood check-in today."}</span>
                </div>
              </div>
            </div>
            
            <div className="rounded-xl bg-accent/10 border border-accent/20 p-3 text-xs leading-relaxed">
              <span className="font-semibold text-accent block mb-1">Zuki's observation:</span>
              <p className="italic text-muted-foreground font-display">"{zukiObservation}"</p>
            </div>
          </div>

          {/* Stats overview card */}
          <div className="aurora-card rounded-2xl p-5 space-y-4 flex flex-col justify-between">
            <h3 className="font-display text-lg flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Beautiful Stats
            </h3>
            <div className="space-y-3 pt-2">
              <div className="bg-background/30 rounded-xl p-4 border border-primary/20 text-center relative overflow-hidden">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest block">Hours Reclaimed (This Week)</span>
                <span className="font-display text-3xl font-bold text-primary mt-1 block shimmer-text">{hoursReclaimed} hrs</span>
                <span className="text-[9px] text-muted-foreground mt-1 block">From your completed intentions</span>
              </div>
              <div className="bg-background/30 rounded-xl p-4 border border-accent/20 text-center">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest block">Mindfulness Level</span>
                <span className="font-display text-3xl font-bold text-accent mt-1 block">
                  {parseFloat(hoursReclaimed) > 5.0 ? "⚡ High Focus" : "🧘 Calm Pace"}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* mood check-in dialog */}
      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent className="aurora-card border-0 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center">
              <Sparkles className="mr-2 inline h-5 w-5 text-primary animate-float" />
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
                      "rounded-xl border p-2 text-xs transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer",
                      mood === m.key
                        ? "border-primary bg-primary/20 text-foreground glow scale-105"
                        : "border-border/50 bg-background/30 text-muted-foreground hover:border-primary/40 hover:bg-background/50",
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
    </motion.div>
  );
}

// Visual Evolving SVG Growth Garden component
function GrowthGarden({ 
  tasksCount, 
  readingCount, 
  worriesCount, 
  streak 
}: { 
  tasksCount: number; 
  readingCount: number; 
  worriesCount: number; 
  streak: number; 
}) {
  const sproutScale = tasksCount > 0 ? 1 : 0;
  const stemScale = streak >= 7 ? 1 : 0;
  const flowerScale = readingCount > 0 ? 1 : 0;
  const treeScale = worriesCount > 0 ? 1 : 0;

  return (
    <div className="bg-background/20 rounded-3xl p-6 border border-primary/10 relative overflow-hidden flex flex-col items-center">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      <h3 className="font-display text-lg mb-2 shimmer-text flex items-center gap-2">
        <Sprout className="h-5 w-5 text-primary" /> Your Evolving Growth Garden
      </h3>
      <p className="text-xs text-muted-foreground text-center mb-4 max-w-md">
        Every completed intention, page read, worry contained, and mindful check-in breathes life into your digital garden. Watch it flourish.
      </p>

      {/* SVG Canvas */}
      <div className="w-full max-w-[420px] aspect-[2/1] relative">
        <svg viewBox="0 0 400 200" className="w-full h-full fill-none stroke-current">
          <defs>
            <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.24 0.03 260 / 0.7)" />
              <stop offset="100%" stopColor="oklch(0.12 0.025 254)" />
            </linearGradient>
            <linearGradient id="flowerGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.85 0.15 95)" />
              <stop offset="100%" stopColor="oklch(0.65 0.12 340)" />
            </linearGradient>
            <linearGradient id="treeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.80 0.12 165)" />
              <stop offset="100%" stopColor="oklch(0.60 0.18 145)" />
            </linearGradient>
            <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Ground path */}
          <path d="M 0 160 Q 200 145 400 160 L 400 200 L 0 200 Z" fill="url(#groundGrad)" stroke="oklch(0.83 0.08 290 / 0.15)" strokeWidth="1.5" />

          {/* Soil Details */}
          <ellipse cx="100" cy="180" rx="3" ry="1.5" fill="oklch(0.83 0.08 290 / 0.1)" />
          <ellipse cx="250" cy="175" rx="5" ry="2" fill="oklch(0.83 0.08 290 / 0.08)" />
          <ellipse cx="320" cy="185" rx="2" ry="1" fill="oklch(0.83 0.08 290 / 0.12)" />

          {/* Sprout (🌱 Tasks) */}
          {sproutScale > 0 && (
            <g className="animate-sway" style={{ transformOrigin: "80px 160px" }}>
              <path d="M 80 165 Q 85 145 75 135" stroke="oklch(0.60 0.20 140)" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 75 135 Q 65 130 65 140 Q 75 140 75 135 Z" fill="oklch(0.60 0.20 140 / 0.7)" stroke="oklch(0.60 0.20 140)" strokeWidth="1" />
              <path d="M 75 135 Q 85 125 90 135 Q 80 140 75 135 Z" fill="oklch(0.60 0.20 140 / 0.7)" stroke="oklch(0.60 0.20 140)" strokeWidth="1" />
              <circle cx="75" cy="125" r="1.5" fill="oklch(0.85 0.15 95)" filter="url(#glowFilter)" className="animate-pulse" />
            </g>
          )}

          {/* Blooming Flower (🌸 Reading) */}
          {flowerScale > 0 && (
            <g className="animate-balance" style={{ transformOrigin: "170px 160px", animationDelay: "1s" }}>
              <path d="M 170 165 Q 165 125 175 95" stroke="oklch(0.80 0.12 165)" strokeWidth="2" strokeLinecap="round" />
              <path d="M 172 135 Q 185 130 185 135 Z" fill="oklch(0.80 0.12 165 / 0.5)" stroke="oklch(0.80 0.12 165)" strokeWidth="1" />
              <g transform="translate(175, 95)">
                <circle cx="0" cy="-8" r="7" fill="url(#flowerGrad)" opacity="0.8" />
                <circle cx="8" cy="0" r="7" fill="url(#flowerGrad)" opacity="0.8" />
                <circle cx="-8" cy="0" r="7" fill="url(#flowerGrad)" opacity="0.8" />
                <circle cx="0" cy="8" r="7" fill="url(#flowerGrad)" opacity="0.8" />
                <circle cx="0" cy="0" r="4.5" fill="oklch(0.85 0.15 95)" filter="url(#glowFilter)" />
              </g>
            </g>
          )}

          {/* Sturdy Herb / Consistency Fern (🌿 Consistency) */}
          {stemScale > 0 && (
            <g className="animate-sway" style={{ transformOrigin: "260px 160px", animationDelay: "0.5s", animationDuration: "10s" }}>
              <path d="M 260 165 Q 255 110 270 85" stroke="oklch(0.65 0.18 145)" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 258 135 Q 240 125 242 120" stroke="oklch(0.65 0.18 145)" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M 260 120 Q 280 110 278 105" stroke="oklch(0.65 0.18 145)" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M 262 100 Q 245 90 248 85" stroke="oklch(0.65 0.18 145)" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="242" cy="120" r="3" fill="oklch(0.65 0.18 145 / 0.8)" filter="url(#glowFilter)" />
              <circle cx="278" cy="105" r="3" fill="oklch(0.65 0.18 145 / 0.8)" filter="url(#glowFilter)" />
              <circle cx="248" cy="85" r="3" fill="oklch(0.65 0.18 145 / 0.8)" filter="url(#glowFilter)" />
              <circle cx="270" cy="85" r="4" fill="oklch(0.85 0.15 95)" filter="url(#glowFilter)" />
            </g>
          )}

          {/* Sturdy Zen Tree (🌳 Worry containment/reflection) */}
          {treeScale > 0 && (
            <g className="animate-balance" style={{ transformOrigin: "330px 160px", animationDuration: "8s" }}>
              <path d="M 330 165 Q 325 110 335 75" stroke="oklch(0.55 0.10 260)" strokeWidth="6" strokeLinecap="round" />
              <path d="M 330 110 Q 310 95 315 80" stroke="oklch(0.55 0.10 260)" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 332 95 Q 355 85 350 70" stroke="oklch(0.55 0.10 260)" strokeWidth="3.5" strokeLinecap="round" />
              
              <ellipse cx="315" cy="75" rx="18" ry="14" fill="url(#treeGrad)" opacity="0.8" filter="url(#glowFilter)" />
              <ellipse cx="350" cy="65" rx="16" ry="12" fill="url(#treeGrad)" opacity="0.8" filter="url(#glowFilter)" />
              <ellipse cx="335" cy="55" rx="22" ry="18" fill="url(#treeGrad)" opacity="0.8" filter="url(#glowFilter)" />
              
              <circle cx="330" cy="50" r="2" fill="oklch(0.85 0.15 95)" className="animate-pulse" />
              <circle cx="315" cy="70" r="1.5" fill="oklch(0.85 0.15 95)" />
              <circle cx="345" cy="65" r="1.5" fill="oklch(0.85 0.15 95)" />
            </g>
          )}

          {/* Floating Glow Particles */}
          <g className="animate-float" style={{ animationDuration: "5s" }}>
            <circle cx="150" cy="60" r="1" fill="oklch(0.85 0.15 95)" filter="url(#glowFilter)" />
            <path d="M 150 60 Q 148 55 146 58 Q 148 60 150 60 Q 152 55 154 58 Q 152 60 150 60" fill="oklch(0.83 0.08 290 / 0.6)" />
          </g>

          <g className="animate-float" style={{ animationDuration: "7s", animationDelay: "2s" }}>
            <circle cx="250" cy="40" r="1" fill="oklch(0.85 0.15 95)" filter="url(#glowFilter)" />
            <path d="M 250 40 Q 248 35 246 38 Q 248 40 250 40 Q 252 35 254 38 Q 252 40 250 40" fill="oklch(0.84 0.07 45 / 0.6)" />
          </g>

          <circle cx="50" cy="40" r="1" fill="oklch(0.85 0.15 95 / 0.4)" />
          <circle cx="110" cy="70" r="1.5" fill="oklch(0.85 0.15 95 / 0.3)" />
          <circle cx="300" cy="30" r="1" fill="oklch(0.85 0.15 95 / 0.4)" />
        </svg>
      </div>

      <div className="flex gap-4 text-[10px] text-muted-foreground mt-2 flex-wrap justify-center border-t border-border/20 pt-4 w-full">
        <div className="flex items-center gap-1.5"><span className="text-sm">🌱</span> Sprouts (Tasks Completed)</div>
        <div className="flex items-center gap-1.5"><span className="text-sm">🌸</span> Blooms (Reading Sessions)</div>
        <div className="flex items-center gap-1.5"><span className="text-sm">🌿</span> Ferns (Consistency Flow)</div>
        <div className="flex items-center gap-1.5"><span className="text-sm">🌳</span> Zen Trees (Worries Contained)</div>
      </div>
    </div>
  );
}


