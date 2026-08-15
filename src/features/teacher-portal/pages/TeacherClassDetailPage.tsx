import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, FileText, Trophy, Plus, Clock, CircleCheck as CheckCircle2, CirclePlay as PlayCircle, User, Building2, Hash } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTeacherStore } from '../store';
import { supabase } from '@/services/supabaseClient';
import { AvatarFrame } from '@/features/badges/AvatarFrame';
import { fetchBestPlacements, type BadgePlacement } from '@/features/badges/services';
import type { ClassStudent } from '../types';

interface ScoreLeaderboardEntry {
  studentId: string;
  studentName: string;
  studentEmail: string;
  totalScore: number;
  examCount: number;
  avgScore: number;
  bestScore: number;
}

interface ExamScoreRow {
  studentId: string;
  studentName: string;
  studentEmail: string;
  score: number;
  examId: string;
  examName: string;
  submittedAt: string | null;
}

export function TeacherClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { classes, exams, loadClasses, loadExams, fetchClassStudents } = useTeacherStore();
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [placements, setPlacements] = useState<Map<string, BadgePlacement | null>>(new Map());
  const [scoreLeaderboard, setScoreLeaderboard] = useState<ScoreLeaderboardEntry[]>([]);
  const [examScoreRows, setExamScoreRows] = useState<ExamScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'exams' | 'students' | 'leaderboard'>('overview');
  const [lbView, setLbView] = useState<'all' | string>('all');

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    Promise.all([
      loadClasses(),
      loadExams(),
      fetchClassStudents(classId).catch(() => []),
      fetchClassScoreLeaderboard(classId).catch(() => []),
      fetchClassExamScores(classId).catch(() => []),
    ])
      .then(([, , studs, lb, examScores]) => {
        setStudents(studs);
        setScoreLeaderboard(lb);
        setExamScoreRows(examScores);
        fetchBestPlacements(studs.map((s) => s.studentId)).then(setPlacements).catch(() => {});
      })
      .finally(() => setLoading(false));
  }, [classId]);

  const cls = classes.find((c) => c.id === classId);

  const classExams = exams.filter((e) => {
    if (e.visibility === 'school') return false;
    if (e.targetAllClasses) return true;
    return e.classIds?.includes(classId ?? '');
  });

  if (loading) {
    return (
      <div className="mx-auto flex max-w-4xl items-center justify-center py-20">
        <div className="text-sm text-muted-foreground">Loading class...</div>
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 py-10">
        <button onClick={() => navigate('/teacher/classes')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft size={16} /> Back to Classes
        </button>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">Class not found.</p>
            <Button onClick={() => navigate('/teacher/classes')}>Go to Classes</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          onClick={() => navigate('/teacher/classes')}
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold">{cls.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {cls.studentCount} students · {classExams.length} exams
          </p>
        </div>
        <Button onClick={() => navigate('/teacher/exams/new')}>
          <Plus size={16} /> Add Exam
        </Button>
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
                  <InfoRow icon={User} label="Teacher" value="You" />
                  <InfoRow icon={Users} label="Total Students" value={`${cls.studentCount}`} />
                  <InfoRow icon={Hash} label="Join Code" value={cls.joinCode} mono />
                  <InfoRow icon={FileText} label="Exams" value={`${classExams.length}`} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <h2 className="mb-3 font-display text-base font-semibold">Quick Stats</h2>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard icon={FileText} label="Exams" value={classExams.length} />
                  <StatCard icon={Users} label="Students" value={cls.studentCount} />
                  <StatCard icon={CheckCircle2} label="Published" value={classExams.filter((e) => e.status === 'published').length} />
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {tab === 'exams' && (
          <div className="space-y-3">
            {classExams.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                  <FileText size={32} className="text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No exams linked to this class yet.</p>
                  <Button onClick={() => navigate('/teacher/exams/new')} variant="outline">
                    <Plus size={16} /> Create Exam
                  </Button>
                </CardContent>
              </Card>
            ) : (
              classExams.map((exam) => (
                <Card key={exam.id}>
                  <CardContent className="flex items-center justify-between gap-4 p-5">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-sm font-semibold">{exam.name}</h3>
                      {exam.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{exam.description}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock size={12} /> {exam.durationMinutes} min</span>
                        <span className="flex items-center gap-1"><FileText size={12} /> {exam.questionIds.length} questions</span>
                        {exam.targetAllClasses && <span className="rounded-lg bg-primary/10 px-2 py-0.5 font-medium text-primary">All Classes</span>}
                      </div>
                      <div className="mt-2">
                        <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium ${
                          exam.status === 'published'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}>
                          {exam.status === 'published' ? <CheckCircle2 size={12} /> : <PlayCircle size={12} />}
                          {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" onClick={() => navigate(`/teacher/exams/${exam.id}/results`)}>
                        Results
                      </Button>
                      <Button variant="outline" onClick={() => navigate(`/teacher/exams/${exam.id}/preview`)}>
                        Preview
                      </Button>
                      <Button variant="outline" onClick={() => navigate(`/teacher/exams/${exam.id}/edit`)}>
                        Edit
                      </Button>
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
              {students.length === 0 ? (
                <div className="flex flex-col items-center gap-3 p-8 text-center">
                  <Users size={32} className="text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No students have joined this class yet.</p>
                  <p className="font-mono text-sm font-semibold text-primary">{cls.joinCode}</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto divide-y divide-border dark:divide-border-dark">
                  {students.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                      <AvatarFrame
                        avatarUrl={s.avatarUrl}
                        fullName={s.fullName || '?'}
                        placement={placements.get(s.studentId) ?? null}
                        size={36}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                      </div>
                      <button
                        onClick={() => navigate(`/teacher/students/${encodeURIComponent(s.studentId)}`)}
                        className="text-xs text-primary underline-offset-2 hover:underline"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {tab === 'leaderboard' && (
          <ClassScoreLeaderboard
            classExams={classExams}
            allExamsData={scoreLeaderboard}
            examScoreRows={examScoreRows}
            lbView={lbView}
            setLbView={setLbView}
          />
        )}
      </motion.div>
    </div>
  );
}

// ============================================================
// Score-based leaderboard component with per-exam / all-exams toggle
// ============================================================
function ClassScoreLeaderboard({
  classExams,
  allExamsData,
  examScoreRows,
  lbView,
  setLbView,
}: {
  classExams: Array<{ id: string; name: string }>;
  allExamsData: ScoreLeaderboardEntry[];
  examScoreRows: ExamScoreRow[];
  lbView: 'all' | string;
  setLbView: (v: 'all' | string) => void;
}) {
  const rankColors = (i: number) => {
    if (i === 0) return 'bg-amber-500/20 text-amber-600';
    if (i === 1) return 'bg-slate-400/20 text-slate-500';
    if (i === 2) return 'bg-orange-500/20 text-orange-600';
    return 'bg-muted/30 text-muted-foreground';
  };

  // Per-exam view: show scores for the selected exam
  const examRows = useMemo(() => {
    if (lbView === 'all') return [];
    return examScoreRows
      .filter((r) => r.examId === lbView)
      .sort((a, b) => b.score - a.score);
  }, [examScoreRows, lbView]);

  const sortedAll = useMemo(
    () => [...allExamsData].sort((a, b) => b.totalScore - a.totalScore || b.avgScore - a.avgScore),
    [allExamsData],
  );

  const isEmpty = lbView === 'all' ? sortedAll.length === 0 : examRows.length === 0;

  return (
    <div className="space-y-4">
      {/* Toggle between all-exams and per-exam */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setLbView('all')}
          className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
            lbView === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'border border-border text-muted-foreground hover:bg-muted/30 dark:border-border-dark dark:hover:bg-white/5'
          }`}
        >
          All Exams
        </button>
        {classExams.map((ex) => (
          <button
            key={ex.id}
            onClick={() => setLbView(ex.id)}
            className={`max-w-[180px] truncate rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
              lbView === ex.id
                ? 'bg-primary text-primary-foreground'
                : 'border border-border text-muted-foreground hover:bg-muted/30 dark:border-border-dark dark:hover:bg-white/5'
            }`}
          >
            {ex.name}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-5 py-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">
              {lbView === 'all' ? 'Class Leaderboard — All Exams' : 'Leaderboard — Single Exam'}
            </h2>
            <span className="text-xs text-muted-foreground">
              {lbView === 'all' ? `${sortedAll.length} students` : `${examRows.length} attempts`}
            </span>
          </div>
          <div className="border-t border-border dark:border-border-dark" />
          {isEmpty ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <Trophy size={32} className="text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No exam scores yet.</p>
            </div>
          ) : lbView === 'all' ? (
            <div className="divide-y divide-border dark:divide-border-dark">
              {sortedAll.map((entry, i) => (
                <div key={entry.studentId} className="flex items-center gap-3 px-5 py-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${rankColors(i)}`}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.studentName}</p>
                    <p className="truncate text-xs text-muted-foreground">{entry.studentEmail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">{entry.totalScore} pts</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.examCount} exams · avg {entry.avgScore}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border dark:divide-border-dark">
              {examRows.map((row, i) => (
                <div key={`${row.studentId}-${row.examId}`} className="flex items-center gap-3 px-5 py-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${rankColors(i)}`}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.studentName}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.studentEmail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">{row.score}/100</p>
                    {row.submittedAt && (
                      <p className="text-xs text-muted-foreground">{new Date(row.submittedAt).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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

// ============================================================
// Fetch aggregated score leaderboard for a class (all exams)
// ============================================================
async function fetchClassScoreLeaderboard(classId: string): Promise<ScoreLeaderboardEntry[]> {
  // Get student IDs for this class
  const { data: studentRows, error: sErr } = await supabase
    .from('class_students')
    .select('student_id')
    .eq('class_id', classId);
  if (sErr) throw sErr;
  const studentIds = (studentRows ?? []).map((r) => r.student_id);
  if (studentIds.length === 0) return [];

  // Fetch profiles for names
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', studentIds);
  const profileMap = new Map<string, { name: string; email: string }>();
  (profiles ?? []).forEach((p) => {
    const row = p as { id: string; full_name: string; email: string };
    profileMap.set(row.id, { name: row.full_name, email: row.email });
  });

  // Fetch completed exam attempts for these students
  const { data: attempts, error: aErr } = await supabase
    .from('exam_attempts')
    .select('student_id, score, status')
    .eq('status', 'completed')
    .in('student_id', studentIds);
  if (aErr) throw aErr;

  // Aggregate per student
  const agg = new Map<string, { total: number; count: number; best: number }>();
  (attempts ?? []).forEach((a) => {
    const row = a as { student_id: string; score: number };
    const cur = agg.get(row.student_id) ?? { total: 0, count: 0, best: 0 };
    cur.total += Number(row.score);
    cur.count += 1;
    cur.best = Math.max(cur.best, Number(row.score));
    agg.set(row.student_id, cur);
  });

  return studentIds.map((sid) => {
    const prof = profileMap.get(sid);
    const stats = agg.get(sid);
    return {
      studentId: sid,
      studentName: prof?.name ?? 'Unknown Student',
      studentEmail: prof?.email ?? '',
      totalScore: stats?.total ?? 0,
      examCount: stats?.count ?? 0,
      avgScore: stats ? Math.round(stats.total / stats.count) : 0,
      bestScore: stats?.best ?? 0,
    };
  });
}

// ============================================================
// Fetch per-exam score rows for all class exams
// ============================================================
async function fetchClassExamScores(classId: string): Promise<ExamScoreRow[]> {
  const { data: studentRows } = await supabase
    .from('class_students')
    .select('student_id')
    .eq('class_id', classId);
  const studentIds = (studentRows ?? []).map((r) => r.student_id);
  if (studentIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', studentIds);
  const profileMap = new Map<string, { name: string; email: string }>();
  (profiles ?? []).forEach((p) => {
    const row = p as { id: string; full_name: string; email: string };
    profileMap.set(row.id, { name: row.full_name, email: row.email });
  });

  const { data: attempts, error } = await supabase
    .from('exam_attempts')
    .select('id, student_id, exam_id, score, submitted_at, status')
    .eq('status', 'completed')
    .in('student_id', studentIds);
  if (error) throw error;

  // Get exam names
  const examIds = Array.from(new Set((attempts ?? []).map((a) => (a as { exam_id: string }).exam_id)));
  const { data: examRows } = await supabase
    .from('exams')
    .select('id, name')
    .in('id', examIds);
  const examNameMap = new Map<string, string>();
  (examRows ?? []).forEach((e) => {
    const row = e as { id: string; name: string };
    examNameMap.set(row.id, row.name);
  });

  return (attempts ?? []).map((a) => {
    const row = a as { student_id: string; exam_id: string; score: number; submitted_at: string | null };
    const prof = profileMap.get(row.student_id);
    return {
      studentId: row.student_id,
      studentName: prof?.name ?? 'Unknown Student',
      studentEmail: prof?.email ?? '',
      score: Number(row.score),
      examId: row.exam_id,
      examName: examNameMap.get(row.exam_id) ?? 'Unknown Exam',
      submittedAt: row.submitted_at,
    };
  });
}
