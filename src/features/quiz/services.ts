import { supabase } from '@/services/supabaseClient';
import { useAuthStore } from '@/stores/authStore';
import type {
  OfficialQuiz, QuizQuestion, ExamInfo, ExamAttempt,
  PracticeAttempt, LeaderboardEntry, StudentProgress, QuizOption, LadderTestCase,
} from './types';

function getStudentId(): string {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// ============================================================
// Exam visibility access check
// ============================================================

async function checkExamAccess(
  examId: string,
  visibility: string,
  examSchoolId: string | null,
  studentId: string
): Promise<string | null> {
  if (visibility === 'public') return null;

  if (visibility === 'school') {
    if (!examSchoolId) return 'You are not allowed to join this exam.';
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', studentId)
      .maybeSingle();
    const studentSchoolId = (profile as { school_id: string | null } | null)?.school_id;
    if (studentSchoolId !== examSchoolId) {
      return 'You are not allowed to join this exam.';
    }
    return null;
  }

  // selected_class — check if student is in any class belonging to the exam's teacher
  const { data: examRow } = await supabase
    .from('exams')
    .select('teacher_id')
    .eq('id', examId)
    .maybeSingle();
  const teacherId = (examRow as { teacher_id: string } | null)?.teacher_id;
  if (!teacherId) return 'You are not allowed to join this exam.';

  const { data: teacherClasses } = await supabase
    .from('classes')
    .select('id')
    .eq('teacher_id', teacherId);
  const classIdList = (teacherClasses ?? []).map((r) => (r as { id: string }).id);
  if (classIdList.length === 0) return 'You are not allowed to join this exam.';

  const { count: classCount } = await supabase
    .from('class_students')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .in('class_id', classIdList);
  if ((classCount ?? 0) === 0) {
    return 'You are not allowed to join this exam.';
  }
  return null;
}

// ============================================================
// Official Quizzes
// ============================================================

interface OfficialQuizRow {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  difficulty: string;
  question_count: number;
  estimated_minutes: number;
  xp_reward: number;
  category: string;
  quiz_data: unknown;
  created_at: string;
}

function rowToQuiz(row: OfficialQuizRow): OfficialQuiz {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    thumbnailUrl: row.thumbnail_url,
    difficulty: row.difficulty as OfficialQuiz['difficulty'],
    questionCount: row.question_count,
    estimatedMinutes: row.estimated_minutes,
    xpReward: row.xp_reward,
    category: row.category,
    quizData: Array.isArray(row.quiz_data) ? (row.quiz_data as QuizQuestion[]) : [],
    createdAt: row.created_at,
  };
}

export async function fetchOfficialQuizzes(): Promise<OfficialQuiz[]> {
  const { data, error } = await supabase
    .from('official_quizzes')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as OfficialQuizRow[]).map(rowToQuiz);
}

export async function fetchPracticeQuizzes(): Promise<OfficialQuiz[]> {
  const { data, error } = await supabase
    .from('practice_quizzes')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    thumbnailUrl: row.thumbnail_url,
    difficulty: row.difficulty as OfficialQuiz['difficulty'],
    questionCount: row.question_count,
    estimatedMinutes: row.estimated_minutes,
    xpReward: row.xp_reward,
    category: row.category,
    quizData: Array.isArray(row.quiz_data) ? (row.quiz_data as QuizQuestion[]) : [],
    createdAt: row.created_at,
  }));
}

