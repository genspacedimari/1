import { supabase } from '@/services/supabaseClient';

export interface ExamCompletionStatus {
  completed: number;
  total: number;
  allDone: boolean;
}

export async function getExamCompletionStatus(examId: string): Promise<ExamCompletionStatus> {
  const { data, error } = await supabase.rpc('get_exam_completion_status', { p_exam_id: examId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { completed_count: number; total_count: number } | undefined;
  const completed = row?.completed_count ?? 0;
  const total = row?.total_count ?? 0;
  return { completed, total, allDone: total > 0 && completed >= total };
}

export interface ExamLeaderboardEntry {
  studentId: string;
  fullName: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  timeUsedSeconds: number;
  submittedAt: string;
}

/** Empty array means either nobody's finished submitting yet, or the caller isn't authorized — see get_exam_leaderboard(). */
export async function getExamLeaderboard(examId: string): Promise<ExamLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_exam_leaderboard', { p_exam_id: examId });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    studentId: r.student_id,
    fullName: r.full_name,
    score: Number(r.score),
    correctCount: r.correct_count,
    wrongCount: r.wrong_count,
    timeUsedSeconds: r.time_used_seconds,
    submittedAt: r.submitted_at,
  }));
}
