import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Award, Mail, CircleCheck as CheckCircle2, Circle as XCircle, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTeacherStore } from '../store';
import { LadderEditorScreen } from '@/features/plc-simulator/components/LadderEditorScreen';
import { importFromLadderJson } from '@/simulator/editor/importFromLadderJson';
import type { ResultDetail } from '../types';

export function ResultDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { fetchResultDetail } = useTeacherStore();
  const [detail, setDetail] = useState<ResultDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchResultDetail(id).then((data) => {
      setDetail(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id, fetchResultDetail]);

  if (loading) {
    return <div className="mx-auto max-w-3xl space-y-4"><div className="text-sm text-muted-foreground">Loading...</div></div>;
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <button onClick={() => navigate('/teacher/results')} className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft size={20} /> Back to Results
        </button>
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Result not found.</CardContent></Card>
      </div>
    );
  }

  const fmtTime = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/teacher/results')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-xl font-semibold">Result Detail</h1>
      </div>

      {/* Summary card */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold">{detail.studentName}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail size={14} /> {detail.studentEmail}
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-3xl font-bold text-primary">{detail.score}</p>
              {detail.rank && <p className="text-xs text-muted-foreground">Rank #{detail.rank}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <InfoBox label="Exam" value={detail.examName} />
            <InfoBox label="Class" value={detail.className ?? 'None'} />
            <InfoBox label="Correct" value={detail.correctCount} icon={CheckCircle2} color="#22C55E" />
            <InfoBox label="Wrong" value={detail.wrongCount} icon={XCircle} color="#EF4444" />
            <InfoBox label="Time Used" value={fmtTime(detail.timeUsedSeconds)} icon={Clock} color="#6B7280" />
            <InfoBox label="Submit Time" value={new Date(detail.submittedAt).toLocaleString()} icon={Clock} color="#6B7280" />
            <InfoBox label="Status" value={detail.status} />
            <InfoBox label="Rank" value={detail.rank ? `#${detail.rank}` : '-'} icon={Award} color="#D97706" />
          </div>
        </CardContent>
      </Card>

      {/* Question review */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">Question Review</h2>
        {detail.questionReviews.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No question data available.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {detail.questionReviews.map((q, idx) => (
              <Card key={q.questionId}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${q.isCorrect ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}>
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant="outline">{q.questionType}</Badge>
                        {q.isCorrect ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 size={14} /> Correct</span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-medium text-red-500"><XCircle size={14} /> Wrong</span>
                        )}
                      </div>
                      <p className="text-sm font-medium">{q.questionText}</p>
                    </div>
                  </div>

                  <div className="ml-10 space-y-2 text-sm">
                    <div className="rounded-xl border border-border p-3 dark:border-border-dark">
                      <p className="text-xs font-medium text-muted-foreground">Student Answer</p>
                      <p className="mt-1">{q.studentAnswer || 'No answer'}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                      <p className="text-xs font-medium text-muted-foreground">Correct Answer</p>
                      <p className="mt-1">{q.correctAnswer || 'N/A'}</p>
                    </div>

                    {q.ladderJson && (
                      <div className="overflow-hidden rounded-xl border border-border dark:border-border-dark">
                        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground dark:border-border-dark">
                          <FileText size={12} /> Student Ladder Submission · jalankan dan review realtime
                        </div>
                        {(() => {
                          try {
                            const project = importFromLadderJson(JSON.parse(q.ladderJson!));
                            return <LadderEditorScreen initialProject={project} saveLabel="Simpan Review" />;
                          } catch {
                            return <p className="p-4 text-xs text-red-500">Program siswa tidak valid.</p>;
                          }
                        })()}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoBox({ label, value, icon: Icon, color }: { label: string; value: string | number; icon?: typeof Clock; color?: string }) {
  return (
    <div className="rounded-2xl border border-border p-3 dark:border-border-dark">
      <div className="flex items-center gap-2">
        {Icon && color && <Icon size={14} style={{ color }} />}
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}
