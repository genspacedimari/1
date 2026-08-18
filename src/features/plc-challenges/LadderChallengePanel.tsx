import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Save, Play, Trash2, RefreshCw, Download, X, FolderOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LadderEditorScreen } from '@/features/plc-simulator/components/LadderEditorScreen';
import { createMasterProgram, fetchMasterPrograms, updateMasterProgram } from './services';
import type { MasterProgram, LadderChallengeDraft } from './types';
import type { LadderProject } from '@/simulator/types/ladder';
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

type EditorTab = 'starter' | 'answer';

function parseProject(json: string | null): LadderProject | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as LadderProject;
    return parsed && Array.isArray(parsed.rungs) && parsed.meta ? parsed : null;
  } catch {
    return null;
  }
}

export function LadderChallengePanel({ value, onChange, disabled = false }: Props) {
  const [programs, setPrograms] = useState<MasterProgram[]>([]);
  const [editorTab, setEditorTab] = useState<EditorTab>('starter');
  const [editorOpen, setEditorOpen] = useState(true);
  const [programName, setProgramName] = useState('');
  const [programDescription, setProgramDescription] = useState('');
  const [savingProgram, setSavingProgram] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ passed: number; total: number; percent: number } | null>(null);

  // Which Simulator project the answer was imported from — for display only,
  // not persisted (a page reload loses the label, not the ladder itself).
  const [importedFromLabel, setImportedFromLabel] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importSearch, setImportSearch] = useState('');

  const simulatorProjects = useProjectStore((s) => s.projects);
  const simulatorLoading = useProjectStore((s) => s.loading);
  const loadSimulatorProjects = useProjectStore((s) => s.loadProjects);

  const activeJson = editorTab === 'starter' ? value.starterProgramJson : value.answerProgramJson;
  const activeProject = useMemo(() => parseProject(activeJson), [activeJson]);

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
  const applyImportedLadder = (json: string, label: string) => {
    onChange({
      ...value,
      baseProgramJson: json,
      answerProgramJson: json,
      starterProgramJson: value.challengeType === 'build' ? null : json,
    });
    setImportedFromLabel(label);
    setEditorTab(value.challengeType === 'build' ? 'answer' : 'starter');
    setEditorOpen(true);
  };

  const handleImportFromSimulator = (project: PlcProject) => {
    applyImportedLadder(project.ladderJson, project.name);
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
    if (!program) {
      onChange({ ...value, masterProgramId: null });
      return;
    }
    onChange({ ...value, masterProgramId: program.id });
    applyImportedLadder(program.ladderJson, program.name);
  };

  const saveAsMasterProgram = async () => {
    const json = value.answerProgramJson ?? value.baseProgramJson;
    if (!json || !programName.trim()) {
      alert('Nama Master Program dan Jawaban Benar wajib diisi (import atau buat dulu di tab Jawaban Benar).');
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

  const saveEditor = (json: string) => {
    if (editorTab === 'starter') {
      onChange({ ...value, starterProgramJson: json });
      return;
    }
    onChange({ ...value, answerProgramJson: json, baseProgramJson: json });
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
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold">Visual Ladder Challenge</h2>
            <p className="text-xs text-muted-foreground">Import program dari Simulator sebagai jawaban benar, lalu edit salinannya jadi soal.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)} disabled={disabled}>
              <Download size={14} /> Import dari Simulator
            </Button>
            <Button variant="outline" size="sm" onClick={() => { loadPrograms(); }} disabled={disabled}>
              <RefreshCw size={14} /> Refresh
            </Button>
          </div>
        </div>

        {importedFromLabel && (
          <div className="rounded-2xl bg-primary/5 px-4 py-2.5 text-xs dark:bg-primary/10">
            <span className="font-semibold text-primary">Diimpor dari Simulator:</span> {importedFromLabel} — konten ini otomatis jadi <span className="font-semibold">Jawaban Benar</span>. Edit tab "Program Awal (Soal)" untuk mengubah alamat / menghapus komponen sebagai soal.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tipe Challenge</label>
            <select
              value={value.challengeType}
              onChange={(e) => handleChallengeType(e.target.value as LadderChallengeType)}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none dark:border-border-dark dark:bg-surface-dark"
              disabled={disabled}
            >
              <option value="modify">Modifikasi Program</option>
              <option value="build">Buat Program dari Instruksi</option>
              <option value="debug">Debug / Perbaiki Program</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Master Program (opsional, untuk dipakai ulang)</label>
            <select
              value={value.masterProgramId ?? ''}
              onChange={(e) => handleSelectProgram(e.target.value)}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none dark:border-border-dark dark:bg-surface-dark"
              disabled={disabled}
            >
              <option value="">Tidak terhubung ke Master Program</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/10 p-4 dark:border-border-dark">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button variant={editorTab === 'starter' ? 'default' : 'outline'} size="sm" onClick={() => { setEditorTab('starter'); setEditorOpen(true); }}>
                Program Awal (Soal)
              </Button>
              <Button variant={editorTab === 'answer' ? 'default' : 'outline'} size="sm" onClick={() => { setEditorTab('answer'); setEditorOpen(true); }}>
                Jawaban Benar
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditorOpen((v) => !v)}>{editorOpen ? 'Tutup Editor' : 'Buka Editor'}</Button>
          </div>

          {editorTab === 'starter' && value.challengeType === 'build' && (
            <p className="mb-3 text-xs text-muted-foreground">Tipe "Buat Program dari Instruksi" tidak punya Program Awal — murid mulai dari kanvas kosong di Simulator.</p>
          )}

          {editorTab === 'answer' && (
            <div className="mb-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input value={programName} onChange={(e) => setProgramName(e.target.value)} placeholder="Nama Master Program" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark" />
              <input value={programDescription} onChange={(e) => setProgramDescription(e.target.value)} placeholder="Deskripsi program" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark" />
              <Button onClick={saveAsMasterProgram} disabled={savingProgram || !value.answerProgramJson}>
                <Save size={14} /> {savingProgram ? 'Menyimpan...' : 'Simpan sebagai Master'}
              </Button>
            </div>
          )}

          {editorOpen && !(editorTab === 'starter' && value.challengeType === 'build') && (
            <div className="overflow-hidden rounded-2xl border border-border dark:border-border-dark">
              <LadderEditorScreen
                key={`${editorTab}:${activeJson?.slice(0, 24) ?? 'empty'}`}
                initialProject={activeProject}
                onSaveLadder={saveEditor}
                saveLabel={editorTab === 'starter' ? 'Simpan Soal' : 'Simpan Jawaban'}
              />
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Test Cases</h3>
              <p className="text-xs text-muted-foreground">Penilaian berdasarkan behavior input → output, bukan bentuk ladder.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => onChange({ ...value, testCases: [...value.testCases, createTestCase(value.testCases.length + 1)] })}>
              <Plus size={14} /> Test Case
            </Button>
          </div>

          <div className="space-y-3">
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary/5 p-4 dark:bg-primary/10">
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
