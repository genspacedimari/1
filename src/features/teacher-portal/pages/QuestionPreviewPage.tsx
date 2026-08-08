import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CircleCheck as CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTeacherStore } from '../store';
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS, LADDER_MODE_LABELS, type Question } from '../types';
import { cn } from '@/utils/cn';

export function QuestionPreviewPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { loadQuestions } = useTeacherStore();
  const [question, setQuestion] = useState<Question | null>(null);

  useEffect(() => {
    loadQuestions().then(() => {
      const q = useTeacherStore.getState().questions.find((q) => q.id === id);
      if (q) setQuestion(q);
    });
  }, [id, loadQuestions]);

  if (!question) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/teacher/questions')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-display text-xl font-semibold">Preview</h1>
        </div>
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading question...</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/teacher/questions')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-xl font-semibold">Question Preview</h1>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{QUESTION_TYPE_LABELS[question.type]}</Badge>
            <Badge variant="muted">{DIFFICULTY_LABELS[question.difficulty]}</Badge>
            <span className="text-xs text-muted-foreground">{question.points} points</span>
          </div>

          <p className="text-base font-medium">{question.question}</p>

          {question.images.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {question.images.map((img, i) => (
                <img key={i} src={img.imageUrl} alt={`Question ${i + 1}`} className="max-h-48 rounded-2xl" />
              ))}
            </div>
          )}

          {question.options.length > 0 && (
            <div className="space-y-2">
              {question.options.map((opt, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border p-3 text-sm',
                    opt.isCorrect
                      ? 'border-emerald-500 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                      : 'border-border dark:border-border-dark'
                  )}
                >
                  <span className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                    opt.isCorrect ? 'bg-emerald-500 text-white' : 'bg-muted/40 text-muted-foreground dark:bg-white/5'
                  )}>
                    {opt.isCorrect ? <CheckCircle2 size={16} /> : String.fromCharCode(65 + i)}
                  </span>
                  {opt.label}
                </div>
              ))}
            </div>
          )}

          {question.ladderData && (
            <div className="rounded-2xl border border-border p-4 dark:border-border-dark">
              <p className="text-xs font-medium text-muted-foreground">Mode: {LADDER_MODE_LABELS[question.ladderData.mode]}</p>
              {question.ladderData.expectedOutput && (
                <p className="mt-2 text-sm">Expected output: {question.ladderData.expectedOutput}</p>
              )}
              {question.ladderData.ladderJson && (
                <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-muted/20 p-3 text-xs dark:bg-white/5">
                  {question.ladderData.ladderJson.slice(0, 500)}...
                </pre>
              )}
            </div>
          )}

          {question.explanation && (
            <div className="rounded-2xl bg-primary/5 p-4 dark:bg-primary/10">
              <p className="text-xs font-medium text-primary">Explanation</p>
              <p className="mt-1 text-sm">{question.explanation}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
