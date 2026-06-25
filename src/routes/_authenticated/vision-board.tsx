import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/vision-board")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Future Vision Board - ZUKI" },
      {
        name: "description",
        content:
          "Your future deserves your attention more than your past. Visualize your dreams, aspirations, and reflections with ZUKI.",
      },
    ],
  }),
  component: VisionBoardPage,
});

const CATEGORIES = [
  { value: "Career", label: "Career" },
  { value: "Travel", label: "Travel" },
  { value: "Lifestyle & Wellness", label: "Lifestyle & Wellness" },
  { value: "Skills & Learning", label: "Skills & Learning" },
  { value: "Relationships", label: "Relationships" },
] as const;

type DreamCategory = typeof CATEGORIES[number]["value"];

type Dream = {
  id: string;
  user_id: string;
  title: string;
  status: string;
  notes: string | null;
  category: string | null;
  description: string | null;
  image_url: string | null;
  quote: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type FutureSelf = {
  id: string;
  user_id: string;
  become_text: string | null;
  feel_text: string | null;
  life_text: string | null;
  values_text: string | null;
  created_at: string;
  updated_at: string;
};

const DREAM_COLUMNS =
  "id,user_id,title,status,notes,category,description,image_url,quote,created_at,updated_at,completed_at";

function cleanOptionalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Image URL must start with http:// or https://");
    }
    return url.toString();
  } catch {
    throw new Error("Please enter a valid image URL, or leave it empty.");
  }
}

