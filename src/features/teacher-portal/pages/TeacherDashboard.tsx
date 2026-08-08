import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, GraduationCap, TrendingUp, Clock, Plus, Upload, Users, Target, ArrowDown, ArrowUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useTeacherStore } from '../store';
import { supabase } from '@/services/supabaseClient';
import type { ExamResult } from '../types';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

function formatTime(seconds: number): string {
  if (!seconds) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function TeacherDashboard() {
  const navigate = useNavigate();
  const { exams, results, classes, students, loadQuestions, loadExams, loadResults, loadClasses, loadStudents } = useTeacherStore();

  useEffect(() => {
    loadQuestions();
    loadExams();
    loadResults();
    loadClasses();
    loadStudents();
  }, [loadQuestions, loadExams, loadResults, loadClasses, loadStudents]);

  useEffect(() => {
    const channel = supabase
      .channel('teacher-dashboard-exam-attempts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_attempts' }, () => {
        loadResults();
        loadStudents();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadResults, loadStudents]);

  const activeExams = exams.filter((e) => e.status === 'published').length;
  const completedResults = results.filter((r) => r.status === 'completed');
  const avgScore = completedResults.length > 0
    ? Math.round(completedResults.reduce((sum, r) => sum + r.score, 0) / completedResults.length)
    : 0;
  const totalStudents = useMemo(
    () => new Set(completedResults.map((r) => r.studentId)).size,
    [completedResults]
  );

  // Average accuracy
  const totalCorrect = completedResults.reduce((s, r) => s + r.correctCount, 0);
  const totalWrong = completedResults.reduce((s, r) => s + r.wrongCount, 0);
  const avgAccuracy = (totalCorrect + totalWrong) > 0
    ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100)
    : 0;

  // Average time
  const avgTime = completedResults.length > 0
    ? Math.round(completedResults.reduce((s, r) => s + r.timeUsedSeconds, 0) / completedResults.length)
    : 0;

  // Top and lowest students
  const sortedStudents = [...students].sort((a, b) => b.averageScore - a.averageScore);
  const topStudent = sortedStudents[0] ?? null;
  const lowestStudent = sortedStudents[sortedStudents.length - 1] ?? null;

  const stats: { label: string; value: string | number; icon: typeof FileText; color: string; to: string }[] = [
    { label: 'Total Students', value: totalStudents, icon: GraduationCap, color: '#059669', to: '/teacher/students' },
    { label: 'Total Classes', value: classes.length, icon: Users, color: '#0891B2', to: '/teacher/classes' },
    { label: 'Total Exams', value: exams.length, icon: FileText, color: '#F26B3A', to: '/teacher/exams' },
    { label: 'Exam Completion', value: completedResults.length, icon: Target, color: '#22C55E', to: '/teacher/results' },
    { label: 'Average Score', value: avgScore, icon: TrendingUp, color: '#D97706', to: '/teacher/results' },
    { label: 'Average Accuracy', value: `${avgAccuracy}%`, icon: Target, color: '#059669', to: '/teacher/results' },
    { label: 'Average Time', value: formatTime(avgTime), icon: Clock, color: '#6B7280', to: '/teacher/results' },
    { label: 'Active Exams', value: activeExams, icon: Clock, color: '#22C55E', to: '/teacher/exams' },
  ];

  const quickActions = [
    { label: 'New Exam', icon: FileText, to: '/teacher/exams/new' },
    { label: 'New Question', icon: Plus, to: '/teacher/questions/new' },
    { label: 'Import Questions', icon: Upload, to: '/teacher/questions/import' },
  ];

  const recentActivity = completedResults
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 10);

  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
  const itemVar = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="mx-auto max-w-4xl space-y-6">
      <motion.div variants={itemVar}>
        <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Overview of your teaching activity.</p>
      </motion.div>

      {/* Stats grid */}
      <motion.div variants={itemVar} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((stat) => (
          <button key={stat.label} onClick={() => navigate(stat.to)} className="text-left" style={{ minHeight: 44 }}>
            <Card className="transition-colors hover:border-primary/50">
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${stat.color}15`, color: stat.color }}
                >
                  <stat.icon size={20} />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold truncate">{stat.value}</p>
                  <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </motion.div>

      {/* Top & Lowest Student */}
      {(topStudent || lowestStudent) && (
        <motion.div variants={itemVar} className="grid grid-cols-2 gap-3">
          {topStudent && (
            <button onClick={() => navigate(`/teacher/students/${topStudent.studentId}`)} className="text-left">
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                    <ArrowUp size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Top Student</p>
                    <p className="truncate text-sm font-semibold">{topStudent.studentName}</p>
                    <p className="text-xs text-muted-foreground">Avg: {topStudent.averageScore}</p>
                  </div>
                </CardContent>
              </Card>
            </button>
          )}
          {lowestStudent && lowestStudent.studentId !== topStudent?.studentId && (
            <button onClick={() => navigate(`/teacher/students/${lowestStudent.studentId}`)} className="text-left">
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-600">
                    <ArrowDown size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Lowest Student</p>
                    <p className="truncate text-sm font-semibold">{lowestStudent.studentName}</p>
                    <p className="text-xs text-muted-foreground">Avg: {lowestStudent.averageScore}</p>
                  </div>
                </CardContent>
              </Card>
            </button>
          )}
        </motion.div>
      )}

      {/* Quick actions */}
      <motion.div variants={itemVar}>
        <h2 className="mb-3 text-sm font-semibold">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.to)}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-center transition-all hover:border-primary hover:bg-primary/5 dark:border-border-dark dark:bg-surface-dark/50"
              style={{ minHeight: 44 }}
            >
              <action.icon size={24} className="text-primary" />
              <span className="text-xs font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Recent activity */}
      <motion.div variants={itemVar}>
        <h2 className="mb-3 text-sm font-semibold">Recent Activity</h2>
        <Card>
          <CardContent className="p-0">
            {recentActivity.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No student submissions yet. Create an exam and publish it to see results here.
              </div>
            ) : (
              <div className="divide-y divide-border dark:divide-border-dark">
                {recentActivity.map((r: ExamResult) => (
                  <button
                    key={r.id}
                    onClick={() => navigate(`/teacher/results/${r.id}`)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/20 dark:hover:bg-white/5"
                    style={{ minHeight: 44 }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {r.studentName} completed {r.examName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{timeAgo(r.completedAt)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-primary">Score {r.score}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
