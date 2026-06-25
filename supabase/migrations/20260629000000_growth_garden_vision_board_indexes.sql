-- Keep Growth Garden and Future Vision Board reads fast and timestamps accurate.

CREATE TRIGGER goals_touch
  BEFORE UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER future_self_touch
  BEFORE UPDATE ON public.future_self
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS goals_user_created_idx
  ON public.goals(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS goals_user_category_status_idx
  ON public.goals(user_id, category, status)
  WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS future_self_user_idx
  ON public.future_self(user_id);