function VisionBoardPage() {
  const queryClient = useQueryClient();
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  // Modals state
  const [addDreamOpen, setAddDreamOpen] = useState(false);
  const [editingDream, setEditingDream] = useState<Dream | null>(null);

  // Future self edit state
  const [isEditingFutureSelf, setIsEditingFutureSelf] = useState(false);

  // Form states
  const [dreamTitle, setDreamTitle] = useState("");
  const [dreamCategory, setDreamCategory] = useState<string>("");
  const [dreamDescription, setDreamDescription] = useState("");
  const [dreamNotes, setDreamNotes] = useState("");
  const [dreamImageUrl, setDreamImageUrl] = useState("");
  const [dreamQuote, setDreamQuote] = useState("");

  const [futureBecome, setFutureBecome] = useState("");
  const [futureFeel, setFutureFeel] = useState("");
  const [futureLife, setFutureLife] = useState("");
  const [futureValues, setFutureValues] = useState("");

  // Get active session
  const { data: session } = useQuery({
    queryKey: ["auth_session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });
  const userId = session?.user?.id ?? null;

  // Fetch dreams (goals with category)
  const { data: dreams = [], isLoading: dreamsLoading } = useQuery({
    queryKey: ["dreams", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select(DREAM_COLUMNS)
        .not("category", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Dream[];
    },
  });

  // Fetch Future Self reflections
  const { data: futureSelf = null } = useQuery({
    queryKey: ["future_self", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("future_self")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        console.warn("Error fetching future_self:", error);
        return null;
      }
      return data as FutureSelf | null;
    },
  });

  // Populate future self form on load or change
  useEffect(() => {
    if (futureSelf) {
      setFutureBecome(futureSelf.become_text || "");
      setFutureFeel(futureSelf.feel_text || "");
      setFutureLife(futureSelf.life_text || "");
      setFutureValues(futureSelf.values_text || "");
    }
  }, [futureSelf]);

  // Mutations
  const addDreamMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("goals")
        .insert({
          user_id: userId,
          title: dreamTitle.trim(),
          category: dreamCategory,
          description: dreamDescription.trim() || null,
          notes: dreamNotes.trim() || null,
          image_url: cleanOptionalUrl(dreamImageUrl),
          quote: dreamQuote.trim() || null,
          status: "active",
        })
        .select(DREAM_COLUMNS)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dreams", userId] });
      queryClient.invalidateQueries({ queryKey: ["goals"] }); // Invalidate general goals as well
      toast.success("Added to your vision board.");
      resetDreamForm();
      setAddDreamOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const editDreamMutation = useMutation({
    mutationFn: async (dream: Dream) => {
      const { error } = await supabase
        .from("goals")
        .update({
          title: dreamTitle.trim(),
          category: dreamCategory,
          description: dreamDescription.trim() || null,
          notes: dreamNotes.trim() || null,
          image_url: cleanOptionalUrl(dreamImageUrl),
          quote: dreamQuote.trim() || null,
        })
        .eq("id", dream.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dreams", userId] });
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Dream card updated");
      resetDreamForm();
      setEditingDream(null);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteDreamMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dreams", userId] });
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Dream card removed");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const toggleDreamStatusMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      const status = isCompleted ? "completed" : "active";
      const completed_at = isCompleted ? new Date().toISOString() : null;
      const { error } = await supabase
        .from("goals")
        .update({ status, completed_at })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dreams", userId] });
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      if (variables.isCompleted) {
        toast.success("Dream marked as realized.");
      } else {
        toast.success("Dream returned to your active board.");
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const saveFutureSelfMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await supabase.from("future_self").upsert({
        user_id: userId,
        become_text: futureBecome.trim() || null,
        feel_text: futureFeel.trim() || null,
        life_text: futureLife.trim() || null,
        values_text: futureValues.trim() || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["future_self", userId] });
      toast.success("Future Self reflections saved");
      setIsEditingFutureSelf(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const resetDreamForm = () => {
    setDreamTitle("");
    setDreamCategory("");
    setDreamDescription("");
    setDreamNotes("");
    setDreamImageUrl("");
    setDreamQuote("");
  };

  const handleEditClick = (dream: Dream) => {
    setEditingDream(dream);
    setDreamTitle(dream.title);
    setDreamCategory(dream.category || "");
    setDreamDescription(dream.description || "");
    setDreamNotes(dream.notes || "");
    setDreamImageUrl(dream.image_url || "");
    setDreamQuote(dream.quote || "");
  };

  const filteredDreams = useMemo(
    () =>
      dreams.filter((d) => {
        if (selectedFilter === "all") return true;
        return d.category === selectedFilter;
      }),
    [dreams, selectedFilter],
  );

  const categoryOptions = CATEGORIES;

  // Calming pastel background presets based on index
  const getCardFallbackBg = (index: number) => {
    const gradients = [
      "from-[oklch(0.92_0.04_120)] to-[oklch(0.88_0.08_160)]", // Soft sage to teal
      "from-[oklch(0.93_0.03_340)] to-[oklch(0.88_0.07_300)]", // Peach/rose to lavender
      "from-[oklch(0.94_0.04_90)] to-[oklch(0.90_0.08_50)]",   // Warm gold to yellow-orange
      "from-[oklch(0.92_0.05_220)] to-[oklch(0.87_0.08_260)]", // Soft sky to blue-violet
      "from-[oklch(0.93_0.04_180)] to-[oklch(0.89_0.06_220)]", // Mint to indigo
    ];
    return gradients[index % gradients.length];
  };

  return (
    <div className="space-y-10 max-w-5xl mx-auto pb-16 relative z-10 animate-in fade-in duration-700">
      {/* Header Panel */}
      <div className="text-center space-y-3 py-6">
        <h1 className="font-display text-4xl sm:text-5xl tracking-tight text-foreground font-semibold flex items-center justify-center gap-3">
          Future Vision Board
        </h1>
        <p className="text-base text-muted-foreground max-w-md mx-auto italic font-medium leading-relaxed">
          "Your future deserves your attention more than your past."
        </p>
      </div>

      {/* Future Self reflections section */}
      <Card className="aurora-card border border-primary/10 p-8 rounded-3xl relative overflow-hidden shadow-soft">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-display text-2xl font-semibold tracking-tight">My Future Self</h2>
          <Button
            variant={isEditingFutureSelf ? "outline" : "default"}
            size="sm"
            onClick={() => {
              if (isEditingFutureSelf) {
                // Cancel
                if (futureSelf) {
                  setFutureBecome(futureSelf.become_text || "");
                  setFutureFeel(futureSelf.feel_text || "");
                  setFutureLife(futureSelf.life_text || "");
                  setFutureValues(futureSelf.values_text || "");
                } else {
                  setFutureBecome("");
                  setFutureFeel("");
                  setFutureLife("");
                  setFutureValues("");
                }
                setIsEditingFutureSelf(false);
              } else {
                setIsEditingFutureSelf(true);
              }
            }}
          >
            {isEditingFutureSelf ? "Cancel" : "Reflect"}
          </Button>
        </div>

        {isEditingFutureSelf ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                  Who I want to become
                </label>
                <Textarea
                  placeholder="Describe your traits, confidence, growth, and character..."
                  value={futureBecome}
                  onChange={(e) => setFutureBecome(e.target.value)}
                  className="min-h-[100px] bg-background/50 border border-primary/15"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                  How I want to feel
                </label>
                <Textarea
                  placeholder="Describe your emotional state, peace of mind, energy, and outlook..."
                  value={futureFeel}
                  onChange={(e) => setFutureFeel(e.target.value)}
                  className="min-h-[100px] bg-background/50 border border-primary/15"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                  What kind of life I want to build
                </label>
                <Textarea
                  placeholder="Describe your daily environment, home, routines, and physical spaces..."
                  value={futureLife}
                  onChange={(e) => setFutureLife(e.target.value)}
                  className="min-h-[100px] bg-background/50 border border-primary/15"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                  What values I want to live by
                </label>
                <Textarea
                  placeholder="Describe your grounding principles, guidelines, and ethics..."
                  value={futureValues}
                  onChange={(e) => setFutureValues(e.target.value)}
                  className="min-h-[100px] bg-background/50 border border-primary/15"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => saveFutureSelfMutation.mutate()}
                disabled={saveFutureSelfMutation.isPending}
                className="px-6"
              >
                {saveFutureSelfMutation.isPending ? "Saving..." : "Save Reflections"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-background/25 border border-primary/5 p-6 rounded-2xl relative">
              <h3 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground mb-2">
                Who I want to become
              </h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {futureBecome || "Not written yet. Tap Reflect to define your future self."}
              </p>
            </Card>

            <Card className="bg-background/25 border border-primary/5 p-6 rounded-2xl relative">
              <h3 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground mb-2">
                How I want to feel
              </h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {futureFeel || "Not written yet. Tap Reflect to define your future self."}
              </p>
            </Card>

            <Card className="bg-background/25 border border-primary/5 p-6 rounded-2xl relative">
              <h3 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground mb-2">
                Life to build
              </h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {futureLife || "Not written yet. Tap Reflect to define your future self."}
              </p>
            </Card>

            <Card className="bg-background/25 border border-primary/5 p-6 rounded-2xl relative">
              <h3 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground mb-2">
                Values to live by
              </h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {futureValues || "Not written yet. Tap Reflect to define your future self."}
              </p>
            </Card>
          </div>
        )}
      </Card>

      {/* Dream Wall control section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-4">
          {/* Categories Selector */}
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant={selectedFilter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedFilter("all")}
              className="rounded-full text-xs py-1 px-4"
            >
              All
            </Button>
            {CATEGORIES.map((cat) => (
              <Button
                key={cat.value}
                variant={selectedFilter === cat.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedFilter(cat.value)}
                className="rounded-full text-xs py-1 px-4 flex items-center gap-1.5"
              >
                <span>{cat.label}</span>
              </Button>
            ))}
          </div>

          <Button
            onClick={() => setAddDreamOpen(true)}
            size="sm"
            className="flex items-center gap-1.5 rounded-full"
          >
            <Plus className="h-4 w-4" /> Add Dream
          </Button>
        </div>

        {/* Pinterest style Dream Wall Grid */}
        {dreamsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-64 rounded-3xl bg-muted/20 border border-primary/5 animate-pulse"
              />
            ))}
          </div>
        ) : filteredDreams.length === 0 ? (
          <div className="text-center py-16 bg-background/20 rounded-3xl border border-dashed border-primary/10">
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Your future board is empty. Add a dream when you feel ready to give your future a little more shape.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {filteredDreams.map((dream, index) => {
              const categoryObj = CATEGORIES.find((c) => c.value === dream.category);
              return (
                <Card
                  key={dream.id}
                  className={cn(
                    "relative overflow-hidden rounded-3xl border border-primary/10 bg-background/40 backdrop-blur-xl shadow-soft",
                    "hover:shadow-lg transition-shadow duration-200 group"
                  )}
                >
                  {/* Image Cover or Pastel Gradient */}
                  <div className="aspect-[16/10] w-full relative overflow-hidden bg-muted">
                    {dream.image_url ? (
                      <img
                        src={dream.image_url}
                        alt={dream.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Handle image loading error nicely
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        className={cn(
                          "w-full h-full bg-gradient-to-br transition-all duration-300",
                          getCardFallbackBg(index)
                        )}
                      />
                    )}
                    {/* Completion glow overlay */}
                    {dream.status === "completed" && (
                      <div className="absolute inset-0 bg-primary/10 backdrop-blur-[1px] flex items-center justify-center">
                        <div className="bg-background/90 text-primary text-xs font-semibold py-1.5 px-3 rounded-full flex items-center gap-1.5 shadow-sm">
                          <CheckCircle2 className="h-3.5 w-3.5 fill-current" />
                          <span>Realized</span>
                        </div>
                      </div>
                    )}

                    {/* Category overlay */}
                    {categoryObj && (
                      <div className="absolute top-3 left-3 bg-background/80 backdrop-blur-md text-foreground text-[10px] font-bold tracking-wider uppercase py-1 px-2.5 rounded-full flex items-center gap-1.5 shadow-sm">
                        <span>{categoryObj.label}</span>
                      </div>
                    )}

                    {/* Completion control */}
                    <button
                      onClick={() =>
                        toggleDreamStatusMutation.mutate({
                          id: dream.id,
                          isCompleted: dream.status !== "completed",
                        })
                      }
                      className={cn(
                        "absolute top-3 right-3 p-1.5 rounded-full transition-colors z-20",
                        dream.status === "completed"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background/80 hover:bg-background backdrop-blur-md text-muted-foreground hover:text-foreground"
                      )}
                      title={dream.status === "completed" ? "Mark Active" : "Mark Realized"}
                    >
                      {dream.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 space-y-4">
                    <div className="space-y-1">
                      <h3 className="font-display text-lg font-semibold leading-snug">
                        {dream.title}
                      </h3>
                      {dream.description && (
                        <p className="text-sm text-foreground/80 leading-relaxed">
                          {dream.description}
                        </p>
                      )}
                    </div>

                    {/* Quote box */}
                    {dream.quote && (
                      <blockquote className="border-l-2 border-primary/30 pl-3 italic text-xs text-muted-foreground/90 font-medium">
                        "{dream.quote}"
                      </blockquote>
                    )}

                    {/* Personal Notes */}
                    {dream.notes && (
                      <div className="bg-primary/5 rounded-2xl p-3 text-[11px] text-muted-foreground/80 border border-primary/5">
                        <span className="font-semibold block mb-0.5 text-muted-foreground">Notes:</span>
                        <p>{dream.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions overlay footer on hover */}
                  <div className="px-6 pb-4 pt-2 border-t border-border/20 flex justify-end gap-2 text-xs">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleEditClick(dream)}
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        if (confirm("Remove this dream from your board?")) {
                          deleteDreamMutation.mutate(dream.id);
                        }
                      }}
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Dream Dialog */}
      <Dialog open={addDreamOpen} onOpenChange={setAddDreamOpen}>
        <DialogContent className="sm:max-w-md aurora-card border-0 z-50">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Add a Dream</DialogTitle>
            <DialogDescription>
              Create a calm visual card for an aspiration you want to keep close.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Dream Title</label>
              <Input
                placeholder="e.g. Visit Japan, Master Python..."
                value={dreamTitle}
                onChange={(e) => setDreamTitle(e.target.value)}
                maxLength={80}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Category</label>
              <Select onValueChange={setDreamCategory} value={dreamCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Description</label>
              <Textarea
                placeholder="Describe your aspiration..."
                value={dreamDescription}
                onChange={(e) => setDreamDescription(e.target.value)}
                maxLength={400}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Image URL (Optional)</label>
              <Input
                placeholder="https://images.unsplash.com/..."
                value={dreamImageUrl}
                onChange={(e) => setDreamImageUrl(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Inspirational Quote (Optional)</label>
              <Input
                placeholder="A quote that drives this aspiration..."
                value={dreamQuote}
                onChange={(e) => setDreamQuote(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Personal Notes / Actions (Optional)</label>
              <Textarea
                placeholder="Private reminders, feelings, or actions you want to take..."
                value={dreamNotes}
                onChange={(e) => setDreamNotes(e.target.value)}
                className="min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button
              onClick={() => addDreamMutation.mutate()}
              disabled={addDreamMutation.isPending || !dreamTitle.trim() || !dreamCategory}
              className="w-full"
            >
              {addDreamMutation.isPending ? "Saving..." : "Save Dream"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dream Dialog */}
      <Dialog open={!!editingDream} onOpenChange={(open) => !open && setEditingDream(null)}>
        <DialogContent className="sm:max-w-md aurora-card border-0 z-50">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Edit Dream Card</DialogTitle>
            <DialogDescription>
              Refine your aspiration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Dream Title</label>
              <Input
                placeholder="e.g. Visit Japan..."
                value={dreamTitle}
                onChange={(e) => setDreamTitle(e.target.value)}
                maxLength={80}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Category</label>
              <Select onValueChange={setDreamCategory} value={dreamCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Description</label>
              <Textarea
                placeholder="Describe your aspiration..."
                value={dreamDescription}
                onChange={(e) => setDreamDescription(e.target.value)}
                maxLength={400}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Image URL</label>
              <Input
                placeholder="https://images.unsplash.com/..."
                value={dreamImageUrl}
                onChange={(e) => setDreamImageUrl(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Inspirational Quote</label>
              <Input
                placeholder="A quote that drives this aspiration..."
                value={dreamQuote}
                onChange={(e) => setDreamQuote(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Personal Notes / Actions</label>
              <Textarea
                placeholder="Private reminders, feelings, or actions..."
                value={dreamNotes}
                onChange={(e) => setDreamNotes(e.target.value)}
                className="min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button
              onClick={() => editingDream && editDreamMutation.mutate(editingDream)}
              disabled={editDreamMutation.isPending || !dreamTitle.trim() || !dreamCategory}
              className="w-full"
            >
              {editDreamMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
