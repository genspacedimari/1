// ============================================================
// Exam scheduling helpers
//
// Exams are scheduled using: examDate + startTime + durationMinutes.
// End time is NEVER stored — it is always derived from these three
// values. lateJoinMinutes controls how long after startTime a student
// may still join a running exam.
// ============================================================

export type ExamRunState = 'not_started' | 'running' | 'finished';

export interface ExamScheduleInput {
  examDate: string | null; // 'YYYY-MM-DD'
  startTime: string | null; // 'HH:mm'
  durationMinutes: number;
  lateJoinMinutes: number;
}

/** Minimum/maximum allowed values, per spec */
export const DURATION_MINUTES_MIN = 5;
export const DURATION_MINUTES_MAX = 300;
export const LATE_JOIN_MINUTES_MIN = 0;
export const LATE_JOIN_MINUTES_MAX = 60;

/** Combine examDate + startTime into a Date object (local time). */
export function getExamStartDateTime(schedule: ExamScheduleInput): Date | null {
  if (!schedule.examDate || !schedule.startTime) return null;
  const [h, m] = schedule.startTime.split(':').map(Number);
  const d = new Date(`${schedule.examDate}T00:00:00`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(h) || Number.isNaN(m)) return null;
  d.setHours(h, m, 0, 0);
  return d;
}

/** Automatically calculated end time (start + duration). Never stored. */
export function getExamEndDateTime(schedule: ExamScheduleInput): Date | null {
  const start = getExamStartDateTime(schedule);
  if (!start) return null;
  return new Date(start.getTime() + schedule.durationMinutes * 60_000);
}

/** Deadline until which a late-joining student may still enter the exam. */
export function getLateJoinDeadline(schedule: ExamScheduleInput): Date | null {
  const start = getExamStartDateTime(schedule);
  if (!start) return null;
  return new Date(start.getTime() + (schedule.lateJoinMinutes ?? 0) * 60_000);
}

/** Format a Date as "HH:mm" (24h), used to display the calculated end time. */
export function formatTime(date: Date | null): string {
  if (!date) return '--:--';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "Exam Ends At" — read-only, calculated from Start Time + Duration. */
export function getExamEndTimeLabel(schedule: ExamScheduleInput): string {
  return formatTime(getExamEndDateTime(schedule));
}

/**
 * NOT STARTED  -> now < start
 * RUNNING      -> start <= now <= end
 * FINISHED     -> now > end
 */
export function getExamRunState(schedule: ExamScheduleInput, now: Date = new Date()): ExamRunState {
  const start = getExamStartDateTime(schedule);
  const end = getExamEndDateTime(schedule);
  if (!start || !end) return 'not_started';
  if (now < start) return 'not_started';
  if (now > end) return 'finished';
  return 'running';
}

/**
 * A student may join while the exam is running AND within the late join
 * tolerance window (start time + lateJoinMinutes). Once that window has
 * passed, joining is blocked even though the exam is still running for
 * students who already joined.
 */
export function canJoinExam(schedule: ExamScheduleInput, now: Date = new Date()): boolean {
  const state = getExamRunState(schedule, now);
  if (state !== 'running') return false;
  const deadline = getLateJoinDeadline(schedule);
  if (!deadline) return false;
  return now <= deadline;
}

/** Human readable countdown, e.g. "2h 14m" or "45s". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** "03 Aug 2026" style date label for exam date. */
export function formatExamDate(examDate: string | null): string {
  if (!examDate) return '';
  const d = new Date(`${examDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** "03 Aug 2026 · 09:00 - 10:30" style summary line for exam lists. */
export function formatScheduleSummary(schedule: ExamScheduleInput): string {
  if (!schedule.examDate || !schedule.startTime) return 'Not scheduled';
  const end = getExamEndTimeLabel(schedule);
  return `${formatExamDate(schedule.examDate)} · ${schedule.startTime} - ${end}`;
}
