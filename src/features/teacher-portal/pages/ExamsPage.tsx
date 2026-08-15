import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown, Plus, Copy, Trash2, Eye, FileText, Archive, Send, ClipboardList } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ActionMenu } from '@/components/ui/action-menu';
import { useTeacherStore } from '../store';
import { EXAM_STATUS_LABELS, type ExamStatus } from '../types';
import { formatScheduleSummary } from '../examSchedule';
import { cn } from '@/utils/cn';

const statusVariant: Record<ExamStatus, 'default' | 'success' | 'muted'> = {
  draft: 'muted',
  published: 'success',
  archived: 'default',
};

export function ExamsPage() {
  const navigate = useNavigate();
  const { exams, loadExams, deleteExam, duplicateExam, updateExam } = useTeacherStore();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => { loadExams(); }, [loadExams]);

  const handleTogglePublish = (examId: string, status: ExamStatus) => {
    const newStatus = status === 'published' ? 'draft' : 'published';
    updateExam(examId, { status: newStatus });
  };

  const handleArchive = (examId: string) => {
    updateExam(examId, { status: 'archived' });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Exams</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{exams.length} exams</p>
        </div>
        <button
          onClick={() => navigate('/teacher/exams/new')}
          className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          style={{ minHeight: 44 }}
        >
          <Plus size={16} /> New Exam
        </button>
      </div>

      {exams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <FileText size={32} className="text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No exams yet. Create your first exam!</p>
            <button onClick={() => navigate('/teacher/exams/new')} className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Create Exam
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {exams.map((exam) => (
            <motion.div key={exam.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <Card>
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/teacher/exams/${exam.id}/edit`)}>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant[exam.status]}>{EXAM_STATUS_LABELS[exam.status]}</Badge>
                      <span className="font-mono text-xs text-muted-foreground">{exam.examCode}</span>
                    </div>
                    <p className="text-sm font-medium">{exam.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{formatScheduleSummary(exam)}</span>
                      <span>·</span>
                      <span>{exam.durationMinutes} Minutes</span>
                      <span>·</span>
                      <span>{exam.questionIds.length} Questions</span>
                    </div>
                    {exam.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{exam.description}</p>}
                  </div>
                  <div className="relative shrink-0">
                    <ActionMenu
                      trigger={({ onClick, open }) => (
                        <button
                          onClick={onClick}
                          className={cn(
                            'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors',
                            open ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/40 dark:border-border-dark dark:hover:bg-white/5'
                          )}
                          style={{ minHeight: 36 }}
                        >
                          Kelola <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
                        </button>
                      )}
                      items={[
                        { icon: ClipboardList, label: 'Review Results', onClick: () => navigate(`/teacher/exams/${exam.id}/results`) },
                        { icon: Eye, label: 'Pratinjau', onClick: () => navigate(`/teacher/exams/${exam.id}/preview`) },
                        { icon: Send, label: exam.status === 'published' ? 'Unpublish' : 'Publish', onClick: () => handleTogglePublish(exam.id, exam.status) },
                        { icon: Copy, label: 'Duplicate', onClick: () => duplicateExam(exam.id) },
                        { icon: Archive, label: 'Archive', onClick: () => handleArchive(exam.id), hidden: exam.status === 'archived' },
                        { icon: Trash2, label: 'Hapus', danger: true, onClick: () => setConfirmDelete(exam.id) },
                      ]}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Exam"
        message="This will permanently delete the exam and all its question selections. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { if (confirmDelete) deleteExam(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
