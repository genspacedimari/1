Full Supabase schema + RLS policies (profiles, projects, materials, exams,
questions, exam_attempts, scores, badges, achievements, leaderboards,
notifications) were finalized in the architecture blueprint and should be
run once, directly in the Supabase SQL editor, before wiring auth-dependent
features in a later phase. Keeping the .sql migration file(s) in this folder
once that's done keeps schema history versioned alongside the app code.
