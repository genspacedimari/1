import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, MoveVertical as MoreVertical, Trash2, Copy, Users, Pencil, CircleAlert as AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useTeacherStore } from '../store';


export function ClassesPage() {
  const navigate = useNavigate();
  const { classes, loadClasses, createClass, renameClass, deleteClass } = useTeacherStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreateError(null);
    setCreating(true);
    try {
      await createClass(newName.trim());
      setNewName('');
      setShowCreate(false);
    } catch (err) {
      // Never fail silently — surface exactly what went wrong (e.g. an
      // RLS/database error) so the teacher isn't left thinking nothing
      // happened when they clicked Create.
      setCreateError(err instanceof Error ? err.message : 'Failed to create class');
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async () => {
    if (!renameId || !renameValue.trim()) return;
    await renameClass(renameId, renameValue.trim());
    setRenameId(null);
    setRenameValue('');
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Classes</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{classes.length} classes</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          style={{ minHeight: 44 }}
        >
          <Plus size={16} /> New Class
        </button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Class name (e.g. PLC Class 2024)"
                className="flex-1 rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                style={{ minHeight: 44 }}
              />
              <button onClick={handleCreate} disabled={creating} className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60" style={{ minHeight: 44 }}>
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button onClick={() => { setShowCreate(false); setCreateError(null); }} className="rounded-2xl border border-border px-4 py-3 text-sm dark:border-border-dark" style={{ minHeight: 44 }}>Cancel</button>
            </div>
            {createError && (
              <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{createError}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {classes.length === 0 && !showCreate ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Users size={32} className="text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No classes yet. Create your first class!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {classes.map((cls) => (
            <motion.div key={cls.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <Card>
                <CardContent className="p-5">
                  {renameId === cls.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenameId(null); }}
                        className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                      />
                      <button onClick={handleRename} className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Save</button>
                      <button onClick={() => setRenameId(null)} className="rounded-xl border border-border px-3 py-2 text-sm dark:border-border-dark">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <button onClick={() => navigate(`/teacher/classes/${encodeURIComponent(cls.id)}`)} className="text-left">
                          <h3 className="font-display text-sm font-semibold hover:text-primary">{cls.name}</h3>
                        </button>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => copyCode(cls.joinCode)}
                            className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 font-mono text-xs font-semibold text-primary"
                          >
                            {cls.joinCode}
                            {copiedCode === cls.joinCode ? <CheckIcon /> : <Copy size={12} />}
                          </button>
                          <button
                            onClick={() => navigate(`/teacher/students?class=${encodeURIComponent(cls.name)}`)}
                            className="text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                          >
                            {cls.studentCount} students
                          </button>
                        </div>
                      </div>
                      <div className="relative shrink-0">
                        <button onClick={() => setMenuOpen(menuOpen === cls.id ? null : cls.id)} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
                          <MoreVertical size={18} />
                        </button>
                        {menuOpen === cls.id && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(null)} />
                            <div className="absolute right-0 top-11 z-30 w-40 rounded-2xl border border-border bg-surface py-1 shadow-lg dark:border-border-dark dark:bg-surface-dark">
                              <button onClick={() => { setRenameId(cls.id); setRenameValue(cls.name); setMenuOpen(null); }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted/30">
                                <Pencil size={16} /> Rename
                              </button>
                              <button onClick={() => { setConfirmDelete(cls.id); setMenuOpen(null); }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-500 hover:bg-muted/30">
                                <Trash2 size={16} /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Class"
        message="This will remove the class and unenroll all students. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { if (confirmDelete) deleteClass(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function CheckIcon() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
