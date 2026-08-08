import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PRACTICE_CATEGORIES, PRACTICE_DIFFICULTIES, type QuizCategory, type QuizDifficulty } from '@/features/quiz/types';
import { cn } from '@/utils/cn';

export default function PracticePickerPage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<QuizCategory>('PLC Basic');
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('easy');

  const handleStart = () => {
    navigate('/quiz/practice/player', { state: { category, difficulty } });
  };



  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/quiz')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-xl font-semibold">Practice Mode</h1>
      </div>

      <Card>
        <CardContent className="space-y-5 p-5">
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {PRACTICE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'rounded-2xl border px-3 py-2.5 text-xs font-medium transition-all',
                    category === cat ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/30 dark:border-border-dark'
                  )}
                  style={{ minHeight: 44 }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Difficulty</label>
            <div className="grid grid-cols-3 gap-2">
              {PRACTICE_DIFFICULTIES.map((diff) => (
                <button
                  key={diff}
                  onClick={() => setDifficulty(diff)}
                  className={cn(
                    'rounded-2xl border px-3 py-2.5 text-sm font-medium capitalize transition-all',
                    difficulty === diff ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/30 dark:border-border-dark'
                  )}
                  style={{ minHeight: 44 }}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-primary/5 p-4 dark:bg-primary/10">
            <p className="text-xs font-medium text-primary">Practice Mode</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Unlimited retries. Immediate correction and explanation. No ranking impact. Fully offline.
            </p>
          </div>

          <Button onClick={handleStart} className="w-full" size="lg">
            <Zap size={18} /> Start Practice
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
