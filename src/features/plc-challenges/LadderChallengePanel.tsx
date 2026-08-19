import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Save, Play, Trash2, RefreshCw, Download, X, FolderOpen, CheckCircle2, PencilLine, Copy, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LadderEditorScreen } from '@/features/plc-simulator/components/LadderEditorScreen';
import { createMasterProgram, fetchMasterPrograms, updateMasterProgram } from './services';
import type { MasterProgram, LadderChallengeDraft } from './types';
import type { LadderProject } from '@/simulator/types/ladder';
import { importFromGridJson } from '@/simulator/editor/importFromGridJson';
import { createTestCase } from './types';
import type { LadderChallengeType, LadderTestCase } from '@/features/quiz/types';
import { gradeLadderProgram } from '@/features/quiz/ladderGrading';
import { useProjectStore } from '@/features/plc-simulator/projectStore';
import type { PlcProject } from '@/features/plc-simulator/projectTypes';

interface Props {
  value: LadderChallengeDraft;
  onChange: (value: LadderChallengeDraft) => void;
  disabled?: boolean;
}

const CHALLENGE_TYPE_LABEL: Record<LadderChallengeType, string> = {
  modify: 'Modifikasi Program',
  build: 'Buat Program dari Instruksi',
  debug: 'Debug / Perbaiki Program',
};

function parseProject(json: string | null): LadderProject | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as LadderProject;
    return parsed && Array.isArray(parsed.rungs) && parsed.meta ? parsed : null;
  } catch {
    return null;
  }
}

