import { create } from 'zustand';
import type {
  OfficialQuiz, ExamInfo, ExamAttempt, PracticeAttempt,
  LeaderboardEntry, StudentProgress, QuizQuestion, QuestionPaletteState,
} from './types';
import * as svc from './services';
import { useAuthStore } from '@/stores/authStore';

interface QuizState {
  // Data
  officialQuizzes: OfficialQuiz[];
  activeExam: ExamInfo | null;
  activeAttempt: ExamAttempt | null;
  practiceHistory: PracticeAttempt[];
  examHistory: Array<ExamAttempt & { examName: string }>;
  progress: StudentProgress | null;
  leaderboard: LeaderboardEntry[];

  // Loading
  loading: boolean;
  error: string | null;

  // Exam player state
  currentQuestionIndex: number;
  answers: Record<string, unknown>;
  flaggedQuestions: Set<string>;
  remainingSeconds: number | null;
  startTime: number | null;
  attemptId: string | null;

  // Actions
  loadOfficialQuizzes: () => Promise<void>;
  joinExam: (code: string) => Promise<ExamInfo | null>;
  startExam: (exam: ExamInfo) => Promise<void>;
  resumeExam: (attempt: ExamAttempt, exam: ExamInfo) => void;
  saveProgress: () => Promise<void>;
  submitExam: () => Promise<{ score: number; correct: number; wrong: number; xp: number } | null>;
  answerQuestion: (questionId: string, answer: unknown) => void;
  toggleFlag: (questionId: string) => void;
  setCurrentQuestion: (index: number) => void;
  setRemainingSeconds: (s: number) => void;
  exitExam: () => void;

  loadPracticeHistory: () => Promise<void>;
  loadExamHistory: () => Promise<void>;
  loadProgress: () => Promise<void>;
  loadLeaderboard: (scope: 'class' | 'weekly' | 'monthly' | 'global' | 'school', scopeId?: string, page?: number) => Promise<void>;

  getPaletteState: (questions: QuizQuestion[]) => QuestionPaletteState[];
  clearExamState: () => void;
}

