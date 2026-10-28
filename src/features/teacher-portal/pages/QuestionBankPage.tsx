import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, Copy, Archive, Trash2, Eye, RotateCcw, Download, Upload, FolderOpen, ClipboardList, ChevronDown, Cpu, X, Layers, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ActionMenu } from '@/components/ui/action-menu';
import { useTeacherStore } from '../store';
import { useProjectStore } from '@/features/plc-simulator/projectStore';
import { exportQuestionsJSON, exportQuestionsCSV, exportQuestionsExcel } from '../importExport';
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS, type Difficulty, type QuestionType, type Question } from '../types';
import { cn } from '@/utils/cn';

type SortBy = 'newest' | 'oldest' | 'points';

export function QuestionBankPage() {
  const navigate = useNavigate();
  const {
    questions, archivedQuestions, questionSets, categories, loading,
    loadQuestions, loadQuestionSets, loadCategories, duplicateQuestion, archiveQuestion, deleteQuestion,
  } = useTeacherStore();
  const { projects: simulatorProjects, loading: simulatorLoading, loadProjects: loadSimulatorProjects } = useProjectStore();
  const [showSimulatorImportModal, setShowSimulatorImportModal] = useState(false);
  const [simulatorSearch, setSimulatorSearch] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<QuestionType | 'all'>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<Difficulty | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showUngrouped, setShowUngrouped] = useState(false);

  useEffect(() => {
    loadQuestions(); loadQuestions(true); loadQuestionSets(); loadCategories();
  }, [loadQuestions, loadQuestionSets, loadCategories]);

  const source = showArchived ? archivedQuestions : questions;
  const filteredUngrouped = source.filter((q) => {
    if (q.questionSetId) return false;
    if (search && !q.question.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== 'all' && q.type !== filterType) return false;
    if (filterDifficulty !== 'all' && q.difficulty !== filterDifficulty) return false;
    if (filterCategory !== 'all' && q.categoryId !== filterCategory) return false;
    return true;
  }).sort((a,b) => sortBy === 'points' ? b.points-a.points : sortBy === 'oldest' ? new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime() : new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());

  const filteredSets = questionSets.filter((set) => !search || set.name.toLowerCase().includes(search.toLowerCase()));
  const handleExport = (format: 'json'|'csv'|'excel') => {
    const data = filteredUngrouped.length > 0 ? filteredUngrouped : source;
    if (format === 'json') exportQuestionsJSON(data); else if (format === 'csv') exportQuestionsCSV(data); else exportQuestionsExcel(data);
  };
  const diffColor: Record<Difficulty, string> = { easy: 'success', medium: 'default', hard: 'muted' };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div><h1 className="font-display text-2xl font-semibold">Question Bank</h1><p className="mt-0.5 text-sm text-muted-foreground">{questionSets.length} question sets · {questions.length} questions</p></div>
        <div className="flex items-center gap-2">
          <ActionMenu
            align="right"
            menuWidth={160}
            trigger={({ onClick, open }) => (
              <button onClick={onClick} className={cn('flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium', open ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/30 dark:border-border-dark')} style={{ minHeight: 44 }}>
                <Download size={16} /> Export
              </button>
            )}
            items={[
              { icon: Download, label: 'JSON', onClick: () => handleExport('json') },
              { icon: Download, label: 'CSV', onClick: () => handleExport('csv') },
              { icon: Download, label: 'Excel', onClick: () => handleExport('excel') },
            ]}
          />
          <button onClick={()=>navigate('/teacher/questions/import')} className="flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted/30 dark:border-border-dark" style={{minHeight:44}}><Upload size={16}/> Import</button>
          <ActionMenu
            align="right"
            menuWidth={240}
            trigger={({ onClick, open }) => (
              <button
                onClick={onClick}
                className={cn(
                  'flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90',
                  open && 'ring-2 ring-primary/40'
                )}
                style={{ minHeight: 44 }}
              >
                <Plus size={16} /> New <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
              </button>
            )}
            items={[
              {
                icon: Plus,
                label: 'Buat Soal Secara Manual',
                onClick: () => navigate('/teacher/questions/new'),
              },
              {
                icon: Cpu,
                label: 'Import dari Simulator (Ladder Logic)',
                onClick: () => {
                  loadSimulatorProjects();
                  setShowSimulatorImportModal(true);
                },
              },
            ]}
          />
        </div>
      </div>

      <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search question sets or ungrouped questions..." className="w-full rounded-2xl border border-border bg-surface pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" style={{minHeight:44}}/></div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={filterType} onChange={e=>setFilterType(e.target.value as QuestionType|'all')} className="rounded-2xl border border-border bg-surface px-3 py-2.5 text-sm dark:border-border-dark dark:bg-surface-dark"><option value="all">All Types</option><option value="multiple_choice">Multiple Choice</option><option value="image">Image</option><option value="ladder">Ladder Logic</option></select>
        <select value={filterDifficulty} onChange={e=>setFilterDifficulty(e.target.value as Difficulty|'all')} className="rounded-2xl border border-border bg-surface px-3 py-2.5 text-sm dark:border-border-dark dark:bg-surface-dark"><option value="all">All Difficulty</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
        <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)} className="rounded-2xl border border-border bg-surface px-3 py-2.5 text-sm dark:border-border-dark dark:bg-surface-dark"><option value="all">All Categories</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value as SortBy)} className="rounded-2xl border border-border bg-surface px-3 py-2.5 text-sm dark:border-border-dark dark:bg-surface-dark"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="points">Highest Points</option></select>
        <button onClick={()=>setShowArchived(!showArchived)} className={cn('rounded-2xl border px-3 py-2.5 text-sm font-medium',showArchived?'border-primary bg-primary/10 text-primary':'border-border text-muted-foreground dark:border-border-dark')}>{showArchived?'Archived':'Active'}</button>
      </div>

      {loading ? <div className="py-12 text-center text-sm text-muted-foreground">Loading questions...</div> : <>
        <div className="space-y-3">
          {filteredSets.map(set=><motion.div key={set.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}><Card><CardContent className="flex items-center gap-4 p-5"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><FolderOpen size={24}/></div><div className="min-w-0 flex-1"><h2 className="font-semibold truncate">{set.name}</h2><p className="mt-1 text-xs text-muted-foreground">{set.questionCount} questions · Owner: You · Created {new Date(set.createdAt).toLocaleDateString()} · Updated {new Date(set.updatedAt).toLocaleDateString()}</p></div><div className="flex items-center gap-2"><button onClick={()=>navigate(`/teacher/questions/sets/${set.id}`)} className="flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted/30 dark:border-border-dark"><Eye size={15}/> Open</button><button onClick={()=>navigate(`/teacher/questions/import?setId=${set.id}`)} className="flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted/30 dark:border-border-dark"><Upload size={15}/> Import</button><button onClick={()=>navigate(`/teacher/exams/new?questionSetId=${set.id}`)} className="flex items-center gap-2 rounded-2xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><ClipboardList size={15}/> Exam</button></div></CardContent></Card></motion.div>)}
        </div>
        {filteredSets.length===0 && <Card><CardContent className="p-8 text-center"><FolderOpen size={32} className="mx-auto text-muted-foreground/50"/><p className="mt-3 text-sm text-muted-foreground">No Question Set found.</p><button onClick={()=>navigate('/teacher/questions/import')} className="mt-3 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Import a Question Set</button></CardContent></Card>}

        <Card><CardContent className="p-0"><button onClick={()=>setShowUngrouped(!showUngrouped)} className="flex w-full items-center justify-between px-5 py-4 text-left"><div><h2 className="text-sm font-semibold">Individual / Ungrouped Questions</h2><p className="mt-0.5 text-xs text-muted-foreground">{filteredUngrouped.length} active matching questions</p></div><span className="text-xs text-muted-foreground">{showUngrouped?'Hide':'Show'}</span></button>{showUngrouped&&<div className="border-t border-border dark:border-border-dark">{filteredUngrouped.length===0?<p className="p-6 text-center text-sm text-muted-foreground">No ungrouped questions.</p>:filteredUngrouped.map(q=><QuestionRow key={q.id} q={q} diffColor={diffColor} onEdit={()=>navigate(`/teacher/questions/${q.id}/edit`)} onDuplicate={()=>duplicateQuestion(q.id)} onArchive={()=>archiveQuestion(q.id,!q.archived)} onDelete={()=>setConfirmDelete(q.id)} />)}</div>}</CardContent></Card>
      </>}

      <ConfirmDialog open={!!confirmDelete} title="Delete Question" message="This will permanently delete this question. This cannot be undone." confirmLabel="Delete" destructive onConfirm={()=>{if(confirmDelete)deleteQuestion(confirmDelete);setConfirmDelete(null)}} onCancel={()=>setConfirmDelete(null)}/>

      {/* Modal: Import Program dari Simulator */}
      {showSimulatorImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-3xl border border-border bg-surface p-6 shadow-2xl dark:border-border-dark dark:bg-surface-dark">
            <div className="flex items-center justify-between border-b border-border pb-4 dark:border-border-dark">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Cpu size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Import Program dari Simulator</h2>
                  <p className="text-xs text-muted-foreground">Pilih program yang sudah Anda buat di simulator untuk dijadikan kunci jawaban & soal latihan</p>
                </div>
              </div>
              <button
                onClick={() => setShowSimulatorImportModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40"
              >
                <X size={18} />
              </button>
            </div>

            <div className="my-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={simulatorSearch}
                  onChange={(e) => setSimulatorSearch(e.target.value)}
                  placeholder="Cari program simulator berdasarkan nama atau deskripsi..."
                  className="w-full rounded-2xl border border-border bg-surface pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              {simulatorLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Memuat program simulator...</div>
              ) : simulatorProjects.length === 0 ? (
                <div className="py-12 text-center">
                  <AlertCircle size={36} className="mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-semibold">Belum Ada Program Simulator</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                    Anda belum memiliki program Ladder Logic yang disimpan di simulator. Buka menu PLC Simulator untuk membuat dan menguji program terlebih dahulu.
                  </p>
                  <button
                    onClick={() => {
                      setShowSimulatorImportModal(false);
                      navigate('/plc-simulator');
                    }}
                    className="mt-4 rounded-2xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow"
                  >
                    Buka PLC Simulator
                  </button>
                </div>
              ) : (
                simulatorProjects
                  .filter((p) => {
                    if (!simulatorSearch.trim()) return true;
                    const q = simulatorSearch.toLowerCase();
                    return p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
                  })
                  .map((p) => {
                    let rungCount = 0;
                    try {
                      if (p.ladderJson) {
                        const parsed = JSON.parse(p.ladderJson);
                        if (Array.isArray(parsed?.rungs)) rungCount = parsed.rungs.length;
                        else if (Array.isArray(parsed)) rungCount = parsed.length;
                      }
                    } catch {}
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-border p-4 transition-all hover:border-primary/40 hover:bg-muted/10 dark:border-border-dark"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                            <Badge variant="outline" className="text-[10px] uppercase font-mono">{p.plcType}</Badge>
                            {rungCount > 0 && (
                              <Badge variant="muted" className="text-[10px]">
                                <Layers size={10} className="mr-1 inline" /> {rungCount} Rung
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                            {p.description || 'Program rangkaian ladder logic dari simulator.'}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground/70">
                            Diperbarui: {new Date(p.updatedAt || p.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setShowSimulatorImportModal(false);
                            navigate(`/teacher/questions/new?type=ladder&importSimulatorId=${p.id}`);
                          }}
                          className="shrink-0 flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 shadow-sm"
                        >
                          <Plus size={14} /> Jadikan Soal
                        </button>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 dark:border-border-dark">
              <button
                onClick={() => {
                  setShowSimulatorImportModal(false);
                  navigate('/plc-simulator');
                }}
                className="text-xs text-primary font-medium hover:underline"
              >
                + Buka Simulator untuk Buat Rangkaian Baru
              </button>
              <button
                onClick={() => setShowSimulatorImportModal(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-medium hover:bg-muted/30 dark:border-border-dark"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionRow({q,diffColor,onEdit,onDuplicate,onArchive,onDelete}:{q:Question;diffColor:Record<Difficulty,string>;onEdit:()=>void;onDuplicate:()=>void;onArchive:()=>void;onDelete:()=>void}){
  return <div className="flex items-start justify-between gap-3 border-b border-border p-4 last:border-b-0 dark:border-border-dark">
    <div className="min-w-0 flex-1 cursor-pointer" onClick={onEdit}><div className="mb-1 flex flex-wrap items-center gap-2"><Badge variant="outline">{QUESTION_TYPE_LABELS[q.type]}</Badge><Badge variant={diffColor[q.difficulty] as any}>{DIFFICULTY_LABELS[q.difficulty]}</Badge><span className="text-xs text-muted-foreground">{q.points} pts</span></div><p className="text-sm font-medium">{q.question}</p></div>
    <ActionMenu
      trigger={({ onClick, open }) => (
        <button onClick={onClick} className={cn('flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors', open ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/40 dark:border-border-dark')} style={{ minHeight: 36 }}>
          Kelola <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
        </button>
      )}
      items={[
        { icon: Eye, label: 'Preview', onClick: onEdit },
        { icon: Copy, label: 'Duplicate', onClick: onDuplicate },
        { icon: q.archived ? RotateCcw : Archive, label: q.archived ? 'Restore' : 'Archive', onClick: onArchive },
        { icon: Trash2, label: 'Delete', danger: true, onClick: onDelete },
      ]}
    />
  </div>
}
