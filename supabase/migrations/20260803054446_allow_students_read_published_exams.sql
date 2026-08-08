/*
  # Allow students to read published exam content

  Adds ADDITIONAL permissive SELECT policies so any authenticated student
  can read published exams and their full question/option/image/ladder data.
  Existing owner-only policies are untouched — teachers still see their
  own drafts, and INSERT/UPDATE/DELETE remain owner-restricted.

  Permissive policies are OR'd with existing ones, so a row is visible if
  EITHER the owner policy OR the new published-exam policy matches.
*/

-- 1. exams: any authenticated user can SELECT a published exam
CREATE POLICY "select_published_exams"
  ON exams FOR SELECT TO authenticated
  USING (status = 'published');

-- 2. exam_questions: any authenticated user can SELECT rows belonging to a published exam
CREATE POLICY "select_published_exam_questions"
  ON exam_questions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exams e
      WHERE e.id = exam_questions.exam_id
        AND e.status = 'published'
    )
  );

-- 3. questions: any authenticated user can SELECT questions used in a published exam
CREATE POLICY "select_published_exam_questions_data"
  ON questions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM exam_questions eq
      JOIN exams e ON e.id = eq.exam_id
      WHERE eq.question_id = questions.id
        AND e.status = 'published'
    )
  );

-- 4. question_options: any authenticated user can SELECT options for questions in a published exam
CREATE POLICY "select_published_exam_options"
  ON question_options FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM exam_questions eq
      JOIN exams e ON e.id = eq.exam_id
      WHERE eq.question_id = question_options.question_id
        AND e.status = 'published'
    )
  );

-- 5. question_images: any authenticated user can SELECT images for questions in a published exam
CREATE POLICY "select_published_exam_images"
  ON question_images FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM exam_questions eq
      JOIN exams e ON e.id = eq.exam_id
      WHERE eq.question_id = question_images.question_id
        AND e.status = 'published'
    )
  );

-- 6. ladder_questions: any authenticated user can SELECT ladder data for questions in a published exam
CREATE POLICY "select_published_exam_ladder"
  ON ladder_questions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM exam_questions eq
      JOIN exams e ON e.id = eq.exam_id
      WHERE eq.question_id = ladder_questions.question_id
        AND e.status = 'published'
    )
  );