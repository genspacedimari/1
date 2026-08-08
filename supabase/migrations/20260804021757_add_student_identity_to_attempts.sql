/*
  # Student identity in exam_attempts + teacher can read student profiles

  1. Add student_name, student_email, class_name columns to exam_attempts
     so every submission stores the student's identity at submission time.
     This guarantees the teacher Results page always shows a real name,
     not "Unknown" — even if the profiles table RLS blocks cross-user reads.

  2. Add a permissive SELECT policy on profiles so teachers can read
     profiles of students who have submitted exams for their exams.
     This fixes the root cause of "Unknown" — the teacher's query to
     profiles was being blocked by the owner-only select_own_profile.
*/

ALTER TABLE exam_attempts
  ADD COLUMN IF NOT EXISTS student_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS student_email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS class_name text DEFAULT '';

-- Backfill from profiles for existing attempts
UPDATE exam_attempts a
SET
  student_name = COALESCE(p.full_name, ''),
  student_email = COALESCE(p.email, '')
FROM profiles p
WHERE p.id = a.student_id
  AND (a.student_name = '' OR a.student_name IS NULL);

-- Backfill class_name from class_students -> classes
UPDATE exam_attempts a
SET class_name = COALESCE(c.name, '')
FROM class_students cs
JOIN classes c ON c.id = cs.class_id
WHERE cs.student_id = a.student_id
  AND (a.class_name = '' OR a.class_name IS NULL);

-- Teacher can read profiles of students who submitted attempts for their exams
CREATE POLICY "select_student_profiles_for_teacher"
  ON profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM exam_attempts ea
      JOIN exams e ON e.id = ea.exam_id
      WHERE ea.student_id = profiles.id
        AND e.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM class_students cs
      JOIN classes c ON c.id = cs.class_id
      WHERE cs.student_id = profiles.id
        AND c.teacher_id = auth.uid()
    )
  );