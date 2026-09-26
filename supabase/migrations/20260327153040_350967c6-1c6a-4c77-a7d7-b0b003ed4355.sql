-- Add username and email columns to profiles
ALTER TABLE public.profiles ADD COLUMN username TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN email TEXT;

-- Create index for username lookups
CREATE INDEX idx_profiles_username ON public.profiles (username);

-- Allow public to read profiles by username (for login lookup)
CREATE POLICY "Anyone can look up profiles by username" ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Drop the old select policy that was too restrictive
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Update the trigger to also store username and email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    LOWER(NEW.raw_user_meta_data->>'username'),
    NEW.email
  );
  RETURN NEW;
END;
$$;