export async function fetchOfficialQuiz(id: string): Promise<OfficialQuiz | null> {
  const { data, error } = await supabase
    .from('official_quizzes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToQuiz(data as OfficialQuizRow);
}

// ============================================================
// Teacher Exam lookup by code
// ============================================================

export async function findExamByCode(code: string): Promise<ExamInfo | null> {
  const { data: exam, error } = await supabase
    .from('exams')
    .select(`
      id, name, description, duration_minutes, exam_date, start_time, late_join_minutes,
      max_attempts, passing_score,
      shuffle_questions, shuffle_answers, show_result_after, allow_review,
      exam_code, teacher_id, status, visibility, school_id
    `)
    .eq('exam_code', code.toUpperCase())
    .eq('status', 'published')
    .maybeSingle();
  if (error || !exam) return null;

  // Visibility check
  const sid = getStudentId();
  const visibility = (exam as { visibility?: string }).visibility ?? 'selected_class';
  const examSchoolId = (exam as { school_id?: string | null }).school_id ?? null;
  const accessError = await checkExamAccess(exam.id, visibility, examSchoolId, sid);
  if (accessError) {
    throw new Error(accessError);
  }

  // Get teacher name
  const { data: teacherProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', exam.teacher_id)
    .maybeSingle();

  // Get questions for this exam
  const { data: examQuestions } = await supabase
    .from('exam_questions')
    .select('question_id, sort_order, question_snapshot')
    .eq('exam_id', exam.id)
    .order('sort_order');

  const questionIds = (examQuestions ?? []).map((eq) => eq.question_id).filter((id): id is string => !!id);
  const questions: QuizQuestion[] = [];
  const snapshotRows = (examQuestions ?? []) as Array<{ question_id: string; sort_order: number; question_snapshot?: QuizQuestion & { options?: Array<{ label: string; isCorrect: boolean }>; images?: Array<{ imageUrl: string }>; ladderData?: { mode?: string; challengeType?: string; masterProgramId?: string | null; ladderJson?: string | null; starterLadderJson?: string | null; expectedOutput?: string | null; answerLadderJson?: string | null; answerProgramJson?: string | null; testCases?: unknown[] } | null } | null }>;
  const hasSnapshots = snapshotRows.length > 0 && snapshotRows.every((eq) => !!eq.question_snapshot);
  if (hasSnapshots) {
    for (const eq of snapshotRows) {
      const snap = eq.question_snapshot!;
      questions.push({
        id: snap.id,
        type: snap.type,
        question: snap.question,
        difficulty: snap.difficulty,
        points: snap.points,
        explanation: snap.explanation ?? null,
        options: (snap.options ?? []).map((o) => ({ label: o.label, isCorrect: o.isCorrect })),
        imageUrls: (snap.images ?? []).map((i) => i.imageUrl),
        ladderMode: snap.ladderData?.mode as QuizQuestion['ladderMode'],
        ladderChallengeType: snap.ladderData?.challengeType as QuizQuestion['ladderChallengeType'],
        ladderJson: snap.ladderData?.ladderJson ?? null,
        expectedOutput: snap.ladderData?.expectedOutput ?? null,
        answerLadderJson: snap.ladderData?.answerLadderJson ?? null,
        masterProgramId: snap.ladderData?.masterProgramId ?? null,
        starterProgramJson: snap.ladderData?.starterLadderJson ?? snap.ladderData?.ladderJson ?? null,
        answerProgramJson: snap.ladderData?.answerProgramJson ?? snap.ladderData?.answerLadderJson ?? null,
        testCases: Array.isArray(snap.ladderData?.testCases) ? (snap.ladderData.testCases as LadderTestCase[]) : [],
      });
    }
  } else if (questionIds.length > 0) {
    // Legacy exams created before snapshots: keep the old live-question fallback.
    const [{ data: qs }, { data: opts }, { data: imgs }, { data: ladders }] = await Promise.all([
      supabase.from('questions').select('*').in('id', questionIds),
      supabase.from('question_options').select('*').in('question_id', questionIds),
      supabase.from('question_images').select('*').in('question_id', questionIds),
      supabase.from('ladder_questions').select('*').in('question_id', questionIds),
    ]);
    for (const eq of examQuestions ?? []) {
      const q = (qs ?? []).find((x) => x.id === eq.question_id);
      if (!q) continue;
      const qOpts = (opts ?? []).filter((o) => o.question_id === q.id).sort((a, b) => a.sort_order - b.sort_order);
      const qImgs = (imgs ?? []).filter((i) => i.question_id === q.id).map((i) => i.image_url);
      const qLadder = (ladders ?? []).find((l) => l.question_id === q.id);
      questions.push({ id: q.id, type: q.type, question: q.question, difficulty: q.difficulty, points: q.points, explanation: q.explanation, options: qOpts.map((o) => ({ label: o.label, isCorrect: o.is_correct })), imageUrls: qImgs, ladderMode: qLadder?.mode, ladderChallengeType: qLadder?.challenge_type as QuizQuestion['ladderChallengeType'], ladderJson: qLadder?.ladder_json, expectedOutput: qLadder?.expected_output, answerLadderJson: qLadder?.answer_ladder_json, masterProgramId: qLadder?.master_program_id ?? null, starterProgramJson: qLadder?.starter_ladder_json ?? qLadder?.ladder_json ?? null, answerProgramJson: qLadder?.answer_program_json ?? qLadder?.answer_ladder_json ?? null, testCases: Array.isArray(qLadder?.test_cases) ? qLadder?.test_cases as QuizQuestion['testCases'] : [] });
    }
  }

  // Count attempts
  const { count } = await supabase
    .from('exam_attempts')
    .select('id', { count: 'exact' })
    .eq('exam_id', exam.id)
    .eq('student_id', sid);

  const attemptsRemaining = Math.max(0, exam.max_attempts - (count ?? 0));

  return {
    id: exam.id,
    name: exam.name,
    description: exam.description,
    durationMinutes: exam.duration_minutes,
    examDate: exam.exam_date,
    startTime: exam.start_time,
    lateJoinMinutes: exam.late_join_minutes,
    maxAttempts: exam.max_attempts,
    passingScore: Number(exam.passing_score),
    shuffleQuestions: exam.shuffle_questions,
    shuffleAnswers: exam.shuffle_answers,
    showResultAfter: exam.show_result_after,
    allowReview: exam.allow_review,
    examCode: exam.exam_code,
    teacherName: teacherProfile?.full_name ?? 'Unknown',
    questionCount: questions.length,
    attemptsRemaining,
    questions,
    visibility: visibility as ExamInfo['visibility'],
    schoolId: examSchoolId,
  };
}

// ============================================================
// Exam Attempts
// ============================================================

interface AttemptRow {
  id: string;
  exam_id: string;
  student_id: string;
  score: number;
  correct_count: number;
  wrong_count: number;
  time_used_seconds: number;
  remaining_seconds: number | null;
  status: string;
  answers: unknown;
  started_at: string;
  submitted_at: string | null;
  attempt_number: number;
  xp_earned: number;
}

function rowToAttempt(row: AttemptRow): ExamAttempt {
  return {
    id: row.id,
    examId: row.exam_id,
    studentId: row.student_id,
    score: Number(row.score),
    correctCount: row.correct_count,
    wrongCount: row.wrong_count,
    timeUsedSeconds: row.time_used_seconds,
    remainingSeconds: row.remaining_seconds,
    status: row.status as ExamAttempt['status'],
    answers: (row.answers ?? {}) as Record<string, unknown>,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    attemptNumber: row.attempt_number,
    xpEarned: row.xp_earned,
  };
}

export async function getActiveAttempt(examId: string): Promise<ExamAttempt | null> {
  const sid = getStudentId();
  const { data, error } = await supabase
    .from('exam_attempts')
    .select('*')
    .eq('exam_id', examId)
    .eq('student_id', sid)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToAttempt(data as AttemptRow);
}

export async function startExamAttempt(examId: string, durationMinutes: number): Promise<ExamAttempt> {
  const sid = getStudentId();
  const { count } = await supabase
    .from('exam_attempts')
    .select('id', { count: 'exact' })
    .eq('exam_id', examId)
    .eq('student_id', sid);

  const { data, error } = await supabase
    .from('exam_attempts')
    .insert({
      exam_id: examId,
      student_id: sid,
      remaining_seconds: durationMinutes * 60,
      status: 'in_progress',
      attempt_number: (count ?? 0) + 1,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToAttempt(data as AttemptRow);
}

export async function saveAttemptProgress(
  attemptId: string,
  answers: Record<string, unknown>,
  remainingSeconds: number
): Promise<void> {
  const { error } = await supabase
    .from('exam_attempts')
    .update({ answers, remaining_seconds: remainingSeconds })
    .eq('id', attemptId);
  if (error) throw error;
}

export async function submitExamAttempt(
  attemptId: string,
  input: {
    score: number;
    correctCount: number;
    wrongCount: number;
    timeUsedSeconds: number;
    remainingSeconds: number;
    answers: Record<string, unknown>;
    xpEarned: number;
    studentName?: string;
    studentEmail?: string;
    className?: string | null;
    examId?: string;
  }
): Promise<void> {
  const sid = getStudentId();
  const updatePayload: Record<string, unknown> = {
    score: input.score,
    correct_count: input.correctCount,
    wrong_count: input.wrongCount,
    time_used_seconds: input.timeUsedSeconds,
    remaining_seconds: input.remainingSeconds,
    status: 'completed',
    answers: input.answers,
    submitted_at: new Date().toISOString(),
  };
  if (input.studentName !== undefined) updatePayload.student_name = input.studentName;
  if (input.studentEmail !== undefined) updatePayload.student_email = input.studentEmail;
  if (input.className !== undefined) updatePayload.class_name = input.className ?? '';

  // Anti-duplicate XP: check if this student already completed this exam before
  const examId = input.examId;
  let actualXpEarned = input.xpEarned;
  if (examId) {
    const { data: priorAttempts } = await supabase
      .from('exam_attempts')
      .select('id, xp_earned, score')
      .eq('exam_id', examId)
      .eq('student_id', sid)
      .eq('status', 'completed')
      .neq('id', attemptId)
      .order('score', { ascending: false });
    const prior = (priorAttempts ?? []) as Array<{ id: string; xp_earned: number; score: number }>;
    if (prior.length > 0) {
      // Retake allowed — score and history update, but XP does NOT increase
      actualXpEarned = 0;
      updatePayload.xp_earned = 0;
    } else {
      updatePayload.xp_earned = input.xpEarned;
    }
  } else {
    updatePayload.xp_earned = input.xpEarned;
  }

  const { error } = await supabase
    .from('exam_attempts')
    .update(updatePayload)
    .eq('id', attemptId);
  if (error) throw error;

  // Update student progress + leaderboard (only with XP if first attempt)
  await updateStudentProgress(actualXpEarned, 'exam');
}

export async function abandonAttempt(attemptId: string): Promise<void> {
  const { error } = await supabase
    .from('exam_attempts')
    .update({ status: 'abandoned' })
    .eq('id', attemptId);
  if (error) throw error;
}

// ============================================================
// Practice Attempts
// ============================================================

export async function savePracticeAttempt(input: {
  category: string;
  difficulty: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  durationSeconds: number;
}): Promise<void> {
  const sid = getStudentId();
  const { error } = await supabase.from('practice_attempts').insert({
    student_id: sid,
    ...input,
  });
  if (error) throw error;
  await updateStudentProgress(0, 'practice');
}

export async function fetchPracticeHistory(): Promise<PracticeAttempt[]> {
  const sid = getStudentId();
  const { data, error } = await supabase
    .from('practice_attempts')
    .select('*')
    .eq('student_id', sid)
    .order('completed_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data as unknown as Array<{
    id: string; category: string; difficulty: string; score: number;
    total_questions: number; correct_count: number; duration_seconds: number;
    completed_at: string;
  }>).map((r) => ({
    id: r.id,
    category: r.category,
    difficulty: r.difficulty,
    score: r.score,
    totalQuestions: r.total_questions,
    correctCount: r.correct_count,
    durationSeconds: r.duration_seconds,
    completedAt: r.completed_at,
  }));
}

// ============================================================
// Exam History (completed attempts)
// ============================================================

export async function fetchExamHistory(): Promise<Array<ExamAttempt & { examName: string }>> {
  const sid = getStudentId();
  const { data, error } = await supabase
    .from('exam_attempts')
    .select(`
      id, exam_id, student_id, score, correct_count, wrong_count,
      time_used_seconds, remaining_seconds, status, answers, started_at,
      submitted_at, attempt_number, xp_earned,
      exams!inner(name)
    `)
    .eq('student_id', sid)
    .order('submitted_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data as unknown as Array<AttemptRow & { exams: { name: string } }>).map((r) => ({
    ...rowToAttempt(r),
    examName: r.exams.name,
  }));
}

// ============================================================
// Student Progress
// ============================================================

export async function fetchStudentProgress(): Promise<StudentProgress> {
  const sid = getStudentId();
  const { data, error } = await supabase
    .from('student_progress')
    .select('*')
    .eq('student_id', sid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { totalXp: 0, level: 1, examsCompleted: 0, quizzesCompleted: 0, practiceCompleted: 0 };
  return {
    totalXp: data.total_xp,
    level: data.level,
    examsCompleted: data.exams_completed,
    quizzesCompleted: data.quizzes_completed,
    practiceCompleted: data.practice_completed,
  };
}

export async function updateStudentProgressDirect(xpGained: number, type: 'exam' | 'quiz' | 'practice'): Promise<void> {
  return updateStudentProgress(xpGained, type);
}

async function updateStudentProgress(
  xpGained: number,
  type: 'exam' | 'quiz' | 'practice'
): Promise<void> {
  const sid = getStudentId();
  const { data: existing } = await supabase
    .from('student_progress')
    .select('*')
    .eq('student_id', sid)
    .maybeSingle();

  let newTotalXp: number;
  let newLevel: number;
  let newExamsCompleted: number;

  if (existing) {
    newTotalXp = existing.total_xp + xpGained;
    newLevel = Math.floor(newTotalXp / 1000) + 1;
    newExamsCompleted = type === 'exam' ? existing.exams_completed + 1 : existing.exams_completed;
    const updates: Record<string, unknown> = {
      total_xp: newTotalXp,
      level: newLevel,
    };
    if (type === 'exam') updates.exams_completed = newExamsCompleted;
    if (type === 'quiz') updates.quizzes_completed = existing.quizzes_completed + 1;
    if (type === 'practice') updates.practice_completed = existing.practice_completed + 1;
    await supabase.from('student_progress').update(updates).eq('student_id', sid);
  } else {
    newTotalXp = xpGained;
    newLevel = Math.floor(xpGained / 1000) + 1;
    newExamsCompleted = type === 'exam' ? 1 : 0;
    await supabase.from('student_progress').insert({
      student_id: sid,
      total_xp: newTotalXp,
      level: newLevel,
      exams_completed: newExamsCompleted,
      quizzes_completed: type === 'quiz' ? 1 : 0,
      practice_completed: type === 'practice' ? 1 : 0,
    });
  }

  // Also update profiles.xp/level for consistency
  await supabase.from('profiles').update({ xp: newTotalXp, level: newLevel }).eq('id', sid);

  // Fetch profile for name + school
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, school_id')
    .eq('id', sid)
    .maybeSingle();
  if (!profile) return;

  const studentName = (profile as { full_name: string }).full_name;
  const schoolId = (profile as { school_id: string | null }).school_id;

  // Compute aggregate stats from all completed attempts
  const { data: allAttempts } = await supabase
    .from('exam_attempts')
    .select('score, correct_count, wrong_count')
    .eq('student_id', sid)
    .eq('status', 'completed');
  const att = (allAttempts ?? []) as Array<{ score: number; correct_count: number; wrong_count: number }>;
  const examCount = att.length;
  const avgScore = examCount > 0 ? att.reduce((s, a) => s + a.score, 0) / examCount : 0;
  const totalCorrect = att.reduce((s, a) => s + a.correct_count, 0);
  const totalWrong = att.reduce((s, a) => s + a.wrong_count, 0);
  const accuracy = (totalCorrect + totalWrong) > 0 ? (totalCorrect / (totalCorrect + totalWrong)) * 100 : 0;

  // Ranking Score = XP*0.4 + AvgScore*0.3 + Accuracy*0.2 + ExamCount*0.1
  const rankingScore = (newTotalXp * 0.4) + (avgScore * 0.3) + (accuracy * 0.2) + (examCount * 0.1);

  // Fetch class memberships for class-scoped leaderboards
  const { data: csRows } = await supabase
    .from('class_students')
    .select('class_id')
    .eq('student_id', sid);
  const classIds = ((csRows ?? []) as Array<{ class_id: string }>).map((r) => r.class_id);

  // Upsert helper
  async function upsertLeaderboard(scope: string, scopeId: string | null, extra?: Record<string, unknown>) {
    let q = supabase.from('leaderboards').select('id').eq('scope', scope).eq('student_id', sid);
    if (scopeId) q = q.eq('scope_id', scopeId);
    else q = q.is('scope_id', null);
    const { data: existing2 } = await q.maybeSingle();

    const payload = {
      student_name: studentName,
      total_xp: newTotalXp,
      exam_count: examCount,
      avg_score: Math.round(avgScore),
      accuracy: Math.round(accuracy),
      ranking_score: rankingScore,
      school_id: schoolId,
      updated_at: new Date().toISOString(),
      ...extra,
    };

    if (existing2) {
      await supabase.from('leaderboards').update(payload).eq('id', (existing2 as { id: string }).id);
    } else {
      await supabase.from('leaderboards').insert({
        scope,
        scope_id: scopeId,
        student_id: sid,
        ...payload,
      });
    }
  }

  // Global leaderboard
  await upsertLeaderboard('global', null);
  // School leaderboard
  if (schoolId) {
    await upsertLeaderboard('school', schoolId);
  }
  // Class leaderboards
  for (const cid of classIds) {
    await upsertLeaderboard('class', cid);
  }
}

// ============================================================
// Leaderboards
// ============================================================

export async function fetchLeaderboard(
  scope: 'class' | 'weekly' | 'monthly' | 'global' | 'school',
  scopeId?: string,
  page = 0,
  pageSize = 50
): Promise<LeaderboardEntry[]> {
  let query = supabase
    .from('leaderboards')
    .select('*')
    .eq('scope', scope)
    .order('ranking_score', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (scopeId) {
    query = query.eq('scope_id', scopeId);
  } else if (scope === 'school') {
    // For school scope without scopeId, use the current user's school
    const sid = getStudentId();
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', sid)
      .maybeSingle();
    const schoolId = (profile as { school_id: string | null } | null)?.school_id;
    if (!schoolId) return [];
    query = query.eq('school_id', schoolId);
  } else if (scope === 'class') {
    // For class scope without scopeId, use the current user's first class
    const sid = getStudentId();
    const { data: cs } = await supabase
      .from('class_students')
      .select('class_id')
      .eq('student_id', sid)
      .order('joined_at', { ascending: false })
      .limit(1);
    const classRows = (cs ?? []) as Array<{ class_id: string }>;
    if (classRows.length === 0) return [];
    query = query.eq('scope_id', classRows[0].class_id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as Array<{
    id: string; student_name: string; total_xp: number; exam_count: number;
    avg_score: number; ranking_score: number; accuracy: number; rank: number | null;
  }>).map((r, i) => ({
    id: r.id,
    studentName: r.student_name,
    totalXp: r.total_xp,
    examCount: r.exam_count,
    avgScore: Number(r.avg_score),
    rankingScore: r.ranking_score,
    accuracy: r.accuracy,
    rank: page * pageSize + i + 1,
  }));
}

// Fetch the current user's rank across scopes
export async function fetchMyRanks(): Promise<{
  global: number | null;
  school: number | null;
  class: number | null;
}> {
  const sid = getStudentId();

  // Global rank
  const { data: globalLb } = await supabase
    .from('leaderboards')
    .select('ranking_score')
    .eq('scope', 'global')
    .order('ranking_score', { ascending: false });
  const globalRows = (globalLb ?? []) as Array<{ ranking_score: number }>;
  const { data: myGlobal } = await supabase
    .from('leaderboards')
    .select('ranking_score')
    .eq('scope', 'global')
    .eq('student_id', sid)
    .maybeSingle();
  let globalRank: number | null = null;
  if (myGlobal) {
    const myScore = (myGlobal as { ranking_score: number }).ranking_score;
    globalRank = globalRows.filter((r) => r.ranking_score > myScore).length + 1;
  }

  // School rank
  let schoolRank: number | null = null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', sid)
    .maybeSingle();
  const schoolId = (profile as { school_id: string | null } | null)?.school_id;
  if (schoolId) {
    const { data: schoolLb } = await supabase
      .from('leaderboards')
      .select('student_id, ranking_score')
      .eq('scope', 'school')
      .eq('school_id', schoolId)
      .order('ranking_score', { ascending: false });
    const schoolRows = (schoolLb ?? []) as Array<{ student_id: string; ranking_score: number }>;
    const idx = schoolRows.findIndex((r) => r.student_id === sid);
    schoolRank = idx >= 0 ? idx + 1 : null;
  }

  // Class rank
  let classRank: number | null = null;
  const { data: cs } = await supabase
    .from('class_students')
    .select('class_id')
    .eq('student_id', sid)
    .order('joined_at', { ascending: false })
    .limit(1);
  const classRows = (cs ?? []) as Array<{ class_id: string }>;
  if (classRows.length > 0) {
    const { data: classLb } = await supabase
      .from('leaderboards')
      .select('student_id, ranking_score')
      .eq('scope', 'class')
      .eq('scope_id', classRows[0].class_id)
      .order('ranking_score', { ascending: false });
    const classLbRows = (classLb ?? []) as Array<{ student_id: string; ranking_score: number }>;
    const idx = classLbRows.findIndex((r) => r.student_id === sid);
    classRank = idx >= 0 ? idx + 1 : null;
  }

  return { global: globalRank, school: schoolRank, class: classRank };
}

// ============================================================
// Grading helpers
// ============================================================

export function gradeMCQuestion(options: QuizOption[], selectedIndex: number): boolean {
  return options[selectedIndex]?.isCorrect ?? false;
}

export function gradeImageQuestion(options: QuizOption[], selectedIndex: number): boolean {
  return options[selectedIndex]?.isCorrect ?? false;
}

export function calculateScore(correctCount: number, totalQuestions: number, _totalPoints?: number): number {
  if (totalQuestions === 0) return 0;
  return Math.round((correctCount / totalQuestions) * 100);
}

export function calculateXP(score: number, baseXP: number): number {
  return Math.round((score / 100) * baseXP);
}

// ============================================================
// Student Class Detail
// ============================================================

export async function fetchClassDetails(classId: string): Promise<{
  info: import('./types').StudentClassInfo;
  students: Array<{ id: string; name: string; email: string; joinedAt: string; avatarUrl: string | null }>;
  exams: import('./types').ClassExamInfo[];
} | null> {
  const sid = getStudentId();

  // Verify the student is a member of this class
  const { data: membership } = await supabase
    .from('class_students')
    .select('class_id')
    .eq('class_id', classId)
    .eq('student_id', sid)
    .maybeSingle();
  if (!membership) return null;

  // Fetch class details
  const { data: classRow } = await supabase
    .from('classes')
    .select('id, name, join_code, teacher_id, created_at')
    .eq('id', classId)
    .maybeSingle();
  if (!classRow) return null;

  // Fetch teacher profile
  const { data: teacher } = await supabase
    .from('profiles')
    .select('full_name, email, school_id')
    .eq('id', (classRow as { teacher_id: string }).teacher_id)
    .maybeSingle();

  const teacherName = (teacher as { full_name: string } | null)?.full_name ?? 'Unknown';
  const teacherEmail = (teacher as { email: string } | null)?.email ?? '';
  const teacherSchoolId = (teacher as { school_id: string | null } | null)?.school_id ?? null;

  // Fetch school name
  let schoolName: string | null = null;
  if (teacherSchoolId) {
    const { data: school } = await supabase
      .from('schools')
      .select('name')
      .eq('id', teacherSchoolId)
      .maybeSingle();
    schoolName = (school as { name: string } | null)?.name ?? null;
  }

  // Count students
  const { count: studentCount } = await supabase
    .from('class_students')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', classId);

  // Fetch all students in the class
  const { data: studentRows } = await supabase
    .from('class_students')
    .select('student_id, joined_at')
    .eq('class_id', classId)
    .order('joined_at', { ascending: true });

  const studentIds = (studentRows ?? []).map((r) => (r as { student_id: string }).student_id);
  let students: Array<{ id: string; name: string; email: string; joinedAt: string; avatarUrl: string | null }> = [];
  if (studentIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', studentIds);
    const profileMap = new Map((profiles ?? []).map((p) => [(p as { id: string }).id, p as { full_name: string; email: string; avatar_url: string | null }]));
    students = (studentRows ?? []).map((r) => {
      const row = r as { student_id: string; joined_at: string };
      const p = profileMap.get(row.student_id);
      return {
        id: row.student_id,
        name: p?.full_name ?? 'Unknown',
        email: p?.email ?? '',
        joinedAt: row.joined_at,
        avatarUrl: p?.avatar_url ?? null,
      };
    });
  }

  // Fetch exams available to this class:
  // 1. Exams with visibility='school' where the student's school matches
  // 2. Exams with visibility='selected_class' where targetAllClasses=true and the teacher owns this class
  // 3. Exams linked to this class via exam_classes
  const teacherId = (classRow as { teacher_id: string }).teacher_id;

  // Get exams by this teacher that are published
  const { data: teacherExams } = await supabase
    .from('exams')
    .select(`
      id, name, description, duration_minutes, exam_date, start_time,
      status, exam_code, visibility, target_all_classes, teacher_id
    `)
    .eq('teacher_id', teacherId)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  // Get exam_classes mappings for this class
  const { data: examClassLinks } = await supabase
    .from('exam_classes')
    .select('exam_id')
    .eq('class_id', classId);
  const linkedExamIds = new Set((examClassLinks ?? []).map((ec) => (ec as { exam_id: string }).exam_id));

  // Get student's school_id for school-visible exams
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', sid)
    .maybeSingle();
  const mySchoolId = (myProfile as { school_id: string | null } | null)?.school_id ?? null;

  // Filter exams that this student can see
  const visibleExamRows = (teacherExams ?? []).filter((e) => {
    const exam = e as {
      id: string; visibility: string; target_all_classes: boolean | null;
      teacher_id: string;
    };
    if (exam.visibility === 'school') {
      return mySchoolId && teacherSchoolId === mySchoolId;
    }
    // selected_class
    if (exam.target_all_classes) return true;
    return linkedExamIds.has(exam.id);
  });

  // Get question counts and attempt info for each visible exam
  const visibleExamIds = visibleExamRows.map((e) => (e as { id: string }).id);
  const examInfoList: import('./types').ClassExamInfo[] = [];

  if (visibleExamIds.length > 0) {
    // Get question counts
    const { data: eqRows } = await supabase
      .from('exam_questions')
      .select('exam_id')
      .in('exam_id', visibleExamIds);
    const questionCountMap = new Map<string, number>();
    for (const eq of (eqRows ?? []) as Array<{ exam_id: string }>) {
      questionCountMap.set(eq.exam_id, (questionCountMap.get(eq.exam_id) ?? 0) + 1);
    }

    // Get attempts for this student
    const { data: myAttempts } = await supabase
      .from('exam_attempts')
      .select('exam_id, status, score')
      .eq('student_id', sid)
      .in('exam_id', visibleExamIds);

    const attemptMap = new Map<string, { status: string; score: number }>();
    for (const a of (myAttempts ?? []) as Array<{ exam_id: string; status: string; score: number }>) {
      const existing = attemptMap.get(a.exam_id);
      if (!existing || a.status === 'completed') {
        attemptMap.set(a.exam_id, { status: a.status, score: Number(a.score) });
      }
    }

    // Get max_attempts for each exam
    const { data: examDetails } = await supabase
      .from('exams')
      .select('id, max_attempts')
      .in('id', visibleExamIds);
    const maxAttemptsMap = new Map<string, number>();
    for (const ed of (examDetails ?? []) as Array<{ id: string; max_attempts: number }>) {
      maxAttemptsMap.set(ed.id, ed.max_attempts);
    }

    // Count completed attempts per exam
    const completedCountMap = new Map<string, number>();
    for (const a of (myAttempts ?? []) as Array<{ exam_id: string; status: string }>) {
      if (a.status === 'completed' || a.status === 'in_progress') {
        completedCountMap.set(a.exam_id, (completedCountMap.get(a.exam_id) ?? 0) + 1);
      }
    }

    for (const e of visibleExamRows) {
      const exam = e as {
        id: string; name: string; description: string | null;
        duration_minutes: number; exam_date: string | null; start_time: string | null;
        status: string; exam_code: string;
      };
      const myAttempt = attemptMap.get(exam.id);
      const maxAttempts = maxAttemptsMap.get(exam.id) ?? 1;
      const attemptsUsed = completedCountMap.get(exam.id) ?? 0;
      const myStatus = myAttempt?.status === 'completed' ? 'completed'
        : myAttempt?.status === 'in_progress' ? 'in_progress'
        : 'not_started';

      examInfoList.push({
        id: exam.id,
        name: exam.name,
        description: exam.description,
        durationMinutes: exam.duration_minutes,
        examDate: exam.exam_date,
        startTime: exam.start_time,
        status: exam.status,
        examCode: exam.exam_code,
        teacherName,
        questionCount: questionCountMap.get(exam.id) ?? 0,
        attemptsRemaining: Math.max(0, maxAttempts - attemptsUsed),
        myStatus: myStatus as 'not_started' | 'in_progress' | 'completed',
        myScore: myAttempt?.status === 'completed' ? myAttempt.score : null,
      });
    }
  }

  return {
    info: {
      id: (classRow as { id: string }).id,
      name: (classRow as { name: string }).name,
      joinCode: (classRow as { join_code: string }).join_code,
      teacherName,
      teacherEmail,
      schoolName,
      studentCount: studentCount ?? 0,
      createdAt: (classRow as { created_at: string }).created_at,
    },
    students,
    exams: examInfoList,
  };
}

export async function fetchClassLeaderboard(classId: string): Promise<LeaderboardEntry[]> {
  return fetchLeaderboard('class', classId);
}
