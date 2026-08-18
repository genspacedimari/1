import { supabase } from '@/services/supabaseClient';
import { useAuthStore } from '@/stores/authStore';
import type {
  QuestionCategory,
  QuestionSet,
  Question,
  QuestionOption,
  QuestionImage,
  LadderQuestionData,
  Exam,
  Class,
  ClassStudent,
  ExamResult,
  StudentSummary,
  StudentDetail,
  ResultDetail,
  QuestionReview,
} from './types';

const DEBUG = import.meta.env.DEV;
function debugLog(...args: unknown[]) {
  if (DEBUG) console.log(...args);
}

/**
 * Turns a raw Supabase/Postgres error into a message a teacher can act on,
 * instead of a generic "Failed to save". Falls back to the original
 * message for anything not specifically recognized.
 */
function toFriendlyError(err: unknown, context: string): Error {
  if (err && typeof err === 'object' && 'message' in err) {
    const e = err as { message: string; code?: string };
    if (e.code === '42501' || /row-level security/i.test(e.message)) {
      return new Error(`${context}: you don't have permission to do this (check that you're signed in as the owner).`);
    }
    if (e.code === '42703' || /column .* does not exist/i.test(e.message)) {
      return new Error(`${context}: the database schema is out of date (${e.message}). Please run the latest migrations.`);
    }
    if (e.code === '23503') {
      return new Error(`${context}: a related record (category/class/question) no longer exists.`);
    }
    if (e.code === '23505') {
      return new Error(`${context}: a duplicate record already exists.`);
    }
    return new Error(`${context}: ${e.message}`);
  }
  return new Error(`${context}: ${err instanceof Error ? err.message : 'unknown error'}`);
}

function getTeacherId(): string {
  const state = useAuthStore.getState();
  debugLog('[GET_TEACHER_ID] auth state:', { hasUser: !!state.user, status: state.status, isGuest: state.isGuest, hasSession: !!state.session });
  const user = state.user;
  if (!user) throw new Error('You must be signed in to do this.');
  return user.id;
}

// ============================================================
// Categories
// ============================================================

interface CategoryRow {
  id: string;
  teacher_id: string;
  name: string;
  color: string;
  created_at: string;
}

function rowToCategory(row: CategoryRow): QuestionCategory {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  };
}

export async function fetchCategories(): Promise<QuestionCategory[]> {
  const tid = getTeacherId();
  const { data, error } = await supabase
    .from('question_categories')
    .select('*')
    .eq('teacher_id', tid)
    .order('name');
  if (error) throw error;
  return (data as CategoryRow[]).map(rowToCategory);
}

