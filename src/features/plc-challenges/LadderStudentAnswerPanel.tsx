import { useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LadderEditorScreen } from '@/features/plc-simulator/components/LadderEditorScreen';
import type { LadderProject } from '@/simulator/types/ladder';
import { gradeLadderProgram } from '@/features/quiz/ladderGrading';
import type { QuizQuestion } from '@/features/quiz/types';

interface Props {
  question: QuizQuestion;
  value: string | null;
  onChange: (value: string) => void;
}

export function LadderStudentAnswerPanel({ question, value, onChange }: Props) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ passed: number; total: number; percent: number; failed: string[] } | null>(null);
  const initialJson = value ?? question.starterProgramJson ?? null;
  const project = useMemo((): LadderProject | null => {
    if (!initialJson) return null;
    try {
      const parsed = JSON.parse(initialJson) as LadderProject;
      return parsed && Array.isArray(parsed.rungs) && parsed.meta ? parsed : null;
    } catch {
      return null;
    }
  }, [initialJson]);

  const testProgram = async () => {
    if (!value || !question.testCases?.length) return;
    setTesting(true);
    try {
      setResult(await gradeLadderProgram(value, question.testCases));
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              {question.ladderChallengeType === 'modify' ? 'Modifikasi Program' : question.ladderChallengeType === 'debug' ? 'Debug Program' : 'Buat Program'}
            </span>
            <p className="mt-2 text-xs text-muted-foreground">Kerjakan langsung di Ladder Editor. Sistem menilai behavior PLC melalui test case.</p>
          </div>
          <div className="flex items-center gap-2">
            {result && <span className="text-sm font-semibold">{result.passed}/{result.total} passed · {result.percent}%</span>}
            <Button variant="outline" onClick={testProgram} disabled={testing || !value || !question.testCases?.length}>
              <Play size={14} /> {testing ? 'Testing...' : 'Test Program'}
            </Button>
          </div>
        </div>

        {question.expectedOutput && (
          <div className="rounded-xl bg-primary/5 p-3 text-sm dark:bg-primary/10">
            <p className="text-xs font-semibold text-primary">Expected Behavior</p>
            <p className="mt-1">{question.expectedOutput}</p>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-border dark:border-border-dark">
          <LadderEditorScreen
            key={initialJson ? initialJson.slice(0, 32) : 'empty'}
            initialProject={project}
            onSaveLadder={onChange}
            saveLabel="Simpan Program"
          />
        </div>

        {result?.failed.length ? (
          <div className="rounded-xl bg-red-500/5 p-3 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300">
            Test gagal: {result.failed.join(', ')}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
