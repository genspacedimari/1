import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, Award, TrendingUp, Zap, Trophy, Clock, FileText, ChevronRight, Building2, User, Target, Globe } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTeacherStore } from '../store';
import { AvatarFrame } from '@/features/badges/AvatarFrame';
import { fetchBestPlacements, type BadgePlacement } from '@/features/badges/services';
import type { StudentDetail } from '../types';

function timeAgo(iso: string): string {
  if (!iso) return '-';
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  return `${d}d ago`;
}

export function StudentDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { fetchStudentDetail } = useTeacherStore();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [placement, setPlacement] = useState<BadgePlacement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchStudentDetail(id).then((data) => {
      setStudent(data);
      setLoading(false);
      if (data) {
        fetchBestPlacements([data.studentId]).then((m) => setPlacement(m.get(data.studentId) ?? null)).catch(() => {});
      }
    }).catch(() => setLoading(false));
  }, [id, fetchStudentDetail]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <button onClick={() => navigate('/teacher/students')} className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft size={20} /> Back to Students
        </button>
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Student not found.</CardContent></Card>
      </div>
    );
  }

  // Chart helpers — simple SVG sparkline
  const maxScore = student.scoreHistory.length > 0 ? Math.max(...student.scoreHistory.map((h) => h.score), 100) : 100;
  const maxXp = student.xpHistory.length > 0 ? Math.max(...student.xpHistory.map((h) => h.xp), 1) : 1;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/teacher/students')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-xl font-semibold">Student Detail</h1>
      </div>

      {/* Profile card */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <AvatarFrame avatarUrl={student.avatarUrl} fullName={student.studentName} placement={placement} size={56} />
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold">{student.studentName}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail size={14} /> <span className="truncate">{student.studentEmail}</span>
              </div>
            </div>
          </div>

          {/* Academic info */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <InfoStat label="Community" value={student.schoolName ?? 'Not set'} icon={Building2} color="#0891B2" />
            <InfoStat label="Class" value={student.className ?? 'None'} icon={FileText} color="#059669" />
            <InfoStat label="Teacher" value={student.teacherName ?? '-'} icon={User} color="#F26B3A" />
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatBox label="Level" value={student.level} icon={Zap} color="#F26B3A" />
            <StatBox label="Total XP" value={student.xp} icon={Zap} color="#D97706" />
            <StatBox label="Total Exams" value={student.totalExams} icon={FileText} color="#059669" />
            <StatBox label="Average Score" value={Math.round(student.averageScore)} icon={TrendingUp} color="#D97706" />
            <StatBox label="Highest Score" value={student.highestScore} icon={Award} color="#22C55E" />
            <StatBox label="Accuracy" value={`${student.accuracy}%`} icon={Target} color="#22C55E" />
            <StatBox label="Last Active" value={timeAgo(student.lastActivity)} icon={Clock} color="#6B7280" />
            <StatBox label="Teacher Rank" value={student.leaderboardPosition ? `#${student.leaderboardPosition}` : '-'} icon={Trophy} color="#F26B3A" />
          </div>

          {/* Ranks */}
          <div className="grid grid-cols-3 gap-3 border-t border-border pt-4 dark:border-border-dark">
            <RankCard label="Global" rank={student.globalRank} icon={Globe} color="#F26B3A" />
            <RankCard label="Community" rank={student.schoolRank} icon={Building2} color="#0891B2" />
            <RankCard label="Class" rank={student.classRank} icon={Trophy} color="#D97706" />
          </div>
        </CardContent>
      </Card>

      {/* XP Progress Chart */}
      {student.xpHistory.length > 1 && (
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 text-sm font-semibold">XP Progress</h2>
            <Sparkline data={student.xpHistory.map((h) => h.xp)} max={maxXp} color="#F26B3A" />
          </CardContent>
        </Card>
      )}

      {/* Score History Chart */}
      {student.scoreHistory.length > 1 && (
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Score History</h2>
            <Sparkline data={student.scoreHistory.map((h) => h.score)} max={maxScore} color="#0891B2" />
          </CardContent>
        </Card>
      )}

      {/* Exam history */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">Exam History</h2>
        {student.history.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No exam history yet.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {student.history.map((r) => (
              <Card key={r.id} onClick={() => navigate(`/teacher/results/${r.id}`)} className="cursor-pointer transition-colors hover:border-primary/50">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.examName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={r.status === 'completed' ? 'success' : 'muted'}>{r.status}</Badge>
                      <span className="flex items-center gap-1"><Clock size={12} />{timeAgo(r.completedAt)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-lg font-semibold text-primary">{r.score}</p>
                    {r.rank && <p className="text-xs text-muted-foreground">Rank #{r.rank}</p>}
                  </div>
                  <ChevronRight size={20} className="shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoStat({ label, value, icon: Icon, color }: { label: string; value: string; icon: typeof FileText; color: string }) {
  return (
    <div className="rounded-2xl border border-border p-3 dark:border-border-dark">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15`, color }}>
          <Icon size={14} />
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1.5 truncate font-display text-sm font-semibold">{value}</p>
    </div>
  );
}

function StatBox({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: typeof FileText; color: string }) {
  return (
    <div className="rounded-2xl border border-border p-3 dark:border-border-dark">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15`, color }}>
          <Icon size={14} />
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1.5 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}

function RankCard({ label, rank, icon: Icon, color }: { label: string; rank: number | null; icon: typeof Trophy; color: string }) {
  return (
    <div className="rounded-2xl border border-border p-3 text-center dark:border-border-dark">
      <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15`, color }}>
        <Icon size={16} />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-semibold">{rank ? `#${rank}` : '-'}</p>
    </div>
  );
}

function Sparkline({ data, max, color }: { data: number[]; max: number; color: string }) {
  const w = 300;
  const h = 60;
  const n = data.length;
  if (n < 2) return <p className="text-xs text-muted-foreground">Not enough data for chart.</p>;
  const stepX = w / (n - 1);
  const points = data.map((v, i) => `${i * stepX},${h - (v / max) * h}`);
  const path = `M ${points.join(' L ')}`;
  const areaPath = `${path} L ${w},${h} L 0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 60 }}>
      <path d={areaPath} fill={`${color}20`} />
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((v, i) => (
        <circle key={i} cx={i * stepX} cy={h - (v / max) * h} r={2.5} fill={color} />
      ))}
    </svg>
  );
}