export async function createCategory(name: string, color = '#F26B3A'): Promise<QuestionCategory> {
  const tid = getTeacherId();
  const { data, error } = await supabase
    .from('question_categories')
    .insert({ teacher_id: tid, name, color })
    .select()
    .single();
  if (error) throw error;
  return rowToCategory(data as CategoryRow);
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('question_categories').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// Question Sets
// ============================================================

interface QuestionSetRow {
  id: string;
  teacher_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

function mapQuestionSet(row: QuestionSetRow, questionCount = 0): QuestionSet {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    name: row.name,
    questionCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchQuestionSets(): Promise<QuestionSet[]> {
  const tid = getTeacherId();
  const [{ data: sets, error: setErr }, { data: qRows, error: qErr }] = await Promise.all([
    supabase.from('question_sets').select('*').eq('teacher_id', tid).order('updated_at', { ascending: false }),
    supabase.from('questions').select('id, question_set_id').eq('teacher_id', tid),
  ]);
  if (setErr) throw toFriendlyError(setErr, 'Failed to load question sets');
  if (qErr) throw toFriendlyError(qErr, 'Failed to load question counts');
  const counts = new Map<string, number>();
  (qRows ?? []).forEach((q) => {
    if (q.question_set_id) counts.set(q.question_set_id, (counts.get(q.question_set_id) ?? 0) + 1);
  });
  return (sets as QuestionSetRow[] ?? []).map((row) => mapQuestionSet(row, counts.get(row.id) ?? 0));
}

export async function fetchQuestionSet(id: string): Promise<QuestionSet | null> {
  const tid = getTeacherId();
  const { data, error } = await supabase.from('question_sets').select('*').eq('id', id).eq('teacher_id', tid).maybeSingle();
  if (error) throw toFriendlyError(error, 'Failed to load question set');
  if (!data) return null;
  const { count, error: countErr } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', tid)
    .eq('question_set_id', id);
  if (countErr) throw toFriendlyError(countErr, 'Failed to load question set');
  return mapQuestionSet(data as QuestionSetRow, count ?? 0);
}

export async function createQuestionSet(name: string): Promise<QuestionSet> {
  const tid = getTeacherId();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Question Set name is required.');
  const { data, error } = await supabase
    .from('question_sets')
    .insert({ teacher_id: tid, name: trimmed })
    .select()
    .single();
  if (error) throw toFriendlyError(error, 'Failed to create question set');
  return mapQuestionSet(data as QuestionSetRow, 0);
}

export async function deleteQuestionSet(id: string): Promise<void> {
  const { error } = await supabase.from('question_sets').delete().eq('id', id);
  if (error) throw toFriendlyError(error, 'Failed to delete question set');
}

// ============================================================
// Questions
// ============================================================

interface QuestionRow {
  id: string;
  teacher_id: string;
  question_set_id: string | null;
  category_id: string | null;
  type: string;
  question: string;
  difficulty: string;
  points: number;
  explanation: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

interface OptionRow {
  id: string;
  question_id: string;
  label: string;
  is_correct: boolean;
  sort_order: number;
}

interface ImageRow {
  id: string;
  question_id: string;
  image_url: string;
}

interface LadderRow {
  id: string;
  question_id: string;
  mode: string;
  ladder_json: string | null;
  expected_output: string | null;
  answer_ladder_json: string | null;
  challenge_type?: string | null;
  master_program_id?: string | null;
  starter_ladder_json?: string | null;
  answer_program_json?: string | null;
  test_cases?: unknown;
}

function mapQuestion(
  q: QuestionRow,
  options: OptionRow[],
  images: ImageRow[],
  ladder: LadderRow | null
): Question {
  return {
    id: q.id,
    teacherId: q.teacher_id,
    questionSetId: q.question_set_id ?? null,
    categoryId: q.category_id,
    type: q.type as Question['type'],
    question: q.question,
    difficulty: q.difficulty as Question['difficulty'],
    points: q.points,
    explanation: q.explanation,
    archived: q.archived,
    createdAt: q.created_at,
    updatedAt: q.updated_at,
    options: options
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((o) => ({ id: o.id, label: o.label, isCorrect: o.is_correct, sortOrder: o.sort_order })),
    images: images.map((img) => ({ id: img.id, imageUrl: img.image_url })),
    ladderData: ladder
      ? {
          id: ladder.id,
          mode: ladder.mode as LadderQuestionData['mode'],
          ladderJson: ladder.ladder_json,
          expectedOutput: ladder.expected_output,
          answerLadderJson: ladder.answer_ladder_json,
        }
      : null,
  };
}

export async function fetchQuestions(archived = false): Promise<Question[]> {
  const tid = getTeacherId();
  const { data: questions, error } = await supabase
    .from('questions')
    .select('*')
    .eq('teacher_id', tid)
    .eq('archived', archived)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!questions || questions.length === 0) return [];

  const ids = questions.map((q) => q.id);

  const [{ data: opts }, { data: imgs }, { data: ladders }] = await Promise.all([
    supabase.from('question_options').select('*').in('question_id', ids),
    supabase.from('question_images').select('*').in('question_id', ids),
    supabase.from('ladder_questions').select('*').in('question_id', ids),
  ]);

  return (questions as QuestionRow[]).map((q) => {
    const qOptions = (opts as OptionRow[] | null)?.filter((o) => o.question_id === q.id) ?? [];
    const qImages = (imgs as ImageRow[] | null)?.filter((i) => i.question_id === q.id) ?? [];
    const qLadder = (ladders as LadderRow[] | null)?.find((l) => l.question_id === q.id) ?? null;
    return mapQuestion(q, qOptions, qImages, qLadder);
  });
}

export async function createQuestion(input: {
  questionSetId?: string | null;
  categoryId: string | null;
  type: Question['type'];
  question: string;
  difficulty: Question['difficulty'];
  points: number;
  explanation: string | null;
  options?: QuestionOption[];
  images?: QuestionImage[];
  ladderData?: LadderQuestionData | null;
}): Promise<Question> {
  const tid = getTeacherId();
  const payload = {
    teacher_id: tid,
    question_set_id: input.questionSetId ?? null,
    category_id: input.categoryId,
    type: input.type,
    question: input.question,
    difficulty: input.difficulty,
    points: input.points,
    explanation: input.explanation,
  };
  debugLog('[CREATE_QUESTION] REQUEST payload:', payload);
  const { data: qRow, error } = await supabase
    .from('questions')
    .insert(payload)
    .select()
    .single();
  if (error) throw toFriendlyError(error, 'Failed to save question');
  const q = qRow as QuestionRow;
  const qid = q.id;
  debugLog('[CREATE_QUESTION] inserted question id:', qid);

  // Child rows (options/images/ladder) are inserted in separate statements
  // since Postgres/PostgREST has no client-side multi-table transaction.
  // If any child insert fails, roll back the parent row ourselves so we
  // never leave an orphaned/incomplete question behind (no silent
  // half-saved state, no dangling rows visible in Question Bank).
  try {
    if (input.options && input.options.length > 0) {
      const optPayload = input.options.map((o, i) => ({
        question_id: qid,
        label: o.label,
        is_correct: o.isCorrect,
        sort_order: i,
      }));
      const { error: optErr } = await supabase.from('question_options').insert(optPayload);
      if (optErr) throw optErr;
    }

    if (input.images && input.images.length > 0) {
      const { error: imgErr } = await supabase
        .from('question_images')
        .insert(input.images.map((img) => ({ question_id: qid, image_url: img.imageUrl })));
      if (imgErr) throw imgErr;
    }

    if (input.ladderData) {
      const { error: ladErr } = await supabase.from('ladder_questions').insert({
        question_id: qid,
        mode: input.ladderData.mode,
        ladder_json: input.ladderData.ladderJson,
        expected_output: input.ladderData.expectedOutput,
        answer_ladder_json: input.ladderData.answerLadderJson,
        challenge_type: input.ladderData.challengeType ?? null,
        master_program_id: input.ladderData.masterProgramId ?? null,
        starter_ladder_json: input.ladderData.starterLadderJson ?? input.ladderData.ladderJson ?? null,
        answer_program_json: input.ladderData.answerProgramJson ?? input.ladderData.answerLadderJson ?? null,
        test_cases: input.ladderData.testCases ?? [],
      });
      if (ladErr) throw ladErr;
    }
  } catch (childErr) {
    debugLog('[CREATE_QUESTION] child insert failed, rolling back question row', qid, childErr);
    await supabase.from('questions').delete().eq('id', qid);
    throw toFriendlyError(childErr, 'Failed to save question');
  }

  return mapQuestion(q, [], [], (input.ladderData ?? null) as unknown as LadderRow);
}

export async function updateQuestion(id: string, input: {
  questionSetId?: string | null;
  categoryId?: string | null;
  question?: string;
  difficulty?: Question['difficulty'];
  points?: number;
  explanation?: string | null;
  options?: QuestionOption[];
  images?: QuestionImage[];
  ladderData?: LadderQuestionData | null;
}): Promise<void> {
  const update: Record<string, unknown> = {};
  if (input.questionSetId !== undefined) update.question_set_id = input.questionSetId;
  if (input.categoryId !== undefined) update.category_id = input.categoryId;
  if (input.question !== undefined) update.question = input.question;
  if (input.difficulty !== undefined) update.difficulty = input.difficulty;
  if (input.points !== undefined) update.points = input.points;
  if (input.explanation !== undefined) update.explanation = input.explanation;

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from('questions').update(update).eq('id', id);
    if (error) throw error;
  }

  if (input.options !== undefined) {
    await supabase.from('question_options').delete().eq('question_id', id);
    if (input.options.length > 0) {
      const { error } = await supabase
        .from('question_options')
        .insert(input.options.map((o, i) => ({
          question_id: id,
          label: o.label,
          is_correct: o.isCorrect,
          sort_order: i,
        })));
      if (error) throw error;
    }
  }

  if (input.images !== undefined) {
    await supabase.from('question_images').delete().eq('question_id', id);
    if (input.images.length > 0) {
      const { error } = await supabase
        .from('question_images')
        .insert(input.images.map((img) => ({ question_id: id, image_url: img.imageUrl })));
      if (error) throw error;
    }
  }

  if (input.ladderData !== undefined) {
    await supabase.from('ladder_questions').delete().eq('question_id', id);
    if (input.ladderData) {
      const { error } = await supabase
        .from('ladder_questions')
        .insert({
          question_id: id,
          mode: input.ladderData.mode,
          ladder_json: input.ladderData.ladderJson,
          expected_output: input.ladderData.expectedOutput,
          answer_ladder_json: input.ladderData.answerLadderJson,
          challenge_type: input.ladderData.challengeType ?? null,
          master_program_id: input.ladderData.masterProgramId ?? null,
          starter_ladder_json: input.ladderData.starterLadderJson ?? input.ladderData.ladderJson ?? null,
          answer_program_json: input.ladderData.answerProgramJson ?? input.ladderData.answerLadderJson ?? null,
          test_cases: input.ladderData.testCases ?? [],
        });
      if (error) throw error;
    }
  }
}

export async function duplicateQuestion(id: string): Promise<void> {
  const tid = getTeacherId();
  const { data: q } = await supabase.from('questions').select('*').eq('id', id).single();
  if (!q) return;
  const { data: copy } = await supabase
    .from('questions')
    .insert({
      teacher_id: tid,
      question_set_id: q.question_set_id ?? null,
      category_id: q.category_id,
      type: q.type,
      question: `${q.question} (Copy)`,
      difficulty: q.difficulty,
      points: q.points,
      explanation: q.explanation,
    })
    .select()
    .single();
  if (!copy) return;

  const { data: opts } = await supabase.from('question_options').select('*').eq('question_id', id);
  if (opts && opts.length > 0) {
    await supabase.from('question_options').insert(opts.map((o) => ({
      question_id: copy.id,
      label: o.label,
      is_correct: o.is_correct,
      sort_order: o.sort_order,
    })));
  }

  const { data: imgs } = await supabase.from('question_images').select('*').eq('question_id', id);
  if (imgs && imgs.length > 0) {
    await supabase.from('question_images').insert(imgs.map((i) => ({
      question_id: copy.id,
      image_url: i.image_url,
    })));
  }

  const { data: ladder } = await supabase.from('ladder_questions').select('*').eq('question_id', id).maybeSingle();
  if (ladder) {
    await supabase.from('ladder_questions').insert({
      question_id: copy.id,
      mode: ladder.mode,
      ladder_json: ladder.ladder_json,
      expected_output: ladder.expected_output,
      answer_ladder_json: ladder.answer_ladder_json,
    });
  }
}

export async function archiveQuestion(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase.from('questions').update({ archived }).eq('id', id);
  if (error) throw error;
}

export async function deleteQuestion(id: string): Promise<void> {
  const { error } = await supabase.from('questions').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchQuestionsBySetId(setId: string, archived = false): Promise<Question[]> {
  const tid = getTeacherId();
  const { data: questions, error } = await supabase
    .from('questions')
    .select('*')
    .eq('teacher_id', tid)
    .eq('question_set_id', setId)
    .eq('archived', archived)
    .order('created_at', { ascending: true });
  if (error) throw toFriendlyError(error, 'Failed to load question set questions');
  if (!questions || questions.length === 0) return [];
  const ids = questions.map((q) => q.id);
  const [{ data: opts }, { data: imgs }, { data: ladders }] = await Promise.all([
    supabase.from('question_options').select('*').in('question_id', ids),
    supabase.from('question_images').select('*').in('question_id', ids),
    supabase.from('ladder_questions').select('*').in('question_id', ids),
  ]);
  return (questions as QuestionRow[]).map((q) => mapQuestion(
    q,
    ((opts as OptionRow[] | null)?.filter((o) => o.question_id === q.id) ?? []),
    ((imgs as ImageRow[] | null)?.filter((i) => i.question_id === q.id) ?? []),
    ((ladders as LadderRow[] | null)?.find((l) => l.question_id === q.id) ?? null),
  ));
}

export async function assignQuestionToSet(questionId: string, setId: string | null): Promise<void> {
  const { error } = await supabase.from('questions').update({ question_set_id: setId }).eq('id', questionId);
  if (error) throw toFriendlyError(error, 'Failed to update question set');
}

// ============================================================
// Exams
// ============================================================

interface ExamRow {
  id: string;
  teacher_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  exam_date: string | null;
  start_time: string | null;
  late_join_minutes: number;
  max_attempts: number;
  passing_score: number;
  shuffle_questions: boolean;
  shuffle_answers: boolean;
  show_result_after: boolean;
  allow_review: boolean;
  exam_code: string;
  status: string;
  visibility: string;
  target_all_classes: boolean;
  school_id: string | null;
  question_set_id: string | null;
  question_selection_mode: string | null;
  created_at: string;
  updated_at: string;
}

function rowToExam(row: ExamRow, questionIds: string[] = [], classIds: string[] = []): Exam {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    examDate: row.exam_date,
    startTime: row.start_time,
    lateJoinMinutes: row.late_join_minutes,
    maxAttempts: row.max_attempts,
    passingScore: Number(row.passing_score),
    shuffleQuestions: row.shuffle_questions,
    shuffleAnswers: row.shuffle_answers,
    showResultAfter: row.show_result_after,
    allowReview: row.allow_review,
    examCode: row.exam_code,
    status: row.status as Exam['status'],
    visibility: (row.visibility ?? 'selected_class') as Exam['visibility'],
    targetAllClasses: row.target_all_classes ?? false,
    schoolId: row.school_id ?? null,
    questionSetId: row.question_set_id ?? null,
    questionSelectionMode: (row.question_selection_mode as Exam['questionSelectionMode']) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    questionIds,
    classIds,
  };
}

export async function fetchExams(): Promise<Exam[]> {
  const tid = getTeacherId();
  const { data: exams, error } = await supabase
    .from('exams')
    .select('*')
    .eq('teacher_id', tid)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!exams || exams.length === 0) return [];

  const ids = exams.map((e) => e.id);
  const [{ data: eqs }, { data: ecs }] = await Promise.all([
    supabase.from('exam_questions').select('*').in('exam_id', ids).order('sort_order'),
    supabase.from('exam_classes').select('exam_id, class_id').in('exam_id', ids),
  ]);

  return (exams as ExamRow[]).map((e) => {
    const qIds = (eqs ?? []).filter((eq) => eq.exam_id === e.id).map((eq) => eq.question_id).filter((id): id is string => !!id);
    const cIds = (ecs ?? []).filter((ec) => ec.exam_id === e.id).map((ec) => ec.class_id);
    return rowToExam(e, qIds, cIds);
  });
}

export async function createExam(input: {
  name: string;
  description?: string;
  durationMinutes?: number;
  examDate?: string;
  startTime?: string;
  lateJoinMinutes?: number;
  maxAttempts?: number;
  passingScore?: number;
  shuffleQuestions?: boolean;
  shuffleAnswers?: boolean;
  showResultAfter?: boolean;
  allowReview?: boolean;
  visibility?: string;
  targetAllClasses?: boolean;
  schoolId?: string | null;
  questionSetId?: string | null;
  questionSelectionMode?: 'all' | 'specific' | null;
  classIds?: string[];
}): Promise<Exam> {
  const tid = getTeacherId();
  // Auto-fill school_id from teacher's profile if not provided
  let schoolId = input.schoolId ?? null;
  if (!schoolId) {
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', tid)
      .maybeSingle();
    if (profileErr) debugLog('[CREATE_EXAM] profile lookup error (non-fatal):', profileErr);
    schoolId = (profile as { school_id: string | null } | null)?.school_id ?? null;
  }
  const payload: Record<string, unknown> = {
    teacher_id: tid,
    name: input.name,
    description: input.description ?? null,
    duration_minutes: input.durationMinutes ?? 60,
    visibility: input.visibility ?? 'selected_class',
    target_all_classes: input.targetAllClasses ?? false,
    school_id: schoolId,
    question_set_id: input.questionSetId ?? null,
    question_selection_mode: input.questionSelectionMode ?? null,
  };
  if (input.examDate !== undefined) payload.exam_date = input.examDate;
  if (input.startTime !== undefined) payload.start_time = input.startTime;
  if (input.lateJoinMinutes !== undefined) payload.late_join_minutes = input.lateJoinMinutes;
  if (input.maxAttempts !== undefined) payload.max_attempts = input.maxAttempts;
  if (input.passingScore !== undefined) payload.passing_score = input.passingScore;
  if (input.shuffleQuestions !== undefined) payload.shuffle_questions = input.shuffleQuestions;
  if (input.shuffleAnswers !== undefined) payload.shuffle_answers = input.shuffleAnswers;
  if (input.showResultAfter !== undefined) payload.show_result_after = input.showResultAfter;
  if (input.allowReview !== undefined) payload.allow_review = input.allowReview;

  debugLog('[CREATE_EXAM] REQUEST payload:', payload);
  const { data, error } = await supabase
    .from('exams')
    .insert(payload)
    .select()
    .single();
  if (error) throw toFriendlyError(error, 'Failed to save exam');
  const examRow = data as ExamRow;

  // Link specific classes if provided. If this fails, roll back the exam
  // row so a half-created exam never shows up in the Exam List.
  if (input.classIds && input.classIds.length > 0) {
    const classPayload = input.classIds.map((cid) => ({ exam_id: examRow.id, class_id: cid }));
    const { error: linkErr } = await supabase.from('exam_classes').insert(classPayload);
    if (linkErr) {
      debugLog('[CREATE_EXAM] class link failed, rolling back exam row', examRow.id, linkErr);
      await supabase.from('exams').delete().eq('id', examRow.id);
      throw toFriendlyError(linkErr, 'Failed to save exam');
    }
  }

  return rowToExam(examRow, [], input.classIds ?? []);
}

export async function updateExam(id: string, input: Partial<{
  name: string;
  description: string;
  durationMinutes: number;
  examDate: string;
  startTime: string;
  lateJoinMinutes: number;
  maxAttempts: number;
  passingScore: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  showResultAfter: boolean;
  allowReview: boolean;
  status: string;
  visibility: string;
  targetAllClasses: boolean;
  schoolId: string | null;
  questionSetId: string | null;
  questionSelectionMode: 'all' | 'specific' | null;
  classIds: string[];
}>): Promise<void> {
  const { classIds, ...rest } = input;
  const update: Record<string, unknown> = {};
  if (rest.name !== undefined) update.name = rest.name;
  if (rest.description !== undefined) update.description = rest.description;
  if (rest.durationMinutes !== undefined) update.duration_minutes = rest.durationMinutes;
  if (rest.examDate !== undefined) update.exam_date = rest.examDate;
  if (rest.startTime !== undefined) update.start_time = rest.startTime;
  if (rest.lateJoinMinutes !== undefined) update.late_join_minutes = rest.lateJoinMinutes;
  if (rest.maxAttempts !== undefined) update.max_attempts = rest.maxAttempts;
  if (rest.passingScore !== undefined) update.passing_score = rest.passingScore;
  if (rest.shuffleQuestions !== undefined) update.shuffle_questions = rest.shuffleQuestions;
  if (rest.shuffleAnswers !== undefined) update.shuffle_answers = rest.shuffleAnswers;
  if (rest.showResultAfter !== undefined) update.show_result_after = rest.showResultAfter;
  if (rest.allowReview !== undefined) update.allow_review = rest.allowReview;
  if (rest.status !== undefined) update.status = rest.status;
  if (rest.visibility !== undefined) update.visibility = rest.visibility;
  if (rest.targetAllClasses !== undefined) update.target_all_classes = rest.targetAllClasses;
  if (rest.schoolId !== undefined) update.school_id = rest.schoolId;
  if (rest.questionSetId !== undefined) update.question_set_id = rest.questionSetId;
  if (rest.questionSelectionMode !== undefined) update.question_selection_mode = rest.questionSelectionMode;

  debugLog('[UPDATE_EXAM] id:', id, 'update fields:', update);
  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from('exams').update(update).eq('id', id).select();
    if (error) throw toFriendlyError(error, 'Failed to update exam');
  }

  // Update class links if provided
  if (classIds !== undefined) {
    await supabase.from('exam_classes').delete().eq('exam_id', id);
    if (classIds.length > 0) {
      const { error: linkErr } = await supabase
        .from('exam_classes')
        .insert(classIds.map((cid) => ({ exam_id: id, class_id: cid })));
      if (linkErr) throw toFriendlyError(linkErr, 'Failed to update exam classes');
    }
  }
}

