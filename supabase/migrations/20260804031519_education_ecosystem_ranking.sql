/* ============================================================
   Education Ecosystem & Competitive Ranking
   ============================================================
   Adds: schools table, profiles.school_id, exams.visibility +
   school_id, classes.school_id, school_requests, leaderboard
   ranking_score + accuracy, class_students student-side INSERT.
   All backward compatible — no existing columns dropped.
   ============================================================ */

-- 1. SCHOOLS table
CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL DEFAULT '',
  province text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT 'Indonesia',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schools_read_all" ON schools FOR SELECT TO authenticated USING (true);
CREATE POLICY "schools_manage_admin" ON schools FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE INDEX idx_schools_name_lower ON schools (lower(name));

-- 2. SCHOOL_REQUESTS table (students/teachers can request new schools)
CREATE TABLE IF NOT EXISTS school_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  city text NOT NULL DEFAULT '',
  province text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT 'Indonesia',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id)
);
ALTER TABLE school_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_requests_insert_own" ON school_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = requested_by);
CREATE POLICY "school_requests_select_own" ON school_requests FOR SELECT
  TO authenticated USING (auth.uid() = requested_by);
CREATE POLICY "school_requests_manage_admin" ON school_requests FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. PROFILES: add school_id (nullable — backward compatible)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON profiles (school_id);

-- 4. CLASSES: add school_id
ALTER TABLE classes ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_classes_school_id ON classes (school_id);

-- 5. EXAMS: add visibility + school_id
ALTER TABLE exams ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'selected_class'
  CHECK (visibility IN ('public','school','selected_class'));
ALTER TABLE exams ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_exams_school_id ON exams (school_id);

-- 6. LEADERBOARDS: add ranking_score + accuracy for weighted ranking
ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS ranking_score double precision NOT NULL DEFAULT 0;
ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS accuracy double precision NOT NULL DEFAULT 0;
ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_leaderboards_scope_ranking ON leaderboards (scope, scope_id, ranking_score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboards_school ON leaderboards (school_id, scope, ranking_score DESC);

-- 7. class_students: let students self-join via join code
-- (Existing teacher policies remain; we add a student INSERT policy)
CREATE POLICY "class_students_insert_student_self"
  ON class_students FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = class_id
      AND c.join_code IS NOT NULL
    )
    AND auth.uid() = student_id
  );

-- Students can read their own class membership rows
CREATE POLICY "class_students_select_own_student"
  ON class_students FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

-- 8. Students can read published exams (already have select_published_exams)
-- Add a policy so students can read classes they belong to
CREATE POLICY "classes_select_for_member_student"
  ON classes FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM class_students cs WHERE cs.class_id = classes.id AND cs.student_id = auth.uid())
  );