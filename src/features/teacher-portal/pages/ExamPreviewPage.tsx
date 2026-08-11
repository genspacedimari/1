import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Award, CircleCheck as CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTeacherStore } from '../store';
import { fetchExamSnapshotQuestions } from '../services';
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS } from '../types';
import { cn } from '@/utils/cn';

export function ExamPreviewPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { questions, loadExams, loadQuestions } = useTeacherStore();
  const [examName, setExamName] = useState('');
  const [examQuestions, setExamQuestions] = useState<typeof questions>([]);

  useEffect(() => {
    Promise.all([loadExams(), loadQuestions()]).then(async () => {
      const exam = useTeacherStore.getState().exams.find((e) => e.id === id);
      if (exam) {
        setExamName(exam.name);
        try {
          const snapshot = await fetchExamSnapshotQuestions(exam.id);
          setExamQuestions(snapshot.length > 0 ? snapshot : useTeacherStore.getState().questions.filter((q) => exam.questionIds.includes(q.id)));
        } catch {
          setExamQuestions(useTeacherStore.getState().questions.filter((q) => exam.questionIds.includes(q.id)));
        }
      }
    });
  }, [id, loadExams, loadQuestions]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/teacher/exams')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-xl font-semibold">Exam Preview</h1>
            <p className="text-xs text-muted-foreground">Read-only — exactly as students will see it</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate('/teacher/exams')}>Exit Preview</Button>
      </div>

      {/* Exam header */}
      <Card>
        <CardContent className="space-y-2 p-5">
          <h2 className="font-display text-lg font-semibold">{examName}</h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock size={14} /> Duration: {examQuestions.length > 0 ? '60 min' : '--'}</span>
            <span className="flex items-center gap-1"><Award size={14} /> Passing: 70%</span>
            <span>{examQuestions.length} questions</span>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      {examQuestions.map((q, idx) => (
        <Card key={q.id}>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">{idx + 1}</span>
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant="outline">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                  <Badge variant="muted">{DIFFICULTY_LABELS[q.difficulty]}</Badge>
                  <span className="text-xs text-muted-foreground">{q.points} pts</span>
                </div>
                <p className="text-sm font-medium">{q.question}</p>
              </div>
            </div>

            {q.images.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {q.images.map((img, i) => (
                  <img key={i} src={img.imageUrl} alt={`Q ${idx + 1} img ${i + 1}`} className="max-h-40 rounded-2xl" />
                ))}
              </div>
            )}

            {q.options.length > 0 && (
              <div className="space-y-2">
                {q.options.map((opt, i) => (
                  <div key={i} className={cn(
                    'flex items-center gap-3 rounded-2xl border p-3 text-sm',
                    opt.isCorrect ? 'border-emerald-500 bg-emerald-500/5' : 'border-border dark:border-border-dark'
                  )}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/40 text-xs font-bold dark:bg-white/5">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt.label}
                    {opt.isCorrect && <CheckCircle2 size={16} className="ml-auto text-emerald-500" />}
                  </div>
                ))}
              </div>
            )}

            {q.ladderData && (
              <div className="rounded-2xl border border-border p-3 dark:border-border-dark">
                <p className="text-xs text-muted-foreground">Ladder mode: {q.ladderData.mode}</p>
                {q.ladderData.expectedOutput && <p className="mt-1 text-sm">Expected: {q.ladderData.expectedOutput}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {examQuestions.length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No questions in this exam yet.</CardContent></Card>
      )}
    </div>
  );
}
