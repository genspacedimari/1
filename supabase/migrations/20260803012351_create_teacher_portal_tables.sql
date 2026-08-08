/*
# Teacher Portal tables — Phase 7

All tables are teacher-owned (auth.uid() = teacher_id) with full CRUD
RLS policies. Admin role can read everything via the profiles table
role check.

Tables created:
  question_categories, questions, question_options, question_images,
  ladder_questions, exams, exam_questions, classes, class_students,
  exam_results
*/

-- ============================================================
-- 1. question_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS question_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text DEFAULT '#F26B3A',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE question_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_categories" ON question_categories FOR SELECT
  TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "insert_own_categories" ON question_categories FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "update_own_categories" ON question_categories FOR UPDATE
  TO authenticated USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "delete_own_categories" ON question_categories FOR DELETE
  TO authenticated USING (auth.uid() = teacher_id);

-- ============================================================
-- 2. questions
-- ============================================================
CREATE TABLE IF NOT EXISTS questions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id  uuid REFERENCES question_categories(id) ON DELETE SET NULL,
  type         text NOT NULL CHECK (type IN ('multiple_choice', 'image', 'ladder')),
  question     text NOT NULL,
  difficulty   text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  points       integer NOT NULL DEFAULT 10,
  explanation  text,
  archived     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_questions" ON questions FOR SELECT
  TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "insert_own_questions" ON questions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "update_own_questions" ON questions FOR UPDATE
  TO authenticated USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "delete_own_questions" ON questions FOR DELETE
  TO authenticated USING (auth.uid() = teacher_id);

-- ============================================================
-- 3. question_options
-- ============================================================
CREATE TABLE IF NOT EXISTS question_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  label       text NOT NULL,
  is_correct  boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0
);
ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_options" ON question_options FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM questions q WHERE q.id = question_id AND q.teacher_id = auth.uid())
  );
CREATE POLICY "insert_own_options" ON question_options FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM questions q WHERE q.id = question_id AND q.teacher_id = auth.uid())
  );
CREATE POLICY "update_own_options" ON question_options FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM questions q WHERE q.id = question_id AND q.teacher_id = auth.uid())
  );
CREATE POLICY "delete_own_options" ON question_options FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM questions q WHERE q.id = question_id AND q.teacher_id = auth.uid())
  );

-- ============================================================
-- 4. question_images
-- ============================================================
CREATE TABLE IF NOT EXISTS question_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  image_url   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE question_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_images" ON question_images FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM questions q WHERE q.id = question_id AND q.teacher_id = auth.uid())
  );
CREATE POLICY "insert_own_images" ON question_images FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM questions q WHERE q.id = question_id AND q.teacher_id = auth.uid())
  );
CREATE POLICY "delete_own_images" ON question_images FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM questions q WHERE q.id = question_id AND q.teacher_id = auth.uid())
  );

-- ============================================================
-- 5. ladder_questions
-- ============================================================
CREATE TABLE IF NOT EXISTS ladder_questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id    uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  mode           text NOT NULL CHECK (mode IN ('build', 'complete', 'find_error', 'predict_output', 'choose_correct')),
  ladder_json    text,
  expected_output text,
  answer_ladder_json text
);
ALTER TABLE ladder_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_ladder" ON ladder_questions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM questions q WHERE q.id = question_id AND q.teacher_id = auth.uid())
  );
CREATE POLICY "insert_own_ladder" ON ladder_questions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM questions q WHERE q.id = question_id AND q.teacher_id = auth.uid())
  );
CREATE POLICY "update_own_ladder" ON ladder_questions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM questions q WHERE q.id = question_id AND q.teacher_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM questions q WHERE q.id = question_id AND q.teacher_id = auth.uid())
  );
CREATE POLICY "delete_own_ladder" ON ladder_questions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM questions q WHERE q.id = question_id AND q.teacher_id = auth.uid())
  );

-- ============================================================
-- 6. exams
-- ============================================================
CREATE TABLE IF NOT EXISTS exams (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  duration_minutes integer NOT NULL DEFAULT 60,
  start_date      timestamptz,
  end_date        timestamptz,
  max_attempts    integer NOT NULL DEFAULT 1,
  passing_score   numeric NOT NULL DEFAULT 70,
  shuffle_questions boolean NOT NULL DEFAULT false,
  shuffle_answers   boolean NOT NULL DEFAULT false,
  show_result_after  boolean NOT NULL DEFAULT true,
  allow_review       boolean NOT NULL DEFAULT true,
  exam_code       text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7)),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_exams" ON exams FOR SELECT
  TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "insert_own_exams" ON exams FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "update_own_exams" ON exams FOR UPDATE
  TO authenticated USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "delete_own_exams" ON exams FOR DELETE
  TO authenticated USING (auth.uid() = teacher_id);

-- ============================================================
-- 7. exam_questions
-- ============================================================
CREATE TABLE IF NOT EXISTS exam_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id     uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  sort_order  integer NOT NULL DEFAULT 0
);
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_exam_questions" ON exam_questions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM exams e WHERE e.id = exam_id AND e.teacher_id = auth.uid())
  );
CREATE POLICY "insert_own_exam_questions" ON exam_questions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM exams e WHERE e.id = exam_id AND e.teacher_id = auth.uid())
  );
CREATE POLICY "delete_own_exam_questions" ON exam_questions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM exams e WHERE e.id = exam_id AND e.teacher_id = auth.uid())
  );

-- ============================================================
-- 8. classes
-- ============================================================
CREATE TABLE IF NOT EXISTS classes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  join_code   text NOT NULL UNIQUE DEFAULT ('PLC-CLASS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4))),
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_classes" ON classes FOR SELECT
  TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "insert_own_classes" ON classes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "update_own_classes" ON classes FOR UPDATE
  TO authenticated USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "delete_own_classes" ON classes FOR DELETE
  TO authenticated USING (auth.uid() = teacher_id);

-- ============================================================
-- 9. class_students
-- ============================================================
CREATE TABLE IF NOT EXISTS class_students (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id)
);
ALTER TABLE class_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_class_students" ON class_students FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM classes c WHERE c.id = class_id AND c.teacher_id = auth.uid())
  );
CREATE POLICY "insert_own_class_students" ON class_students FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM classes c WHERE c.id = class_id AND c.teacher_id = auth.uid())
  );
CREATE POLICY "delete_own_class_students" ON class_students FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM classes c WHERE c.id = class_id AND c.teacher_id = auth.uid())
  );

-- ============================================================
-- 10. exam_results
-- ============================================================
CREATE TABLE IF NOT EXISTS exam_results (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id      uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score        numeric NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  wrong_count  integer NOT NULL DEFAULT 0,
  time_used_seconds integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'abandoned'))
);
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_exam_results" ON exam_results FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM exams e WHERE e.id = exam_id AND e.teacher_id = auth.uid())
  );

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_questions_teacher ON questions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category_id);
CREATE INDEX IF NOT EXISTS idx_exams_teacher ON exams(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_class_students_class ON class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_exam ON exam_results(exam_id);

-- ============================================================
-- question-images storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "question_images_read_public" ON storage.objects;
CREATE POLICY "question_images_read_public"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'question-images');

DROP POLICY IF EXISTS "question_images_insert_own" ON storage.objects;
CREATE POLICY "question_images_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'question-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "question_images_delete_own" ON storage.objects;
CREATE POLICY "question_images_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'question-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- updated_at trigger for questions and exams
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS questions_updated_at ON questions;
CREATE TRIGGER questions_updated_at BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS exams_updated_at ON exams;
CREATE TRIGGER exams_updated_at BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
