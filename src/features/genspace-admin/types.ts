export type AdminQuizKind = 'practice' | 'official';
export type BadgePlacement = '1st' | '2nd' | '3rd';

export interface AdminQuizQuestion {
  id: string;
  type: 'multiple_choice';
  question: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  explanation: string | null;
  options: Array<{ label: string; isCorrect: boolean }>;
  imageUrls: string[];
}

/**
 * A question as it appears in the "Import dari Bank Soal" picker.
 * Adds which Question Set (folder) it came from — e.g. an Excel-imported
 * batch — so the picker can group questions by folder instead of forcing
 * a one-by-one pick. `questionSetId`/`questionSetName` are null for
 * standalone questions that were never placed in a set.
 */
export interface BankQuestion extends AdminQuizQuestion {
  questionSetId: string | null;
  questionSetName: string | null;
}

export interface AdminQuiz {
  id: string;
  title: string;
  description: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  questionCount: number;
  estimatedMinutes: number;
  xpReward: number;
  quizData: AdminQuizQuestion[];
  isPublished: boolean;
  createdAt: string;
}

export interface Competition {
  id: string;
  name: string;
  description: string | null;
  accessCode: string;
  status: 'draft' | 'published' | 'live' | 'finished';
  startAt: string | null;
  endAt: string | null;
  maxParticipants: number | null;
  badgePrefix: string;
  durationMinutes: number;
  questionCount: number;
  quizData: AdminQuizQuestion[];
  createdAt: string;
}

export interface ProfileSearchResult {
  id: string;
  fullName: string;
  username: string;
  email: string;
}

/**
 * One row in a competition's leaderboard/results, shown in the admin
 * "Kelola" panel. Ranked by score desc, then time used asc (faster wins
 * ties) — computed client-side in fetchCompetitionParticipants.
 */
export interface CompetitionParticipant {
  id: string;
  userId: string;
  fullName: string;
  username: string;
  email: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  timeUsedSeconds: number;
  submittedAt: string;
  rank: number;
  badgePlacement: BadgePlacement | null;
}
