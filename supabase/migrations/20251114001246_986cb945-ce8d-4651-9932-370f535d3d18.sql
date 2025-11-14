-- Fix RLS policy for profiles table to require authentication
-- Drop the existing public read policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create new policy that requires authentication
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Keep existing update policy (users can update their own profile)
-- Keep existing insert policy (users can insert their own profile)