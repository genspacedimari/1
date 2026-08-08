/*
# Fix infinite RLS recursion on exams and exam_classes

## Problem
The `exams` table has a SELECT policy (`students_read_published_exams`) that
runs a subquery against `exam_classes`. The `exam_classes` table has SELECT
policies that run subqueries back against `exams`. When Postgres evaluates
either side, it applies RLS on the other table, which re-enters the same
cycle — producing "infinite recursion detected in policy for relation exams".

This blocked ALL writes that touched exams (creating questions, creating
exams, linking questions to exams) because the INSERT/UPDATE policies on
child tables (exam_questions, exam_classes) also reference exams, triggering
the same recursion.

## Fix
Replace the circular inline subqueries with SECURITY DEFINER helper functions
that read the tables with elevated (owner) privileges, bypassing RLS entirely.
This is the standard Supabase pattern for breaking policy recursion.

### New functions (all SECURITY DEFINER, STABLE, search_path = 'public')
1. `is_teacher_of_exam(exam_uuid)` — true if auth.uid() owns the exam.
2. `student_can_see_published_exam(exam_uuid)` — true if the current user
   is a student who should see a published exam (school visibility, all
   classes, or specific class link).
3. `student_can_see_exam_class(exam_uuid, class_uuid)` — true if the current
   user is a student who should see an exam_classes row.

### Policies rewritten
- `exams` `students_read_published_exams` → uses `student_can_see_published_exam(id)`
- `exam_classes` select/insert/delete teacher policies → use `is_teacher_of_exam(exam_id)`
- `exam_classes` select student policy → uses `student_can_see_exam_class(exam_id, class_id)`
- `exam_questions` select/insert/delete teacher policies → use `is_teacher_of_exam(exam_id)`

All other policies (simple `auth.uid() = teacher_id` checks, published-only
reads) are left untouched — they never caused recursion.
*/

-- ============================================================
-- 1. Helper functions (SECURITY DEFINER → bypass RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_teacher_of_exam(exam_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.exams
  WHERE id = exam_uuid AND teacher_id = auth.uid()
);
$$;

CREATE OR REPLACE FUNCTION public.student_can_see_published_exam(exam_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.exams e
  WHERE e.id = exam_uuid
    AND e.status = 'published'
    AND (
      (e.visibility = 'school' AND e.school_id = public.get_my_school_id())
      OR (
        e.visibility = 'selected_class'
        AND e.target_all_classes = true
        AND EXISTS (
          SELECT 1 FROM public.class_students cs
          JOIN public.classes c ON c.id = cs.class_id
          WHERE cs.student_id = auth.uid() AND c.teacher_id = e.teacher_id
        )
      )
      OR (
        e.visibility = 'selected_class'
        AND e.target_all_classes = false
        AND EXISTS (
          SELECT 1 FROM public.exam_classes ec
          JOIN public.class_students cs ON cs.class_id = ec.class_id
          WHERE ec.exam_id = e.id AND cs.student_id = auth.uid()
        )
      )
    )
);
$$;

CREATE OR REPLACE FUNCTION public.student_can_see_exam_class(exam_uuid uuid, class_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT
  public.is_student_in_class(class_uuid)
  OR EXISTS (
    SELECT 1 FROM public.exams e
    WHERE e.id = exam_uuid
      AND e.visibility = 'school'
      AND e.school_id = public.get_my_school_id()
  )
  OR EXISTS (
    SELECT 1 FROM public.exams e
    WHERE e.id = exam_uuid
      AND e.target_all_classes = true
      AND e.visibility = 'selected_class'
      AND EXISTS (
        SELECT 1 FROM public.class_students cs
        JOIN public.classes c ON c.id = cs.class_id
        WHERE cs.student_id = auth.uid() AND c.teacher_id = e.teacher_id
      )
  );
$$;

-- ============================================================
-- 2. exams: replace recursive student SELECT policy
-- ============================================================

DROP POLICY IF EXISTS "students_read_published_exams" ON exams;
CREATE POLICY "students_read_published_exams"
ON exams FOR SELECT
TO authenticated
USING (public.student_can_see_published_exam(id));

-- ============================================================
-- 3. exam_classes: replace all policies that referenced exams
-- ============================================================

DROP POLICY IF EXISTS "exam_classes_select_teacher" ON exam_classes;
CREATE POLICY "exam_classes_select_teacher"
ON exam_classes FOR SELECT
TO authenticated
USING (public.is_teacher_of_exam(exam_id));

DROP POLICY IF EXISTS "exam_classes_select_student" ON exam_classes;
CREATE POLICY "exam_classes_select_student"
ON exam_classes FOR SELECT
TO authenticated
USING (public.student_can_see_exam_class(exam_id, class_id));

DROP POLICY IF EXISTS "exam_classes_insert_teacher" ON exam_classes;
CREATE POLICY "exam_classes_insert_teacher"
ON exam_classes FOR INSERT
TO authenticated
WITH CHECK (public.is_teacher_of_exam(exam_id));

DROP POLICY IF EXISTS "exam_classes_delete_teacher" ON exam_classes;
CREATE POLICY "exam_classes_delete_teacher"
ON exam_classes FOR DELETE
TO authenticated
USING (public.is_teacher_of_exam(exam_id));

-- ============================================================
-- 4. exam_questions: replace policies that referenced exams
-- ============================================================

DROP POLICY IF EXISTS "select_own_exam_questions" ON exam_questions;
CREATE POLICY "select_own_exam_questions"
ON exam_questions FOR SELECT
TO authenticated
USING (public.is_teacher_of_exam(exam_id));

DROP POLICY IF EXISTS "insert_own_exam_questions" ON exam_questions;
CREATE POLICY "insert_own_exam_questions"
ON exam_questions FOR INSERT
TO authenticated
WITH CHECK (public.is_teacher_of_exam(exam_id));

DROP POLICY IF EXISTS "delete_own_exam_questions" ON exam_questions;
CREATE POLICY "delete_own_exam_questions"
ON exam_questions FOR DELETE
TO authenticated
USING (public.is_teacher_of_exam(exam_id));
