import type { TestCase } from '@/features/quiz/behaviorTypes';

export type QuestionType = 'multiple_choice' | 'image' | 'ladder';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type ExamStatus = 'draft' | 'published' | 'archived';
/** Legacy structural-comparison modes — still readable/gradable for old
 * questions (see src/features/quiz/ladderGrading.ts), but new ladder
 * questions should use ChallengeType + testCases (behavior-based grading,
 * src/features/quiz/behaviorGrading.ts) instead. */
export type LadderMode = 'build' | 'complete' | 'find_error' | 'predict_output' | 'choose_correct';
export type ResultStatus = 'in_progress' | 'completed' | 'abandoned';

/**
 * How a Ladder PLC question relates to its Master Program (PlcProgram):
 *  - 'modify': student starts from a copy of the program and must change
 *    it per the instruction (e.g. "hapus kontak I2").
 *  - 'create_from_instruction': student starts from a BLANK editor and
 *    must build a program from scratch per the instruction. No starting
 *    ladder is shown.
 *  - 'debug': student starts from a deliberately-broken copy of the
 *    program and must find and fix the error.
 */
export type ChallengeType = 'modify' | 'create_from_instruction' | 'debug';

export const CHALLENGE_TYPE_LABELS: Record<ChallengeType, string> = {
  modify: 'Modifikasi Program',
  create_from_instruction: 'Buat Program dari Instruksi',
  debug: 'Debugging / Perbaiki Program',
};

/**
 * Master Program — a reusable base ladder program a teacher builds once
 * in the Ladder Editor/Simulator, then turns into many questions (spec
 * section 2: "1 Master Program = bisa memiliki banyak soal"). Lives in
 * the teacher's "PLC Program Library".
 */
export interface PlcProgram {
  id: string;
  teacherId: string;
  name: string;
  description: string | null;
  /** The full LadderProject, JSON-encoded — same shape the Ladder
   * Editor/Simulator/PlcRuntime already read and write. */
  programJson: string;
  /** How many questions currently reference this program (for the
   * Program Library list view — "Kontrol Motor Dasar · 3 soal"). */
  questionCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionCategory {
  id: string;
  teacherId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface QuestionOption {
  id?: string;
  label: string;
  isCorrect: boolean;
  sortOrder: number;
}

export interface QuestionImage {
  id?: string;
  imageUrl: string;
}

export interface LadderQuestionData {
  id?: string;
  /** @deprecated kept for old questions graded by ladderGrading.ts's
   * structural comparison. New questions should set challengeType +
   * testCases instead and leave this as any legacy value / 'build'. */
  mode: LadderMode;
  /** Starting ladder shown to the student, JSON-encoded LadderProject.
   * Null for challengeType 'create_from_instruction' (blank editor). For
   * 'modify'/'debug' this is a SNAPSHOT copied from the Master Program
   * (optionally with an intentional bug introduced for 'debug') — editing
   * the Master Program later does not retroactively change it. */
  ladderJson: string | null;
  /** @deprecated legacy free-text expected output, superseded by
   * testCases' structured expectedOutputs. */
  expectedOutput: string | null;
  /** Optional reference/answer program a teacher can run "Test Answer"
   * against before publishing (spec section 9). Never shown to students. */
  answerLadderJson: string | null;
  /** The Master Program this question was created from, if any. Optional
   * so 'create_from_instruction' questions (which don't need a base
   * program) and old rows created before this field existed both work. */
  programId?: string | null;
  /** Which of the three authoring flows (spec section 3) this question
   * uses. Optional for backward compatibility with rows saved before this
   * field existed — treat missing as 'modify' when reading legacy rows. */
  challengeType?: ChallengeType;
  /** Behavior-based test cases (spec sections 6-8) — the actual grading
   * source of truth for questions created via the new flow. Run through
   * src/features/quiz/behaviorGrading.ts's runTestSuite(). Empty/omitted
   * for legacy questions still graded by structural comparison. */
  testCases?: TestCase[];
}

export interface QuestionSet {
  id: string;
  teacherId: string;
  name: string;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  teacherId: string;
  questionSetId: string | null;
  categoryId: string | null;
  type: QuestionType;
  question: string;
  difficulty: Difficulty;
  points: number;
  explanation: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  options: QuestionOption[];
  images: QuestionImage[];
  ladderData: LadderQuestionData | null;
}

export interface Exam {
  id: string;
  teacherId: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  examDate: string | null;
  startTime: string | null;
  lateJoinMinutes: number;
  maxAttempts: number;
  passingScore: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  showResultAfter: boolean;
  allowReview: boolean;
  examCode: string;
  status: ExamStatus;
  visibility: ExamVisibility;
  targetAllClasses: boolean;
  schoolId: string | null;
  questionSetId: string | null;
  questionSelectionMode: 'all' | 'specific' | null;
  createdAt: string;
  updatedAt: string;
  questionIds: string[];
  classIds: string[];
}

export type ExamVisibility = 'school' | 'selected_class';

export interface Class {
  id: string;
  teacherId: string;
  name: string;
  joinCode: string;
  createdAt: string;
  studentCount: number;
}

export interface ClassStudent {
  id: string;
  classId: string;
  studentId: string;
  joinedAt: string;
  fullName: string;
  email: string;
  username: string;
  avatarUrl: string | null;
}

export interface ExamResult {
  id: string;
  examId: string;
  studentId: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  timeUsedSeconds: number;
  completedAt: string;
  status: ResultStatus;
  studentName: string;
  studentEmail: string;
  examName: string;
  className: string | null;
  rank: number | null;
}

export interface StudentSummary {
  studentId: string;
  studentName: string;
  studentEmail: string;
  className: string | null;
  totalExams: number;
  averageScore: number;
  highestScore: number;
  lastActivity: string;
}

export interface StudentDetail extends StudentSummary {
  avatarUrl: string | null;
  schoolName: string | null;
  teacherName: string | null;
  xp: number;
  level: number;
  globalRank: number | null;
  schoolRank: number | null;
  classRank: number | null;
  leaderboardPosition: number | null;
  accuracy: number;
  history: ExamResult[];
  xpHistory: { date: string; xp: number }[];
  scoreHistory: { date: string; score: number }[];
}

export interface ResultDetail {
  id: string;
  examId: string;
  examName: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  className: string | null;
  score: number;
  correctCount: number;
  wrongCount: number;
  rank: number | null;
  timeUsedSeconds: number;
  submittedAt: string;
  status: ResultStatus;
  questionReviews: QuestionReview[];
}

export interface QuestionReview {
  questionId: string;
  questionText: string;
  questionType: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  ladderJson: string | null;
}

export const DEFAULT_CATEGORIES = [
  'PLC Basic',
  'PLC Intermediate',
  'PLC Advanced',
  'Timer',
  'Counter',
  'Memory',
  'Safety',
  'Troubleshooting',
];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple Choice',
  image: 'Image Question',
  ladder: 'Ladder Logic',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export const LADDER_MODE_LABELS: Record<LadderMode, string> = {
  build: 'Build Ladder',
  complete: 'Complete Ladder',
  find_error: 'Find Error',
  predict_output: 'Predict Output',
  choose_correct: 'Choose Correct Ladder',
};

export const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};
