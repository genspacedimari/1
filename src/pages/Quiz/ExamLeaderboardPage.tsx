import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Hourglass, Trophy, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { getExamCompletionStatus, getExamLeaderboard, type ExamLeaderboardEntry } from '@/features/quiz/examCompletion';

function fmtTime(s: number): string {
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function ExamLeaderboardPage() {
  const navigate = useNavigate();
  const { examId } = useParams<{ examId: string }>();
  const myId = useAuthStore((s) => s.user?.id);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ completed: number; total: number; allDone: boolean } | null>(null);
  const [rows, setRows] = useState<ExamLeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!examId) return;
    setLoading(true); setError(null);
    try {
      const s = await getExamCompletionStatus(examId);
      setStatus(s);
      if (s.allDone) setRows(await getExamLeaderboard(examId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat leaderboard.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [examId]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-lg font-semibold">Leaderboard Exam</h1>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Memuat...</div>
      ) : error ? (
        <div className="rounded-2xl bg-red-500/10 p-4 text-center text-sm text-red-600">{error}</div>
      ) : !status?.allDone ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Hourglass size={28} className="text-primary" />
            </div>
            <p className="font-display text-base font-semibold">Menunggu peserta lain</p>
            <p className="text-sm text-muted-foreground">
              Nilai baru tampil setelah semua peserta selesai mengerjakan.
              {status && status.total > 0 && <> Sejauh ini <b>{status.completed}/{status.total}</b> peserta sudah submit.</>}
            </p>
            <Button variant="outline" onClick={load}><RefreshCw size={15} /> Cek Lagi</Button>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">Belum ada hasil untuk exam ini.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border dark:border-border-dark">
          {rows.map((r, i) => (
            <div key={r.studentId} className={`flex items-center gap-3 border-b border-border p-3 last:border-b-0 dark:border-border-dark ${r.studentId === myId ? 'bg-primary/5' : ''}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${i === 0 ? 'bg-amber-400/20 text-amber-600' : i === 1 ? 'bg-slate-300/30 text-slate-500' : i === 2 ? 'bg-orange-400/20 text-orange-600' : 'bg-muted/40 text-muted-foreground dark:bg-white/5'}`}>
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.fullName}{r.studentId === myId ? ' (kamu)' : ''}</p>
                <p className="text-xs text-muted-foreground">{r.correctCount} benar · {r.wrongCount} salah · {fmtTime(r.timeUsedSeconds)}</p>
              </div>
              <span className="flex items-center gap-1 text-sm font-semibold text-primary">
                {i === 0 && <Trophy size={14} />} {r.score}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
