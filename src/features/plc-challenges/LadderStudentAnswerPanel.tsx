import { useMemo, useState } from 'react';
import { Play, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LadderEditorScreen } from '@/features/plc-simulator/components/LadderEditorScreen';
import type { LadderProject } from '@/simulator/types/ladder';
import { gradeLadderDetailed } from '@/features/quiz/ladderGrading';
import type { QuizQuestion } from '@/features/quiz/types';

interface Props {
  question: QuizQuestion;
  value: string | null;
  onChange: (value: string) => void;
}

export function LadderStudentAnswerPanel({ question, value, onChange }: Props) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    structureScore: number;
    logicScore: number;
    feedback: string[];
  } | null>(null);

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
    const currentVal = value ?? question.starterProgramJson;
    if (!currentVal) return;
    setTesting(true);
    try {
      const evaluation = await gradeLadderDetailed(question, currentVal);
      setResult(evaluation);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="border border-border dark:border-border-dark">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                {question.ladderChallengeType === 'modify'
                  ? 'Lengkapi Rangkaian'
                  : question.ladderChallengeType === 'debug'
                  ? 'Debug Program'
                  : 'Buat Program'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Klik bagian <span className="font-semibold text-amber-600 dark:text-amber-400">[ KOSONG ]</span> untuk memilih komponen pengganti
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Kerjakan langsung pada Ladder Editor di bawah. Tekan &quot;Simpan Program&quot; dan &quot;Uji Jawaban&quot; untuk memeriksa hasil.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {result && (
              <Badge
                variant={result.passed ? 'default' : 'outline'}
                className={result.passed ? 'bg-emerald-500 text-white' : 'border-amber-500 text-amber-600'}
              >
                {result.score}% {result.passed ? 'Lulus' : 'Belum Sesuai'}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={testProgram}
              disabled={testing || (!value && !question.starterProgramJson)}
              className="gap-1.5"
            >
              <Play size={14} /> {testing ? 'Menguji...' : 'Uji Jawaban'}
            </Button>
          </div>
        </div>

        {question.expectedOutput && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground dark:bg-primary/10">
            <p className="font-semibold text-primary">Instruksi Pengerjaan:</p>
            <p className="mt-0.5">{question.expectedOutput}</p>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-border dark:border-border-dark" style={{ minHeight: 460 }}>
          <LadderEditorScreen
            key={initialJson ? initialJson.slice(0, 32) : 'empty'}
            initialProject={project}
            readOnly={false}
            isTeacherMode={false}
            onChangeLadder={onChange}
            onSaveLadder={onChange}
            saveLabel="Simpan Program"
          />
        </div>

        {result && (
          <div
            className={`rounded-2xl p-4 text-xs ${
              result.passed
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                : 'border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold mb-2">
              {result.passed ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>Hasil Evaluasi: Skor {result.score}% (Struktur: {result.structureScore}%, Logika: {result.logicScore}%)</span>
            </div>
            <ul className="list-disc pl-5 space-y-1">
              {result.feedback.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
