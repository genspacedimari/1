-- Fix circular RLS recursion between classes and class_students that makes
-- ALL SELECT queries on profiles fail (including select_own_profile).
--
-- The recursion:
--   profiles.select_student_profiles_for_teacher
--     → class_students (select_own_class_students)
--       → classes (classes_select_for_member_student)
--         → class_students (select_own_class_students) → ∞
--
-- Fix: replace the recursive subquery in select_student_profiles_for_teacher
-- with a SECURITY DEFINER function that bypasses RLS, breaking the cycle.

CREATE OR REPLACE FUNCTION public.is_teacher_of_student(p_student_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Bypasses RLS to avoid infinite recursion.
  -- Returns true if the current auth.uid() is a teacher who has the given
  -- student in one of their classes, or whose exam the student has attempted.
  SELECT EXISTS (
    SELECT 1
    FROM class_students cs
    JOIN classes c ON c.id = cs.class_id
    WHERE cs.student_id = p_student_uuid
      AND c.teacher_id = auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM exam_attempts ea
    JOIN exams e ON e.id = ea.exam_id
    WHERE ea.student_id = p_student_uuid
      AND e.teacher_id = auth.uid()
  );
$$;

-- Drop the recursive policy and replace with one that uses the function
DROP POLICY IF EXISTS select_student_profiles_for_teacher ON public.profiles;

CREATE POLICY "select_student_profiles_for_teacher"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_teacher_of_student(id));
