
-- Add academic profile fields to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS college_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS department text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cgpa numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_year integer DEFAULT 1;
