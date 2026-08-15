export type QuestionType = 'multiple_choice' | 'image' | 'ladder';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type ExamStatus = 'draft' | 'published' | 'archived';
export type LadderMode = 'build' | 'complete' | 'find_error' | 'predict_output' | 'choose_correct';
export type ResultStatus = 'in_progress' | 'completed' | 'abandoned';

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
  mode: LadderMode;
  ladderJson: string | null;
  expectedOutput: string | null;
  answerLadderJson: string | null;
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
