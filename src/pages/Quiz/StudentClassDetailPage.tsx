import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, User, Building2, FileText, Clock, CircleCheck as CheckCircle2, CirclePlay as PlayCircle, Lock, Trophy, Hash, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchClassDetails, fetchClassLeaderboard } from '@/features/quiz/services';
import { AvatarFrame } from '@/features/badges/AvatarFrame';
import { fetchBestPlacements, type BadgePlacement } from '@/features/badges/services';
import type { StudentClassInfo, ClassExamInfo, LeaderboardEntry } from '@/features/quiz/types';

interface ClassStudent {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  avatarUrl: string | null;
}

interface ClassDetails {
  info: StudentClassInfo;
  students: ClassStudent[];
  exams: ClassExamInfo[];
}

export default function StudentClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [details, setDetails] = useState<ClassDetails | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [placements, setPlacements] = useState<Map<string, BadgePlacement | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'exams' | 'students' | 'leaderboard'>('overview');

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    Promise.all([
      fetchClassDetails(classId),
      fetchClassLeaderboard(classId),
    ])
      .then(([d, lb]) => {
        if (!d) {
          setError('You are not a member of this class.');
          setDetails(null);
        } else {
          setDetails(d);
          setLeaderboard(lb);
          fetchBestPlacements(d.students.map((s) => s.id)).then(setPlacements).catch(() => {});
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load class'))
      .finally(() => setLoading(false));
  }, [classId]);

  const handleJoinExam = (exam: ClassExamInfo) => {
    if (exam.myStatus === 'completed' && exam.attemptsRemaining === 0) return;
    navigate(`/quiz/join?code=${encodeURIComponent(exam.examCode)}`);
  };

  if (loading) {
    return (
      <div className="mx-auto flex max-w-4xl items-center justify-center py-20">
        <div className="text-sm text-muted-foreground">Loading class...</div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 py-10">
        <button onClick={() => navigate('/community')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft size={16} /> Back to Community
        </button>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">{error ?? 'Class not found'}</p>
            <Button onClick={() => navigate('/community')}>Go to Community</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { info, students, exams } = details;
  const tabs = [
    { key: 'overview', label: 'Overview', icon: Building2 },
    { key: 'exams', label: 'Exams', icon: FileText },
    { key: 'students', label: 'Students', icon: Users },
    { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate('/community')}
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold">{info.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {info.schoolName ?? 'Independent'} · {info.studentCount} students
          </p>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1 dark:border-border-dark dark:bg-surface-dark">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/30 dark:hover:bg-white/5'
            }`}
            style={{ minHeight: 40, whiteSpace: 'nowrap' }}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
        {tab === 'overview' && (
          <>
            <Card>
              <CardContent className="space-y-4 p-5">
                <h2 className="font-display text-base font-semibold">Class Information</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoRow icon={User} label="Teacher" value={info.teacherName} />
                  <InfoRow icon={Building2} label="Community" value={info.schoolName ?? 'Independent'} />
                  <InfoRow icon={Users} label="Total Students" value={`${info.studentCount}`} />
                  <InfoRow icon={Hash} label="Join Code" value={info.joinCode} mono />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <h2 className="mb-3 font-display text-base font-semibold">Quick Stats</h2>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard icon={FileText} label="Exams" value={exams.length} />
                  <StatCard icon={CheckCircle2} label="Completed" value={exams.filter((e) => e.myStatus === 'completed').length} />
                  <StatCard icon={PlayCircle} label="Available" value={exams.filter((e) => e.myStatus !== 'completed' && e.attemptsRemaining > 0).length} />
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {tab === 'exams' && (
          <div className="space-y-3">
            {exams.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                  <FileText size={32} className="text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No exams available for this class yet.</p>
                </CardContent>
              </Card>
            ) : (
              exams.map((exam) => (
                <Card key={exam.id}>
                  <CardContent className="flex items-center justify-between gap-4 p-5">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-sm font-semibold">{exam.name}</h3>
                      {exam.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{exam.description}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock size={12} /> {exam.durationMinutes} min</span>
                        <span className="flex items-center gap-1"><FileText size={12} /> {exam.questionCount} questions</span>
                        {exam.examDate && (
                          <span className="flex items-center gap-1"><Calendar size={12} /> {exam.examDate}{exam.startTime ? ` ${exam.startTime}` : ''}</span>
                        )}
                      </div>
                      <div className="mt-2">
                        {exam.myStatus === 'completed' ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={12} /> Completed · Score: {exam.myScore ?? '--'}
                          </span>
                        ) : exam.attemptsRemaining > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                            <PlayCircle size={12} /> Available
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-muted/30 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            <Lock size={12} /> No attempts remaining
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {exam.myStatus === 'completed' && exam.attemptsRemaining === 0 ? (
                        <Button variant="outline" onClick={() => navigate(`/quiz/review?examId=${encodeURIComponent(exam.id)}`)}>
                          Review
                        </Button>
                      ) : (
                        <Button onClick={() => handleJoinExam(exam)}>
                          {exam.myStatus === 'in_progress' ? 'Resume' : 'Join Exam'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {tab === 'students' && (
          <Card>
            <CardContent className="p-0">
              <div className="px-5 py-4">
                <h2 className="font-display text-sm font-semibold">Class Members ({students.length})</h2>
              </div>
              <div className="border-t border-border dark:border-border-dark" />
              <div className="max-h-96 overflow-y-auto divide-y divide-border dark:divide-border-dark">
                {students.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <AvatarFrame avatarUrl={s.avatarUrl} fullName={s.name} placement={placements.get(s.id) ?? null} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {tab === 'leaderboard' && (
          <Card>
            <CardContent className="p-0">
              <div className="px-5 py-4">
                <h2 className="font-display text-sm font-semibold">Class Leaderboard</h2>
              </div>
              <div className="border-t border-border dark:border-border-dark" />
              {leaderboard.length === 0 ? (
                <div className="flex flex-col items-center gap-3 p-8 text-center">
                  <Trophy size={32} className="text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No leaderboard data yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border dark:divide-border-dark">
                  {leaderboard.map((entry, i) => (
                    <div key={entry.id} className="flex items-center gap-3 px-5 py-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        i === 0 ? 'bg-amber-500/20 text-amber-600' :
                        i === 1 ? 'bg-slate-400/20 text-slate-500' :
                        i === 2 ? 'bg-orange-500/20 text-orange-600' :
                        'bg-muted/30 text-muted-foreground'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{entry.studentName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{entry.totalXp.toFixed(0)} XP</p>
                        <p className="text-xs text-muted-foreground">{entry.examCount} exams</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, mono }: {
  icon: typeof User; label: string; value: string; mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/30 dark:bg-white/5">
        <Icon size={16} className="text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`truncate text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: {
  icon: typeof FileText; label: string; value: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border p-4 dark:border-border-dark">
      <Icon size={20} className="text-primary" />
      <p className="font-display text-xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
