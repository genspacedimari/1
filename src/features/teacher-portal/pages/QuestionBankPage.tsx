import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, MoveVertical as MoreVertical, Copy, Archive, Trash2, Eye, RotateCcw, Download, Upload, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useTeacherStore } from '../store';
import { exportQuestionsJSON, exportQuestionsCSV, exportQuestionsExcel } from '../importExport';
import {
  QUESTION_TYPE_LABELS, DIFFICULTY_LABELS, type Difficulty, type QuestionType,
} from '../types';
import { cn } from '@/utils/cn';

type SortBy = 'newest' | 'oldest' | 'points';

export function QuestionBankPage() {
  const navigate = useNavigate();
  const {
    questions, archivedQuestions, categories, loading,
    loadQuestions, loadCategories, duplicateQuestion, archiveQuestion, deleteQuestion,
  } = useTeacherStore();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<QuestionType | 'all'>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<Difficulty | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [showArchived, setShowArchived] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  useEffect(() => {
    loadQuestions();
    loadQuestions(true);
    loadCategories();
  }, [loadQuestions, loadCategories]);

  const source = showArchived ? archivedQuestions : questions;

  const filtered = source
    .filter((q) => {
      if (search && !q.question.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterType !== 'all' && q.type !== filterType) return false;
      if (filterDifficulty !== 'all' && q.difficulty !== filterDifficulty) return false;
      if (filterCategory !== 'all' && q.categoryId !== filterCategory) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'points') return b.points - a.points;
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const handleExport = (format: 'json' | 'csv' | 'excel') => {
    const data = filtered.length > 0 ? filtered : questions;
    if (format === 'json') exportQuestionsJSON(data);
    else if (format === 'csv') exportQuestionsCSV(data);
    else exportQuestionsExcel(data);
    setExportMenuOpen(false);
  };

  const diffColor: Record<Difficulty, string> = {
    easy: 'success',
    medium: 'default',
    hard: 'muted',
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Question Bank</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{questions.length} questions</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/30 dark:border-border-dark"
              style={{ minHeight: 44 }}
            >
              <Download size={16} /> Export
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 top-12 z-30 w-40 rounded-2xl border border-border bg-surface py-1 shadow-lg dark:border-border-dark dark:bg-surface-dark">
                <button onClick={() => handleExport('json')} className="block w-full px-4 py-2 text-left text-sm hover:bg-muted/30">JSON</button>
                <button onClick={() => handleExport('csv')} className="block w-full px-4 py-2 text-left text-sm hover:bg-muted/30">CSV</button>
                <button onClick={() => handleExport('excel')} className="block w-full px-4 py-2 text-left text-sm hover:bg-muted/30">Excel</button>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/teacher/questions/import')}
            className="flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/30 dark:border-border-dark"
            style={{ minHeight: 44 }}
          >
            <Upload size={16} /> Import
          </button>
          <button
            onClick={() => navigate('/teacher/questions/new')}
            className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            style={{ minHeight: 44 }}
          >
            <Plus size={16} /> New
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions..."
            className="w-full rounded-2xl border border-border bg-surface pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            style={{ minHeight: 44 }}
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as QuestionType | 'all')}
          className="rounded-2xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
          style={{ minHeight: 44 }}
        >
          <option value="all">All Types</option>
          <option value="multiple_choice">Multiple Choice</option>
          <option value="image">Image</option>
          <option value="ladder">Ladder Logic</option>
        </select>
        <select
          value={filterDifficulty}
          onChange={(e) => setFilterDifficulty(e.target.value as Difficulty | 'all')}
          className="rounded-2xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
          style={{ minHeight: 44 }}
        >
          <option value="all">All Difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-2xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
          style={{ minHeight: 44 }}
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="rounded-2xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
          style={{ minHeight: 44 }}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="points">Highest Points</option>
        </select>
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={cn(
            'rounded-2xl border px-3 py-2.5 text-sm font-medium transition-colors',
            showArchived
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-muted/30 dark:border-border-dark'
          )}
          style={{ minHeight: 44 }}
        >
          {showArchived ? 'Archived' : 'Active'}
        </button>
      </div>

      {/* Question list */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading questions...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <FileText size={32} className="text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {showArchived ? 'No archived questions.' : 'No questions yet. Create your first question!'}
            </p>
            {!showArchived && (
              <button
                onClick={() => navigate('/teacher/questions/new')}
                className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Create Question
              </button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/teacher/questions/${q.id}/edit`)}>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                      <Badge variant={diffColor[q.difficulty] as 'success' | 'default' | 'muted'}>
                        {DIFFICULTY_LABELS[q.difficulty]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{q.points} pts</span>
                    </div>
                    <p className="line-clamp-2 text-sm font-medium">{q.question}</p>
                    {q.options.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {q.options.length} options · {q.options.filter((o) => o.isCorrect).length} correct
                      </p>
                    )}
                  </div>
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setMenuOpen(menuOpen === q.id ? null : q.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/40 dark:hover:bg-white/5"
                    >
                      <MoreVertical size={18} />
                    </button>
                    {menuOpen === q.id && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(null)} />
                        <div className="absolute right-0 top-11 z-30 w-44 rounded-2xl border border-border bg-surface py-1 shadow-lg dark:border-border-dark dark:bg-surface-dark">
                          <MenuItem icon={Eye} label="Preview" onClick={() => { navigate(`/teacher/questions/${q.id}/preview`); setMenuOpen(null); }} />
                          <MenuItem icon={Copy} label="Duplicate" onClick={() => { duplicateQuestion(q.id); setMenuOpen(null); }} />
                          {q.archived ? (
                            <MenuItem icon={RotateCcw} label="Restore" onClick={() => { archiveQuestion(q.id, false); setMenuOpen(null); }} />
                          ) : (
                            <MenuItem icon={Archive} label="Archive" onClick={() => { archiveQuestion(q.id, true); setMenuOpen(null); }} />
                          )}
                          <MenuItem icon={Trash2} label="Delete" danger onClick={() => { setConfirmDelete(q.id); setMenuOpen(null); }} />
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Question"
        message="This will permanently delete the question and all its options. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { if (confirmDelete) deleteQuestion(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: {
  icon: typeof Eye; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-muted/30',
        danger && 'text-red-500'
      )}
    >
      <Icon size={16} /> {label}
    </button>
  );
}
