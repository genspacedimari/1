CREATE POLICY "select_published_exams_for_students" ON exams FOR SELECT
  TO authenticated USING (status = 'published');

CREATE POLICY "select_exam_questions_for_students" ON exam_questions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM exams e WHERE e.id = exam_questions.exam_id AND e.status = 'published')
  );

CREATE POLICY "select_questions_for_published_exams" ON questions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM exam_questions eq
      JOIN exams e ON e.id = eq.exam_id
      WHERE eq.question_id = questions.id AND e.status = 'published'
    )
  );

CREATE POLICY "select_options_for_published_exams" ON question_options FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM exam_questions eq
      JOIN exams e ON e.id = eq.exam_id
      WHERE eq.question_id = question_options.question_id AND e.status = 'published'
    )
  );

CREATE POLICY "select_images_for_published_exams" ON question_images FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM exam_questions eq
      JOIN exams e ON e.id = eq.exam_id
      WHERE eq.question_id = question_images.question_id AND e.status = 'published'
    )
  );

CREATE POLICY "select_ladder_for_published_exams" ON ladder_questions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM exam_questions eq
      JOIN exams e ON e.id = eq.exam_id
      WHERE eq.question_id = ladder_questions.question_id AND e.status = 'published'
    )
  );