import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Pencil, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import * as admin from '@/features/genspace-admin/services';
import type { AdminQuiz, AdminQuizQuestion } from '@/features/genspace-admin/types';

const EMPTY_Q = (): AdminQuizQuestion => ({
  id: crypto.randomUUID(),
  type: 'multiple_choice',
  question: '',
  difficulty: 'easy',
  points: 10,
  explanation: '',
  options: [0, 1, 2, 3].map(() => ({ label: '', isCorrect: false })),
  imageUrls: [],
});

export default function QuizContentPage({ kind }: { kind: 'practice' | 'official' }) {
  const navigate = useNavigate();
  const isPractice = kind === 'practice';
  const [items, setItems] = useState<AdminQuiz[]>([]);
  const [editing, setEditing] = useState<AdminQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(isPractice ? await admin.listPracticeQuizzes() : await admin.listOfficialQuizzes());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [kind]);

  const blank: AdminQuiz = useMemo(() => ({
    id: '',
    title: '',
    description: '',
    difficulty: 'easy',
    category: 'PLC Basic',
    questionCount: 0,
    estimatedMinutes: 10,
    xpReward: 50,
    quizData: [EMPTY_Q()],
    isPublished: false,
    createdAt: '',
  }), []);

  const startNew = () => setEditing({ ...blank, quizData: [EMPTY_Q()] });

  const updateQuestion = (index: number, patch: Partial<AdminQuizQuestion>) => {
    if (!editing) return;
    const questions = [...editing.quizData];
    questions[index] = { ...questions[index], ...patch };
    setEditing({ ...editing, quizData: questions });
  };

  const updateOption = (qi: number, oi: number, label: string) => {
    if (!editing) return;
    const questions = [...editing.quizData];
    const options = questions[qi].options.map((o, i) => ({ ...o, isCorrect: i === oi ? true : o.isCorrect && i !== oi, label: i === oi ? label : o.label }));
    questions[qi] = { ...questions[qi], options };
    setEditing({ ...editing, quizData: questions });
  };

  const chooseCorrect = (qi: number, oi: number) => {
    if (!editing) return;
    const questions = [...editing.quizData];
    questions[qi] = { ...questions[qi], options: questions[qi].options.map((o, i) => ({ ...o, isCorrect: i === oi })) };
    setEditing({ ...editing, quizData: questions });
  };

  const save = async () => {
    if (!editing?.title.trim() || editing.quizData.some((q) => !q.question.trim() || q.options.some((o) => !o.label.trim()) || !q.options.some((o) => o.isCorrect))) {
      setError('Judul dan semua soal harus lengkap, serta setiap soal wajib punya 1 jawaban benar.');
      return;
    }
    setSaving(true); setError(null);
    try {
      const input = {
        id: editing.id || undefined,
        title: editing.title,
        description: editing.description ?? '',
        difficulty: editing.difficulty,
        category: editing.category,
        estimatedMinutes: editing.estimatedMinutes,
        xpReward: editing.xpReward,
        quizData: editing.quizData,
        isPublished: editing.isPublished,
      };
      await (isPractice ? admin.savePracticeQuiz(input) : admin.saveOfficialQuiz(input));
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Hapus konten ini?')) return;
    try {
      await (isPractice ? admin.deletePracticeQuiz(id) : admin.deleteOfficialQuiz(id));
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal menghapus.'); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="font-display text-xl font-semibold">{isPractice ? '🎯 Mode Latihan' : '🏆 GENSPACE Official Quiz'}</h1>
            <p className="text-xs text-muted-foreground">{isPractice ? 'Konten latihan resmi GENSPACE' : 'Quiz resmi dari GENSPACE Team'}</p>
          </div>
        </div>
        {!editing && <Button onClick={startNew}><Plus size={16} /> Buat Baru</Button>}
      </div>

      {error && <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

      {editing ? (
        <Card><CardContent className="space-y-5 p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Judul"><input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" placeholder="Contoh: PLC Basic Mastery" /></Field>
            <Field label="Kategori"><input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" /></Field>
            <Field label="Deskripsi"><input value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" /></Field>
            <Field label="Difficulty"><select value={editing.difficulty} onChange={(e) => setEditing({ ...editing, difficulty: e.target.value as AdminQuiz['difficulty'] })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></Field>
            <Field label="Estimasi menit"><input type="number" value={editing.estimatedMinutes} onChange={(e) => setEditing({ ...editing, estimatedMinutes: Number(e.target.value) })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" min={1} /></Field>
            <Field label="XP Reward"><input type="number" value={editing.xpReward} onChange={(e) => setEditing({ ...editing, xpReward: Number(e.target.value) })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" min={0} /></Field>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Questions</h2><Button size="sm" variant="outline" onClick={() => setEditing({ ...editing, quizData: [...editing.quizData, EMPTY_Q()] })}><Plus size={15} /> Tambah Soal</Button></div>
            {editing.quizData.map((q, qi) => (
              <div key={q.id} className="rounded-2xl border border-border p-4 dark:border-border-dark">
                <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold text-primary">SOAL {qi + 1}</span><button onClick={() => setEditing({ ...editing, quizData: editing.quizData.filter((_, i) => i !== qi) })} className="text-muted-foreground hover:text-red-500"><Trash2 size={16} /></button></div>
                <textarea value={q.question} onChange={(e) => updateQuestion(qi, { question: e.target.value })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark min-h-24" placeholder="Tulis pertanyaan..." />
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {q.options.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2"><button type="button" onClick={() => chooseCorrect(qi, oi)} className={`h-8 w-8 rounded-lg border text-xs font-bold ${o.isCorrect ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground dark:border-border-dark'}`}>{String.fromCharCode(65 + oi)}</button><input value={o.label} onChange={(e) => updateOption(qi, oi, e.target.value)} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" placeholder={`Pilihan ${String.fromCharCode(65 + oi)}`} /></div>
                  ))}
                </div>
                <input value={q.explanation ?? ''} onChange={(e) => updateQuestion(qi, { explanation: e.target.value })} className="field mt-3" placeholder="Penjelasan jawaban (opsional)" />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.isPublished} onChange={(e) => setEditing({ ...editing, isPublished: e.target.checked })} /> Publish sekarang</label><div className="flex gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Batal</Button><Button onClick={save} disabled={saving}><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}</Button></div></div>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          {loading ? <div className="p-8 text-center text-sm text-muted-foreground">Memuat...</div> : items.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Belum ada konten. Klik “Buat Baru”.</div> : items.map((item) => <div key={item.id} className="flex items-center gap-4 border-b border-border p-4 last:border-b-0 dark:border-border-dark"><div className="min-w-0 flex-1"><p className="font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.category} · {item.questionCount} soal · {item.difficulty}</p></div><span className={`flex items-center gap-1 text-xs ${item.isPublished ? 'text-emerald-600' : 'text-muted-foreground'}`}>{item.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}{item.isPublished ? 'Published' : 'Draft'}</span><button onClick={() => setEditing(item)} className="rounded-xl p-2 text-muted-foreground hover:bg-muted/40 hover:text-primary"><Pencil size={16} /></button><button onClick={() => remove(item.id)} className="rounded-xl p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"><Trash2 size={16} /></button></div>)}
        </CardContent></Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-medium text-muted-foreground">{label}<div className="mt-1.5">{children}</div></label>; }
