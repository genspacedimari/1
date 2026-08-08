import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, X, ChevronRight, Trophy, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import * as svc from '@/features/quiz/services';
import type { OfficialQuiz, QuizQuestion } from '@/features/quiz/types';

export default function OfficialQuizPlayerPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [quiz, setQuiz] = useState<OfficialQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [startTime] = useState(Date.now());
  const [finished, setFinished] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const q = await svc.fetchOfficialQuiz(id);
      if (q) setQuiz(q);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return <div className="mx-auto max-w-md py-12 text-center text-sm text-muted-foreground">Loading quiz...</div>;
  }

  if (!quiz || quiz.quizData.length === 0) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">Quiz not found or has no questions.</p>
            <Button onClick={() => navigate('/quiz/official')}>Back to Quizzes</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const questions = quiz.quizData;
  const currentQ: QuizQuestion = questions[currentIndex];

  const handleAnswer = (index: number) => {
    if (showFeedback) return;
    setAnswers({ ...answers, [currentQ.id]: index });
    setShowFeedback(true);
  };

  const handleNext = () => {
    setShowFeedback(false);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Grade
      let correct = 0;
      for (const q of questions) {
        const ans = answers[q.id];
        if (ans !== undefined && q.options[ans]?.isCorrect) correct++;
      }
      const score = Math.round((correct / questions.length) * 100);
      const xp = svc.calculateXP(score, quiz.xpReward);
      // Save to student progress
      svc.updateStudentProgressDirect(xp, 'quiz').catch(() => {});
      setFinished(true);
    }
  };

  if (finished) {
    let correct = 0;
    for (const q of questions) {
      const ans = answers[q.id];
      if (ans !== undefined && q.options[ans]?.isCorrect) correct++;
    }
    const score = Math.round((correct / questions.length) * 100);
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
    const xp = svc.calculateXP(score, quiz.xpReward);

    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <Trophy size={36} className="text-primary" />
            </div>
            <p className="font-display text-4xl font-bold text-primary">{score}%</p>
            <p className="text-sm text-muted-foreground">{correct} of {questions.length} correct</p>
            <div className="flex items-center gap-2 text-sm">
              <Clock size={16} className="text-muted-foreground" />
              <span>{Math.floor(durationSeconds / 60)}m {durationSeconds % 60}s</span>
              <span className="text-primary font-semibold">+{xp} XP</span>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/quiz/official')}>More Quizzes</Button>
              <Button onClick={() => navigate('/quiz')}>Done</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => navigate('/quiz/official')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <span className="font-display text-sm font-semibold">{quiz.title}</span>
        <span className="text-sm font-medium">Q{currentIndex + 1}/{questions.length}</span>
      </div>

      {/* Progress */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60 dark:bg-white/10">
        <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
      </div>

      {/* Question */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium capitalize text-primary">{currentQ.type.replace('_', ' ')}</span>
            <span className="text-xs text-muted-foreground">{currentQ.points} pts</span>
          </div>
          <p className="text-base font-medium">{currentQ.question}</p>

          {currentQ.imageUrls.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {currentQ.imageUrls.map((url, i) => (
                <img key={i} src={url} alt={`Q ${i + 1}`} className="max-h-48 rounded-2xl" />
              ))}
            </div>
          )}

          <div className="space-y-2">
            {currentQ.options.map((opt, i) => {
              const selected = answers[currentQ.id] === i;
              const showCorrect = showFeedback && opt.isCorrect;
              const showWrong = showFeedback && selected && !opt.isCorrect;
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={showFeedback}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border p-4 text-left text-sm transition-all',
                    showCorrect ? 'border-emerald-500 bg-emerald-500/10' :
                    showWrong ? 'border-red-500 bg-red-500/10' :
                    'border-border hover:bg-muted/30 dark:border-border-dark dark:hover:bg-white/5'
                  )}
                  style={{ minHeight: 44 }}
                >
                  <span className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-colors',
                    showCorrect ? 'bg-emerald-500 text-white' :
                    showWrong ? 'bg-red-500 text-white' :
                    'bg-muted/40 text-muted-foreground dark:bg-white/5'
                  )}>
                    {showCorrect ? <Check size={16} /> : showWrong ? <X size={16} /> : String.fromCharCode(65 + i)}
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>

          {showFeedback && currentQ.explanation && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="rounded-2xl bg-primary/5 p-4 dark:bg-primary/10"
            >
              <p className="text-xs font-medium text-primary">Explanation</p>
              <p className="mt-1 text-sm">{currentQ.explanation}</p>
            </motion.div>
          )}

          {showFeedback && (
            <Button onClick={handleNext} className="w-full">
              {currentIndex < questions.length - 1 ? 'Next' : 'Finish'} <ChevronRight size={16} />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
