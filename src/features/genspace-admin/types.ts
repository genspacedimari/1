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
