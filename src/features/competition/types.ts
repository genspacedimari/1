export interface CompetitionOption {
  label: string;
  isCorrect: boolean;
}

export interface CompetitionQuestion {
  id: string;
  type: 'multiple_choice';
  question: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  explanation: string | null;
  options: CompetitionOption[];
  imageUrls: string[];
}

export type CompetitionStatus = 'draft' | 'published' | 'live' | 'finished';

/** A competition as seen by a student validating an access code. */
export interface CompetitionInfo {
  id: string;
  name: string;
  description: string | null;
  accessCode: string;
  status: CompetitionStatus;
  startAt: string | null;
  endAt: string | null;
  maxParticipants: number | null;
  badgePrefix: string;
  durationMinutes: number;
  quizData: CompetitionQuestion[];
  /** Set when the current user already has a submitted result for this competition. */
  myResult: CompetitionResult | null;
}

export interface CompetitionResult {
  score: number;
  correctCount: number;
  wrongCount: number;
  timeUsedSeconds: number;
  rank: number | null;
  totalParticipants: number;
}
