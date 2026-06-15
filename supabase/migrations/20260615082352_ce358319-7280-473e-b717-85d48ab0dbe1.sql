
-- books
CREATE TABLE public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  author text,
  total_pages integer NOT NULL DEFAULT 0,
  current_page integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'reading',
  final_score integer,
  final_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own books" ON public.books FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER books_touch BEFORE UPDATE ON public.books FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- reading_sessions
CREATE TABLE public.reading_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  pages_from integer NOT NULL,
  pages_to integer NOT NULL,
  understanding_note text NOT NULL,
  ai_score integer,
  ai_feedback text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reading_sessions TO authenticated;
GRANT ALL ON public.reading_sessions TO service_role;
ALTER TABLE public.reading_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions" ON public.reading_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX reading_sessions_book_idx ON public.reading_sessions(book_id, created_at);

-- book_recommendations
CREATE TABLE public.book_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
  title text NOT NULL,
  author text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_recommendations TO authenticated;
GRANT ALL ON public.book_recommendations TO service_role;
ALTER TABLE public.book_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recs" ON public.book_recommendations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- link chat threads to a book
ALTER TABLE public.chat_threads ADD COLUMN IF NOT EXISTS book_id uuid REFERENCES public.books(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS chat_threads_book_idx ON public.chat_threads(book_id);
