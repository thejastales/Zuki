import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BookOpen, Plus, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reading/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Reading — Lumen" }] }),
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
};

type Rec = { id: string; title: string; author: string | null; reason: string | null };

function ReadingIndex() {
  const nav = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [pages, setPages] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: r }] = await Promise.all([
        supabase.from("books").select("*").order("created_at", { ascending: false }),
        supabase.from("book_recommendations").select("id,title,author,reason").order("created_at", { ascending: false }).limit(6),
      ]);
      setBooks((b ?? []) as Book[]);
      setRecs((r ?? []) as Rec[]);
      setLoading(false);
    })();
  }, []);

  async function addBook(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !pages) return;
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data, error } = await supabase
      .from("books")
      .insert({
        user_id: user.user.id,
        title: title.trim(),
        author: author.trim() || null,
        total_pages: parseInt(pages),
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setOpen(false);
    setTitle(""); setAuthor(""); setPages("");
    nav({ to: "/reading/$bookId", params: { bookId: (data as Book).id } });
  }

  const reading = books.filter((b) => b.status === "reading");
  const finished = books.filter((b) => b.status === "finished");

  return (
    <div className="space-y-6">
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
          <p className="text-sm text-muted-foreground">Loading…</p>
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
          <form onSubmit={addBook} className="space-y-3 pt-2">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-background/40" />
            <Input placeholder="Author (optional)" value={author} onChange={(e) => setAuthor(e.target.value)} className="bg-background/40" />
            <Input type="number" min={1} placeholder="Total pages" value={pages} onChange={(e) => setPages(e.target.value)} className="bg-background/40" />
            <Button type="submit" className="w-full">Add</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookCard({ book }: { book: Book }) {
  const pct = book.total_pages > 0 ? Math.round((book.current_page / book.total_pages) * 100) : 0;
  return (
    <Link
      to="/reading/$bookId"
      params={{ bookId: book.id }}
      className="aurora-card group block rounded-2xl p-4 transition-all hover:ring-2 hover:ring-primary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-display text-lg">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="truncate">{book.title}</span>
          </p>
          {book.author && <p className="text-xs text-muted-foreground">{book.author}</p>}
        </div>
        {book.status === "finished" && (
          <span className={cn("flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary")}>
            <Trophy className="h-3 w-3" /> {book.final_score ?? "—"}
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{book.current_page} / {book.total_pages} pp</span>
          <span>{pct}%</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>
    </Link>
  );
}
