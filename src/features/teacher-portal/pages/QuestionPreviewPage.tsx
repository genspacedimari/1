import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CircleCheck as CheckCircle2, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTeacherStore } from '../store';
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS, LADDER_MODE_LABELS, type Question } from '../types';
import { cn } from '@/utils/cn';
import { LadderStudentAnswerPanel } from '@/features/plc-challenges/LadderStudentAnswerPanel';
import { LadderEditorScreen } from '@/features/plc-simulator/components/LadderEditorScreen';
import type { LadderProject } from '@/simulator/types/ladder';

export function QuestionPreviewPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { loadQuestions } = useTeacherStore();
  const [question, setQuestion] = useState<Question | null>(null);
  const [ladderTab, setLadderTab] = useState<'student' | 'answer'>('student');
  const [previewAnswer, setPreviewAnswer] = useState<string | null>(null);

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

  const answerProject: LadderProject | null = (() => {
    const raw = question.ladderData?.answerProgramJson || question.ladderData?.answerLadderJson;
    if (!raw) return null;
    try {
      const p = JSON.parse(raw);
      return p && Array.isArray(p.rungs) ? p : null;
    } catch {
      return null;
    }
  })();

  return (
    <div className={cn('mx-auto space-y-4', question.type === 'ladder' ? 'max-w-5xl' : 'max-w-2xl')}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/teacher/questions')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-xl font-semibold">Pratinjau Soal</h1>
            <p className="text-xs text-muted-foreground">Tampilan dan evaluasi soal yang akan dilihat oleh siswa</p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/teacher/questions/${question.id}/edit`)}
          className="rounded-xl border border-border px-3.5 py-2 text-xs font-semibold hover:bg-muted/30 dark:border-border-dark"
        >
          Edit Soal Ini
        </button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{QUESTION_TYPE_LABELS[question.type]}</Badge>
            <Badge variant="muted">{DIFFICULTY_LABELS[question.difficulty]}</Badge>
            <span className="text-xs text-muted-foreground">{question.points} points</span>
          </div>

          <p className="text-base font-semibold">{question.question}</p>

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
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-border pb-3 dark:border-border-dark">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs uppercase font-mono">
                    Mode: {LADDER_MODE_LABELS[question.ladderData.mode] || question.ladderData.challengeType || 'modify'}
                  </Badge>
                  {question.ladderData.expectedOutput && (
                    <span className="text-xs text-muted-foreground">Output: {question.ladderData.expectedOutput}</span>
                  )}
                </div>

                {/* Tabs to switch between student view and answer key */}
                <div className="flex rounded-xl bg-muted/40 p-1 dark:bg-white/5">
                  <button
                    onClick={() => setLadderTab('student')}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                      ladderTab === 'student' ? 'bg-surface shadow text-primary dark:bg-surface-dark' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Tampilan Soal Siswa
                  </button>
                  <button
                    onClick={() => setLadderTab('answer')}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                      ladderTab === 'answer' ? 'bg-surface shadow text-emerald-600 dark:bg-surface-dark dark:text-emerald-400' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <ShieldCheck size={14} /> Kunci Jawaban Asli
                  </button>
                </div>
              </div>

              {ladderTab === 'student' ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground dark:bg-primary/10">
                    <span className="font-semibold text-primary">Simulasi Pengerjaan Siswa:</span>
                    <p className="mt-0.5">
                      Siswa melihat rangkaian dengan placeholder <span className="font-semibold text-amber-600 dark:text-amber-400">[ KOSONG ]</span>. Siswa dapat mengklik bagian yang kosong untuk melengkapi kontak NO/NC atau koil output sesuai logika aslinya, lalu menguji jawabannya.
                    </p>
                  </div>
                  <LadderStudentAnswerPanel
                    value={previewAnswer}
                    onChange={setPreviewAnswer}
                    question={{
                      id: question.id,
                      type: 'ladder',
                      question: question.question,
                      difficulty: question.difficulty,
                      points: question.points,
                      explanation: question.explanation,
                      options: [],
                      imageUrls: question.images.map((img) => img.imageUrl),
                      starterProgramJson: question.ladderData.starterLadderJson ?? question.ladderData.ladderJson,
                      answerProgramJson: question.ladderData.answerProgramJson ?? question.ladderData.answerLadderJson,
                      ladderChallengeType: question.ladderData.challengeType ?? 'modify',
                      testCases: question.ladderData.testCases ?? [],
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <div className="flex items-center gap-2 font-semibold">
                      <ShieldCheck size={15} /> Kunci Jawaban Lengkap (Diimpor dari Simulator)
                    </div>
                    <p className="mt-0.5">
                      Program ini tersimpan aman sebagai acuan kebenaran dan penilaian otomatis. Perubahan pada tampilan soal siswa tidak merusak atau mengubah rangkaian kunci jawaban ini.
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-border dark:border-border-dark" style={{ minHeight: 480 }}>
                    <LadderEditorScreen
                      initialProject={answerProject}
                      readOnly={true}
                      isTeacherMode={true}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {question.explanation && (
            <div className="rounded-2xl bg-primary/5 p-4 dark:bg-primary/10">
              <p className="text-xs font-medium text-primary">Explanation / Instruksi</p>
              <p className="mt-1 text-sm">{question.explanation}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
