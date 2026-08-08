import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Download, BarChart3, FileText, FileSpreadsheet, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTeacherStore } from '../store';
import { exportResultsCSV, exportResultsExcel, exportResultsPDF } from '../importExport';
import type { ResultStatus } from '../types';
import { supabase } from '@/services/supabaseClient';

type SortBy = 'score_desc' | 'score_asc' | 'date_desc' | 'date_asc';

const statusVariant: Record<ResultStatus, 'success' | 'muted' | 'default'> = {
  completed: 'success',
  in_progress: 'muted',
  abandoned: 'default',
};

export function ResultsPage() {
  const navigate = useNavigate();
  const { results, exams, loadResults, loadExams, loadClasses } = useTeacherStore();
  const [search, setSearch] = useState('');
  const [filterExam, setFilterExam] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('date_desc');
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    loadResults();
    loadExams();
    loadClasses();
  }, [loadResults, loadExams, loadClasses]);

  useEffect(() => {
    const channel = supabase
      .channel('teacher-results-exam-attempts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_attempts' }, () => {
        loadResults();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadResults]);

  const filtered = results
    .filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.studentName.toLowerCase().includes(q) &&
          !r.studentEmail.toLowerCase().includes(q) &&
          !r.examName.toLowerCase().includes(q)
        ) return false;
      }
      if (filterExam !== 'all' && r.examId !== filterExam) return false;
      if (filterClass !== 'all' && (r.className ?? '') !== filterClass) return false;
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'score_desc') return b.score - a.score;
      if (sortBy === 'score_asc') return a.score - b.score;
      if (sortBy === 'date_asc') return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
      return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
    });

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    if (format === 'csv') exportResultsCSV(filtered);
    else if (format === 'excel') exportResultsExcel(filtered);
    else exportResultsPDF(filtered);
    setExportOpen(false);
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  const classNames = Array.from(new Set(results.map((r) => r.className).filter(Boolean))) as string[];

  const selectClass = 'rounded-2xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark';

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Results</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{filtered.length} results</p>
        </div>
        <div className="relative">
          <Button variant="outline" onClick={() => setExportOpen(!exportOpen)}>
            <Download size={16} /> Export
          </Button>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setExportOpen(false)} />
              <div className="absolute right-0 top-12 z-30 w-40 rounded-2xl border border-border bg-surface py-1 shadow-lg dark:border-border-dark dark:bg-surface-dark">
                <button onClick={() => handleExport('csv')} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted/30"><FileText size={16} /> CSV</button>
                <button onClick={() => handleExport('excel')} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted/30"><FileSpreadsheet size={16} /> Excel</button>
                <button onClick={() => handleExport('pdf')} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted/30"><FileText size={16} /> PDF</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name, email, or exam..."
            className="w-full rounded-2xl border border-border bg-surface pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            style={{ minHeight: 44 }}
          />
        </div>
        <select value={filterExam} onChange={(e) => setFilterExam(e.target.value)} className={selectClass} style={{ minHeight: 44 }}>
          <option value="all">All Exams</option>
          {exams.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className={selectClass} style={{ minHeight: 44 }}>
          <option value="all">All Classes</option>
          {classNames.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClass} style={{ minHeight: 44 }}>
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="in_progress">In Progress</option>
          <option value="abandoned">Abandoned</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className={selectClass} style={{ minHeight: 44 }}>
          <option value="date_desc">Newest First</option>
          <option value="date_asc">Oldest First</option>
          <option value="score_desc">Highest Score</option>
          <option value="score_asc">Lowest Score</option>
        </select>
      </div>

      {/* Results table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <BarChart3 size={32} className="text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No student submissions yet. Results appear here as soon as a student submits an exam.</p>
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
                    <th className="px-5 py-3 text-left font-medium">Student</th>
                    <th className="px-3 py-3 text-left font-medium">Exam</th>
                    <th className="px-3 py-3 text-left font-medium">Class</th>
                    <th className="px-3 py-3 text-left font-medium">Score</th>
                    <th className="px-3 py-3 text-left font-medium">Correct</th>
                    <th className="px-3 py-3 text-left font-medium">Wrong</th>
                    <th className="px-3 py-3 text-left font-medium">Time</th>
                    <th className="px-3 py-3 text-left font-medium">Submitted At</th>
                    <th className="px-3 py-3 text-left font-medium">Rank</th>
                    <th className="px-5 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border dark:divide-border-dark">
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/teacher/results/${r.id}`)}
                      className="cursor-pointer hover:bg-muted/20 dark:hover:bg-white/5"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium">{r.studentName}</p>
                        <p className="text-xs text-muted-foreground">{r.studentEmail}</p>
                      </td>
                      <td className="px-3 py-3">{r.examName}</td>
                      <td className="px-3 py-3 text-muted-foreground">{r.className ?? '-'}</td>
                      <td className="px-3 py-3 font-semibold text-primary">{r.score}</td>
                      <td className="px-3 py-3 text-emerald-600">{r.correctCount}</td>
                      <td className="px-3 py-3 text-red-500">{r.wrongCount}</td>
                      <td className="px-3 py-3 text-muted-foreground">{fmtTime(r.timeUsedSeconds)}</td>
                      <td className="px-3 py-3 text-muted-foreground">{new Date(r.completedAt).toLocaleString()}</td>
                      <td className="px-3 py-3 font-medium">{r.rank ? `#${r.rank}` : '-'}</td>
                      <td className="px-5 py-3"><Badge variant={statusVariant[r.status]}>{r.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {filtered.map((r) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                <Card onClick={() => navigate(`/teacher/results/${r.id}`)} className="cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.studentName}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.examName}{r.className ? ` · ${r.className}` : ''}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="font-display text-lg font-semibold text-primary">{r.score}</span>
                        {r.rank && <p className="text-xs text-muted-foreground">Rank #{r.rank}</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="text-emerald-600">{r.correctCount} correct</span>
                      <span className="text-red-500">{r.wrongCount} wrong</span>
                      <span>{fmtTime(r.timeUsedSeconds)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{new Date(r.completedAt).toLocaleString()}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant[r.status]}>{r.status}</Badge>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
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
