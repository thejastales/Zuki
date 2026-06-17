
CREATE TABLE public.worries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  intensity INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  worry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worries TO authenticated;
GRANT ALL ON public.worries TO service_role;
ALTER TABLE public.worries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own worries" ON public.worries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER worries_touch BEFORE UPDATE ON public.worries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.worry_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INTEGER NOT NULL DEFAULT 20,
  notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worry_sessions TO authenticated;
GRANT ALL ON public.worry_sessions TO service_role;
ALTER TABLE public.worry_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own worry sessions" ON public.worry_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.worry_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worry_reports TO authenticated;
GRANT ALL ON public.worry_reports TO service_role;
ALTER TABLE public.worry_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own worry reports" ON public.worry_reports FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.chat_threads ADD COLUMN IF NOT EXISTS kind TEXT;
