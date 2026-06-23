import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BookOpen, Plus, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/reading/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Reading — ZUKI" }] }),
  component: ReadingIndex,
});

type Book = {
  id: string;
  title: string;
  author: string | null;
  total_pages: number;
  current_page: number;
  status: "reading" | "finished" | "abandoned";
  final_score: number | null;
  cover_url?: string | null;
};

type Rec = { id: string; title: string; author: string | null; reason: string | null };

function ReadingIndex() {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [pages, setPages] = useState("");

  // Queries
  const { data: allSessions = [] } = useQuery({
    queryKey: ["all_reading_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reading_sessions")
        .select("pages_from, pages_to, session_date")
        .order("session_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: books = [], isLoading: booksLoading } = useQuery({
    queryKey: ["books"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Book[];
    },
  });

  const { data: recs = [], isLoading: recsLoading } = useQuery({
    queryKey: ["book_recommendations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("book_recommendations")
        .select("id,title,author,reason")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as Rec[];
    },
  });

async function fetchBookCover(title: string, author: string): Promise<string | null> {
  try {
    let url = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}`;
    if (author) {
      url += `&author=${encodeURIComponent(author)}`;
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const doc = data.docs?.[0];
    if (doc?.cover_i) {
      return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    }
    if (doc?.cover_edition_key) {
      return `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-L.jpg`;
    }
    return null;
  } catch (err) {
    console.error("Failed to fetch book cover:", err);
    return null;
  }
}

  // Mutation to add book
  const addBookMutation = useMutation({
    mutationFn: async ({ title, author, pages }: { title: string; author: string; pages: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      
      let coverUrl = null;
      try {
        coverUrl = await fetchBookCover(title, author);
      } catch (e) {
        console.warn("Could not fetch cover from OpenLibrary:", e);
      }

      const insertData = {
        user_id: user.user.id,
        title: title.trim(),
        author: author.trim() || null,
        total_pages: parseInt(pages),
      };

      let result;
      try {
        const { data, error } = await supabase
          .from("books")
          .insert({
            ...insertData,
            cover_url: coverUrl,
          })
          .select()
          .single();
        if (error) throw error;
        result = data;
      } catch (err) {
        console.warn("Inserting with cover_url failed, retrying without cover_url:", err);
        const { data, error } = await supabase
          .from("books")
          .insert(insertData)
          .select()
          .single();
        if (error) throw error;
        result = data;
      }
      return result as Book;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      setOpen(false);
      setTitle("");
      setAuthor("");
      setPages("");
      toast.success("Book added to library.");
      nav({ to: "/reading/$bookId", params: { bookId: data.id } });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  function handleAddBook(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !pages) return;
    addBookMutation.mutate({ title, author, pages });
  }

  const reading = books.filter((b) => b.status === "reading");
  const finished = books.filter((b) => b.status === "finished");
  const loading = booksLoading || recsLoading;

  const totalPagesRead = useMemo(() => {
    return allSessions.reduce((acc, s) => acc + Math.max(0, s.pages_to - s.pages_from + 1), 0);
  }, [allSessions]);

  const streak = useMemo(() => {
    if (allSessions.length === 0) return 0;
    const uniqueDates = Array.from(new Set(allSessions.map(s => s.session_date))).sort((a, b) => b.localeCompare(a));
    
    let currentStreak = 0;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const yesterdayStr = format(new Date(Date.now() - 24 * 60 * 60 * 1000), "yyyy-MM-dd");
    
    let expectedDateStr = uniqueDates[0] === todayStr ? todayStr : uniqueDates[0] === yesterdayStr ? yesterdayStr : null;
    if (!expectedDateStr) return 0;
    
    let expectedDate = new Date(expectedDateStr);
    for (const dateStr of uniqueDates) {
      const current = new Date(dateStr);
      const diffTime = Math.abs(expectedDate.getTime() - current.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 1) {
        currentStreak++;
        expectedDate = current;
      } else {
        break;
      }
    }
    return currentStreak;
  }, [allSessions]);

  const booksFinished = finished.length;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-6"
    >
      <section className="aurora-card flex flex-col gap-4 rounded-3xl p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-primary/80">Reading</p>
          <h1 className="font-display text-3xl sm:text-4xl">Your library</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Log what you read, talk to the book, and never miss the ideas that matter.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add a book
        </Button>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl">Currently reading</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading library…</p>
        ) : reading.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/50 p-6 text-center text-sm text-muted-foreground">
            No active books. Add one to begin.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {reading.map((b) => <BookCard key={b.id} book={b} />)}
          </div>
        )}
      </section>

      {/* Library Stats Grid */}
      <section className="grid gap-4 grid-cols-3">
        <div className="aurora-card p-4 rounded-2xl text-center relative overflow-hidden interactive-card shadow-soft">
          <span className="text-xs text-muted-foreground uppercase tracking-wider block text-[10px]">Reading Streak</span>
          <span className="font-display text-2xl sm:text-3xl font-bold text-primary mt-1 block">🔥 {streak} days</span>
        </div>
        <div className="aurora-card p-4 rounded-2xl text-center relative overflow-hidden interactive-card shadow-soft">
          <span className="text-xs text-muted-foreground uppercase tracking-wider block text-[10px]">Books Finished</span>
          <span className="font-display text-2xl sm:text-3xl font-bold text-accent mt-1 block">📚 {booksFinished}</span>
        </div>
        <div className="aurora-card p-4 rounded-2xl text-center relative overflow-hidden interactive-card shadow-soft">
          <span className="text-xs text-muted-foreground uppercase tracking-wider block text-[10px]">Pages Read</span>
          <span className="font-display text-2xl sm:text-3xl font-bold text-foreground mt-1 block">📄 {totalPagesRead}</span>
        </div>
      </section>

      {/* Reading Insights Card */}
      <section className="aurora-card p-5 rounded-2xl relative overflow-hidden interactive-card shadow-soft">
        <h3 className="font-display text-lg mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary animate-pulse" /> Reading Insights
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {streak > 0 
            ? `Fantastic work! You have logged sessions for ${streak} consecutive days. Regular reading strengthens your memory and focus by over 32% compared to sporadic reading.`
            : "No active streak yet — but today is the perfect day to start. Just log a few pages to unlock your daily reading momentum!"
          }
        </p>
      </section>

      {finished.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl">Finished</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {finished.map((b) => <BookCard key={b.id} book={b} />)}
          </div>
        </section>
      )}

      {recs.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl">
            <Sparkles className="h-4 w-4 text-primary" /> Recommended for you
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {recs.map((r) => (
              <div key={r.id} className="aurora-card rounded-2xl p-4">
                <p className="font-display text-lg">{r.title}</p>
                {r.author && <p className="text-xs text-muted-foreground">{r.author}</p>}
                {r.reason && <p className="mt-2 text-sm text-muted-foreground">{r.reason}</p>}
              </div>
            ))}
          </div>
        </section>
      )}


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="aurora-card border-0 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Add a book</DialogTitle>
            <DialogDescription>What are you reading next?</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddBook} className="space-y-3 pt-2">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-background/40" />
            <Input placeholder="Author (optional)" value={author} onChange={(e) => setAuthor(e.target.value)} className="bg-background/40" />
            <Input type="number" min={1} placeholder="Total pages" value={pages} onChange={(e) => setPages(e.target.value)} className="bg-background/40" />
            <Button type="submit" disabled={addBookMutation.isPending} className="w-full">Add</Button>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}


function BookCard({ book }: { book: Book }) {
  const pct = book.total_pages > 0 ? Math.round((book.current_page / book.total_pages) * 100) : 0;
  return (
    <Link
      to="/reading/$bookId"
      params={{ bookId: book.id }}
      className="aurora-card group flex gap-4 rounded-2xl p-4 transition-all hover:ring-2 hover:ring-primary/40 hover:-translate-y-0.5 relative overflow-hidden animate-fade-in-up"
    >
      <BookCover title={book.title} author={book.author} coverUrl={book.cover_url} size="small" />
      <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-display text-base font-semibold group-hover:text-primary transition-colors truncate">
              {book.title}
            </p>
            {book.status === "finished" && (
              <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary shrink-0 animate-pulse">
                <Trophy className="h-3 w-3" /> {book.final_score ?? "—"}
              </span>
            )}
          </div>
          {book.author && <p className="text-xs text-muted-foreground truncate">{book.author}</p>}
        </div>
        <div className="space-y-1.5 mt-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{book.current_page} / {book.total_pages} pp</span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
      </div>
    </Link>
  );
}

export function BookCover({ title, author, coverUrl, size = "small" }: { title: string; author: string | null; coverUrl?: string | null; size?: "small" | "large" }) {
  const [imgFailed, setImgFailed] = useState(false);
  const getHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  const hash = getHash(title);
  
  const gradients = [
    "from-[oklch(0.20_0.04_250)] to-[oklch(0.35_0.08_290)]", // Lavender Dusk
    "from-[oklch(0.22_0.04_180)] to-[oklch(0.32_0.08_150)]", // Forest Sage
    "from-[oklch(0.20_0.05_20)] to-[oklch(0.33_0.08_40)]",   // Clay Rose
    "from-[oklch(0.18_0.03_280)] to-[oklch(0.28_0.07_310)]", // Deep Iris
    "from-[oklch(0.23_0.03_90)] to-[oklch(0.33_0.06_70)]",   // Ochre Wheat
    "from-[oklch(0.19_0.04_220)] to-[oklch(0.30_0.08_240)]", // Ocean Teal
  ];

  const gradient = gradients[hash % gradients.length];
  const isLarge = size === "large";

  if (coverUrl && !imgFailed) {
    return (
      <div 
        className={cn(
          "relative rounded-xl overflow-hidden bg-zinc-950 flex flex-col justify-between border border-primary/20 shadow-md shrink-0",
          isLarge ? "h-64 w-44" : "h-28 w-20"
        )}
      >
        <img 
          src={coverUrl} 
          alt={title} 
          className="w-full h-full object-cover" 
          onError={() => setImgFailed(true)}
        />
        {/* Visual book crease/spine line */}
        <div className="absolute left-2 top-0 bottom-0 w-[1px] bg-white/10 shadow-[1px_0_3px_rgba(0,0,0,0.3)] pointer-events-none" />
        {/* Decorative design frame */}
        <div className="absolute inset-1.5 border border-white/5 rounded-lg pointer-events-none" />
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "relative rounded-xl overflow-hidden bg-gradient-to-br flex flex-col justify-between p-3 text-center border border-primary/20 shadow-md shrink-0",
        gradient,
        isLarge ? "h-64 w-44" : "h-28 w-20"
      )}
    >
      {/* Visual book crease/spine line */}
      <div className="absolute left-2 top-0 bottom-0 w-[1px] bg-white/10 shadow-[1px_0_3px_rgba(0,0,0,0.3)] pointer-events-none" />
      
      {/* Decorative design frame */}
      <div className="absolute inset-1.5 border border-white/5 rounded-lg pointer-events-none" />
      
      <div className="mt-1 space-y-0.5 relative z-10">
        <p className={cn("font-display font-semibold text-white leading-tight text-center break-words", isLarge ? "text-lg pt-4" : "text-[10px] line-clamp-3")}>
          {title}
        </p>
      </div>
      
      {author && (
        <p className={cn("font-sans font-light text-white/70 relative z-10 truncate text-center", isLarge ? "text-xs pb-2" : "text-[8px]")}>
          {author}
        </p>
      )}
    </div>
  );
}


