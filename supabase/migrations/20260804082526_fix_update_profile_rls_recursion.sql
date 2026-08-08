/*
# Fix remaining RLS recursion in update_own_profile policy

## Root Cause
The `update_own_profile` policy has a WITH CHECK clause that subqueries
profiles to verify the role hasn't changed:
  WITH CHECK (auth.uid() = id AND role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid()))
This self-referential subquery on profiles triggers infinite RLS recursion
whenever a user updates their own profile (e.g., setting last_login after
sign-in, or updating school_id after joining a community).

## Fix
Replace the recursive subquery with a SECURITY DEFINER function that reads
the role without triggering RLS. We already have is_admin(); we add
get_user_role() for the general case.

## Changes
1. New function get_user_role() — SECURITY DEFINER, STABLE
2. update_own_profile policy — use get_user_role() instead of subquery
*/

-- 1. get_user_role() SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

-- 2. Fix update_own_profile policy — remove recursive subquery
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND role = public.get_user_role());
