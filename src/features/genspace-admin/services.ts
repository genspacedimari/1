import { supabase } from '@/services/supabaseClient';
import type { AdminQuiz, AdminQuizQuestion, BankQuestion, Competition, CompetitionParticipant, ProfileSearchResult } from './types';

function normalizeQuiz(row: any): AdminQuiz {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    difficulty: row.difficulty,
    category: row.category,
    questionCount: row.question_count ?? 0,
    estimatedMinutes: row.estimated_minutes ?? 10,
    xpReward: row.xp_reward ?? 50,
    quizData: Array.isArray(row.quiz_data) ? row.quiz_data : [],
    isPublished: Boolean(row.is_published),
    createdAt: row.created_at,
  };
}

/**
 * Fetches multiple-choice questions from ALL teachers' question banks,
 * for the "Import dari Bank Soal" feature on official/practice quiz and
 * competition editing. Requires the `questions_select_admin` etc. RLS
 * policies (20260813060000 migration) — without them this silently
 * returns [].
 *
 * Only `multiple_choice` type is returned since AdminQuizQuestion only
 * supports that shape; ladder/image-only questions are skipped.
 *
 * Each question is tagged with the Question Set (folder) it belongs to
 * — e.g. a batch imported from Excel — via `questionSetId`/
 * `questionSetName`, so the picker UI can group by folder instead of
 * listing hundreds of questions one by one. Standalone questions (never
 * placed in a set) come back with both fields null.
 */
export async function fetchImportableQuestions(): Promise<BankQuestion[]> {
  const { data: questions, error } = await supabase
    .from('questions')
    .select('*')
    .eq('type', 'multiple_choice')
    .eq('archived', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!questions || questions.length === 0) return [];

  const ids = questions.map((q: any) => q.id);
  const setIds = Array.from(new Set(questions.map((q: any) => q.question_set_id).filter(Boolean)));
  const [{ data: opts }, { data: imgs }, { data: sets }] = await Promise.all([
    supabase.from('question_options').select('*').in('question_id', ids),
    supabase.from('question_images').select('*').in('question_id', ids),
    setIds.length > 0
      ? supabase.from('question_sets').select('id, name').in('id', setIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const setNames = new Map((sets ?? []).map((s: any) => [s.id, s.name]));

  return questions.map((q: any) => ({
    id: crypto.randomUUID(), // fresh id — this becomes a new, independent copy inside the quiz
    type: 'multiple_choice' as const,
    question: q.question,
    difficulty: q.difficulty,
    points: q.points ?? 10,
    explanation: q.explanation ?? '',
    options: (opts ?? [])
      .filter((o: any) => o.question_id === q.id)
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((o: any) => ({ label: o.label, isCorrect: o.is_correct })),
    imageUrls: (imgs ?? [])
      .filter((i: any) => i.question_id === q.id)
      .map((i: any) => i.image_url),
    questionSetId: q.question_set_id ?? null,
    questionSetName: q.question_set_id ? (setNames.get(q.question_set_id) ?? 'Tanpa nama') : null,
  }));
}

export async function listOfficialQuizzes(): Promise<AdminQuiz[]> {
  const { data, error } = await supabase.from('official_quizzes').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeQuiz);
}

export async function saveOfficialQuiz(input: {
  id?: string;
  title: string;
  description: string;
  difficulty: AdminQuiz['difficulty'];
  category: string;
  estimatedMinutes: number;
  xpReward: number;
  quizData: AdminQuizQuestion[];
  isPublished: boolean;
}) {
  const payload = {
    title: input.title.trim(),
    description: input.description.trim() || null,
    difficulty: input.difficulty,
    category: input.category.trim() || 'PLC Basic',
    question_count: input.quizData.length,
    estimated_minutes: input.estimatedMinutes,
    xp_reward: input.xpReward,
    quiz_data: input.quizData,
    is_published: input.isPublished,
  };
  const query = input.id
    ? supabase.from('official_quizzes').update(payload).eq('id', input.id).select('*').single()
    : supabase.from('official_quizzes').insert(payload).select('*').single();
  const { data, error } = await query;
  if (error) throw error;
  return normalizeQuiz(data);
}

export async function deleteOfficialQuiz(id: string) {
  const { error } = await supabase.from('official_quizzes').delete().eq('id', id);
  if (error) throw error;
}

export async function listPracticeQuizzes(): Promise<AdminQuiz[]> {
  const { data, error } = await supabase.from('practice_quizzes').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeQuiz);
}

export async function savePracticeQuiz(input: {
  id?: string;
  title: string;
  description: string;
  difficulty: AdminQuiz['difficulty'];
  category: string;
  estimatedMinutes: number;
  xpReward: number;
  quizData: AdminQuizQuestion[];
  isPublished: boolean;
}) {
  const payload = {
    title: input.title.trim(),
    description: input.description.trim() || null,
    difficulty: input.difficulty,
    category: input.category.trim() || 'PLC Basic',
    question_count: input.quizData.length,
    estimated_minutes: input.estimatedMinutes,
    xp_reward: input.xpReward,
    quiz_data: input.quizData,
    is_published: input.isPublished,
  };
  const query = input.id
    ? supabase.from('practice_quizzes').update(payload).eq('id', input.id).select('*').single()
    : supabase.from('practice_quizzes').insert(payload).select('*').single();
  const { data, error } = await query;
  if (error) throw error;
  return normalizeQuiz(data);
}

export async function deletePracticeQuiz(id: string) {
  const { error } = await supabase.from('practice_quizzes').delete().eq('id', id);
  if (error) throw error;
}

export async function listCompetitions(): Promise<Competition[]> {
  const { data, error } = await supabase
    .from('genspace_competitions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    accessCode: r.access_code,
    status: r.status,
    startAt: r.start_at,
    endAt: r.end_at,
    maxParticipants: r.max_participants,
    badgePrefix: r.badge_prefix,
    durationMinutes: r.duration_minutes ?? 30,
    questionCount: r.question_count ?? 0,
    quizData: Array.isArray(r.quiz_data) ? r.quiz_data : [],
    createdAt: r.created_at,
  }));
}

