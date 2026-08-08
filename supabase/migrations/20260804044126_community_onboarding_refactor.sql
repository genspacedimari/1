/*
# Community & Onboarding Refactor

## Overview
Refactors the onboarding flow so users register WITHOUT choosing a school.
After login, teachers create/join a "Community" (school) via a welcome wizard,
and students join a community using an invite code from their teacher.

## Changes

### 1. schools table — new columns
- `owner_teacher_id` (uuid, nullable) — the teacher who created/owns the community.
- `invite_code` (text, unique, nullable) — human-readable code like "GEN-BUMI-8F4K".
- `invite_link` (text, nullable) — full invite URL derived from invite_code.

### 2. profiles table
- `school_id` is already nullable — no change needed. Stays nullable so users
  can register without a community and join one later.

### 3. classes table
- `school_id` is already present — no structural change. Teachers' classes
  inherit school_id from the teacher's profile at insert time (app-level).

### 4. exams table
- `school_id` already present (nullable). `visibility` already present.
- No structural change needed.

### 5. Indexes
- Index on `schools.invite_code` for fast lookups.
- Index on `schools.owner_teacher_id`.

### 6. RLS
- schools: authenticated can SELECT (to search/join). Only owner can UPDATE/DELETE.
- school_requests: keep existing (students can INSERT, admins can SELECT).

## Backward Compatibility
- No tables renamed. `school_id` columns remain. Existing rows unaffected.
- Existing profiles with school_id keep their value.
- All new columns are nullable so old rows are valid.
*/

-- 1. Add columns to schools
ALTER TABLE schools ADD COLUMN IF NOT EXISTS owner_teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS invite_code text;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS invite_link text;

-- 2. Unique constraint on invite_code (partial — only non-null)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schools_invite_code_key'
  ) THEN
    ALTER TABLE schools ADD CONSTRAINT schools_invite_code_key UNIQUE (invite_code);
  END IF;
END $$;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_schools_invite_code ON schools(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schools_owner_teacher_id ON schools(owner_teacher_id) WHERE owner_teacher_id IS NOT NULL;

-- 4. RLS policies for schools
-- Enable RLS (may already be enabled)
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user can search/view schools (to join a community)
DROP POLICY IF EXISTS "select_schools_any_authenticated" ON schools;
CREATE POLICY "select_schools_any_authenticated"
ON schools FOR SELECT
TO authenticated
USING (true);

-- INSERT: any authenticated teacher can create a school/community
DROP POLICY IF EXISTS "insert_schools_teacher" ON schools;
CREATE POLICY "insert_schools_teacher"
ON schools FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_teacher_id);

-- UPDATE: only the owner teacher can update the school
DROP POLICY IF EXISTS "update_schools_owner" ON schools;
CREATE POLICY "update_schools_owner"
ON schools FOR UPDATE
TO authenticated
USING (auth.uid() = owner_teacher_id)
WITH CHECK (auth.uid() = owner_teacher_id);

-- DELETE: only the owner teacher can delete the school
DROP POLICY IF EXISTS "delete_schools_owner" ON schools;
CREATE POLICY "delete_schools_owner"
ON schools FOR DELETE
TO authenticated
USING (auth.uid() = owner_teacher_id);

-- 5. Allow students to UPDATE their own profile.school_id (to join a community)
-- The existing profile policies likely cover this, but ensure it.
DROP POLICY IF EXISTS "update_own_profile_school" ON profiles;
CREATE POLICY "update_own_profile_school"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
