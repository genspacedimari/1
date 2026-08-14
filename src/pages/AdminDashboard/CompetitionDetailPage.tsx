import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Award, Search, Upload, X, CircleCheck as CheckCircle2, Folder, ChevronDown, ChevronRight, Trophy, Medal, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import * as admin from '@/features/genspace-admin/services';
import type { Competition, ProfileSearchResult, AdminQuizQuestion, BankQuestion, CompetitionParticipant } from '@/features/genspace-admin/types';

const blankQuestion = (): AdminQuizQuestion => ({ id: crypto.randomUUID(), type: 'multiple_choice', question: '', difficulty: 'easy', points: 10, explanation: '', options: [0, 1, 2, 3].map(() => ({ label: '', isCorrect: false })), imageUrls: [] });
const blankForm = () => ({ name: '', description: '', accessCode: 'GSC26', status: 'draft' as Competition['status'], startAt: '', endAt: '', maxParticipants: '', badgePrefix: 'GSC26', durationMinutes: 30, quizData: [blankQuestion()] });

export default function CompetitionDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id;

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [form, setForm] = useState(blankForm());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showImport, setShowImport] = useState(false);
  const [bank, setBank] = useState<BankQuestion[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankSearch, setBankSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedSetIds, setExpandedSetIds] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<ProfileSearchResult[]>([]);
  const [participants, setParticipants] = useState<CompetitionParticipant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState<string | null>(null);
  const [autoAssigning, setAutoAssigning] = useState(false);

  useEffect(() => {
    if (isNew) { setCompetition(null); setForm(blankForm()); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    admin.getCompetition(id).then((c) => {
      if (cancelled) return;
      if (!c) { setError('Kompetisi tidak ditemukan.'); return; }
      setCompetition(c);
      setForm({ name: c.name, description: c.description ?? '', accessCode: c.accessCode, status: c.status, startAt: toLocalDatetimeInput(c.startAt), endAt: toLocalDatetimeInput(c.endAt), maxParticipants: c.maxParticipants?.toString() ?? '', badgePrefix: c.badgePrefix, durationMinutes: c.durationMinutes, quizData: c.quizData?.length ? c.quizData : [blankQuestion()] });
    }).catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Gagal memuat kompetisi.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, isNew]);

  useEffect(() => { const t = setTimeout(() => { admin.searchProfiles(search).then(setUsers).catch(() => setUsers([])); }, 250); return () => clearTimeout(t); }, [search]);

  const loadParticipants = async (competitionId: string) => {
    setParticipantsLoading(true); setParticipantsError(null);
    try { setParticipants(await admin.fetchCompetitionParticipants(competitionId)); } catch (e) { setParticipantsError(e instanceof Error ? e.message : 'Gagal memuat peserta.'); } finally { setParticipantsLoading(false); }
  };
  useEffect(() => { if (competition) loadParticipants(competition.id); else setParticipants([]); }, [competition]);

  const save = async () => {
    if (!form.name.trim() || !form.accessCode.trim() || !form.badgePrefix.trim()) { setError('Nama, kode masuk, dan badge prefix wajib diisi.'); return; }
    setSaving(true); setError(null);
    try {
      await admin.saveCompetition({ id: competition?.id, ...form, startAt: form.startAt || null, endAt: form.endAt || null, maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : null, durationMinutes: form.durationMinutes, quizData: form.quizData });
      navigate('/admin/competition');
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal menyimpan.'); } finally { setSaving(false); }
  };

  const handleAutoAssign = async () => {
    if (!competition) return;
    if (participants.length === 0) { setError('Belum ada peserta yang submit — belum bisa kasih badge otomatis.'); return; }
    if (!confirm(`Kasih badge 1st/2nd/3rd otomatis ke 3 peserta teratas berdasarkan skor & waktu tercepat?`)) return;
    setAutoAssigning(true); setError(null);
    try {
      const top3 = await admin.autoAssignCompetitionBadges(competition.id, competition.badgePrefix);
      await loadParticipants(competition.id);
      alert(`Badge diberikan ke: ${top3.map((p, i) => `#${i + 1} ${p.fullName}`).join(', ')}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal memberi badge otomatis.'); } finally { setAutoAssigning(false); }
  };

  const award = async (user: ProfileSearchResult, placement: '1st' | '2nd' | '3rd') => {
    if (!competition) return;
    const code = `${competition.badgePrefix}-${placement.toUpperCase()}`;
    try { await admin.awardCompetitionBadge({ competitionId: competition.id, userId: user.id, placement, badgeCode: code, badgeName: `${placement.toUpperCase()} ${competition.badgePrefix}` }); alert(`Badge ${placement.toUpperCase()} ${competition.badgePrefix} diberikan ke ${user.fullName}.`); } catch (e) { setError(e instanceof Error ? e.message : 'Gagal memberi badge.'); }
  };

  const openImport = async () => {
    setShowImport(true);
    setSelectedIds(new Set());
    setExpandedSetIds(new Set());
    setBankSearch('');
    if (bank.length === 0) {
      setBankLoading(true); setBankError(null);
      try { setBank(await admin.fetchImportableQuestions()); } catch (e) { setBankError(e instanceof Error ? e.message : 'Gagal memuat bank soal.'); } finally { setBankLoading(false); }
    }
  };

  const toggleSelect = (qid: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(qid)) next.delete(qid); else next.add(qid); return next; });
  };

  const toggleExpand = (setId: string) => {
    setExpandedSetIds((prev) => { const next = new Set(prev); if (next.has(setId)) next.delete(setId); else next.add(setId); return next; });
  };

  const toggleFolder = (ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((qid) => next.has(qid));
      ids.forEach((qid) => { if (allSelected) next.delete(qid); else next.add(qid); });
      return next;
    });
  };

  const confirmImport = () => {
    if (selectedIds.size === 0) { setShowImport(false); return; }
    const picked = bank
      .filter((q) => selectedIds.has(q.id))
      .map(({ questionSetId: _s, questionSetName: _n, ...q }): AdminQuizQuestion => q);
    const stillBlank = form.quizData.length === 1 && !form.quizData[0].question.trim();
    const base = stillBlank ? [] : form.quizData;
    setForm({ ...form, quizData: [...base, ...picked] });
    setShowImport(false);
  };

  const filteredBank = bank.filter((q) => q.question.toLowerCase().includes(bankSearch.toLowerCase()));

  const { folders, standalone } = useMemo(() => {
    const folderMap = new Map<string, { name: string; questions: BankQuestion[] }>();
    const loose: BankQuestion[] = [];
    for (const q of filteredBank) {
      if (q.questionSetId) {
        if (!folderMap.has(q.questionSetId)) folderMap.set(q.questionSetId, { name: q.questionSetName ?? 'Tanpa nama', questions: [] });
        folderMap.get(q.questionSetId)!.questions.push(q);
      } else {
        loose.push(q);
      }
    }
    return { folders: Array.from(folderMap.entries()).map(([fid, v]) => ({ id: fid, ...v })), standalone: loose };
  }, [filteredBank]);

  if (loading) return <div className="mx-auto max-w-4xl p-8 text-center text-sm text-muted-foreground">Memuat...</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/competition')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-display text-xl font-semibold">{isNew ? 'Buat Kompetisi' : competition?.name}</h1>
          <p className="text-xs text-muted-foreground">{isNew ? 'Kompetisi resmi GENSPACE Team' : `Kode: ${competition?.accessCode} · Badge: ${competition?.badgePrefix}`}</p>
        </div>
      </div>
      {error && <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</div>}

      <Card><CardContent className="space-y-4 p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nama kompetisi"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" placeholder="GSC26 — PLC Master Challenge" /></Field>
          <Field label="Kode masuk CUSTOM"><input value={form.accessCode} onChange={e => setForm({ ...form, accessCode: e.target.value.toUpperCase() })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" /></Field>
          <Field label="Badge prefix"><input value={form.badgePrefix} onChange={e => setForm({ ...form, badgePrefix: e.target.value.toUpperCase() })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" placeholder="GSC26" /></Field>
          <Field label="Status"><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Competition['status'] })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"><option value="draft">Draft</option><option value="published">Published</option><option value="live">Live</option><option value="finished">Finished</option></select></Field>
          <Field label="Mulai"><input type="datetime-local" value={form.startAt} onChange={e => setForm({ ...form, startAt: e.target.value })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" /></Field>
          <Field label="Selesai"><input type="datetime-local" value={form.endAt} onChange={e => setForm({ ...form, endAt: e.target.value })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" /></Field>
          <Field label="Durasi (menit)"><input type="number" min={1} value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: Number(e.target.value) })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" /></Field>
          <Field label="Max peserta"><input type="number" min={1} value={form.maxParticipants} onChange={e => setForm({ ...form, maxParticipants: e.target.value })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" /></Field>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-semibold">Soal Kompetisi</p><p className="text-xs text-muted-foreground">Setiap competition punya exam/soal sendiri.</p></div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={openImport}><Upload size={15} /> Import dari Bank Soal</Button>
              <Button size="sm" variant="outline" onClick={() => setForm({ ...form, quizData: [...form.quizData, blankQuestion()] })}><Plus size={15} /> Tambah Soal</Button>
            </div>
          </div>
          {form.quizData.map((q, qi) => (
            <div key={q.id} className="rounded-2xl border border-border p-4 dark:border-border-dark">
              <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold text-primary">SOAL {qi + 1}</span><button onClick={() => setForm({ ...form, quizData: form.quizData.filter((_, i) => i !== qi) })} className="text-muted-foreground hover:text-red-500"><Trash2 size={16} /></button></div>
              <textarea value={q.question} onChange={e => { const quizData = [...form.quizData]; quizData[qi] = { ...q, question: e.target.value }; setForm({ ...form, quizData }); }} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark min-h-20" placeholder="Tulis soal kompetisi..." />
              <div className="mt-3 grid gap-2 md:grid-cols-2">{q.options.map((o, oi) => <div key={oi} className="flex items-center gap-2"><button type="button" onClick={() => { const quizData = [...form.quizData]; quizData[qi] = { ...q, options: q.options.map((x, i) => ({ ...x, isCorrect: i === oi })) }; setForm({ ...form, quizData }); }} className={`h-8 w-8 rounded-lg border text-xs font-bold ${o.isCorrect ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground dark:border-border-dark'}`}>{String.fromCharCode(65 + oi)}</button><input value={o.label} onChange={e => { const quizData = [...form.quizData]; quizData[qi] = { ...q, options: q.options.map((x, i) => i === oi ? { ...x, label: e.target.value } : x) }; setForm({ ...form, quizData }); }} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" placeholder={`Pilihan ${String.fromCharCode(65 + oi)}`} /></div>)}</div>
            </div>
          ))}
        </div>
        <Field label="Deskripsi"><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark min-h-24" /></Field>
        <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Kompetisi'}</Button></div>
      </CardContent></Card>

      {competition && <Card><CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold"><Trophy size={15} className="text-primary" /> Peserta & Leaderboard</p>
            <p className="mt-1 text-xs text-muted-foreground">Diurutkan dari skor tertinggi, lalu waktu tercepat.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => loadParticipants(competition.id)} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40" title="Muat ulang"><RefreshCw size={16} /></button>
            <Button size="sm" onClick={handleAutoAssign} disabled={autoAssigning || participants.length === 0}>
              <Medal size={15} /> {autoAssigning ? 'Memproses...' : 'Beri Badge Top 3 Otomatis'}
            </Button>
          </div>
        </div>

        {participantsLoading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Memuat peserta...</p>
        ) : participantsError ? (
          <p className="p-6 text-center text-sm text-red-500">{participantsError}</p>
        ) : participants.length === 0 ? (
          <p className="rounded-2xl bg-muted/30 p-6 text-center text-sm text-muted-foreground dark:bg-white/5">Belum ada yang ikut kompetisi ini. Bagikan kode <b>{competition.accessCode}</b> ke peserta — mereka bisa join lewat menu Quiz &gt; GENSPACE Competition di aplikasi.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border dark:border-border-dark">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-b border-border p-3 last:border-b-0 dark:border-border-dark">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${p.rank === 1 ? 'bg-amber-400/20 text-amber-600' : p.rank === 2 ? 'bg-slate-300/30 text-slate-500' : p.rank === 3 ? 'bg-orange-400/20 text-orange-600' : 'bg-muted/40 text-muted-foreground dark:bg-white/5'}`}>{p.rank}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.fullName || 'Tanpa nama'}</p>
                  <p className="text-xs text-muted-foreground">@{p.username || '-'} · {p.correctCount} benar · {Math.floor(p.timeUsedSeconds / 60)}m {p.timeUsedSeconds % 60}s</p>
                </div>
                <span className="text-sm font-semibold text-primary">{p.score}</span>
                {p.badgePlacement && <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{p.badgePlacement.toUpperCase()}</span>}
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>}

      {competition && <Card><CardContent className="space-y-4 p-5">
        <div><p className="text-sm font-semibold">Beri badge manual (opsional)</p><p className="mt-1 text-xs text-muted-foreground">Kalau perlu override di luar leaderboard di atas — cari user lalu berikan badge resmi 1st / 2nd / 3rd.</p></div>
        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark pl-9" placeholder="Cari nama, username, atau email..." /></div>
        <div className="space-y-2">{users.map(u => <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-border p-3 dark:border-border-dark"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{u.fullName}</p><p className="text-xs text-muted-foreground">@{u.username} · {u.email}</p></div><div className="flex gap-2"><button onClick={() => award(u, '1st')} className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">🥇 1ST {competition.badgePrefix}</button><button onClick={() => award(u, '2nd')} className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">🥈 2ND</button><button onClick={() => award(u, '3rd')} className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">🥉 3RD</button></div></div>)}</div>
        <div className="rounded-2xl bg-muted/30 p-3 text-xs text-muted-foreground dark:bg-white/5"><Award size={14} className="mb-1" />Badge otomatis menggunakan format <b>1ST {competition.badgePrefix}</b>, <b>2ND {competition.badgePrefix}</b>, <b>3RD {competition.badgePrefix}</b>.</div>
      </CardContent></Card>}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowImport(false)}>
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl bg-surface shadow-xl dark:bg-surface-dark" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border p-5 dark:border-border-dark">
              <div>
                <h2 className="font-display text-base font-semibold">Import dari Bank Soal</h2>
                <p className="text-xs text-muted-foreground">Pilih 1 folder soal (misalnya hasil import Excel) atau soal individu — tidak perlu satu-satu.</p>
              </div>
              <button onClick={() => setShowImport(false)} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5"><X size={18} /></button>
            </div>

            <div className="border-b border-border p-4 dark:border-border-dark">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  placeholder="Cari soal..."
                  className="w-full rounded-2xl border border-border bg-surface py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {bankLoading ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Memuat bank soal...</p>
              ) : bankError ? (
                <p className="p-6 text-center text-sm text-red-500">{bankError}</p>
              ) : filteredBank.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  {bank.length === 0 ? 'Belum ada soal di bank soal guru manapun.' : 'Tidak ada soal yang cocok.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {folders.map((f) => {
                    const ids = f.questions.map((q) => q.id);
                    const selectedCount = ids.filter((qid) => selectedIds.has(qid)).length;
                    const allSelected = selectedCount === ids.length;
                    const partial = selectedCount > 0 && !allSelected;
                    const expanded = expandedSetIds.has(f.id);
                    return (
                      <div key={f.id} className={`rounded-2xl border transition-colors ${allSelected ? 'border-primary bg-primary/5' : partial ? 'border-primary/40' : 'border-border dark:border-border-dark'}`}>
                        <div className="flex w-full items-start gap-3 p-3 text-left">
                          <button type="button" onClick={() => toggleFolder(ids)} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${allSelected ? 'border-primary bg-primary text-primary-foreground' : partial ? 'border-primary bg-primary/20' : 'border-border dark:border-border-dark'}`}>
                            {allSelected && <CheckCircle2 size={14} />}
                            {partial && <div className="h-2 w-2 rounded-sm bg-primary" />}
                          </button>
                          <button type="button" onClick={() => toggleFolder(ids)} className="min-w-0 flex-1 text-left">
                            <p className="flex items-center gap-1.5 text-sm font-medium"><Folder size={14} className="shrink-0 text-primary" /> {f.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{f.questions.length} soal · folder hasil import{selectedCount > 0 ? ` · ${selectedCount} dipilih` : ''}</p>
                          </button>
                          <button type="button" onClick={() => toggleExpand(f.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/40">
                            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </div>
                        {expanded && (
                          <div className="space-y-1.5 border-t border-border p-3 pt-2 dark:border-border-dark">
                            {f.questions.map((q) => {
                              const isSelected = selectedIds.has(q.id);
                              return (
                                <button
                                  key={q.id}
                                  type="button"
                                  onClick={() => toggleSelect(q.id)}
                                  className={`flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30 dark:border-border-dark'}`}
                                >
                                  <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border dark:border-border-dark'}`}>
                                    {isSelected && <CheckCircle2 size={11} />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="line-clamp-2 text-xs font-medium">{q.question}</p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">{q.options.length} pilihan · {q.difficulty} · {q.points} poin</p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {standalone.map((q) => {
                    const isSelected = selectedIds.has(q.id);
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => toggleSelect(q.id)}
                        className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30 dark:border-border-dark'}`}
                      >
                        <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border dark:border-border-dark'}`}>
                          {isSelected && <CheckCircle2 size={14} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium">{q.question}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{q.options.length} pilihan · {q.difficulty} · {q.points} poin · soal individu</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border p-4 dark:border-border-dark">
              <span className="text-xs text-muted-foreground">{selectedIds.size} soal dipilih</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowImport(false)}>Batal</Button>
                <Button onClick={confirmImport} disabled={selectedIds.size === 0}>Import {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-medium text-muted-foreground">{label}<div className="mt-1.5">{children}</div></label>; }

// Postgres returns start_at/end_at as UTC ISO strings (e.g. "2026-08-14T15:47:00+00:00").
// <input type="datetime-local"> needs "YYYY-MM-DDTHH:mm" in the BROWSER'S local time —
// `new Date(iso)` already converts to local time internally, we just need to read its
// local getters (not toISOString, which would give UTC again) and zero-pad them.
function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
