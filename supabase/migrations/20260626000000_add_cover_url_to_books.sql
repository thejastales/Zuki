-- Add cover_url column to books table
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS cover_url TEXT;
