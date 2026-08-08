import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Users, Clock, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTeacherStore } from '../store';

interface ExamAttemptRow {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  timeUsedSeconds: number;
  status: string;
  submittedAt: string | null;
  rank: number | null;
}

export function ExamResultsPage() {
  const { id: examId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { exams, loadExams } = useTeacherStore();
  const [attempts, setAttempts] = useState<ExamAttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!examId) return;
    setLoading(true);
    loadExams().then(async () => {
      try {
        const rows = await fetchExamAttemptRows(examId);
        setAttempts(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load results');
      } finally {
        setLoading(false);
      }
    });
  }, [examId]);

  const exam = exams.find((e) => e.id === examId);

  const completedAttempts = useMemo(
    () => attempts.filter((a) => a.status === 'completed').sort((a, b) => b.score - a.score || a.timeUsedSeconds - b.timeUsedSeconds),
    [attempts],
  );

  const stats = useMemo(() => {
    if (completedAttempts.length === 0) return { avg: 0, highest: 0, lowest: 0, count: 0 };
    const scores = completedAttempts.map((a) => a.score);
    return {
      avg: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
      highest: Math.max(...scores),
      lowest: Math.min(...scores),
      count: completedAttempts.length,
    };
  }, [completedAttempts]);

  if (loading) {
    return (
      <div className="mx-auto flex max-w-4xl items-center justify-center py-20">
        <div className="text-sm text-muted-foreground">Loading results...</div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 py-10">
        <button onClick={() => navigate('/teacher/exams')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft size={16} /> Back to Exams
        </button>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">Exam not found.</p>
            <Button onClick={() => navigate('/teacher/exams')}>Go to Exams</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rankSuffix = (i: number) => {
    if (i === 0) return 'bg-amber-500/20 text-amber-600';
    if (i === 1) return 'bg-slate-400/20 text-slate-500';
    if (i === 2) return 'bg-orange-500/20 text-orange-600';
    return 'bg-muted/30 text-muted-foreground';
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate('/teacher/exams')}
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold">{exam.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Exam Results · {completedAttempts.length} students completed
          </p>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-red-500">{error}</CardContent>
        </Card>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Users} label="Completed" value={`${stats.count}`} />
        <StatCard icon={BarChart3} label="Average" value={`${stats.avg}/100`} />
        <StatCard icon={Trophy} label="Highest" value={`${stats.highest}/100`} />
        <StatCard icon={BarChart3} label="Lowest" value={`${stats.lowest}/100`} />
      </div>

      {/* Results list */}
      {completedAttempts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Users size={32} className="text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No students have completed this exam yet.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 dark:bg-white/5">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Rank</th>
                    <th className="px-3 py-3 text-left font-medium">Student</th>
                    <th className="px-3 py-3 text-left font-medium">Score</th>
                    <th className="px-3 py-3 text-left font-medium">Correct</th>
                    <th className="px-3 py-3 text-left font-medium">Wrong</th>
                    <th className="px-3 py-3 text-left font-medium">Time</th>
                    <th className="px-5 py-3 text-left font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border dark:divide-border-dark">
                  {completedAttempts.map((a, i) => (
                    <tr
                      key={a.id}
                      onClick={() => navigate(`/teacher/results/${a.id}`)}
                      className="cursor-pointer hover:bg-muted/20 dark:hover:bg-white/5"
                    >
                      <td className="px-5 py-3">
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${rankSuffix(i)}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{a.studentName}</p>
                        <p className="text-xs text-muted-foreground">{a.studentEmail}</p>
                      </td>
                      <td className="px-3 py-3 font-semibold text-primary">{a.score}/100</td>
                      <td className="px-3 py-3 text-emerald-600">{a.correctCount}</td>
                      <td className="px-3 py-3 text-red-500">{a.wrongCount}</td>
                      <td className="px-3 py-3 text-muted-foreground">{fmtTime(a.timeUsedSeconds)}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {completedAttempts.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                <Card onClick={() => navigate(`/teacher/results/${a.id}`)} className="cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${rankSuffix(i)}`}>
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{a.studentName}</p>
                          <p className="truncate text-xs text-muted-foreground">{a.studentEmail}</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="font-display text-lg font-semibold text-primary">{a.score}/100</span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="text-emerald-600">{a.correctCount} correct</span>
                      <span className="text-red-500">{a.wrongCount} wrong</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {fmtTime(a.timeUsedSeconds)}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border p-4 dark:border-border-dark">
      <Icon size={20} className="text-primary" />
      <p className="font-display text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ============================================================
// Fetch attempts for a specific exam (completed only)
// ============================================================
import { supabase } from '@/services/supabaseClient';

async function fetchExamAttemptRows(examId: string): Promise<ExamAttemptRow[]> {
  const { data, error } = await supabase
    .from('exam_attempts')
    .select('id, student_id, score, correct_count, wrong_count, time_used_seconds, submitted_at, started_at, status')
    .eq('exam_id', examId)
    .order('submitted_at', { ascending: false, nullsFirst: false });
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    student_id: string;
    score: number;
    correct_count: number;
    wrong_count: number;
    time_used_seconds: number;
    submitted_at: string | null;
    started_at: string;
    status: string;
  }>;

  const studentIds = Array.from(new Set(rows.map((r) => r.student_id)));
  const profileMap = new Map<string, { name: string; email: string }>();
  if (studentIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', studentIds);
    (profiles ?? []).forEach((p) => {
      const row = p as { id: string; full_name: string; email: string };
      profileMap.set(row.id, { name: row.full_name, email: row.email });
    });
  }

  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: profileMap.get(r.student_id)?.name ?? 'Unknown Student',
    studentEmail: profileMap.get(r.student_id)?.email ?? '',
    score: Number(r.score),
    correctCount: r.correct_count,
    wrongCount: r.wrong_count,
    timeUsedSeconds: r.time_used_seconds,
    status: r.status,
    submittedAt: r.submitted_at,
    rank: null,
  }));
}
