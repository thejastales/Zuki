-- Create weekly_reflections table
CREATE TABLE IF NOT EXISTS public.weekly_reflections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  wins TEXT[] NOT NULL DEFAULT '{}',
  challenges TEXT[] NOT NULL DEFAULT '{}',
  lessons_learned TEXT[] NOT NULL DEFAULT '{}',
  mood_trends TEXT,
  reading_progress TEXT,
  worries_summary TEXT,
  suggested_focus TEXT,
  ai_reflection TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_reflections TO authenticated;
GRANT ALL ON public.weekly_reflections TO service_role;
ALTER TABLE public.weekly_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own weekly_reflections" ON public.weekly_reflections FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create monthly_reports table
CREATE TABLE IF NOT EXISTS public.monthly_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_month DATE NOT NULL,
  time_invested_minutes INTEGER NOT NULL DEFAULT 0,
  books_completed INTEGER NOT NULL DEFAULT 0,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  emotional_growth TEXT,
  consistency_score INTEGER NOT NULL DEFAULT 0,
  ai_observations TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_reports TO authenticated;
GRANT ALL ON public.monthly_reports TO service_role;
ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own monthly_reports" ON public.monthly_reports FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create growth_milestones table
CREATE TABLE IF NOT EXISTS public.growth_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  milestone_date DATE NOT NULL DEFAULT CURRENT_DATE,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_milestones TO authenticated;
GRANT ALL ON public.growth_milestones TO service_role;
ALTER TABLE public.growth_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own growth_milestones" ON public.growth_milestones FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create life_chapters table
CREATE TABLE IF NOT EXISTS public.life_chapters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.life_chapters TO authenticated;
GRANT ALL ON public.life_chapters TO service_role;
ALTER TABLE public.life_chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own life_chapters" ON public.life_chapters FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create book_insights table
CREATE TABLE IF NOT EXISTS public.book_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE UNIQUE,
  key_ideas TEXT[] NOT NULL DEFAULT '{}',
  reflection_prompts TEXT[] NOT NULL DEFAULT '{}',
  personal_applications TEXT[] NOT NULL DEFAULT '{}',
  quotes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_insights TO authenticated;
GRANT ALL ON public.book_insights TO service_role;
ALTER TABLE public.book_insights ENABLE ROW LEVEL SECURITY;
-- book_insights policy depends on ownership of public.books
CREATE POLICY "own book_insights" ON public.book_insights FOR ALL USING (
  EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.user_id = auth.uid())
);

-- Create daily_sparks table
CREATE TABLE IF NOT EXISTS public.daily_sparks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spark_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quote TEXT NOT NULL,
  quote_author TEXT NOT NULL,
  reflection TEXT NOT NULL,
  challenge TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, spark_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_sparks TO authenticated;
GRANT ALL ON public.daily_sparks TO service_role;
ALTER TABLE public.daily_sparks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own daily_sparks" ON public.daily_sparks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
