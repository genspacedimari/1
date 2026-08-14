import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { useCompetitionStore } from '@/features/competition/store';

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CompetitionPlayerPage() {
  const navigate = useNavigate();
  const { activeCompetition, submit, loading } = useCompetitionStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(() => (activeCompetition?.durationMinutes ?? 30) * 60);
  const [submitting, setSubmitting] = useState(false);
  const startTimeRef = useRef(Date.now());
  const submittedRef = useRef(false);
  // The countdown's setInterval is set up once and must never read a stale
  // "answers" snapshot from when it was created — keep a ref in sync instead.
  const answersRef = useRef<Record<string, number>>({});
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // Guard: this page only makes sense right after joining a competition — if the
  // person lands here directly (refresh, back button), send them back to enter a code.
  useEffect(() => {
    if (!activeCompetition) navigate('/competition/join', { replace: true });
  }, [activeCompetition, navigate]);

  const questions = activeCompetition?.quizData ?? [];
  const currentQ = questions[currentIndex];

  const handleFinish = async () => {
    if (submittedRef.current || !activeCompetition) return;
    submittedRef.current = true;
    setSubmitting(true);
    const finalAnswers = answersRef.current;
    let correct = 0;
    for (const q of questions) {
      const ans = finalAnswers[q.id];
      if (ans !== undefined && q.options[ans]?.isCorrect) correct++;
    }
    const wrong = questions.length - correct;
    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    const timeUsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const result = await submit({ score, correctCount: correct, wrongCount: wrong, timeUsedSeconds, answers: finalAnswers });
    setSubmitting(false);
    if (result) navigate('/competition/result', { replace: true });
  };

  // Countdown; auto-submits whatever's answered when time runs out.
  useEffect(() => {
    if (!activeCompetition) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompetition]);

  if (!activeCompetition || !currentQ) {
    return <div className="mx-auto max-w-md py-12 text-center text-sm text-muted-foreground">Memuat kompetisi...</div>;
  }

  const selectAnswer = (index: number) => setAnswers((prev) => ({ ...prev, [currentQ.id]: index }));
  const isLast = currentIndex === questions.length - 1;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Top bar — no back button on purpose: leaving mid-competition should be a deliberate choice, not a misclick. */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-sm font-semibold">{activeCompetition.name}</span>
        <div className={cn('flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold', remainingSeconds <= 60 ? 'bg-red-500/10 text-red-600' : 'bg-primary/10 text-primary')}>
          <Clock size={14} /> {formatClock(remainingSeconds)}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Soal {currentIndex + 1} / {questions.length}</span>
        <span>{Object.keys(answers).length} terjawab</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60 dark:bg-white/10">
        <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium capitalize text-primary">{currentQ.difficulty}</span>
            <span className="text-xs text-muted-foreground">{currentQ.points} pts</span>
          </div>
          <p className="text-base font-medium">{currentQ.question}</p>

          {currentQ.imageUrls.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {currentQ.imageUrls.map((url, i) => <img key={i} src={url} alt={`Q ${i + 1}`} className="max-h-48 rounded-2xl" />)}
            </div>
          )}

          <div className="space-y-2">
            {currentQ.options.map((opt, i) => {
              const selected = answers[currentQ.id] === i;
              return (
                <button
                  key={i}
                  onClick={() => selectAnswer(i)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border p-4 text-left text-sm transition-all',
                    selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30 dark:border-border-dark dark:hover:bg-white/5'
                  )}
                  style={{ minHeight: 44 }}
                >
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold', selected ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground dark:bg-white/5')}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex((i) => i - 1)} className="flex-1">Sebelumnya</Button>
            {isLast ? (
              <Button onClick={handleFinish} disabled={submitting || loading} className="flex-1">{submitting ? 'Mengirim...' : 'Selesai & Kirim'}</Button>
            ) : (
              <Button onClick={() => setCurrentIndex((i) => i + 1)} className="flex-1">Selanjutnya</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