export const useQuizStore = create<QuizState>((set, get) => ({
  officialQuizzes: [],
  activeExam: null,
  activeAttempt: null,
  practiceHistory: [],
  examHistory: [],
  progress: null,
  leaderboard: [],
  loading: false,
  error: null,
  currentQuestionIndex: 0,
  answers: {},
  flaggedQuestions: new Set(),
  remainingSeconds: null,
  startTime: null,
  attemptId: null,

  loadOfficialQuizzes: async () => {
    set({ loading: true, error: null });
    try {
      const quizzes = await svc.fetchOfficialQuizzes();
      set({ officialQuizzes: quizzes, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load quizzes', loading: false });
    }
  },

  joinExam: async (code) => {
    set({ loading: true, error: null });
    try {
      const exam = await svc.findExamByCode(code);
      set({ activeExam: exam, loading: false });
      return exam;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to find exam', loading: false });
      return null;
    }
  },

  startExam: async (exam) => {
    set({ loading: true, error: null });
    try {
      const attempt = await svc.startExamAttempt(exam.id, exam.durationMinutes);
      set({
        activeExam: exam,
        activeAttempt: attempt,
        attemptId: attempt.id,
        answers: {},
        flaggedQuestions: new Set(),
        currentQuestionIndex: 0,
        remainingSeconds: exam.durationMinutes * 60,
        startTime: Date.now(),
        loading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to start exam', loading: false });
    }
  },

  resumeExam: (attempt, exam) => {
    set({
      activeExam: exam,
      activeAttempt: attempt,
      attemptId: attempt.id,
      answers: attempt.answers,
      flaggedQuestions: new Set(),
      currentQuestionIndex: 0,
      remainingSeconds: attempt.remainingSeconds ?? exam.durationMinutes * 60,
      startTime: Date.now() - (attempt.timeUsedSeconds * 1000),
      loading: false,
    });
  },

  saveProgress: async () => {
    const { attemptId, answers, remainingSeconds } = get();
    if (!attemptId || remainingSeconds === null) return;
    try {
      await svc.saveAttemptProgress(attemptId, answers, remainingSeconds);
    } catch {
      // Silent fail — auto-save should not disrupt the student
    }
  },

  submitExam: async () => {
    const { activeExam, attemptId, answers, remainingSeconds, startTime } = get();
    if (!activeExam || !attemptId || !startTime) return null;

    const authState = useAuthStore.getState();
    const profile = authState.profile;
    const studentName = profile?.fullName ?? 'Unknown Student';
    const studentEmail = profile?.email ?? '';

    let correct = 0;
    let wrong = 0;
    const totalPoints = activeExam.questions.reduce((sum, q) => sum + q.points, 0);
    let earnedPoints = 0;

    for (const q of activeExam.questions) {
      const ans = answers[q.id];
      let isCorrect = false;
      if (q.type === 'multiple_choice' && typeof ans === 'number') {
        isCorrect = svc.gradeMCQuestion(q.options, ans);
      } else if (q.type === 'image' && typeof ans === 'number') {
        isCorrect = svc.gradeImageQuestion(q.options, ans);
      } else if (q.type === 'ladder' && typeof ans === 'string') {
        isCorrect = (await import('./ladderGrading')).gradeLadderQuestion(q, ans);
      }
      if (isCorrect) {
        correct++;
        earnedPoints += q.points;
      } else {
        wrong++;
      }
    }

    const score = svc.calculateScore(correct, activeExam.questions.length, totalPoints);
    const timeUsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const xp = svc.calculateXP(score, totalPoints);

    try {
      await svc.submitExamAttempt(attemptId, {
        score,
        correctCount: correct,
        wrongCount: wrong,
        timeUsedSeconds,
        remainingSeconds: remainingSeconds ?? 0,
        answers,
        xpEarned: xp,
        studentName,
        studentEmail,
        examId: activeExam.id,
      });
      set({ activeExam: null, activeAttempt: null, attemptId: null });
      return { score, correct, wrong, xp };
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to submit exam' });
      return null;
    }
  },

  answerQuestion: (questionId, answer) => {
    set((state) => ({ answers: { ...state.answers, [questionId]: answer } }));
    get().saveProgress();
  },

  toggleFlag: (questionId) => {
    set((state) => {
      const flagged = new Set(state.flaggedQuestions);
      if (flagged.has(questionId)) flagged.delete(questionId);
      else flagged.add(questionId);
      return { flaggedQuestions: flagged };
    });
  },

  setCurrentQuestion: (index) => {
    set({ currentQuestionIndex: index });
  },

  setRemainingSeconds: (s) => set({ remainingSeconds: s }),

  exitExam: () => {
    const { attemptId } = get();
    if (attemptId) {
      svc.abandonAttempt(attemptId).catch(() => {});
    }
    get().clearExamState();
  },

  loadPracticeHistory: async () => {
    try {
      const history = await svc.fetchPracticeHistory();
      set({ practiceHistory: history });
    } catch { /* silent */ }
  },

  loadExamHistory: async () => {
    try {
      const history = await svc.fetchExamHistory();
      set({ examHistory: history });
    } catch { /* silent */ }
  },

  loadProgress: async () => {
    try {
      const progress = await svc.fetchStudentProgress();
      set({ progress });
    } catch { /* silent */ }
  },

  loadLeaderboard: async (scope, scopeId, page = 0) => {
    try {
      const lb = await svc.fetchLeaderboard(scope, scopeId, page);
      set({ leaderboard: lb });
    } catch { /* silent */ }
  },

  getPaletteState: (questions) => {
    const { answers, flaggedQuestions, currentQuestionIndex } = get();
    return questions.map((q, i) => ({
      questionId: q.id,
      answered: answers[q.id] !== undefined,
      flagged: flaggedQuestions.has(q.id),
      current: i === currentQuestionIndex,
    }));
  },

  clearExamState: () => set({
    activeExam: null,
    activeAttempt: null,
    attemptId: null,
    answers: {},
    flaggedQuestions: new Set(),
    currentQuestionIndex: 0,
    remainingSeconds: null,
    startTime: null,
  }),
}));
