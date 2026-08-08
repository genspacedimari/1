-- ============================================================
-- Class & Exam Flow Revision
-- ============================================================
--
-- Goals:
-- 1. Exams can be linked to specific classes (not just "any class by this teacher")
-- 2. Visibility options: 'school' (Community) or 'selected_class' (Class)
-- 3. 'selected_class' supports: specific class(es) OR all classes
-- 4. Remove 'public' visibility (no longer needed)
--
-- Schema changes:
-- - exam_classes junction table (exam_id, class_id) for specific class assignments
-- - exam.visibility stays as text: 'school' | 'selected_class'
-- - exam.target_all_classes boolean: when true + visibility=selected_class,
--   exam targets ALL classes by this teacher (no junction rows needed)

CREATE TABLE IF NOT EXISTS public.exam_classes (
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (exam_id, class_id)
);

ALTER TABLE public.exam_classes ENABLE ROW LEVEL SECURITY;

-- Add target_all_classes column to exams
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS target_all_classes boolean NOT NULL DEFAULT false;

-- ============================================================
-- RLS for exam_classes
-- ============================================================

-- Teachers can read exam_classes for their own exams
CREATE POLICY "exam_classes_select_teacher"
  ON public.exam_classes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.exams e
    WHERE e.id = exam_id AND e.teacher_id = auth.uid()
  ));

-- Students can read exam_classes for exams they can access
-- (either school-visible or they're in the linked class)
CREATE POLICY "exam_classes_select_student"
  ON public.exam_classes FOR SELECT
  TO authenticated
  USING (
    -- Student is in the linked class
    public.is_student_in_class(class_id)
    OR
    -- Exam is school-visible and student is in the same school
    (EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_id
        AND e.visibility = 'school'
        AND e.school_id = public.get_my_school_id()
    ))
    OR
    -- Exam targets all classes and student is in any class by this teacher
    (EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_id
        AND e.target_all_classes = true
        AND e.visibility = 'selected_class'
        AND EXISTS (
          SELECT 1 FROM public.class_students cs
          JOIN public.classes c ON c.id = cs.class_id
          WHERE cs.student_id = auth.uid() AND c.teacher_id = e.teacher_id
        )
    ))
  );

-- Teachers can insert/delete exam_classes for their own exams
CREATE POLICY "exam_classes_insert_teacher"
  ON public.exam_classes FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exams e
    WHERE e.id = exam_id AND e.teacher_id = auth.uid()
  ));

CREATE POLICY "exam_classes_delete_teacher"
  ON public.exam_classes FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.exams e
    WHERE e.id = exam_id AND e.teacher_id = auth.uid()
  ));

-- ============================================================
-- Update exams RLS: allow students to see published exams
-- that are visible to them (school or their class)
-- ============================================================

-- First check existing policies on exams
DO $$
DECLARE
  pol_exists boolean;
BEGIN
  -- Check if students_read_published_exams policy already exists
  SELECT EXISTS(
    SELECT 1 FROM pg_policy WHERE polname = 'students_read_published_exams' AND polrelid = 'public.exams'::regclass
  ) INTO pol_exists;
  
  IF NOT pol_exists THEN
    CREATE POLICY "students_read_published_exams"
      ON public.exams FOR SELECT
      TO authenticated
      USING (
        status = 'published' AND (
          -- School-visible: student in same school
          (visibility = 'school' AND school_id = public.get_my_school_id())
          OR
          -- Selected class with target_all_classes: student in any class by this teacher
          (visibility = 'selected_class' AND target_all_classes = true AND EXISTS (
            SELECT 1 FROM public.class_students cs
            JOIN public.classes c ON c.id = cs.class_id
            WHERE cs.student_id = auth.uid() AND c.teacher_id = exams.teacher_id
          ))
          OR
          -- Selected class with specific classes: student in one of the linked classes
          (visibility = 'selected_class' AND target_all_classes = false AND EXISTS (
            SELECT 1 FROM public.exam_classes ec
            JOIN public.class_students cs ON cs.class_id = ec.class_id
            WHERE ec.exam_id = exams.id AND cs.student_id = auth.uid()
          ))
        )
      );
  END IF;
END $$;
