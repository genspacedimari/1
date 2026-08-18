import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Flag, ChevronLeft, ChevronRight, Check, Grid3x3, CircleAlert as AlertCircle, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useQuizStore } from '@/features/quiz/store';
import { useAuthStore } from '@/stores/authStore';
import * as svc from '@/features/quiz/services';
import { PALETTE_COLORS, type QuizQuestion } from '@/features/quiz/types';
import { cn } from '@/utils/cn';
import { Wrench, CheckCircle2 } from 'lucide-react';

export default function ExamPlayerPage() {
  const navigate = useNavigate();
  const store = useQuizStore();
  const { activeExam, currentQuestionIndex, answers, flaggedQuestions, remainingSeconds, attemptId } = store;

  const [showPalette, setShowPalette] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialized = useRef(false);

  // Resume detection — check for in-progress attempt
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (activeExam) return; // already started via Join Exam

    (async () => {
      // Check for any in-progress exam attempt
      const { data: attempt } = await (async () => {
        const sid = useAuthStore.getState().user?.id;
        if (!sid) return { data: null };
        const { supabase } = await import('@/services/supabaseClient');
        const { data } = await supabase
          .from('exam_attempts')
          .select('*')
          .eq('student_id', sid)
          .eq('status', 'in_progress')
          .order('started_at', { ascending: false })
          .maybeSingle();
        return { data };
      })();

      if (attempt) {
        setShowResume(true);
        const examId = attempt.exam_id;
        const { supabase } = await import('@/services/supabaseClient');
        const { data: examRow } = await supabase
          .from('exams')
          .select('*')
          .eq('id', examId)
          .maybeSingle();
        if (examRow) {
          const examInfo = await svc.findExamByCode(examRow.exam_code);
          if (examInfo) {
            useQuizStore.setState({ activeExam: examInfo });
            store.resumeExam(
              {
                id: attempt.id, examId, studentId: attempt.student_id,
                score: Number(attempt.score), correctCount: attempt.correct_count,
                wrongCount: attempt.wrong_count, timeUsedSeconds: attempt.time_used_seconds,
                remainingSeconds: attempt.remaining_seconds, status: 'in_progress',
                answers: attempt.answers ?? {}, startedAt: attempt.started_at,
                submittedAt: null, attemptNumber: attempt.attempt_number, xpEarned: 0,
              },
              examInfo
            );
          }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer countdown
  useEffect(() => {
    if (!attemptId || remainingSeconds === null) return;
    timerRef.current = setInterval(() => {
      const cur = useQuizStore.getState().remainingSeconds;
      if (cur === null) return;
      if (cur <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        handleAutoSubmit();
      } else {
        useQuizStore.getState().setRemainingSeconds(cur - 1);
      }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!attemptId) return;
    autoSaveRef.current = setInterval(() => {
      useQuizStore.getState().saveProgress();
    }, 30000);
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [attemptId]);

  // Auto-save on page visibility change (app pause)
  useEffect(() => {
    const handler = () => { if (document.visibilityState === 'hidden') useQuizStore.getState().saveProgress(); };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Warn when leaving app
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (attemptId) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [attemptId]);

  const handleAutoSubmit = useCallback(async () => {
    setSubmitError(null);
    setSubmitting(true);
    const r = await store.submitExam();
    setSubmitting(false);
    if (r) {
      navigate('/quiz/result', { state: r, replace: true });
    } else {
      setSubmitError(useQuizStore.getState().error ?? 'Gagal mengirim jawaban. Coba lagi.');
    }
  }, [store, navigate]);

  const handleFinish = async () => {
    setConfirmFinish(false);
    setSubmitError(null);
    setSubmitting(true);
    const r = await store.submitExam();
    setSubmitting(false);
    if (r) {
      navigate('/quiz/result', { state: r, replace: true });
    } else {
      setSubmitError(useQuizStore.getState().error ?? 'Gagal mengirim jawaban. Coba lagi.');
    }
  };

  if (!activeExam) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle size={32} className="text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No active exam. Join an exam to get started.</p>
            <Button onClick={() => navigate('/quiz')}>Back to Quiz</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showResume) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <RefreshCw size={28} />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Resume Exam?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You have an exam in progress. Your answers and timer will be restored.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { store.exitExam(); navigate('/quiz'); }}>Exit</Button>
            <Button onClick={() => setShowResume(false)}>Continue</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const questions = activeExam.questions;
  const currentQ: QuizQuestion = questions[currentQuestionIndex] ?? questions[0];
  const isFlagged = flaggedQuestions.has(currentQ?.id);

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const paletteStates = store.getPaletteState(questions);

  const handleAnswer = (answer: unknown) => {
    store.answerQuestion(currentQ.id, answer);
  };

  const goNext = () => {
    if (currentQuestionIndex < questions.length - 1) store.setCurrentQuestion(currentQuestionIndex + 1);
  };
  const goPrev = () => {
    if (currentQuestionIndex > 0) store.setCurrentQuestion(currentQuestionIndex - 1);
  };

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-secondary/30 dark:bg-surface-dark">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark/50">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold">
            Q{currentQuestionIndex + 1}/{questions.length}
          </span>
        </div>
        <div className="flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('flex items-center gap-1 text-xs font-medium', remainingSeconds !== null && remainingSeconds < 60 && 'text-red-500')}>
            <Clock size={14} /> {remainingSeconds !== null ? fmtTime(remainingSeconds) : '--:--'}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {isOnline ? <Wifi size={14} className="text-emerald-500" /> : <WifiOff size={14} className="text-red-500" />}
          </span>
        </div>
      </div>

      {/* Question content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {/* Flag + question */}
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium capitalize text-primary">
                  {currentQ.type.replace('_', ' ')}
                </span>
                <span className="text-xs text-muted-foreground">{currentQ.points} pts</span>
              </div>
              <p className="text-base font-medium">{currentQ.question}</p>
            </div>
            <button
              onClick={() => store.toggleFlag(currentQ.id)}
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors',
                isFlagged ? 'border-red-500 bg-red-500/10 text-red-500' : 'border-border text-muted-foreground dark:border-border-dark'
              )}
              style={{ minHeight: 36 }}
            >
              <Flag size={16} />
            </button>
          </div>

          {/* Images */}
          {currentQ.imageUrls.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {currentQ.imageUrls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Question ${i + 1}`}
                  className="max-h-64 rounded-2xl object-contain cursor-pointer"
                  onClick={() => window.open(url, '_blank')}
                />
              ))}
            </div>
          )}

          {/* MC / Image options */}
          {(currentQ.type === 'multiple_choice' || currentQ.type === 'image') && (
            <div className="space-y-2">
              {currentQ.options.map((opt, i) => {
                const selected = answers[currentQ.id] === i;
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl border p-4 text-left text-sm transition-all',
                      selected ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/30 dark:border-border-dark dark:hover:bg-white/5'
                    )}
                    style={{ minHeight: 44 }}
                  >
                    <span className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-colors',
                      selected ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground dark:bg-white/5'
                    )}>
                      {selected ? <Check size={16} /> : String.fromCharCode(65 + i)}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Ladder question — build/edit the program in the full Simulator,
              then apply it back here as the answer. */}
          {currentQ.type === 'ladder' && (() => {
            const isAnswered = typeof answers[currentQ.id] === 'string' && !!answers[currentQ.id];
            return (
              <div className="rounded-2xl border border-border p-5 dark:border-border-dark">
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                    {currentQ.ladderChallengeType === 'modify' ? 'Modifikasi Program' : currentQ.ladderChallengeType === 'debug' ? 'Debug Program' : 'Buat Program'}
                  </span>
                  {isAnswered && (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-500">
                      <CheckCircle2 size={14} /> Sudah dijawab
                    </span>
                  )}
                </div>
                {currentQ.expectedOutput && (
                  <div className="mb-3 rounded-xl bg-primary/5 p-3 text-sm dark:bg-primary/10">
                    <p className="text-xs font-semibold text-primary">Expected Behavior</p>
                    <p className="mt-1">{currentQ.expectedOutput}</p>
                  </div>
                )}
                <p className="mb-3 text-xs text-muted-foreground">Soal ini butuh program ladder PLC. Kerjakan di editor Simulator penuh, lalu terapkan jawabanmu.</p>
                <Button onClick={() => navigate(`/quiz/exam/ladder-answer/${currentQ.id}`)} className="w-full">
                  <Wrench size={16} /> {isAnswered ? 'Edit Jawaban di Simulator' : 'Jawab dengan Simulator'}
                </Button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="border-t border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark/50">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
          <button
            onClick={goPrev}
            disabled={currentQuestionIndex === 0}
            className="flex items-center gap-1 rounded-2xl border border-border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-30 dark:border-border-dark"
            style={{ minHeight: 44 }}
          >
            <ChevronLeft size={16} /> Prev
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPalette(!showPalette)}
              className="flex items-center gap-1 rounded-2xl border border-border px-4 py-2.5 text-sm font-medium transition-colors dark:border-border-dark"
              style={{ minHeight: 44 }}
            >
              <Grid3x3 size={16} /> Palette
            </button>
            <button
              onClick={() => setConfirmFinish(true)}
              className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              style={{ minHeight: 44 }}
            >
              Finish
            </button>
          </div>

          <button
            onClick={goNext}
            disabled={currentQuestionIndex === questions.length - 1}
            className="flex items-center gap-1 rounded-2xl border border-border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-30 dark:border-border-dark"
            style={{ minHeight: 44 }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Question palette sheet */}
      <AnimatePresence>
        {showPalette && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setShowPalette(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl border-t border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted/60 dark:bg-white/10" />
              <h3 className="mb-3 text-sm font-semibold">Question Palette</h3>
              <div className="grid grid-cols-8 gap-2">
                {paletteStates.map((ps, i) => {
                  const color = ps.current
                    ? PALETTE_COLORS.current
                    : ps.flagged
                      ? PALETTE_COLORS.flagged
                      : ps.answered
                        ? PALETTE_COLORS.answered
                        : PALETTE_COLORS.notAnswered;
                  return (
                    <button
                      key={ps.questionId}
                      onClick={() => { store.setCurrentQuestion(i); setShowPalette(false); }}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold text-white transition-transform hover:scale-105"
                      style={{ backgroundColor: color, minHeight: 44, minWidth: 44 }}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <Legend color={PALETTE_COLORS.notAnswered} label="Not Answered" />
                <Legend color={PALETTE_COLORS.current} label="Current" />
                <Legend color={PALETTE_COLORS.answered} label="Answered" />
                <Legend color={PALETTE_COLORS.flagged} label="Flagged" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmFinish}
        title="Finish Exam?"
        message={`You have answered ${Object.keys(answers).length} of ${questions.length} questions. Are you sure you want to submit?`}
        confirmLabel="Submit"
        onConfirm={handleFinish}
        onCancel={() => setConfirmFinish(false)}
      />

      {submitting && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface p-6 dark:bg-surface-dark">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm font-medium">Submitting exam...</p>
          </div>
        </div>
      )}

      {submitError && !submitting && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-surface p-6 text-center dark:bg-surface-dark">
            <AlertCircle size={28} className="text-red-500" />
            <p className="text-sm font-medium">Gagal mengirim jawaban</p>
            <p className="text-xs text-muted-foreground">{submitError}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSubmitError(null)}>Tutup</Button>
              <Button onClick={handleFinish}>Coba Lagi</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-3 w-3 rounded" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}