export async function getCompetition(id: string): Promise<Competition | null> {
  const { data, error } = await supabase
    .from('genspace_competitions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r: any = data;
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    accessCode: r.access_code,
    status: r.status,
    startAt: r.start_at,
    endAt: r.end_at,
    maxParticipants: r.max_participants,
    badgePrefix: r.badge_prefix,
    durationMinutes: r.duration_minutes ?? 30,
    questionCount: r.question_count ?? 0,
    quizData: Array.isArray(r.quiz_data) ? r.quiz_data : [],
    createdAt: r.created_at,
  };
}

export async function saveCompetition(input: {
  id?: string;
  name: string;
  description: string;
  accessCode: string;
  status: Competition['status'];
  startAt: string | null;
  endAt: string | null;
  maxParticipants: number | null;
  badgePrefix: string;
  durationMinutes: number;
  quizData: AdminQuizQuestion[];
}) {
  const payload = {
    name: input.name.trim(),
    description: input.description.trim() || null,
    access_code: input.accessCode.trim().toUpperCase(),
    status: input.status,
    // input.startAt/endAt come from <input type="datetime-local">, e.g. "2026-08-14T08:47" —
    // no timezone info. `new Date(...)` parses that as LOCAL browser time (WIB etc.), and
    // .toISOString() converts it to the correct UTC instant before it hits Postgres. Without
    // this, Postgres treats the bare string as already being UTC, silently shifting the
    // schedule by the browser's UTC offset (e.g. 7 hours off for WIB).
    start_at: input.startAt ? new Date(input.startAt).toISOString() : null,
    end_at: input.endAt ? new Date(input.endAt).toISOString() : null,
    max_participants: input.maxParticipants,
    badge_prefix: input.badgePrefix.trim().toUpperCase(),
    duration_minutes: input.durationMinutes,
    question_count: input.quizData.length,
    quiz_data: input.quizData,
  };
  const query = input.id
    ? supabase.from('genspace_competitions').update(payload).eq('id', input.id).select('*').single()
    : supabase.from('genspace_competitions').insert(payload).select('*').single();
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function deleteCompetition(id: string) {
  const { error } = await supabase.from('genspace_competitions').delete().eq('id', id);
  if (error) throw error;
}

export async function searchProfiles(query: string): Promise<ProfileSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, email')
    .or(`full_name.ilike.%${q}%,username.ilike.%${q}%,email.ilike.%${q}%`)
    .order('full_name')
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, fullName: r.full_name, username: r.username, email: r.email }));
}

