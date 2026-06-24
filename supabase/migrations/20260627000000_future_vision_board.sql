-- Alter goals table to add vision board columns
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS quote TEXT;

-- Create future_self table
CREATE TABLE IF NOT EXISTS public.future_self (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  become_text TEXT,
  feel_text TEXT,
  life_text TEXT,
  values_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.future_self TO authenticated;
GRANT ALL ON public.future_self TO service_role;

-- Enable Row Level Security
ALTER TABLE public.future_self ENABLE ROW LEVEL SECURITY;

-- Owner policy
CREATE POLICY "own future_self" ON public.future_self 
  FOR ALL USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);
