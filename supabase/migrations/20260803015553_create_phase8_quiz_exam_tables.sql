/*
# Phase 8: Quiz & Exam Engine tables

New tables:
  official_quizzes, official_questions, practice_attempts,
  exam_attempts, leaderboards, student_progress

All student-facing tables are scoped to auth.uid(). Teachers can read
their own exam's attempts via the exam ownership chain.
*/

-- ============================================================
-- 1. official_quizzes (published by GENSPACE, readable by all authed)
-- ============================================================
CREATE TABLE IF NOT EXISTS official_quizzes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  description     text,
  thumbnail_url   text,
  difficulty      text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_count  integer NOT NULL DEFAULT 0,
  estimated_minutes integer NOT NULL DEFAULT 10,
  xp_reward       integer NOT NULL DEFAULT 50,
  category        text NOT NULL DEFAULT 'PLC Basic',
  quiz_data       jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_published    boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE official_quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "official_quizzes_read" ON official_quizzes FOR SELECT
  TO authenticated USING (is_published = true);

-- ============================================================
-- 2. official_questions (unused if quiz_data embeds questions, but
--    provided for structured per-question storage if needed)
-- ============================================================
CREATE TABLE IF NOT EXISTS official_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     uuid NOT NULL REFERENCES official_quizzes(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('multiple_choice', 'image', 'ladder')),
  question    text NOT NULL,
  difficulty  text NOT NULL DEFAULT 'medium',
  points      integer NOT NULL DEFAULT 10,
  explanation text,
  options     jsonb NOT NULL DEFAULT '[]'::jsonb,
  image_urls  jsonb NOT NULL DEFAULT '[]'::jsonb,
  ladder_data jsonb,
  sort_order  integer NOT NULL DEFAULT 0
);

ALTER TABLE official_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "official_questions_read" ON official_questions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM official_quizzes q WHERE q.id = quiz_id AND q.is_published = true)
  );

-- ============================================================
-- 3. practice_attempts (student's own practice history)
-- ============================================================
CREATE TABLE IF NOT EXISTS practice_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category        text NOT NULL,
  difficulty      text NOT NULL DEFAULT 'medium',
  score           integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  correct_count   integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  completed_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE practice_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practice_attempts_own" ON practice_attempts FOR SELECT
  TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "practice_attempts_insert" ON practice_attempts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = student_id);

-- ============================================================
-- 4. exam_attempts (student exam submissions)
-- ============================================================
CREATE TABLE IF NOT EXISTS exam_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id         uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score           numeric NOT NULL DEFAULT 0,
  correct_count   integer NOT NULL DEFAULT 0,
  wrong_count     integer NOT NULL DEFAULT 0,
  time_used_seconds integer NOT NULL DEFAULT 0,
  remaining_seconds integer,
  status          text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  answers         jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at      timestamptz NOT NULL DEFAULT now(),
  submitted_at    timestamptz,
  attempt_number  integer NOT NULL DEFAULT 1,
  xp_earned       integer NOT NULL DEFAULT 0
);

ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;

-- Students can read/insert/update their own attempts
CREATE POLICY "exam_attempts_select_student" ON exam_attempts FOR SELECT
  TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "exam_attempts_insert_student" ON exam_attempts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "exam_attempts_update_student" ON exam_attempts FOR UPDATE
  TO authenticated USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

-- Teachers can read attempts for their exams
CREATE POLICY "exam_attempts_select_teacher" ON exam_attempts FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM exams e WHERE e.id = exam_id AND e.teacher_id = auth.uid())
  );

-- ============================================================
-- 5. leaderboards (materialized view-like table for fast reads)
-- ============================================================
CREATE TABLE IF NOT EXISTS leaderboards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope         text NOT NULL CHECK (scope IN ('class', 'weekly', 'monthly', 'global')),
  scope_id      text,
  student_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_name  text NOT NULL,
  total_xp      integer NOT NULL DEFAULT 0,
  exam_count    integer NOT NULL DEFAULT 0,
  avg_score     numeric NOT NULL DEFAULT 0,
  rank          integer,
  period_start  timestamptz,
  period_end    timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leaderboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leaderboards_read" ON leaderboards FOR SELECT
  TO authenticated USING (true);

-- Students can upsert their own row
CREATE POLICY "leaderboards_upsert_own" ON leaderboards FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "leaderboards_update_own" ON leaderboards FOR UPDATE
  TO authenticated USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

-- ============================================================
-- 6. student_progress (aggregated XP and level per student)
-- ============================================================
CREATE TABLE IF NOT EXISTS student_progress (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp       integer NOT NULL DEFAULT 0,
  level          integer NOT NULL DEFAULT 1,
  exams_completed integer NOT NULL DEFAULT 0,
  quizzes_completed integer NOT NULL DEFAULT 0,
  practice_completed integer NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_progress_own" ON student_progress FOR SELECT
  TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "student_progress_upsert" ON student_progress FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "student_progress_update" ON student_progress FOR UPDATE
  TO authenticated USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_practice_attempts_student ON practice_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam ON exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student ON exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_leaderboards_scope ON leaderboards(scope, scope_id);
CREATE INDEX IF NOT EXISTS idx_leaderboards_student ON leaderboards(student_id);

-- ============================================================
-- updated_at trigger for student_progress
-- ============================================================
DROP TRIGGER IF EXISTS student_progress_updated_at ON student_progress;
CREATE TRIGGER student_progress_updated_at BEFORE UPDATE ON student_progress
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