function StepHeader({ step, title, done, subtitle }: { step: number; title: string; done?: boolean; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary'
        }`}
      >
        {done ? <CheckCircle2 size={16} /> : step}
      </span>
      <div>
        <h3 className="text-sm font-semibold leading-none">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

export function LadderChallengePanel({ value, onChange, disabled = false }: Props) {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<MasterProgram[]>([]);
  const [programName, setProgramName] = useState('');
  const [programDescription, setProgramDescription] = useState('');
  const [savingProgram, setSavingProgram] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ passed: number; total: number; percent: number } | null>(null);
  const [canvasView, setCanvasView] = useState<'answer' | 'soal' | 'hidden'>('answer');
  const [showMasterPicker, setShowMasterPicker] = useState(false);

  // Which Simulator project the answer was imported from — for display only,
  // not persisted (a page reload loses the label, not the ladder itself).
  const [importedFromLabel, setImportedFromLabel] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importSearch, setImportSearch] = useState('');

  const simulatorProjects = useProjectStore((s) => s.projects);
  const simulatorLoading = useProjectStore((s) => s.loading);
  const loadSimulatorProjects = useProjectStore((s) => s.loadProjects);

  const hasAnswer = !!value.answerProgramJson;
  const linkedMasterProgram = useMemo(
    () => programs.find((p) => p.id === value.masterProgramId) ?? null,
    [programs, value.masterProgramId],
  );

  const loadPrograms = async () => {
    try {
      setPrograms(await fetchMasterPrograms());
    } catch (err) {
      console.error('[PLC_CHALLENGE] load programs failed', err);
    }
  };

  useEffect(() => { loadPrograms(); }, []);

  useEffect(() => {
    if (!value.testCases.length) onChange({ ...value, testCases: [createTestCase()] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (importDialogOpen) loadSimulatorProjects();
  }, [importDialogOpen, loadSimulatorProjects]);

  // Import a ladder (from a Simulator project, or from an existing Master
  // Program) as the correct answer. A clone becomes the editable starter —
  // the teacher then edits that copy (change addresses, delete components)
  // to turn it into the actual question, without touching the answer.
  //
  // The real Simulator (where projects are built) saves ladders in its own
  // row/link grid format — a different shape from the graph format this
  // Challenge editor and the grading engine speak. importFromGridJson
  // converts it; if the JSON is already graph format (e.g. re-importing a
  // Master Program saved from this panel), the conversion is skipped.
  const applyImportedLadder = (rawJson: string, label: string) => {
    let json = rawJson;
    const converted = importFromGridJson(rawJson, label);
    if (converted) {
      json = JSON.stringify(converted.project);
      if (converted.warnings.length) {
        alert(`Program berhasil diimpor, tapi ada bagian yang tidak sepenuhnya didukung:\n\n${converted.warnings.join('\n')}`);
      }
    }
    onChange({
      ...value,
      baseProgramJson: json,
      answerProgramJson: json,
      starterProgramJson: value.challengeType === 'build' ? null : json,
    });
    setImportedFromLabel(label);
    // Show the imported program's canvas right away — the teacher should
    // see it land as the Jawaban Benar before touching anything.
    setCanvasView('answer');
  };

  const handleImportFromSimulator = (project: PlcProject) => {
    applyImportedLadder(project.ladderJson, project.name);
    onChange({ ...value, masterProgramId: null });
    setProgramName(project.name);
    setProgramDescription(project.description);
    setImportDialogOpen(false);
  };

  const filteredSimulatorProjects = useMemo(() => {
    const q = importSearch.trim().toLowerCase();
    if (!q) return simulatorProjects;
    return simulatorProjects.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }, [simulatorProjects, importSearch]);

  const handleChallengeType = (next: LadderChallengeType) => {
    let starter = value.starterProgramJson;
    if (next === 'build') {
      starter = null;
    } else if (!starter && (value.answerProgramJson || value.baseProgramJson)) {
      // Switching into modify/debug with no starter yet — seed it from the
      // answer so there is something to edit into a question.
      starter = value.answerProgramJson ?? value.baseProgramJson;
    }
    onChange({ ...value, challengeType: next, starterProgramJson: starter });
  };

  const handleSelectProgram = (id: string) => {
    const program = programs.find((item) => item.id === id);
    if (!program) return;
    onChange({ ...value, masterProgramId: program.id });
    applyImportedLadder(program.ladderJson, program.name);
    setProgramName(program.name);
    setProgramDescription(program.description);
    setShowMasterPicker(false);
  };

  const saveAsMasterProgram = async () => {
    const json = value.answerProgramJson ?? value.baseProgramJson;
    if (!json || !programName.trim()) {
      alert('Nama Master Program dan Jawaban Benar wajib diisi (import atau buat dulu di Step 1).');
      return;
    }
    setSavingProgram(true);
    try {
      if (value.masterProgramId) {
        await updateMasterProgram(value.masterProgramId, {
          name: programName.trim(),
          description: programDescription.trim(),
          ladderJson: json,
        });
      } else {
        const created = await createMasterProgram({
          name: programName.trim(),
          description: programDescription.trim(),
          ladderJson: json,
        });
        onChange({ ...value, masterProgramId: created.id });
      }
      await loadPrograms();
    } finally {
      setSavingProgram(false);
    }
  };

  // Lets a teacher reuse one saved Master Program across several
  // questions: leaves this soal untouched, jumps to a brand-new
  // Question Editor pre-linked to the same program so the answer
  // is ready instantly — only "Edit jadi Soal" is left to do.
  const startNewQuestionFromProgram = () => {
    if (!value.masterProgramId) return;
    navigate(`/teacher/questions/new?type=ladder&masterProgramId=${value.masterProgramId}`);
  };

  const runTestAnswer = async () => {
    if (!value.answerProgramJson) {
      setTestResult(null);
      alert('Import atau buat Jawaban Benar terlebih dahulu.');
      return;
    }
    setTesting(true);
    try {
      const result = await gradeLadderProgram(value.answerProgramJson, value.testCases);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  const updateTestCase = (index: number, patch: Partial<LadderTestCase>) => {
    const next = value.testCases.map((tc, i) => i === index ? { ...tc, ...patch } : tc);
    onChange({ ...value, testCases: next });
  };

  const updateMap = (index: number, key: 'inputs' | 'expectedOutputs', address: string, checked: boolean) => {
    const tc = value.testCases[index];
    updateTestCase(index, { [key]: { ...tc[key], [address.toUpperCase().trim()]: checked } } as Partial<LadderTestCase>);
  };

  return (
    <Card>
      <CardContent className="space-y-6 p-5">
        <div>
          <h2 className="font-display text-base font-semibold">Visual Ladder Challenge</h2>
          <p className="text-xs text-muted-foreground">
            Import program dari Simulator → otomatis jadi Jawaban Benar → edit salinannya jadi Soal → beri judul → simpan.
          </p>
        </div>

        {/* STEP 1 — Sumber program */}
        <div className="space-y-3">
          <StepHeader step={1} title="Import Program dari Simulator" done={hasAnswer} subtitle="Import dari Simulator, atau pakai ulang Master Program yang sudah pernah disimpan." />

          {!hasAnswer && (
            <div className="ml-10 flex flex-wrap gap-2">
              <Button onClick={() => setImportDialogOpen(true)} disabled={disabled}>
                <Download size={14} /> Import dari Simulator
              </Button>
              <Button variant="outline" onClick={() => { setShowMasterPicker((v) => !v); loadPrograms(); }} disabled={disabled}>
                <FolderOpen size={14} /> Pakai Master Program Tersimpan
              </Button>
            </div>
          )}

          {showMasterPicker && (
            <div className="ml-10 rounded-2xl border border-border p-3 dark:border-border-dark">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Pilih Master Program</p>
                <button onClick={() => { loadPrograms(); }} className="text-muted-foreground hover:text-foreground" title="Refresh"><RefreshCw size={13} /></button>
              </div>
              {programs.length === 0 && <p className="text-xs text-muted-foreground">Belum ada Master Program tersimpan.</p>}
              <div className="flex flex-wrap gap-2">
                {programs.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProgram(p.id)}
                    className={`rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors ${
                      value.masterProgramId === p.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary dark:border-border-dark'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasAnswer && (
            <div className="ml-10 space-y-2">
              <div className="rounded-2xl bg-primary/5 px-4 py-3 text-xs dark:bg-primary/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    <span className="font-semibold text-primary">
                      {linkedMasterProgram ? linkedMasterProgram.name : importedFromLabel ?? 'Program'}
                    </span>{' '}
                    berhasil diimpor dan otomatis jadi <span className="font-semibold">Jawaban Benar</span> — bisa dilihat di kanvas di bawah.
                    {linkedMasterProgram && <> Terhubung ke Master Program — 1 program ini bisa dipakai untuk beberapa soal.</>}
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => setImportDialogOpen(true)} disabled={disabled}>
                      <Download size={13} /> Ganti Program
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowMasterPicker((v) => !v); loadPrograms(); }} disabled={disabled}>
                      <FolderOpen size={13} /> Master Lain
                    </Button>
                  </div>
                </div>
              </div>

              {/* Canvas showing the imported program as the Jawaban Benar — visible
                  right away so the teacher can confirm what came in before editing.
                  Only one ladder canvas is ever mounted at a time (this one, or the
                  "Edit Jadi Soal" one in Step 2) since the editor uses shared state
                  internally — mounting both together would make them clash. */}
              <div>
                <button
                  onClick={() => setCanvasView((v) => (v === 'answer' ? 'hidden' : 'answer'))}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown size={13} className={`transition-transform ${canvasView === 'answer' ? 'rotate-180' : ''}`} />
                  {canvasView === 'answer' ? 'Sembunyikan Kanvas Jawaban Benar' : 'Tampilkan Kanvas Jawaban Benar'}
                </button>
                {canvasView === 'answer' && (
                  <div className="mt-2 overflow-hidden rounded-2xl border border-border dark:border-border-dark" style={{ minHeight: 480 }}>
                    <LadderEditorScreen
                      key={`answer:${value.answerProgramJson?.slice(0, 24) ?? 'empty'}`}
                      initialProject={parseProject(value.answerProgramJson)}
                      onSaveLadder={(json) => onChange({ ...value, answerProgramJson: json, baseProgramJson: json })}
                      saveLabel="Simpan Jawaban Benar"
                    />
                  </div>
                )}
              </div>

              <Button size="sm" onClick={() => { setCanvasView('soal'); document.getElementById('ladder-step-2')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                Lanjut: Edit Jadi Soal <ChevronDown size={13} className="-rotate-90" />
              </Button>
            </div>
          )}
        </div>

        {/* STEP 2 — Jenis soal & edit jadi soal */}
        <div id="ladder-step-2" className="space-y-3 border-t border-border pt-5 dark:border-border-dark">
          <StepHeader
            step={2}
            title="Edit Jadi Soal"
            subtitle='Tentukan tipe soal, lalu ubah salinan program (alamat I/O, kontak, dsb.) — Jawaban Benar di Step 1 tidak ikut berubah.'
          />

          <div className="ml-10 max-w-sm">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tipe Challenge</label>
            <select
              value={value.challengeType}
              onChange={(e) => handleChallengeType(e.target.value as LadderChallengeType)}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none dark:border-border-dark dark:bg-surface-dark"
              disabled={disabled}
            >
              {(Object.entries(CHALLENGE_TYPE_LABEL) as [LadderChallengeType, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {value.challengeType === 'build' ? (
            <p className="ml-10 text-xs text-muted-foreground">Tipe "Buat Program dari Instruksi" tidak punya Program Awal — murid mulai dari kanvas kosong di Simulator. Jelaskan instruksinya lewat Judul Soal di bawah.</p>
          ) : !hasAnswer ? (
            <p className="ml-10 text-xs text-muted-foreground">Selesaikan Step 1 (ambil program) dulu sebelum mengedit soal.</p>
          ) : canvasView !== 'soal' ? (
            <div className="ml-10">
              <Button size="sm" variant="outline" onClick={() => setCanvasView('soal')}>
                <PencilLine size={13} /> Buka Kanvas Edit Soal
              </Button>
            </div>
          ) : (
            <div className="ml-10 overflow-hidden rounded-2xl border border-border dark:border-border-dark" style={{ minHeight: 480 }}>
              <LadderEditorScreen
                key={`starter:${value.starterProgramJson?.slice(0, 24) ?? 'empty'}`}
                initialProject={parseProject(value.starterProgramJson)}
                onSaveLadder={(json) => onChange({ ...value, starterProgramJson: json })}
                saveLabel="Simpan Soal"
              />
            </div>
          )}
        </div>

        {/* STEP 3 — Test cases */}
        <div className="space-y-3 border-t border-border pt-5 dark:border-border-dark">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StepHeader step={3} title="Test Case Penilaian" subtitle="Penilaian berdasarkan behavior input → output, bukan bentuk ladder." />
            <Button size="sm" variant="outline" onClick={() => onChange({ ...value, testCases: [...value.testCases, createTestCase(value.testCases.length + 1)] })}>
              <Plus size={14} /> Test Case
            </Button>
          </div>

          <div className="ml-10 space-y-3">
            {value.testCases.map((tc, index) => (
              <div key={tc.id} className="rounded-2xl border border-border p-4 dark:border-border-dark">
                <div className="grid gap-3 md:grid-cols-[1fr_120px_100px_auto]">
                  <input value={tc.name} onChange={(e) => updateTestCase(index, { name: e.target.value })} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark" />
                  <input type="number" min={0} step={100} value={tc.durationMs} onChange={(e) => updateTestCase(index, { durationMs: Number(e.target.value) || 0 })} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark" placeholder="Durasi ms" />
                  <input type="number" min={0.1} step={0.1} value={tc.weight} onChange={(e) => updateTestCase(index, { weight: Number(e.target.value) || 1 })} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark" placeholder="Bobot" />
                  <button onClick={() => onChange({ ...value, testCases: value.testCases.filter((_, i) => i !== index) })} className="flex h-10 w-10 items-center justify-center rounded-xl text-red-500 hover:bg-red-500/10" title="Hapus test case"><Trash2 size={16} /></button>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <MapEditor title="Input" valueMap={tc.inputs} onToggle={(a, b) => updateMap(index, 'inputs', a, b)} />
                  <MapEditor title="Expected Output" valueMap={tc.expectedOutputs} onToggle={(a, b) => updateMap(index, 'expectedOutputs', a, b)} />
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <WordMapEditor title="Memory Expected" placeholder="M1" values={tc.expectedMemory ?? {}} onChange={(map) => updateTestCase(index, { expectedMemory: map })} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input placeholder="Timer address (TIM1)" className="rounded-xl border border-border bg-surface px-3 py-2 text-xs dark:border-border-dark dark:bg-surface-dark" onKeyDown={(e) => { if (e.key === 'Enter') { const address = e.currentTarget.value.toUpperCase().trim(); if (address) { updateTestCase(index, { expectedTimers: { ...(tc.expectedTimers ?? {}), [address]: { done: true } } }); e.currentTarget.value = ''; } } }} />
                    <input placeholder="Counter address (CTU1)" className="rounded-xl border border-border bg-surface px-3 py-2 text-xs dark:border-border-dark dark:bg-surface-dark" onKeyDown={(e) => { if (e.key === 'Enter') { const address = e.currentTarget.value.toUpperCase().trim(); if (address) { updateTestCase(index, { expectedCounters: { ...(tc.expectedCounters ?? {}), [address]: { done: true } } }); e.currentTarget.value = ''; } } }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="ml-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary/5 p-4 dark:bg-primary/10">
            <div>
              <p className="text-sm font-semibold">Test Answer</p>
              <p className="text-xs text-muted-foreground">Jalankan Jawaban Benar terhadap seluruh test case sebelum publish.</p>
            </div>
            <div className="flex items-center gap-3">
              {testResult && <span className="text-sm font-semibold">{testResult.passed}/{testResult.total} passed · {testResult.percent}%</span>}
              <Button onClick={runTestAnswer} disabled={testing || !value.answerProgramJson || value.testCases.length === 0}>
                <Play size={14} /> {testing ? 'Testing...' : 'Test Answer'}
              </Button>
            </div>
          </div>
        </div>

        {/* STEP 4 — Simpan sebagai Master Program (dipakai ulang untuk soal lain) */}
        <div className="space-y-3 border-t border-border pt-5 dark:border-border-dark">
          <StepHeader
            step={4}
            title="Simpan sebagai Master Program"
            done={!!value.masterProgramId}
            subtitle="Opsional — simpan Jawaban Benar sebagai Master Program supaya bisa dipakai lagi untuk soal lain (misalnya versi soal yang lebih sulit dari program yang sama)."
          />
          <div className="ml-10 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input value={programName} onChange={(e) => setProgramName(e.target.value)} placeholder="Nama Master Program" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark" disabled={disabled} />
            <input value={programDescription} onChange={(e) => setProgramDescription(e.target.value)} placeholder="Deskripsi program" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark" disabled={disabled} />
            <Button onClick={saveAsMasterProgram} disabled={disabled || savingProgram || !value.answerProgramJson}>
              <Save size={14} /> {savingProgram ? 'Menyimpan...' : value.masterProgramId ? 'Update Master' : 'Simpan sebagai Master'}
            </Button>
          </div>
          {value.masterProgramId && (
            <div className="ml-10">
              <Button variant="outline" size="sm" onClick={startNewQuestionFromProgram}>
                <Copy size={13} /> Buat Soal Lain dari Program Ini
              </Button>
              <p className="mt-1 text-[11px] text-muted-foreground">Membuka soal baru yang sudah terhubung ke Master Program yang sama — tinggal ulangi Step 2 (Edit Jadi Soal) dan beri Judul Soal baru.</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-muted/10 px-4 py-3 text-xs text-muted-foreground dark:bg-white/5">
          <PencilLine size={13} className="mr-1 inline align-text-bottom" />
          Langkah terakhir: isi <span className="font-semibold text-foreground">Judul Soal</span> dan detail lain di bawah, lalu tekan <span className="font-semibold text-foreground">Save</span>.
        </div>
      </CardContent>

      {importDialogOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4" onClick={() => setImportDialogOpen(false)}>
          <div
            className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-surface p-5 dark:bg-surface-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Import Program dari Simulator</h3>
              <button onClick={() => setImportDialogOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/30"><X size={16} /></button>
            </div>
            <input
              value={importSearch}
              onChange={(e) => setImportSearch(e.target.value)}
              placeholder="Cari nama project..."
              className="mb-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark"
            />
            <div className="flex-1 space-y-2 overflow-y-auto">
              {simulatorLoading && <p className="py-6 text-center text-xs text-muted-foreground">Memuat project...</p>}
              {!simulatorLoading && filteredSimulatorProjects.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <FolderOpen size={28} className="text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">Belum ada program tersimpan di Simulator perangkat ini.</p>
                  <Link to="/simulator" className="text-xs font-semibold text-primary hover:underline">Buka Simulator untuk membuat program</Link>
                </div>
              )}
              {filteredSimulatorProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleImportFromSimulator(project)}
                  className="flex w-full flex-col items-start gap-1 rounded-2xl border border-border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5 dark:border-border-dark"
                >
                  <span className="text-sm font-semibold">{project.name}</span>
                  {project.description && <span className="text-xs text-muted-foreground">{project.description}</span>}
                  <span className="text-[11px] text-muted-foreground">Diubah {new Date(project.updatedAt).toLocaleString('id-ID')}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function MapEditor({ title, valueMap, onToggle }: { title: string; valueMap: Record<string, boolean>; onToggle: (address: string, value: boolean) => void }) {
  const [newAddress, setNewAddress] = useState('');
  const entries = Object.entries(valueMap);
  return (
    <div className="rounded-xl border border-border p-3 dark:border-border-dark">
      <div className="mb-2 text-xs font-semibold">{title}</div>
      <div className="flex flex-wrap gap-2">
        {entries.map(([address, checked]) => (
          <button key={address} onClick={() => onToggle(address, !checked)} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${checked ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground dark:border-border-dark'}`}>
            {address} = {checked ? 'ON' : 'OFF'}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="I2" className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-xs dark:border-border-dark dark:bg-surface-dark" />
        <Button size="sm" variant="outline" onClick={() => { const a = newAddress.toUpperCase().trim(); if (!a || valueMap[a] !== undefined) return; onToggle(a, false); setNewAddress(''); }}>Add</Button>
      </div>
    </div>
  );
}

function WordMapEditor({ title, values, onChange, placeholder }: { title: string; values: Record<string, boolean>; onChange: (next: Record<string, boolean>) => void; placeholder: string }) {
  const [address, setAddress] = useState('');
  const entries = Object.entries(values);
  return (
    <div className="rounded-xl border border-border p-3 dark:border-border-dark">
      <div className="mb-2 text-xs font-semibold">{title}</div>
      {entries.length > 0 && <div className="flex flex-wrap gap-2">{entries.map(([a, v]) => <button key={a} onClick={() => onChange({ ...values, [a]: !v })} className="rounded-xl border border-border px-3 py-2 text-xs dark:border-border-dark">{a} = {v ? 'ON' : 'OFF'}</button>)}</div>}
      <div className="mt-2 flex gap-2"><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-xs dark:border-border-dark dark:bg-surface-dark" /><Button size="sm" variant="outline" onClick={() => { const a = address.toUpperCase().trim(); if (!a || values[a] !== undefined) return; onChange({ ...values, [a]: false }); setAddress(''); }}>Add</Button></div>
    </div>
  );
}
