import { supabase } from '@/services/supabaseClient';
import { useAuthStore } from '@/stores/authStore';
import type { CompetitionInfo, CompetitionResult } from './types';

function getUserId(): string {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error('You must be signed in to join a competition.');
  return user.id;
}

/**
 * Validates an access code against `genspace_competitions` and returns the
 * competition (including its questions) if found. Requires the
 * `genspace_competitions_select_participants` RLS policy (20260813070000
 * migration) — without it this throws a permissions error for anyone who
 * isn't admin.
 */
export async function findCompetitionByCode(code: string): Promise<CompetitionInfo | null> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from('genspace_competitions')
    .select('*')
    .eq('access_code', trimmed)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  let myResult: CompetitionResult | null = null;
  const uid = useAuthStore.getState().user?.id;
  if (uid) {
    const { data: existing } = await supabase
      .from('genspace_competition_participants')
      .select('*')
      .eq('competition_id', data.id)
      .eq('user_id', uid)
      .maybeSingle();
    if (existing) myResult = await withRank(data.id, existing);
  }

  return {
    id: data.id,
    name: data.name,
    description: data.description ?? null,
    accessCode: data.access_code,
    status: data.status,
    startAt: data.start_at,
    endAt: data.end_at,
    maxParticipants: data.max_participants,
    badgePrefix: data.badge_prefix,
    durationMinutes: data.duration_minutes ?? 30,
    quizData: Array.isArray(data.quiz_data) ? data.quiz_data : [],
    myResult,
  };
}

async function withRank(competitionId: string, row: any): Promise<CompetitionResult> {
  const { data: rankRow } = await supabase.rpc('get_competition_rank', { p_competition_id: competitionId }).maybeSingle();
  return {
    score: row.score,
    correctCount: row.correct_count,
    wrongCount: row.wrong_count,
    timeUsedSeconds: row.time_used_seconds,
    rank: (rankRow as any)?.rank ?? null,
    totalParticipants: (rankRow as any)?.total ?? 0,
  };
}

/**
 * Submits a student's final competition result. One-shot — the
 * `UNIQUE (competition_id, user_id)` constraint blocks a second
 * submission, so a competition has no retakes (matches how it's presented
 * to students: an official one-time challenge, not practice).
 */
export async function submitCompetitionResult(input: {
  competitionId: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  timeUsedSeconds: number;
  answers: Record<string, number>;
}): Promise<CompetitionResult> {
  const uid = getUserId();
  const { data, error } = await supabase
    .from('genspace_competition_participants')
    .insert({
      competition_id: input.competitionId,
      user_id: uid,
      score: input.score,
      correct_count: input.correctCount,
      wrong_count: input.wrongCount,
      time_used_seconds: input.timeUsedSeconds,
      answers: input.answers,
    })
    .select('*')
    .single();
  if (error) throw error;
  return withRank(input.competitionId, data);
}
