import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Play, Trash2, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LadderEditorScreen } from '@/features/plc-simulator/components/LadderEditorScreen';
import { createMasterProgram, fetchMasterPrograms, updateMasterProgram } from './services';
import type { MasterProgram, LadderChallengeDraft } from './types';
import type { LadderProject } from '@/simulator/types/ladder';
import { createTestCase } from './types';
import type { LadderChallengeType, LadderTestCase } from '@/features/quiz/types';
import { gradeLadderProgram } from '@/features/quiz/ladderGrading';

interface Props {
  value: LadderChallengeDraft;
  onChange: (value: LadderChallengeDraft) => void;
  disabled?: boolean;
}

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
  const [editorTab, setEditorTab] = useState<'base' | 'answer'>('base');
  const [editorOpen, setEditorOpen] = useState(true);
  const [programName, setProgramName] = useState('');
  const [programDescription, setProgramDescription] = useState('');
  const [savingProgram, setSavingProgram] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ passed: number; total: number; percent: number } | null>(null);

  const activeJson = editorTab === 'base'
    ? (value.masterProgramId ? value.baseProgramJson : value.starterProgramJson)
    : value.answerProgramJson;
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

  const handleChallengeType = (next: LadderChallengeType) => {
    const base = value.baseProgramJson;
    let starter = value.starterProgramJson;
    if (next === 'build') starter = null;
    if (next === 'modify' || next === 'debug') starter = base;
    onChange({ ...value, challengeType: next, starterProgramJson: starter });
  };

  const handleSelectProgram = (id: string) => {
    const program = programs.find((item) => item.id === id);
    if (!program) {
      onChange({ ...value, masterProgramId: null, baseProgramJson: null, starterProgramJson: value.challengeType === 'build' ? null : value.starterProgramJson });
      return;
    }
    setProgramName(program.name);
    setProgramDescription(program.description);
    onChange({
      ...value,
      masterProgramId: program.id,
      baseProgramJson: program.ladderJson,
      starterProgramJson: value.challengeType === 'build' ? null : program.ladderJson,
    });
  };

  const saveAsMasterProgram = async () => {
    const json = value.baseProgramJson;
    if (!json || !programName.trim()) {
      alert('Nama Master Program dan program ladder wajib diisi.');
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
        onChange({ ...value, masterProgramId: created.id, starterProgramJson: value.challengeType === 'build' ? null : json });
      }
      await loadPrograms();
    } finally {
      setSavingProgram(false);
    }
  };

  const saveEditor = (json: string) => {
    if (editorTab === 'base') {
      onChange({
        ...value,
        baseProgramJson: json,
        starterProgramJson: value.challengeType === 'build' ? null : json,
      });
      return;
    }
    onChange({ ...value, answerProgramJson: json });
  };

  const runTestAnswer = async () => {
    if (!value.answerProgramJson) {
      setTestResult(null);
      alert('Buat dan simpan Answer Program secara visual terlebih dahulu.');
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
            <p className="text-xs text-muted-foreground">Guru membuat program langsung di editor, tanpa paste Ladder JSON.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { loadPrograms(); }} disabled={disabled}>
              <RefreshCw size={14} /> Refresh Program
            </Button>
          </div>
        </div>

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
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Master Program</label>
            <select
              value={value.masterProgramId ?? ''}
              onChange={(e) => handleSelectProgram(e.target.value)}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none dark:border-border-dark dark:bg-surface-dark"
              disabled={disabled}
            >
              <option value="">Buat Master Program baru</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/10 p-4 dark:border-border-dark">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button variant={editorTab === 'base' ? 'default' : 'outline'} size="sm" onClick={() => { setEditorTab('base'); setEditorOpen(true); }}>
                {value.masterProgramId ? 'Master / Base Program' : 'Program Awal'}
              </Button>
              <Button variant={editorTab === 'answer' ? 'default' : 'outline'} size="sm" onClick={() => { setEditorTab('answer'); setEditorOpen(true); }}>
                Answer Program
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditorOpen((v) => !v)}>{editorOpen ? 'Tutup Editor' : 'Buka Editor'}</Button>
          </div>

          {editorTab === 'base' && (
            <div className="mb-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input value={programName} onChange={(e) => setProgramName(e.target.value)} placeholder="Nama Master Program" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark" />
              <input value={programDescription} onChange={(e) => setProgramDescription(e.target.value)} placeholder="Deskripsi program" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark" />
              <Button onClick={saveAsMasterProgram} disabled={savingProgram || !value.baseProgramJson}>
                <Save size={14} /> {savingProgram ? 'Menyimpan...' : 'Simpan Master'}
              </Button>
            </div>
          )}

          {editorOpen && (
            <div className="overflow-hidden rounded-2xl border border-border dark:border-border-dark">
              <LadderEditorScreen
                key={`${editorTab}:${value.masterProgramId ?? 'new'}:${activeJson?.slice(0, 24) ?? 'empty'}`}
                initialProject={activeProject}
                onSaveLadder={saveEditor}
                saveLabel={editorTab === 'base' ? 'Simpan Program' : 'Simpan Answer'}
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
              <p className="text-xs text-muted-foreground">Jalankan Answer Program terhadap seluruh test case sebelum publish.</p>
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
