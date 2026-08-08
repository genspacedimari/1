import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, GraduationCap, Mail, ChevronRight, Award, TrendingUp, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTeacherStore } from '../store';
import { supabase } from '@/services/supabaseClient';

function timeAgo(iso: string): string {
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

export function StudentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { students, loadStudents } = useTeacherStore();
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState(searchParams.get('class') ?? 'all');

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Deep-link support: /teacher/students?class=<name> pre-selects the filter
  // (used by the "N students" links on the Classes and Community pages).
  useEffect(() => {
    const fromUrl = searchParams.get('class');
    if (fromUrl) setFilterClass(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    const channel = supabase
      .channel('teacher-students-exam-attempts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_attempts' }, () => {
        loadStudents();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadStudents]);

  const classNames = Array.from(new Set(students.map((s) => s.className).filter(Boolean))) as string[];

  const filtered = students.filter((s) => {
    if (search) {
      const q = search.toLowerCase();
      if (!s.studentName.toLowerCase().includes(q) && !s.studentEmail.toLowerCase().includes(q)) return false;
    }
    if (filterClass !== 'all' && (s.className ?? '') !== filterClass) return false;
    return true;
  });

  const selectClass = 'rounded-2xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark';

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Students</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{filtered.length} students who have submitted exams</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-2xl border border-border bg-surface pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            style={{ minHeight: 44 }}
          />
        </div>
        <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className={selectClass} style={{ minHeight: 44 }}>
          <option value="all">All Classes</option>
          {classNames.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <GraduationCap size={32} className="text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No students found. Students appear here after they submit an exam.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((student) => (
            <motion.div key={student.studentId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
              <Card onClick={() => navigate(`/teacher/students/${student.studentId}`)} className="cursor-pointer transition-colors hover:border-primary/50">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <GraduationCap size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{student.studentName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Mail size={12} /> {student.studentEmail}</span>
                      {student.className && <Badge variant="muted">{student.className}</Badge>}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-right">
                    <div>
                      <p className="text-xs text-muted-foreground">Exams</p>
                      <p className="font-semibold">{student.totalExams}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avg</p>
                      <p className="flex items-center gap-1 font-semibold text-primary"><TrendingUp size={12} />{Math.round(student.averageScore)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Highest</p>
                      <p className="flex items-center gap-1 font-semibold text-emerald-600"><Award size={12} />{student.highestScore}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Last</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock size={12} />{timeAgo(student.lastActivity)}</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