export async function awardCompetitionBadge(input: {
  competitionId: string;
  userId: string;
  placement: '1st' | '2nd' | '3rd';
  badgeCode: string;
  badgeName: string;
}) {
  const { data: badge, error: badgeError } = await supabase
    .from('genspace_badges')
    .upsert({ code: input.badgeCode, name: input.badgeName, competition_id: input.competitionId, placement: input.placement }, { onConflict: 'code' })
    .select('id')
    .single();
  if (badgeError) throw badgeError;

  const { error } = await supabase.from('genspace_badge_awards').upsert(
    { badge_id: badge.id, user_id: input.userId, competition_id: input.competitionId, placement: input.placement },
    { onConflict: 'badge_id,user_id' },
  );
  if (error) throw error;
}

/**
 * Fetches the ranked leaderboard for a competition — everyone who has
 * submitted a result, sorted by score desc then time used asc (faster
 * finisher wins a tie). Requires the `genspace_competition_participants`
 * table + `genspace_competition_participants_select_admin` RLS policy
 * (20260813070000 migration) — without them this silently returns [].
 *
 * Also cross-references `genspace_badge_awards` so the "Kelola" panel can
 * show which participants already hold a 1st/2nd/3rd badge for this
 * competition.
 */
export async function fetchCompetitionParticipants(competitionId: string): Promise<CompetitionParticipant[]> {
  const { data: rows, error } = await supabase
    .from('genspace_competition_participants')
    .select('*')
    .eq('competition_id', competitionId)
    .order('score', { ascending: false })
    .order('time_used_seconds', { ascending: true });
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const userIds = rows.map((r: any) => r.user_id);
  const [{ data: profiles }, { data: awards }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, username, email').in('id', userIds),
    supabase.from('genspace_badge_awards').select('user_id, placement').eq('competition_id', competitionId),
  ]);
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  const placementMap = new Map((awards ?? []).map((a: any) => [a.user_id, a.placement]));

  return rows.map((r: any, i: number) => {
    const p = profileMap.get(r.user_id);
    return {
      id: r.id,
      userId: r.user_id,
      fullName: p?.full_name ?? 'Unknown',
      username: p?.username ?? '-',
      email: p?.email ?? '-',
      score: r.score,
      correctCount: r.correct_count,
      wrongCount: r.wrong_count,
      timeUsedSeconds: r.time_used_seconds,
      submittedAt: r.submitted_at,
      rank: i + 1,
      badgePlacement: placementMap.get(r.user_id) ?? null,
    };
  });
}

/**
 * Awards 1st/2nd/3rd badges to the top 3 of a competition's leaderboard in
 * one click, instead of searching and clicking each winner manually.
 * Uses the same `awardCompetitionBadge` upsert under the hood, so
 * re-running it after new submissions come in just corrects the winners
 * (upsert on badge code / badge+user).
 */
export async function autoAssignCompetitionBadges(competitionId: string, badgePrefix: string): Promise<CompetitionParticipant[]> {
  const leaderboard = await fetchCompetitionParticipants(competitionId);
  const top3 = leaderboard.slice(0, 3);
  const placements: Array<'1st' | '2nd' | '3rd'> = ['1st', '2nd', '3rd'];
  for (let i = 0; i < top3.length; i++) {
    const placement = placements[i];
    const code = `${badgePrefix}-${placement.toUpperCase()}`;
    await awardCompetitionBadge({
      competitionId,
      userId: top3[i].userId,
      placement,
      badgeCode: code,
      badgeName: `${placement.toUpperCase()} ${badgePrefix}`,
    });
  }
  return top3;
}
