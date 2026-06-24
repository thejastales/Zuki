-- Create trigger to auto-confirm email signups at the database level
CREATE OR REPLACE FUNCTION public.auto_confirm_new_users()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at := NOW();
  NEW.confirmed_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it already exists to prevent duplicate execution errors
DROP TRIGGER IF EXISTS tr_auto_confirm_new_users ON auth.users;

-- Create the trigger
CREATE TRIGGER tr_auto_confirm_new_users
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_new_users();
