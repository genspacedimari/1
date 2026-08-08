/*
  # Update exam scheduling model

  1. Changes
    - Add `exam_date` (date) — the calendar date the exam takes place
    - Add `start_time` (text, "HH:mm") — the time the exam starts
    - Add `late_join_minutes` (integer) — minutes after start time students may still join
    - Migrate any existing `start_date` values into `exam_date` / `start_time`
    - Drop `start_date` and `end_date` — end time is never stored, it is always
      calculated on the fly from `start_time` + `duration_minutes`
    - Add range constraints for `duration_minutes` (5-300) and `late_join_minutes` (0-60)

  2. Notes
    - This only affects the `exams` table (exam scheduling). No other tables are touched.
*/

ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_date date;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS start_time text;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS late_join_minutes integer NOT NULL DEFAULT 0;

-- Best-effort migration of previously entered schedule data
UPDATE exams
SET exam_date = start_date::date,
    start_time = to_char(start_date, 'HH24:MI')
WHERE start_date IS NOT NULL AND exam_date IS NULL;

ALTER TABLE exams DROP COLUMN IF EXISTS start_date;
ALTER TABLE exams DROP COLUMN IF EXISTS end_date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exams_duration_minutes_range'
  ) THEN
    ALTER TABLE exams ADD CONSTRAINT exams_duration_minutes_range
      CHECK (duration_minutes >= 5 AND duration_minutes <= 300);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exams_late_join_minutes_range'
  ) THEN
    ALTER TABLE exams ADD CONSTRAINT exams_late_join_minutes_range
      CHECK (late_join_minutes >= 0 AND late_join_minutes <= 60);
  END IF;
END $$;
