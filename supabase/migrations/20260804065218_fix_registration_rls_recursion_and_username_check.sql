/*
# Fix Registration Failures: RLS Recursion + Username Check + Trigger

## Overview
Registration was failing due to three root causes:
1. RLS infinite recursion: `schools_manage_admin` and `school_requests_manage_admin`
   policies subquery `profiles` (which has RLS), causing a cycle when profiles
   join to schools. Fixed with a SECURITY DEFINER `is_admin()` function.
2. Username availability check: `check_username_available` RPC didn't exist,
   so the frontend's RPC call failed. Added as SECURITY DEFINER so anon users
   (not yet logged in) can check without being blocked by profiles RLS.
3. `handle_new_user` trigger only handled `ON CONFLICT (id) DO NOTHING` —
   duplicate usernames (unique index on lower(username)) caused a
   unique_violation that rolled back the entire transaction with a generic
   error. Now catches unique_violation and raises a clear message.

## Changes

### 1. New Functions
- `is_admin()` — SECURITY DEFINER, STABLE. Checks if current user is admin
  without triggering RLS recursion on profiles.
- `check_username_available(p_username text)` — SECURITY DEFINER, STABLE.
  Returns true if username is available (case-insensitive, via lower()).
  Callable by anon + authenticated.

### 2. RLS Policy Updates
- `schools_manage_admin`: replaced subquery with `public.is_admin()`.
- `school_requests_manage_admin`: replaced subquery with `public.is_admin()`.

### 3. Trigger Update
- `handle_new_user`: now catches unique_violation on username and raises
  a clear exception: "Username is already taken. Please choose another."

## Backward Compatibility
- No tables or columns changed.
- Existing policies not mentioned remain unchanged.
- is_admin() is additive; check_username_available is additive.
- handle_new_user logic preserved except for the new error handling.
*/

-- 1. is_admin() SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2. check_username_available() SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.check_username_available(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(p_username)
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_username_available(p_username text) TO anon, authenticated;

-- 3. Fix schools_manage_admin policy — use is_admin() instead of subquery
DROP POLICY IF EXISTS "schools_manage_admin" ON schools;
CREATE POLICY "schools_manage_admin"
ON schools FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 4. Fix school_requests_manage_admin policy — use is_admin() instead of subquery
DROP POLICY IF EXISTS "school_requests_manage_admin" ON school_requests;
CREATE POLICY "school_requests_manage_admin"
ON school_requests FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 5. Fix handle_new_user trigger to catch username unique_violation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_full_name text;
  v_username  text;
  v_role      text;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_username  := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  v_role      := COALESCE(NEW.raw_user_meta_data->>'role', 'student');

  -- Reject admin self-assignment at signup
  IF v_role = 'admin' THEN
    v_role := 'student';
  END IF;

  -- Only student/teacher/admin allowed; default to student otherwise
  IF v_role NOT IN ('student', 'teacher', 'admin') THEN
    v_role := 'student';
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, full_name, username, email, role)
    VALUES (NEW.id, v_full_name, v_username, NEW.email, v_role)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Username is already taken. Please choose another.'
        USING ERRCODE = 'unique_violation';
  END;

  RETURN NEW;
END;
$function$;
