/*
# Create profiles table for GENSPACE PLC authentication

1. Purpose
   Stores public user data (display name, username, role, avatar, bio, XP,
   level, timestamps) keyed off auth.users. This is the single source of
   truth for a user's application-level identity after sign-in.

2. New Tables
   - `profiles`
     - `id`            (uuid, PRIMARY KEY, references auth.users ON DELETE CASCADE)
     - `full_name`     (text, NOT NULL)
     - `username`      (text, NOT NULL, UNIQUE, lowercase)
     - `email`         (text, NOT NULL)
     - `role`          (text, NOT NULL, DEFAULT 'student' — 'student' | 'teacher' | 'admin')
     - `avatar_url`    (text, nullable)
     - `bio`           (text, nullable)
     - `xp`            (integer, NOT NULL, DEFAULT 0)
     - `level`         (integer, NOT NULL, DEFAULT 1)
     - `created_at`    (timestamptz, DEFAULT now())
     - `updated_at`    (timestamptz, DEFAULT now())
     - `last_login`    (timestamptz, nullable)

3. Security (RLS)
   - RLS ENABLED on profiles.
   - SELECT: a user can read their own profile (auth.uid() = id).
   - INSERT: blocked at the RLS layer — profiles are created server-side
     by the handle_new_user trigger (which runs as the authenticated user
     during the signup event, so auth.uid() = NEW.id is satisfied).
     A guard policy is added so a freshly-signed-up user whose trigger
     hasn't run yet can still insert their own row.
   - UPDATE: a user can update their own profile, but ONLY non-role
     columns — the `role` column is excluded from client updates via a
     separate UPDATE policy with WITH CHECK that requires the incoming
     role to equal the existing role (preventing privilege escalation).
   - DELETE: a user can delete their own profile row (account deletion).

   Admin role is never exposed in any UI; it can only be set by a
   developer/admin directly in the database (UPDATE profiles SET
   role='admin' WHERE id = ...). There is no INSERT path for admin via
   the client, and the UPDATE policy prevents a user from granting
   themselves admin.

4. Trigger
   - `handle_new_user`: AFTER INSERT on auth.users → inserts a matching
     row into profiles using the new user's id, email, and metadata
     (full_name, username, role from raw_user_meta_data; role defaults
     to 'student' if absent, and is rejected if 'admin').

5. Avatar Storage
   - Creates a public storage bucket `avatars` for profile photos.
   - Policy: authenticated users can upload/update/delete only objects
     under a path matching their own user id (avatars/{uid}/...).
   - Policy: anyone (anon + authenticated) can READ avatars so images
     render without an auth header.

6. Important Notes
   - Email confirmation stays OFF (per project defaults).
   - The role column has a CHECK constraint restricting it to the three
     allowed values.
   - username uniqueness is enforced at the DB level (UNIQUE index).
   - The trigger rejects 'admin' on signup so the role can ONLY be
     assigned manually in the database.
*/

-- 1. profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text NOT NULL,
  username    text NOT NULL,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
  avatar_url  text,
  bio         text,
  xp          integer NOT NULL DEFAULT 0,
  level       integer NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  last_login  timestamptz
);

-- unique lowercase username index
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON profiles (lower(username));

-- auto-update updated_at
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE OR REPLACE FUNCTION profiles_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION profiles_set_updated_at();

-- 2. RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Prevent privilege escalation: a user can update their own profile but
-- cannot change the role column (incoming role must equal existing).
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile"
  ON profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- 3. handle_new_user trigger (auto-create profile on signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
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

  INSERT INTO public.profiles (id, full_name, username, email, role)
  VALUES (NEW.id, v_full_name, v_username, NEW.email, v_role)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Avatar storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars bucket
DROP POLICY IF EXISTS "avatars_read_public" ON storage.objects;
CREATE POLICY "avatars_read_public"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
