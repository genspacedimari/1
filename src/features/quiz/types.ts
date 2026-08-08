export type QuizDifficulty = 'easy' | 'medium' | 'hard';
export type QuizCategory =
  | 'PLC Basic' | 'PLC Intermediate' | 'PLC Advanced'
  | 'Timer' | 'Counter' | 'Memory' | 'Safety' | 'Troubleshooting' | 'Random';

export type QuestionType = 'multiple_choice' | 'image' | 'ladder';
export type LadderMode = 'build' | 'complete' | 'find_error' | 'predict_output' | 'choose_correct';
export type AttemptStatus = 'in_progress' | 'completed' | 'abandoned';
export type LeaderboardScope = 'class' | 'weekly' | 'monthly' | 'global' | 'school';
export type ExamVisibility = 'school' | 'selected_class';

export interface StudentClassInfo {
  id: string;
  name: string;
  joinCode: string;
  teacherName: string;
  teacherEmail: string;
  schoolName: string | null;
  studentCount: number;
  createdAt: string;
}

export interface ClassExamInfo {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  examDate: string | null;
  startTime: string | null;
  status: string;
  examCode: string;
  teacherName: string;
  questionCount: number;
  attemptsRemaining: number;
  myStatus: 'not_started' | 'in_progress' | 'completed';
  myScore: number | null;
}

export interface QuizOption {
  label: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  difficulty: QuizDifficulty;
  points: number;
  explanation: string | null;
  options: QuizOption[];
  imageUrls: string[];
  ladderMode?: LadderMode;
  ladderJson?: string | null;
  expectedOutput?: string | null;
  answerLadderJson?: string | null;
}

export interface OfficialQuiz {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  difficulty: QuizDifficulty;
  questionCount: number;
  estimatedMinutes: number;
  xpReward: number;
  category: string;
  quizData: QuizQuestion[];
  createdAt: string;
}

export interface ExamInfo {
  id: string;
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
  teacherName: string;
  questionCount: number;
  attemptsRemaining: number;
  questions: QuizQuestion[];
  visibility?: ExamVisibility;
  schoolId?: string | null;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  timeUsedSeconds: number;
  remainingSeconds: number | null;
  status: AttemptStatus;
  answers: Record<string, unknown>;
  startedAt: string;
  submittedAt: string | null;
  attemptNumber: number;
  xpEarned: number;
}

export interface PracticeAttempt {
  id: string;
  category: string;
  difficulty: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  durationSeconds: number;
  completedAt: string;
}

export interface LeaderboardEntry {
  id: string;
  studentName: string;
  totalXp: number;
  examCount: number;
  avgScore: number;
  rankingScore?: number;
  accuracy?: number;
  rank: number | null;
}

export interface StudentProgress {
  totalXp: number;
  level: number;
  examsCompleted: number;
  quizzesCompleted: number;
  practiceCompleted: number;
}

export interface QuestionPaletteState {
  questionId: string;
  answered: boolean;
  flagged: boolean;
  current: boolean;
}

export const PRACTICE_CATEGORIES: QuizCategory[] = [
  'PLC Basic', 'PLC Intermediate', 'PLC Advanced',
  'Timer', 'Counter', 'Memory', 'Safety', 'Troubleshooting', 'Random',
];

export const PRACTICE_DIFFICULTIES: QuizDifficulty[] = ['easy', 'medium', 'hard'];

export const PALETTE_COLORS = {
  notAnswered: '#9CA3AF',
  current: '#F26B3A',
  answered: '#22C55E',
  flagged: '#EF4444',
};