export async function regenerateExamCode(id: string): Promise<string> {
  const newCode = generateExamCode();
  const { error } = await supabase.from('exams').update({ exam_code: newCode }).eq('id', id);
  if (error) throw error;
  return newCode;
}

export async function deleteExam(id: string): Promise<void> {
  const { error } = await supabase.from('exams').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateExam(id: string): Promise<void> {
  const tid = getTeacherId();
  const { data: exam } = await supabase.from('exams').select('*').eq('id', id).single();
  if (!exam) return;
  const { data: copy } = await supabase
    .from('exams')
    .insert({
      teacher_id: tid,
      name: `${exam.name} (Copy)`,
      description: exam.description,
      duration_minutes: exam.duration_minutes,
      exam_date: exam.exam_date,
      start_time: exam.start_time,
      late_join_minutes: exam.late_join_minutes,
      max_attempts: exam.max_attempts,
      passing_score: exam.passing_score,
      shuffle_questions: exam.shuffle_questions,
      shuffle_answers: exam.shuffle_answers,
      show_result_after: exam.show_result_after,
      allow_review: exam.allow_review,
      status: 'draft',
      visibility: exam.visibility ?? 'selected_class',
      school_id: exam.school_id ?? null,
      question_set_id: exam.question_set_id ?? null,
      question_selection_mode: exam.question_selection_mode ?? null,
    })
    .select()
    .single();
  if (!copy) return;
  const { data: eqs } = await supabase.from('exam_questions').select('*').eq('exam_id', id).order('sort_order');
  if (eqs && eqs.length > 0) {
    await supabase.from('exam_questions').insert(eqs.map((eq) => ({
      exam_id: copy.id,
      question_id: eq.question_id ?? null,
      sort_order: eq.sort_order,
      question_snapshot: eq.question_snapshot ?? null,
    })));
  }
}

export async function setExamQuestions(
  examId: string,
  questionIds: string[],
  questionSetId: string | null = null,
  questionSelectionMode: 'all' | 'specific' | null = null,
): Promise<void> {
  const tid = getTeacherId();
  const uniqueIds = Array.from(new Set(questionIds));
  let questionsForSnapshot: Question[] = [];
  if (uniqueIds.length > 0) {
    const { data: rows, error } = await supabase
      .from('questions')
      .select('*')
      .eq('teacher_id', tid)
      .in('id', uniqueIds);
    if (error) throw toFriendlyError(error, 'Failed to load questions for exam');
    const typedRows = (rows ?? []) as QuestionRow[];
    const [{ data: opts }, { data: imgs }, { data: ladders }] = await Promise.all([
      supabase.from('question_options').select('*').in('question_id', uniqueIds),
      supabase.from('question_images').select('*').in('question_id', uniqueIds),
      supabase.from('ladder_questions').select('*').in('question_id', uniqueIds),
    ]);
    questionsForSnapshot = typedRows.map((q) => mapQuestion(
      q,
      ((opts as OptionRow[] | null)?.filter((o) => o.question_id === q.id) ?? []),
      ((imgs as ImageRow[] | null)?.filter((i) => i.question_id === q.id) ?? []),
      ((ladders as LadderRow[] | null)?.find((l) => l.question_id === q.id) ?? null),
    ));
    if (questionsForSnapshot.length !== uniqueIds.length) {
      throw new Error('One or more selected questions could not be found or do not belong to you.');
    }
  }
  const byId = new Map(questionsForSnapshot.map((q) => [q.id, q]));
  await supabase.from('exam_questions').delete().eq('exam_id', examId);
  if (uniqueIds.length > 0) {
    const { error } = await supabase
      .from('exam_questions')
      .insert(uniqueIds.map((qid, i) => ({
        exam_id: examId,
        question_id: qid,
        sort_order: i,
        question_snapshot: byId.get(qid) ?? null,
      })));
    if (error) throw toFriendlyError(error, 'Failed to save exam questions');
  }
  const { error: examErr } = await supabase.from('exams').update({
    question_set_id: questionSetId,
    question_selection_mode: questionSelectionMode,
  }).eq('id', examId).eq('teacher_id', tid);
  if (examErr) throw toFriendlyError(examErr, 'Failed to save exam question source');
}

export async function fetchExamSnapshotQuestions(examId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from('exam_questions')
    .select('question_id, question_snapshot, sort_order')
    .eq('exam_id', examId)
    .order('sort_order');
  if (error) throw toFriendlyError(error, 'Failed to load exam questions');
  const snapshots = (data ?? []) as Array<{ question_id: string; question_snapshot: Question | null; sort_order: number }>;
  return snapshots.filter((r) => r.question_snapshot).map((r) => r.question_snapshot as Question);
}


export function generateExamCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PLC-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ============================================================
// Classes
// ============================================================

interface ClassRow {
  id: string;
  teacher_id: string;
  name: string;
  join_code: string;
  school_id: string | null;
  created_at: string;
}

export async function fetchClasses(): Promise<Class[]> {
  const tid = getTeacherId();
  const { data: classes, error } = await supabase
    .from('classes')
    .select('*')
    .eq('teacher_id', tid)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!classes || classes.length === 0) return [];

  const ids = classes.map((c) => c.id);
  const { data: students } = await supabase
    .from('class_students')
    .select('class_id')
    .in('class_id', ids);

  return (classes as ClassRow[]).map((c) => ({
    id: c.id,
    teacherId: c.teacher_id,
    name: c.name,
    joinCode: c.join_code,
    createdAt: c.created_at,
    studentCount: (students ?? []).filter((s) => s.class_id === c.id).length,
  }));
}

function generateClassJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PLC-CLASS-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createClass(name: string): Promise<Class> {
  const tid = getTeacherId();

  // Auto-fill school_id from teacher's profile (teacher_id = auth.uid(),
  // school_id = profile.school_id, per the expected insert flow).
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', tid)
    .maybeSingle();
  if (profileErr) throw toFriendlyError(profileErr, 'Failed to create class');
  const schoolId = (profile as { school_id: string | null } | null)?.school_id ?? null;

  // The DB has a default generator for join_code, but we also generate one
  // client-side and send it explicitly so class creation never silently
  // fails if that default is ever missing (e.g. a migration didn't apply).
  const payload = { teacher_id: tid, name, school_id: schoolId, join_code: generateClassJoinCode() };
  debugLog('[CREATE_CLASS] payload', payload);

  const { data, error } = await supabase
    .from('classes')
    .insert(payload)
    .select()
    .single();

  if (error) throw toFriendlyError(error, 'Failed to create class');
  const row = data as ClassRow;
  return { id: row.id, teacherId: row.teacher_id, name: row.name, joinCode: row.join_code, createdAt: row.created_at, studentCount: 0 };
}

export async function renameClass(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('classes').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function deleteClass(id: string): Promise<void> {
  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) throw error;
}

export async function regenerateClassCode(id: string): Promise<string> {
  const newCode = `PLC-CLASS-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const { error } = await supabase.from('classes').update({ join_code: newCode }).eq('id', id);
  if (error) throw error;
  return newCode;
}

// ============================================================
// Class Students
// ============================================================

export async function fetchClassStudents(classId: string): Promise<ClassStudent[]> {
  const { data, error } = await supabase
    .from('class_students')
    .select('id, class_id, student_id, joined_at')
    .eq('class_id', classId)
    .order('joined_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Array<{ id: string; class_id: string; student_id: string; joined_at: string }>;
  if (rows.length === 0) return [];

  // class_students.student_id and profiles.id both reference auth.users(id)
  // independently — there is no direct FK between them, so PostgREST
  // cannot auto-embed profiles. Fetch separately instead.
  const studentIds = Array.from(new Set(rows.map((r) => r.student_id)));
  const { data: profileRows, error: profileErr } = await supabase
    .from('profiles')
    .select('id, full_name, email, username, avatar_url')
    .in('id', studentIds);
  if (profileErr) throw profileErr;
  const profileMap = new Map(
    (profileRows ?? []).map((p) => [p.id, {
      full_name: p.full_name as string,
      email: p.email as string,
      username: p.username as string,
      avatar_url: (p as { avatar_url: string | null }).avatar_url ?? null,
    }])
  );

  return rows.map((r) => ({
    id: r.id,
    classId: r.class_id,
    studentId: r.student_id,
    joinedAt: r.joined_at,
    fullName: profileMap.get(r.student_id)?.full_name ?? 'Unknown',
    email: profileMap.get(r.student_id)?.email ?? '',
    username: profileMap.get(r.student_id)?.username ?? '',
    avatarUrl: profileMap.get(r.student_id)?.avatar_url ?? null,
  }));
}

// ============================================================
// Exam Results
// ============================================================

export async function fetchExamResults(): Promise<ExamResult[]> {
  const tid = getTeacherId();
  const { data: exams } = await supabase.from('exams').select('id, name').eq('teacher_id', tid);
  if (!exams || exams.length === 0) return [];

  const examIds = exams.map((e) => e.id);
  const { data, error } = await supabase
    .from('exam_attempts')
    .select(`
      id,
      exam_id,
      student_id,
      score,
      correct_count,
      wrong_count,
      time_used_seconds,
      submitted_at,
      started_at,
      status,
      student_name,
      student_email,
      class_name
    `)
    .in('exam_id', examIds)
    .order('submitted_at', { ascending: false, nullsFirst: false });
  if (error) throw error;

  const examMap = new Map(exams.map((e) => [e.id, e.name]));

  type Row = {
    id: string;
    exam_id: string;
    student_id: string;
    score: number;
    correct_count: number;
    wrong_count: number;
    time_used_seconds: number;
    submitted_at: string | null;
    started_at: string;
    status: string;
    student_name: string | null;
    student_email: string | null;
    class_name: string | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return [];

  // Fetch profiles as a fallback for old attempts without stored identity.
  // Now that the RLS policy allows teachers to read student profiles, this
  // also fixes the "Unknown" issue for legacy rows.
  const studentIds = Array.from(new Set(rows.map((r) => r.student_id)));
  const { data: profileRows, error: profileErr } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', studentIds);
  if (profileErr) throw profileErr;
  const profileMap = new Map(
    (profileRows ?? []).map((p) => [p.id, { name: p.full_name as string, email: p.email as string }])
  );

  // Best-effort class lookup (only classes belonging to this teacher)
  const classNameByStudent = new Map<string, string>();
  const { data: cs } = await supabase
    .from('class_students')
    .select('student_id, classes!inner(name, teacher_id)')
    .in('student_id', studentIds);
  (cs as unknown as Array<{ student_id: string; classes: { name: string; teacher_id: string } }> | null)?.forEach((row) => {
    if (row.classes?.teacher_id === tid && !classNameByStudent.has(row.student_id)) {
      classNameByStudent.set(row.student_id, row.classes.name);
    }
  });

  const mapped: ExamResult[] = rows.map((r) => ({
    id: r.id,
    examId: r.exam_id,
    studentId: r.student_id,
    score: Number(r.score),
    correctCount: r.correct_count,
    wrongCount: r.wrong_count,
    timeUsedSeconds: r.time_used_seconds,
    completedAt: r.submitted_at ?? r.started_at,
    status: r.status as ExamResult['status'],
    studentName: r.student_name || profileMap.get(r.student_id)?.name || 'Unknown Student',
    studentEmail: r.student_email || profileMap.get(r.student_id)?.email || '',
    examName: examMap.get(r.exam_id) ?? 'Unknown',
    className: r.class_name || classNameByStudent.get(r.student_id) || null,
    rank: null,
  }));

  // Ranking: per exam, completed attempts only — highest score first,
  // tie-broken by fastest time used.
  const byExam = new Map<string, ExamResult[]>();
  mapped.forEach((r) => {
    if (!byExam.has(r.examId)) byExam.set(r.examId, []);
    byExam.get(r.examId)!.push(r);
  });
  byExam.forEach((group) => {
    const completed = group
      .filter((r) => r.status === 'completed')
      .sort((a, b) => b.score - a.score || a.timeUsedSeconds - b.timeUsedSeconds);
    completed.forEach((r, i) => { r.rank = i + 1; });
  });

  return mapped;
}

// ============================================================
// Students (auto-populated from exam submissions)
// ============================================================

export async function fetchStudents(): Promise<StudentSummary[]> {
  const results = await fetchExamResults();
  const completed = results.filter((r) => r.status === 'completed');

  const byStudent = new Map<string, StudentSummary>();
  for (const r of completed) {
    const existing = byStudent.get(r.studentId);
    if (existing) {
      existing.totalExams++;
      existing.averageScore = (existing.averageScore * (existing.totalExams - 1) + r.score) / existing.totalExams;
      existing.highestScore = Math.max(existing.highestScore, r.score);
      if (new Date(r.completedAt).getTime() > new Date(existing.lastActivity).getTime()) {
        existing.lastActivity = r.completedAt;
      }
    } else {
      byStudent.set(r.studentId, {
        studentId: r.studentId,
        studentName: r.studentName,
        studentEmail: r.studentEmail,
        className: r.className,
        totalExams: 1,
        averageScore: r.score,
        highestScore: r.score,
        lastActivity: r.completedAt,
      });
    }
  }

  return Array.from(byStudent.values()).sort(
    (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  );
}

export async function fetchStudentDetail(studentId: string): Promise<StudentDetail | null> {
  const results = await fetchExamResults();
  const studentResults = results.filter((r) => r.studentId === studentId);

  // A student can be a class member with zero exam attempts (e.g. just
  // joined, or the class has no exams yet) — that's not the same as the
  // student not existing. Only bail out here if we truly can't find any
  // profile for this id; otherwise fall through and build the detail view
  // from their profile/class data with exam stats defaulted to zero.
  let profileExists = studentResults.length > 0;

  const completed = studentResults.filter((r) => r.status === 'completed');
  const totalExams = completed.length;
  const averageScore = totalExams > 0
    ? Math.round(completed.reduce((sum, r) => sum + r.score, 0) / totalExams)
    : 0;
  const highestScore = totalExams > 0 ? Math.max(...completed.map((r) => r.score)) : 0;
  const lastActivity = studentResults
    .map((r) => r.completedAt)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? '';
  const totalCorrect = completed.reduce((s, r) => s + r.correctCount, 0);
  const totalWrong = completed.reduce((s, r) => s + r.wrongCount, 0);
  const accuracy = (totalCorrect + totalWrong) > 0
    ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100)
    : 0;

  const first = studentResults[0] as (typeof studentResults)[number] | undefined;

  // Name/email/XP/level from the profile directly — this is the source of
  // truth regardless of whether the student has taken any exams yet.
  let xp = 0;
  let level = 1;
  let schoolName: string | null = null;
  let schoolId: string | null = null;
  let studentName = first?.studentName ?? '';
  let studentEmail = first?.studentEmail ?? '';
  let avatarUrl: string | null = null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, avatar_url, xp, level, school_id, schools!left(name)')
    .eq('id', studentId)
    .maybeSingle();
  if (profile) {
    profileExists = true;
    studentName = (profile as { full_name: string }).full_name ?? studentName;
    studentEmail = (profile as { email: string }).email ?? studentEmail;
    avatarUrl = (profile as { avatar_url: string | null }).avatar_url ?? null;
    xp = (profile as { xp: number }).xp ?? 0;
    level = (profile as { level: number }).level ?? 1;
    schoolId = (profile as { school_id: string | null }).school_id ?? null;
    const schoolJoin = (profile as unknown as { schools?: { name: string } | null }).schools;
    schoolName = schoolJoin?.name ?? null;
  }

  if (!profileExists) return null;

  // Class + teacher info
  let className: string | null = first?.className ?? null;
  let teacherName: string | null = null;
  const { data: csRow } = await supabase
    .from('class_students')
    .select('classes!inner(id, name, teacher_id)')
    .eq('student_id', studentId)
    .order('joined_at', { ascending: false })
    .limit(1);
  const csData = (csRow ?? []) as unknown as Array<{ classes: { id: string; name: string; teacher_id: string } }>;
  if (csData.length > 0) {
    className = csData[0].classes.name;
    const { data: teacherProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', csData[0].classes.teacher_id)
      .maybeSingle();
    teacherName = (teacherProfile as { full_name: string } | null)?.full_name ?? null;
  }

  // Ranks from leaderboards
  let globalRank: number | null = null;
  let schoolRank: number | null = null;
  let classRank: number | null = null;

  const { data: globalLb } = await supabase
    .from('leaderboards')
    .select('student_id, ranking_score')
    .eq('scope', 'global')
    .order('ranking_score', { ascending: false });
  const globalRows = (globalLb ?? []) as Array<{ student_id: string; ranking_score: number }>;
  const gIdx = globalRows.findIndex((r) => r.student_id === studentId);
  globalRank = gIdx >= 0 ? gIdx + 1 : null;

  if (schoolId) {
    const { data: schoolLb } = await supabase
      .from('leaderboards')
      .select('student_id, ranking_score')
      .eq('scope', 'school')
      .eq('school_id', schoolId)
      .order('ranking_score', { ascending: false });
    const schoolRows = (schoolLb ?? []) as Array<{ student_id: string; ranking_score: number }>;
    const sIdx = schoolRows.findIndex((r) => r.student_id === studentId);
    schoolRank = sIdx >= 0 ? sIdx + 1 : null;
  }

  if (csData.length > 0) {
    const { data: classLb } = await supabase
      .from('leaderboards')
      .select('student_id, ranking_score')
      .eq('scope', 'class')
      .eq('scope_id', csData[0].classes.id)
      .order('ranking_score', { ascending: false });
    const classRows = (classLb ?? []) as Array<{ student_id: string; ranking_score: number }>;
    const cIdx = classRows.findIndex((r) => r.student_id === studentId);
    classRank = cIdx >= 0 ? cIdx + 1 : null;
  }

  // Leaderboard position among teacher's students
  const allStudents = await fetchStudents();
  const ranked = allStudents
    .sort((a, b) => b.averageScore - a.averageScore || b.highestScore - a.highestScore);
  const leaderboardPosition = ranked.findIndex((s) => s.studentId === studentId);
  const pos = leaderboardPosition >= 0 ? leaderboardPosition + 1 : null;

  // Build XP and score history from completed attempts
  const sortedCompleted = completed.sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  );
  let cumulativeXp = 0;
  const xpHistory: { date: string; xp: number }[] = [];
  const scoreHistory: { date: string; score: number }[] = [];
  for (const r of sortedCompleted) {
    // Approximate XP per exam from score
    cumulativeXp += Math.round(r.score * 10);
    xpHistory.push({ date: r.completedAt, xp: cumulativeXp });
    scoreHistory.push({ date: r.completedAt, score: r.score });
  }

  return {
    studentId,
    studentName,
    studentEmail,
    avatarUrl,
    className,
    schoolName,
    teacherName,
    xp,
    level,
    globalRank,
    schoolRank,
    classRank,
    leaderboardPosition: pos,
    totalExams,
    averageScore,
    highestScore,
    accuracy,
    lastActivity,
    history: studentResults.sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    ),
    xpHistory,
    scoreHistory,
  };
}

// ============================================================
// Result Detail (question-by-question review)
// ============================================================

export async function fetchResultDetail(attemptId: string): Promise<ResultDetail | null> {
  const tid = getTeacherId();

  // Fetch the attempt row (teacher can only see attempts for their exams)
  const { data: attemptRow, error: attemptErr } = await supabase
    .from('exam_attempts')
    .select(`
      id,
      exam_id,
      student_id,
      score,
      correct_count,
      wrong_count,
      time_used_seconds,
      submitted_at,
      started_at,
      status,
      answers,
      student_name,
      student_email,
      class_name
    `)
    .eq('id', attemptId)
    .maybeSingle();
  if (attemptErr) throw attemptErr;
  if (!attemptRow) return null;

  type AttemptRow = {
    id: string;
    exam_id: string;
    student_id: string;
    score: number;
    correct_count: number;
    wrong_count: number;
    time_used_seconds: number;
    submitted_at: string | null;
    started_at: string;
    status: string;
    answers: Record<string, unknown>;
    student_name: string | null;
    student_email: string | null;
    class_name: string | null;
  };
  const attempt = attemptRow as unknown as AttemptRow;

  // Fetch the exam to verify ownership and get name
  const { data: examRow } = await supabase
    .from('exams')
    .select('id, name, teacher_id')
    .eq('id', attempt.exam_id)
    .maybeSingle();
  if (!examRow || (examRow as { teacher_id: string }).teacher_id !== tid) return null;

  // Fetch exam_questions to get question order
  const { data: eqRows } = await supabase
    .from('exam_questions')
    .select('question_id, question_snapshot, sort_order')
    .eq('exam_id', attempt.exam_id)
    .order('sort_order');
  const questionIds = (eqRows ?? []).map((r) => {
    const row = r as { question_id: string | null; question_snapshot?: { id?: string } | null };
    return row.question_id ?? row.question_snapshot?.id ?? null;
  }).filter((id): id is string => !!id);
  if (questionIds.length === 0) {
    return buildResultDetail(attempt, (examRow as { name: string }).name, [], attempt.answers ?? {});
  }

  // Prefer the immutable exam snapshot. Legacy exams fall back to live question rows.
  type Snapshot = { id: string; question: string; type: string; options?: Array<{ label: string; isCorrect: boolean }>; ladderData?: { answerLadderJson?: string | null } | null };
  const snapshotRows = (eqRows ?? []) as Array<{ question_id: string; question_snapshot: Snapshot | null; sort_order: number }>;
  const useSnapshots = snapshotRows.length > 0 && snapshotRows.every((r) => !!r.question_snapshot);
  const qMap = new Map<string, { id: string; question: string; type: string }>();
  const optsByQuestion = new Map<string, Array<{ label: string; is_correct: boolean }>>();
  const ladderByQuestion = new Map<string, string | null>();

  if (useSnapshots) {
    snapshotRows.forEach((r) => {
      const q = r.question_snapshot!;
      qMap.set(q.id, { id: q.id, question: q.question, type: q.type });
      optsByQuestion.set(q.id, (q.options ?? []).map((o) => ({ label: o.label, is_correct: o.isCorrect })));
      ladderByQuestion.set(q.id, q.ladderData?.answerLadderJson ?? null);
    });
  } else {
    const { data: qRows } = await supabase
      .from('questions')
      .select('id, question, type')
      .in('id', questionIds);
    (qRows ?? []).forEach((q) => qMap.set(q.id, q as { id: string; question: string; type: string }));
    const { data: optRows } = await supabase
      .from('question_options')
      .select('question_id, label, is_correct')
      .in('question_id', questionIds);
    (optRows ?? []).forEach((o) => {
      const row = o as { question_id: string; label: string; is_correct: boolean };
      if (!optsByQuestion.has(row.question_id)) optsByQuestion.set(row.question_id, []);
      optsByQuestion.get(row.question_id)!.push({ label: row.label, is_correct: row.is_correct });
    });
    const { data: ladderRows } = await supabase
      .from('ladder_questions')
      .select('question_id, answer_ladder_json')
      .in('question_id', questionIds);
    (ladderRows ?? []).forEach((l) => {
      const row = l as { question_id: string; answer_ladder_json: string | null };
      ladderByQuestion.set(row.question_id, row.answer_ladder_json);
    });
  }

  const questionReviews: QuestionReview[] = questionIds.map((qid) => {
    const q = qMap.get(qid);
    const opts = optsByQuestion.get(qid) ?? [];
    const correctOpt = opts.find((o) => o.is_correct);
    const studentAns = attempt.answers?.[qid];
    const correctAnswer = correctOpt?.label ?? (ladderByQuestion.get(qid) ? 'Ladder solution' : '');

    let studentAnswerStr = '';
    let isCorrect = false;
    let ladderJson: string | null = null;

    if (typeof studentAns === 'number' && opts[studentAns]) {
      studentAnswerStr = opts[studentAns].label;
      isCorrect = opts[studentAns].is_correct;
    } else if (typeof studentAns === 'string') {
      studentAnswerStr = 'Ladder submission';
      ladderJson = studentAns;
      // For ladder, we can't easily re-grade without the full question data.
      // Mark based on stored correct/wrong counts comparison is not per-question,
      // so we just show the submission. Correctness is approximated.
      isCorrect = false;
    } else if (studentAns === null || studentAns === undefined) {
      studentAnswerStr = 'No answer';
    }

    return {
      questionId: qid,
      questionText: q?.question ?? 'Unknown question',
      questionType: q?.type ?? 'multiple_choice',
      studentAnswer: studentAnswerStr,
      correctAnswer,
      isCorrect,
      ladderJson,
    };
  });

  return buildResultDetail(
    attempt,
    (examRow as { name: string }).name,
    questionReviews,
    attempt.answers ?? {}
  );
}

function buildResultDetail(
  attempt: {
    id: string;
    exam_id: string;
    student_id: string;
    score: number;
    correct_count: number;
    wrong_count: number;
    time_used_seconds: number;
    submitted_at: string | null;
    started_at: string;
    status: string;
    student_name: string | null;
    student_email: string | null;
    class_name: string | null;
  },
  examName: string,
  questionReviews: QuestionReview[],
  _answers: Record<string, unknown>
): ResultDetail {
  // Compute rank among all attempts for this exam
  return {
    id: attempt.id,
    examId: attempt.exam_id,
    examName,
    studentId: attempt.student_id,
    studentName: attempt.student_name || 'Unknown Student',
    studentEmail: attempt.student_email || '',
    className: attempt.class_name || null,
    score: Number(attempt.score),
    correctCount: attempt.correct_count,
    wrongCount: attempt.wrong_count,
    rank: null,
    timeUsedSeconds: attempt.time_used_seconds,
    submittedAt: attempt.submitted_at ?? attempt.started_at,
    status: attempt.status as ResultDetail['status'],
    questionReviews,
  };
}

// ============================================================
// Dashboard Statistics
// ============================================================

export async function fetchDashboardStats(): Promise<{
  totalExams: number;
  totalQuestions: number;
  totalStudents: number;
  averageScore: number;
  activeExams: number;
  recentActivity: Array<{
    id: string;
    studentName: string;
    examName: string;
    score: number;
    completedAt: string;
    status: string;
  }>;
}> {
  const tid = getTeacherId();
  const { data: exams } = await supabase.from('exams').select('id, name, status').eq('teacher_id', tid);
  const { data: questionCount } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', tid)
    .eq('archived', false);

  const results = await fetchExamResults();
  const completed = results.filter((r) => r.status === 'completed');
  const totalStudents = new Set(completed.map((r) => r.studentId)).size;
  const averageScore = completed.length > 0
    ? Math.round(completed.reduce((sum, r) => sum + r.score, 0) / completed.length)
    : 0;

  const recentActivity = completed
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      studentName: r.studentName,
      examName: r.examName,
      score: r.score,
      completedAt: r.completedAt,
      status: r.status,
    }));

  return {
    totalExams: exams?.length ?? 0,
    totalQuestions: questionCount?.length ?? 0,
    totalStudents,
    averageScore,
    activeExams: (exams ?? []).filter((e) => (e as { status: string }).status === 'published').length,
    recentActivity,
  };
}

// ============================================================
// Image upload
// ============================================================

export async function uploadQuestionImage(file: File): Promise<string> {
  const tid = getTeacherId();
  const ext = file.name.split('.').pop() ?? 'png';
  const path = `${tid}/q-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('question-images').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('question-images').getPublicUrl(path);
  return data.publicUrl;
}
