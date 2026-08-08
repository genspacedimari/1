import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CircleCheck as CheckCircle2, Circle as XCircle, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuizStore } from '@/features/quiz/store';
import { cn } from '@/utils/cn';

export default function QuizReviewPage() {
  const navigate = useNavigate();
  const { activeExam, answers } = useQuizStore();

  if (!activeExam) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <FileText size={32} className="text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No exam to review.</p>
            <button onClick={() => navigate('/quiz')} className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Back to Quiz
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!activeExam.allowReview) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <FileText size={32} className="text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Review is disabled for this exam.</p>
            <button onClick={() => navigate('/quiz')} className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Back to Quiz
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/quiz')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-xl font-semibold">Review: {activeExam.name}</h1>
      </div>

      {activeExam.questions.map((q, idx) => {
        const userAnswer = answers[q.id];
        let isCorrect = false;
        let correctLabel = '';
        if ((q.type === 'multiple_choice' || q.type === 'image') && typeof userAnswer === 'number') {
          isCorrect = q.options[userAnswer]?.isCorrect ?? false;
          correctLabel = q.options.find((o) => o.isCorrect)?.label ?? 'N/A';
        } else if (q.type === 'ladder') {
          correctLabel = q.expectedOutput ?? 'See answer ladder';
        }

        return (
          <Card key={q.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start gap-3">
                <span className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                  isCorrect ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-500'
                )}>
                  {isCorrect ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                </span>
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Q{idx + 1}</span>
                    <Badge variant="outline">{q.type.replace('_', ' ')}</Badge>
                    <span className="text-xs text-muted-foreground">{q.points} pts</span>
                  </div>
                  <p className="text-sm font-medium">{q.question}</p>
                </div>
              </div>

              {/* Show options */}
              {(q.type === 'multiple_choice' || q.type === 'image') && (
                <div className="space-y-1.5 pl-10">
                  {q.options.map((opt, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border p-2.5 text-sm',
                        opt.isCorrect ? 'border-emerald-500 bg-emerald-500/5' : userAnswer === i ? 'border-red-500 bg-red-500/5' : 'border-border dark:border-border-dark'
                      )}
                    >
                      <span className="font-bold text-xs">{String.fromCharCode(65 + i)}</span>
                      {opt.label}
                      {opt.isCorrect && <CheckCircle2 size={14} className="ml-auto text-emerald-500" />}
                      {userAnswer === i && !opt.isCorrect && <XCircle size={14} className="ml-auto text-red-500" />}
                    </div>
                  ))}
                </div>
              )}

              {/* Show user's answer vs correct */}
              <div className="space-y-1 pl-10 text-xs">
                <p className="text-muted-foreground">
                  Your answer: {typeof userAnswer === 'number' ? q.options[userAnswer]?.label ?? 'Not answered' : typeof userAnswer === 'string' ? 'Ladder submitted' : 'Not answered'}
                </p>
                {!isCorrect && <p className="text-emerald-600 dark:text-emerald-400">Correct answer: {correctLabel}</p>}
              </div>

              {/* Explanation */}
              {q.explanation && (
                <div className="ml-10 rounded-xl bg-primary/5 p-3 dark:bg-primary/10">
                  <p className="text-xs font-medium text-primary">Explanation</p>
                  <p className="mt-1 text-sm">{q.explanation}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
