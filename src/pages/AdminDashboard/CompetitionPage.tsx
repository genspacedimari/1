import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Award, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import * as admin from '@/features/genspace-admin/services';
import type { Competition, ProfileSearchResult, AdminQuizQuestion } from '@/features/genspace-admin/types';

export default function CompetitionPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Competition[]>([]);
  const [selected, setSelected] = useState<Competition | null>(null);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<ProfileSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const blankQuestion = (): AdminQuizQuestion => ({ id: crypto.randomUUID(), type: 'multiple_choice', question: '', difficulty: 'easy', points: 10, explanation: '', options: [0,1,2,3].map(() => ({ label: '', isCorrect: false })), imageUrls: [] });
  const [form, setForm] = useState({ name: '', description: '', accessCode: 'GSC26', status: 'draft' as Competition['status'], startAt: '', endAt: '', maxParticipants: '', badgePrefix: 'GSC26', durationMinutes: 30, quizData: [blankQuestion()] });
  const [error, setError] = useState<string | null>(null);

  const load = async () => { setLoading(true); try { setItems(await admin.listCompetitions()); } catch (e) { setError(e instanceof Error ? e.message : 'Gagal memuat kompetisi.'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(() => { admin.searchProfiles(search).then(setUsers).catch(() => setUsers([])); }, 250); return () => clearTimeout(t); }, [search]);

  const save = async () => {
    if (!form.name.trim() || !form.accessCode.trim() || !form.badgePrefix.trim()) { setError('Nama, kode masuk, dan badge prefix wajib diisi.'); return; }
    setSaving(true); setError(null);
    try { await admin.saveCompetition({ id: selected?.id, ...form, startAt: form.startAt || null, endAt: form.endAt || null, maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : null, durationMinutes: form.durationMinutes, quizData: form.quizData }); setSelected(null); setForm({ name: '', description: '', accessCode: 'GSC26', status: 'draft', startAt: '', endAt: '', maxParticipants: '', badgePrefix: 'GSC26', durationMinutes: 30, quizData: [blankQuestion()] }); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Gagal menyimpan.'); } finally { setSaving(false); }
  };

  const edit = (c: Competition) => { setSelected(c); setForm({ name: c.name, description: c.description ?? '', accessCode: c.accessCode, status: c.status, startAt: c.startAt ? c.startAt.slice(0, 16) : '', endAt: c.endAt ? c.endAt.slice(0, 16) : '', maxParticipants: c.maxParticipants?.toString() ?? '', badgePrefix: c.badgePrefix, durationMinutes: c.durationMinutes, quizData: c.quizData?.length ? c.quizData : [blankQuestion()] }); };

  const award = async (user: ProfileSearchResult, placement: '1st' | '2nd' | '3rd') => {
    if (!selected) return;
    const code = `${selected.badgePrefix}-${placement.toUpperCase()}`;
    try { await admin.awardCompetitionBadge({ competitionId: selected.id, userId: user.id, placement, badgeCode: code, badgeName: `${placement.toUpperCase()} ${selected.badgePrefix}` }); alert(`Badge ${placement.toUpperCase()} ${selected.badgePrefix} diberikan ke ${user.fullName}.`); } catch (e) { setError(e instanceof Error ? e.message : 'Gagal memberi badge.'); }
  };

  return <div className="mx-auto max-w-4xl space-y-5">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><button onClick={() => navigate('/admin')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40"><ArrowLeft size={20} /></button><div><h1 className="font-display text-xl font-semibold">🏅 GENSPACE Competition</h1><p className="text-xs text-muted-foreground">Kompetisi resmi GENSPACE Team</p></div></div><Button onClick={() => { setSelected(null); setForm({ name: '', description: '', accessCode: 'GSC26', status: 'draft', startAt: '', endAt: '', maxParticipants: '', badgePrefix: 'GSC26', durationMinutes: 30, quizData: [blankQuestion()] }); }}><Plus size={16} /> Buat Kompetisi</Button></div>
    {error && <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</div>}

    <Card><CardContent className="space-y-4 p-5">
      <div className="grid gap-3 md:grid-cols-2"><Field label="Nama kompetisi"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" placeholder="GSC26 — PLC Master Challenge" /></Field><Field label="Kode masuk CUSTOM"><input value={form.accessCode} onChange={e => setForm({ ...form, accessCode: e.target.value.toUpperCase() })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" /></Field><Field label="Badge prefix"><input value={form.badgePrefix} onChange={e => setForm({ ...form, badgePrefix: e.target.value.toUpperCase() })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" placeholder="GSC26" /></Field><Field label="Status"><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Competition['status'] })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"><option value="draft">Draft</option><option value="published">Published</option><option value="live">Live</option><option value="finished">Finished</option></select></Field><Field label="Mulai"><input type="datetime-local" value={form.startAt} onChange={e => setForm({ ...form, startAt: e.target.value })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" /></Field><Field label="Selesai"><input type="datetime-local" value={form.endAt} onChange={e => setForm({ ...form, endAt: e.target.value })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" /></Field><Field label="Durasi (menit)"><input type="number" min={1} value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: Number(e.target.value) })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" /></Field><Field label="Max peserta"><input type="number" min={1} value={form.maxParticipants} onChange={e => setForm({ ...form, maxParticipants: e.target.value })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" /></Field></div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div><p className="text-sm font-semibold">Soal Kompetisi</p><p className="text-xs text-muted-foreground">Setiap competition punya exam/soal sendiri.</p></div>
          <Button size="sm" variant="outline" onClick={() => setForm({ ...form, quizData: [...form.quizData, blankQuestion()] })}><Plus size={15} /> Tambah Soal</Button>
        </div>
        {form.quizData.map((q, qi) => (
          <div key={q.id} className="rounded-2xl border border-border p-4 dark:border-border-dark">
            <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold text-primary">SOAL {qi + 1}</span><button onClick={() => setForm({ ...form, quizData: form.quizData.filter((_, i) => i !== qi) })} className="text-muted-foreground hover:text-red-500"><Trash2 size={16} /></button></div>
            <textarea value={q.question} onChange={e => { const quizData=[...form.quizData]; quizData[qi]={...q,question:e.target.value}; setForm({...form,quizData}); }} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark min-h-20" placeholder="Tulis soal kompetisi..." />
            <div className="mt-3 grid gap-2 md:grid-cols-2">{q.options.map((o,oi) => <div key={oi} className="flex items-center gap-2"><button type="button" onClick={() => { const quizData=[...form.quizData]; quizData[qi]={...q,options:q.options.map((x,i)=>({...x,isCorrect:i===oi}))}; setForm({...form,quizData}); }} className={`h-8 w-8 rounded-lg border text-xs font-bold ${o.isCorrect?'border-primary bg-primary/10 text-primary':'border-border text-muted-foreground dark:border-border-dark'}`}>{String.fromCharCode(65+oi)}</button><input value={o.label} onChange={e => { const quizData=[...form.quizData]; quizData[qi]={...q,options:q.options.map((x,i)=>i===oi?{...x,label:e.target.value}:x)}; setForm({...form,quizData}); }} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" placeholder={`Pilihan ${String.fromCharCode(65+oi)}`} /></div>)}</div>
          </div>
        ))}
      </div>
      <Field label="Deskripsi"><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark min-h-24" /></Field><div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Kompetisi'}</Button></div>
    </CardContent></Card>

    <Card><CardContent className="p-0">{loading ? <div className="p-8 text-center text-sm text-muted-foreground">Memuat...</div> : items.map(c => <div key={c.id} className={`flex items-center gap-3 border-b border-border p-4 last:border-b-0 dark:border-border-dark ${selected?.id === c.id ? 'bg-primary/5' : ''}`}><div className="min-w-0 flex-1"><p className="font-medium">{c.name}</p><p className="mt-1 text-xs text-muted-foreground">Kode: <b>{c.accessCode}</b> · Badge: <b>{c.badgePrefix}</b> · {c.status}</p></div><button onClick={() => edit(c)} className="rounded-xl px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10">Kelola</button><button onClick={async () => { if (confirm('Hapus kompetisi ini?')) { await admin.deleteCompetition(c.id); load(); } }} className="rounded-xl p-2 text-muted-foreground hover:text-red-500"><Trash2 size={16} /></button></div>)}</CardContent></Card>

    {selected && <Card><CardContent className="space-y-4 p-5"><div><p className="text-sm font-semibold">Badge juara — {selected.name}</p><p className="mt-1 text-xs text-muted-foreground">Cari user lalu berikan badge resmi 1st / 2nd / 3rd.</p></div><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark pl-9" placeholder="Cari nama, username, atau email..." /></div><div className="space-y-2">{users.map(u => <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-border p-3 dark:border-border-dark"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{u.fullName}</p><p className="text-xs text-muted-foreground">@{u.username} · {u.email}</p></div><div className="flex gap-2"><button onClick={() => award(u, '1st')} className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">🥇 1ST {selected.badgePrefix}</button><button onClick={() => award(u, '2nd')} className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">🥈 2ND</button><button onClick={() => award(u, '3rd')} className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">🥉 3RD</button></div></div>)}</div><div className="rounded-2xl bg-muted/30 p-3 text-xs text-muted-foreground dark:bg-white/5"><Award size={14} className="mb-1" />Badge otomatis menggunakan format <b>1ST {selected.badgePrefix}</b>, <b>2ND {selected.badgePrefix}</b>, <b>3RD {selected.badgePrefix}</b>.</div></CardContent></Card>}
  </div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-medium text-muted-foreground">{label}<div className="mt-1.5">{children}</div></label>; }
