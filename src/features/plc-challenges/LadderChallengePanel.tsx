import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Play,
  Trash2,
  RefreshCw,
  Download,
  X,
  FolderOpen,

  Lock,
  Pencil,
  Eye,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ArrowLeft,
  CheckCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LadderEditorScreen } from '@/features/plc-simulator/components/LadderEditorScreen';
import { LadderStudentAnswerPanel } from './LadderStudentAnswerPanel';
import { createMasterProgram, fetchMasterPrograms, updateMasterProgram } from './services';
import type { MasterProgram, LadderChallengeDraft } from './types';
import type { LadderProject } from '@/simulator/types/ladder';
import { importFromGridJson } from '@/simulator/editor/importFromGridJson';
import { createTestCase } from './types';
import type { LadderTestCase } from '@/features/quiz/types';
import {
  gradeLadderProgram,
  autoGenerateTestCasesFromAnswer,
  gradeStructuralLadder,
} from '@/features/quiz/ladderGrading';
import { useProjectStore } from '@/features/plc-simulator/projectStore';
import type { PlcProject } from '@/features/plc-simulator/projectTypes';

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
  const [searchParams] = useSearchParams();
  const querySimulatorId = searchParams.get('importSimulatorId');
  const openImportParam = searchParams.get('openImport');

  const [programs, setPrograms] = useState<MasterProgram[]>([]);
  const [programName, setProgramName] = useState('');
  const [programDescription, setProgramDescription] = useState('');
  const [savingProgram, setSavingProgram] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ passed: number; total: number; percent: number } | null>(null);
  const [showMasterPicker, setShowMasterPicker] = useState(false);

  // Active view mode: 'answer' (Mode Program Asli) or 'question' (Mode Edit Soal)
  const [activeMode, setActiveMode] = useState<'answer' | 'question'>(
    value.starterProgramJson && value.starterProgramJson !== value.answerProgramJson ? 'question' : 'answer'
  );

  // Preview modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Import Dialog
  const [importedFromLabel, setImportedFromLabel] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importSearch, setImportSearch] = useState('');

  const simulatorProjects = useProjectStore((s) => s.projects);
  const simulatorLoading = useProjectStore((s) => s.loading);
  const loadSimulatorProjects = useProjectStore((s) => s.loadProjects);

  const hasAnswer = !!value.answerProgramJson;
  const linkedMasterProgram = useMemo(
    () => programs.find((p) => p.id === value.masterProgramId) ?? null,
    [programs, value.masterProgramId]
  );

  const loadPrograms = async () => {
    try {
      setPrograms(await fetchMasterPrograms());
    } catch (err) {
      console.error('[PLC_CHALLENGE] load programs failed', err);
    }
  };

  useEffect(() => {
    loadPrograms();
    loadSimulatorProjects();
  }, []);

  // Check URL query parameters for auto-import
  useEffect(() => {
    if (openImportParam === '1' && !hasAnswer) {
      setImportDialogOpen(true);
    }
  }, [openImportParam, hasAnswer]);

  useEffect(() => {
    if (querySimulatorId && !hasAnswer && simulatorProjects.length > 0) {
      const proj = simulatorProjects.find((p) => p.id === querySimulatorId);
      if (proj) {
        handleImportFromSimulator(proj);
      }
    }
  }, [querySimulatorId, hasAnswer, simulatorProjects]);

  useEffect(() => {
    if (importDialogOpen) loadSimulatorProjects();
  }, [importDialogOpen, loadSimulatorProjects]);

  // Builds imported ladder draft from simulator raw JSON
  const buildImportedLadder = (rawJson: string, label: string, projectId?: string): LadderChallengeDraft => {
    let json = rawJson;
    const converted = importFromGridJson(rawJson, label);
    if (converted) {
      json = JSON.stringify(converted.project);
      if (converted.warnings.length) {
        alert(
          `Program berhasil diimpor, tapi ada bagian yang disesuaikan:\n\n${converted.warnings.join('\n')}`
        );
      }
    }
    setImportedFromLabel(label);

    // Auto-derive realistic test cases directly from the imported program
    const autoTests = autoGenerateTestCasesFromAnswer(json);

    return {
      ...value,
      challengeType: 'modify',
      sourceProjectId: projectId ?? null,
      baseProgramJson: json,
      answerProgramJson: json,
      starterProgramJson: json,
      testCases: autoTests.length > 0 ? autoTests : (value.testCases.length > 0 ? value.testCases : [createTestCase()]),
      gradingConfig: {
        checkStructure: true,
        checkLogic: true,
        allowAlternativeLogic: false,
        ...(value.gradingConfig ?? {}),
      },
    };
  };

  const handleImportFromSimulator = (project: PlcProject) => {
    const updated = buildImportedLadder(project.ladderJson, project.name, project.id);
    onChange({ ...updated, masterProgramId: null });
    setProgramName(project.name);
    setProgramDescription(project.description);
    setImportDialogOpen(false);
    setActiveMode('answer'); // Always start at Mode Program Asli as specified in requirements
  };

  const filteredSimulatorProjects = useMemo(() => {
    const q = importSearch.trim().toLowerCase();
    if (!q) return simulatorProjects;
    return simulatorProjects.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }, [simulatorProjects, importSearch]);

  const handleSelectMasterProgram = (id: string) => {
    const program = programs.find((item) => item.id === id);
    if (!program) return;
    onChange({ ...buildImportedLadder(program.ladderJson, program.name), masterProgramId: program.id });
    setProgramName(program.name);
    setProgramDescription(program.description);
    setShowMasterPicker(false);
    setActiveMode('answer');
  };

  // Reverts the question starter program back to exact copy of original answer program
  const handleRevertToOriginal = () => {
    if (!value.answerProgramJson) return;
    if (confirm('Kembalikan program soal persis seperti program asli? Semua perubahan pada soal akan direset.')) {
      onChange({ ...value, starterProgramJson: value.answerProgramJson });
    }
  };

  // Auto-generate test cases from the answer program
  const handleAutoGenerateTestCases = () => {
    if (!value.answerProgramJson) return;
    const generated = autoGenerateTestCasesFromAnswer(value.answerProgramJson);
    if (generated.length === 0) {
      alert('Tidak ditemukan alamat Input (I) atau Output (O) pada program kunci jawaban.');
      return;
    }
    onChange({ ...value, testCases: generated });
    alert(`Berhasil membuat ${generated.length} test case otomatis berdasarkan perilaku program asli!`);
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

  const saveAsMasterProgram = async () => {
    const json = value.answerProgramJson ?? value.baseProgramJson;
    if (!json || !programName.trim()) {
      alert('Nama Master Program dan Jawaban Benar wajib diisi.');
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
      alert('Master Program berhasil disimpan!');
    } finally {
      setSavingProgram(false);
    }
  };

  const updateTestCase = (index: number, patch: Partial<LadderTestCase>) => {
    const next = value.testCases.map((tc, i) => (i === index ? { ...tc, ...patch } : tc));
    onChange({ ...value, testCases: next });
  };

  const updateMap = (index: number, key: 'inputs' | 'expectedOutputs', address: string, checked: boolean) => {
    const tc = value.testCases[index];
    updateTestCase(index, { [key]: { ...tc[key], [address.toUpperCase().trim()]: checked } } as Partial<LadderTestCase>);
  };

  // Analyze differences between answer and starter program (detect placeholders and missing items)
  const differenceAnalysis = useMemo(() => {
    if (!value.answerProgramJson || !value.starterProgramJson) return null;
    const ans = parseProject(value.answerProgramJson);
    const start = parseProject(value.starterProgramJson);
    if (!ans || !start) return null;

    const placeholders: { id: string; label: string; originalLabel: string }[] = [];
    for (const r of start.rungs) {
      for (const el of r.elements) {
        if (el.kind === 'PLACEHOLDER') {
          const orig = (el as any).originalElement;
          const origDesc = orig?.address ? `${orig.kind} ${orig.address.type}${orig.address.number}` : 'Komponen';
          placeholders.push({
            id: el.id,
            label: el.alias || 'Slot Kosong',
            originalLabel: origDesc,
          });
        }
      }
    }

    const structCheck = gradeStructuralLadder(start, ans);
    return {
      placeholders,
      structuralMatch: structCheck.score,
      feedback: structCheck.feedback,
    };
  }, [value.answerProgramJson, value.starterProgramJson]);

  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <Card className="overflow-hidden border border-border shadow-sm dark:border-border-dark">
      <CardContent className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 dark:border-border-dark">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Soal Ladder Logic dari Simulator</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Program simulator otomatis menjadi kunci jawaban. Modifikasi salinan soal untuk membuat tantangan siswa.
            </p>
          </div>
          {hasAnswer && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={activeMode === 'answer' ? 'default' : 'outline'}
                onClick={() => setActiveMode('answer')}
                className="h-9 gap-1.5 text-xs font-semibold"
              >
                <Lock size={13} /> Mode Program Asli (Kunci Jawaban)
              </Button>
              <Button
                size="sm"
                variant={activeMode === 'question' ? 'default' : 'outline'}
                onClick={() => setActiveMode('question')}
                className="h-9 gap-1.5 text-xs font-semibold"
              >
                <Pencil size={13} /> Mode Edit Soal
              </Button>
            </div>
          )}
        </div>

        {/* State: No program imported yet */}
        {!hasAnswer && (
          <div className="space-y-4 rounded-3xl border-2 border-dashed border-border p-8 text-center dark:border-border-dark">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Download size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-base font-semibold">Import Program dari Simulator</h3>
              <p className="mx-auto max-w-md text-xs text-muted-foreground">
                Pilih program Ladder Logic yang sudah Anda uji di Simulator. Rangkaian akan diimpor utuh dan otomatis menjadi kunci jawaban yang aman.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                onClick={() => setImportDialogOpen(true)}
                disabled={disabled}
                className="gap-2 px-6 py-2.5 font-semibold"
              >
                <Download size={16} /> Pilih dari Simulator
              </Button>
              <Button
                variant="outline"
                onClick={() => { setShowMasterPicker((v) => !v); loadPrograms(); }}
                disabled={disabled}
                className="gap-2"
              >
                <FolderOpen size={16} /> Master Program Tersimpan
              </Button>
            </div>

            {showMasterPicker && (
              <div className="mt-4 rounded-2xl border border-border bg-muted/20 p-4 text-left dark:border-border-dark">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold">Pilih Master Program</p>
                  <button onClick={loadPrograms} className="text-muted-foreground hover:text-foreground">
                    <RefreshCw size={13} />
                  </button>
                </div>
                {programs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Belum ada Master Program yang tersimpan.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {programs.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleSelectMasterProgram(p.id)}
                        className="rounded-xl border border-border bg-surface px-3 py-2 text-left text-xs font-medium hover:border-primary dark:border-border-dark dark:bg-surface-dark"
                      >
                        <span className="font-semibold">{p.name}</span>
                        {p.description && <span className="block text-[11px] text-muted-foreground">{p.description}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* State: Program Imported */}
        {hasAnswer && (
          <div className="space-y-5">
            {/* Mode 1: Mode Program Asli (Kunci Jawaban) */}
            {activeMode === 'answer' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
                      <Lock size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">
                          {linkedMasterProgram ? linkedMasterProgram.name : importedFromLabel ?? 'Program Simulator'}
                        </span>
                        <Badge variant="outline" className="border-emerald-600 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                          Kunci Jawaban Asli
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Tampilan persis program simulator. Rangkaian ini terkunci aman sebagai acuan penilaian dan tidak akan berubah saat mengedit soal.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setActiveMode('question')}
                      className="gap-2 bg-primary font-semibold text-primary-foreground shadow-sm"
                    >
                      <Pencil size={15} /> EDIT JADI SOAL
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setImportDialogOpen(true)}
                    >
                      <Download size={14} /> Ganti Program
                    </Button>
                  </div>
                </div>

                {/* Read-Only Ladder Visualization */}
                <div className="overflow-hidden rounded-2xl border border-border shadow-inner dark:border-border-dark" style={{ minHeight: 460 }}>
                  <LadderEditorScreen
                    key={`answer:${value.answerProgramJson?.slice(0, 32)}`}
                    initialProject={parseProject(value.answerProgramJson)}
                    readOnly={true}
                    saveLabel="Kunci Jawaban Terkunci"
                  />
                </div>
              </div>
            )}

            {/* Mode 2: Mode Edit Soal */}
            {activeMode === 'question' && (
              <div className="space-y-4">
                {/* Banner & Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                      <Pencil size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">Mode Edit Soal (Tampilan Siswa)</span>
                        <Badge variant="outline" className="border-amber-600 bg-amber-500/20 text-amber-700 dark:text-amber-300">
                          Bisa Diedit
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Hapus komponen atau klik tombol ✂️ Kosongkan pada komponen untuk menjadikannya slot <span className="font-semibold text-amber-600 dark:text-amber-400">[ KOSONG ]</span> yang harus dilengkapi siswa.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveMode('answer')}
                      className="gap-1.5"
                    >
                      <ArrowLeft size={14} /> Kembali ke Program Asli
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPreviewModal(true)}
                      className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <Eye size={14} /> Pratinjau Soal
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRevertToOriginal}
                      className="gap-1.5 text-muted-foreground hover:text-red-500"
                    >
                      <RotateCcw size={14} /> Batalkan Perubahan
                    </Button>
                  </div>
                </div>

                {/* Placeholders / Missing items breakdown */}
                {differenceAnalysis && differenceAnalysis.placeholders.length > 0 && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 dark:bg-amber-500/10">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                        Bagian Rangkaian yang Dikosongkan (Wajib Dilengkapi Siswa):
                      </p>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {differenceAnalysis.placeholders.length} placeholder aktif
                      </span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {differenceAnalysis.placeholders.map((ph, idx) => (
                        <div
                          key={ph.id}
                          className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm dark:bg-surface-dark"
                        >
                          <span className="text-amber-600 dark:text-amber-400">[ ? ]</span>
                          <span>Slot #{idx + 1}: {ph.originalLabel}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Editable Ladder Screen */}
                <div className="overflow-hidden rounded-2xl border border-border shadow-sm dark:border-border-dark" style={{ minHeight: 480 }}>
                  <LadderEditorScreen
                    key={`starter:${value.starterProgramJson?.slice(0, 32)}`}
                    initialProject={parseProject(value.starterProgramJson)}
                    isTeacherMode={true}
                    readOnly={false}
                    onChangeLadder={(json) => onChange({ ...value, starterProgramJson: json })}
                    onSaveLadder={(json) => onChange({ ...value, starterProgramJson: json })}
                    saveLabel="Simpan Desain Soal"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section: Aturan Penilaian & Test Case (Step 8) */}
        {hasAnswer && (
          <div className="space-y-4 border-t border-border pt-5 dark:border-border-dark">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Aturan Penilaian Jawaban Siswa</h3>
                <p className="text-xs text-muted-foreground">
                  Pemeriksaan struktur rangkaian dan fungsi logika input/output.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoGenerateTestCases}
                className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              >
                <Sparkles size={14} /> Buat Test Case Otomatis dari Program Asli
              </Button>
            </div>

            {/* Assessment Option Toggles */}
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex items-start gap-2.5 rounded-2xl border border-border bg-surface p-3.5 text-xs font-medium cursor-pointer hover:border-primary/50 dark:border-border-dark dark:bg-surface-dark">
                <input
                  type="checkbox"
                  checked={value.gradingConfig?.checkStructure ?? true}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      gradingConfig: { ...value.gradingConfig, checkStructure: e.target.checked },
                    })
                  }
                  className="mt-0.5 rounded"
                />
                <div>
                  <span className="font-semibold block">Pemeriksaan Struktur Rangkaian</span>
                  <span className="text-muted-foreground text-[11px]">
                    Memastikan komponen, NO/NC, alamat, dan cabang sesuai kunci jawaban.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-2xl border border-border bg-surface p-3.5 text-xs font-medium cursor-pointer hover:border-primary/50 dark:border-border-dark dark:bg-surface-dark">
                <input
                  type="checkbox"
                  checked={value.gradingConfig?.checkLogic ?? true}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      gradingConfig: { ...value.gradingConfig, checkLogic: e.target.checked },
                    })
                  }
                  className="mt-0.5 rounded"
                />
                <div>
                  <span className="font-semibold block">Pemeriksaan Fungsi Logika</span>
                  <span className="text-muted-foreground text-[11px]">
                    Menguji respon output berdasarkan variasi kondisi input.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-2xl border border-border bg-surface p-3.5 text-xs font-medium cursor-pointer hover:border-primary/50 dark:border-border-dark dark:bg-surface-dark">
                <input
                  type="checkbox"
                  checked={value.gradingConfig?.allowAlternativeLogic ?? false}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      gradingConfig: { ...value.gradingConfig, allowAlternativeLogic: e.target.checked },
                    })
                  }
                  className="mt-0.5 rounded"
                />
                <div>
                  <span className="font-semibold block">Terima Solusi Alternatif</span>
                  <span className="text-muted-foreground text-[11px]">
                    Jika fungsi logika benar 100%, jawaban tetap diterima walau tata letak berbeda.
                  </span>
                </div>
              </label>
            </div>

            {/* Test Case Verification Runner */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary/5 p-4 dark:bg-primary/10">
              <div>
                <p className="text-xs font-semibold text-primary">Validasi Kunci Jawaban Asli</p>
                <p className="text-xs text-muted-foreground">
                  Uji program kunci jawaban terhadap seluruh skenario ({value.testCases.length} test case) untuk memastikan kunci jawaban 100% valid.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {testResult && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle size={14} className="mr-1 inline" /> {testResult.passed}/{testResult.total} passed ({testResult.percent}%)
                  </span>
                )}
                <Button
                  size="sm"
                  onClick={runTestAnswer}
                  disabled={testing || !value.answerProgramJson || value.testCases.length === 0}
                  className="gap-1.5"
                >
                  <Play size={13} /> {testing ? 'Menguji...' : 'Uji Kunci Jawaban'}
                </Button>
              </div>
            </div>

            {/* Collapsible Test Cases & Master Program Management */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full items-center justify-between py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <span>Lihat Detail Test Cases & Simpan sebagai Master Program</span>
                <ChevronDown size={14} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-4">
                  {/* Test Cases List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold">Daftar Test Cases ({value.testCases.length})</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onChange({ ...value, testCases: [...value.testCases, createTestCase(value.testCases.length + 1)] })}
                      >
                        <Plus size={13} /> Tambah Test Case
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {value.testCases.map((tc, index) => (
                        <div key={tc.id} className="rounded-2xl border border-border bg-surface p-4 text-xs dark:border-border-dark dark:bg-surface-dark">
                          <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
                            <input
                              value={tc.name}
                              onChange={(e) => updateTestCase(index, { name: e.target.value })}
                              className="rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none dark:border-border-dark"
                              placeholder="Nama skenario pengujian"
                            />
                            <input
                              type="number"
                              min={0.1}
                              step={0.1}
                              value={tc.weight}
                              onChange={(e) => updateTestCase(index, { weight: Number(e.target.value) || 1 })}
                              className="rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none dark:border-border-dark"
                              placeholder="Bobot"
                            />
                            <button
                              type="button"
                              onClick={() => onChange({ ...value, testCases: value.testCases.filter((_, i) => i !== index) })}
                              className="flex h-9 w-9 items-center justify-center rounded-xl text-red-500 hover:bg-red-500/10"
                              title="Hapus"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <MapEditor title="Input Terpicu" valueMap={tc.inputs} onToggle={(a, b) => updateMap(index, 'inputs', a, b)} />
                            <MapEditor title="Expected Output" valueMap={tc.expectedOutputs} onToggle={(a, b) => updateMap(index, 'expectedOutputs', a, b)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Master Program Persistence */}
                  <div className="rounded-2xl border border-border p-4 dark:border-border-dark space-y-3">
                    <p className="text-xs font-semibold">Simpan sebagai Master Program</p>
                    <p className="text-xs text-muted-foreground">
                      Simpan program ini agar dapat digunakan kembali untuk membuat variasi soal lain dengan cepat.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                      <input
                        value={programName}
                        onChange={(e) => setProgramName(e.target.value)}
                        placeholder="Nama Master Program"
                        className="rounded-xl border border-border bg-surface px-3 py-2 text-xs dark:border-border-dark dark:bg-surface-dark"
                      />
                      <input
                        value={programDescription}
                        onChange={(e) => setProgramDescription(e.target.value)}
                        placeholder="Deskripsi singkat"
                        className="rounded-xl border border-border bg-surface px-3 py-2 text-xs dark:border-border-dark dark:bg-surface-dark"
                      />
                      <Button onClick={saveAsMasterProgram} disabled={savingProgram || !value.answerProgramJson}>
                        {savingProgram ? 'Menyimpan...' : 'Simpan Master'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Simulator Project Import Modal */}
      {importDialogOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4" onClick={() => setImportDialogOpen(false)}>
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-surface p-6 shadow-2xl dark:bg-surface-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-2 border-b border-border pb-3 dark:border-border-dark">
              <div>
                <h3 className="font-display text-base font-semibold">Import Program dari Simulator</h3>
                <p className="text-xs text-muted-foreground">Pilih program yang akan dijadikan kunci jawaban dan soal</p>
              </div>
              <button
                onClick={() => setImportDialogOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40"
              >
                <X size={18} />
              </button>
            </div>

            <input
              value={importSearch}
              onChange={(e) => setImportSearch(e.target.value)}
              placeholder="Cari nama program simulator..."
              className="mb-4 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            />

            <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
              {simulatorLoading && <p className="py-8 text-center text-xs text-muted-foreground">Memuat program...</p>}
              {!simulatorLoading && filteredSimulatorProjects.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <FolderOpen size={36} className="text-muted-foreground/40" />
                  <p className="text-xs font-medium text-muted-foreground">Belum ada program tersimpan di Simulator.</p>
                  <Link to="/simulator" className="text-xs font-semibold text-primary hover:underline">
                    Buka Simulator untuk membuat program baru
                  </Link>
                </div>
              )}
              {filteredSimulatorProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleImportFromSimulator(project)}
                  className="flex w-full flex-col items-start gap-1 rounded-2xl border border-border p-3.5 text-left transition-all hover:border-primary hover:bg-primary/5 dark:border-border-dark"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{project.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      PLC Simulator
                    </Badge>
                  </div>
                  {project.description && <span className="text-xs text-muted-foreground">{project.description}</span>}
                  <span className="mt-1 text-[11px] text-muted-foreground">
                    Diperbarui {new Date(project.updatedAt).toLocaleString('id-ID')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pratinjau Soal Modal (Student View Preview) */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowPreviewModal(false)}>
          <div
            className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl bg-surface p-6 shadow-2xl dark:bg-surface-dark overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-2 border-b border-border pb-3 dark:border-border-dark">
              <div>
                <h3 className="font-display text-base font-semibold">Pratinjau Soal (Tampilan Siswa)</h3>
                <p className="text-xs text-muted-foreground">Tampilan interaktif seperti yang akan dilihat dan dikerjakan oleh siswa</p>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs dark:bg-primary/10">
                <p className="font-semibold text-primary">Instruksi Pengerjaan Siswa:</p>
                <p className="mt-1 text-foreground">
                  Lengkapi komponen Ladder Logic yang masih bertanda <span className="font-bold text-amber-600 dark:text-amber-400">[ KOSONG ]</span> agar rangkaian berfungsi sesuai instruksi. Klik pada bagian kosong untuk memilih komponen dan alamat yang tepat.
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border dark:border-border-dark" style={{ minHeight: 450 }}>
                <LadderStudentAnswerPanel
                  question={{
                    id: 'preview',
                    type: 'ladder',
                    question: 'Preview Soal',
                    difficulty: 'medium',
                    points: 10,
                    explanation: null,
                    options: [],
                    imageUrls: [],
                    starterProgramJson: value.starterProgramJson,
                    answerProgramJson: value.answerProgramJson,
                    testCases: value.testCases,
                  }}
                  value={value.starterProgramJson}
                  onChange={() => {}}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function MapEditor({
  title,
  valueMap,
  onToggle,
}: {
  title: string;
  valueMap: Record<string, boolean>;
  onToggle: (address: string, value: boolean) => void;
}) {
  const [newAddress, setNewAddress] = useState('');
  const entries = Object.entries(valueMap);
  return (
    <div className="rounded-xl border border-border p-3 dark:border-border-dark">
      <div className="mb-2 text-xs font-semibold">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([address, checked]) => (
          <button
            key={address}
            type="button"
            onClick={() => onToggle(address, !checked)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
              checked
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground dark:border-border-dark'
            }`}
          >
            {address} = {checked ? 'ON' : 'OFF'}
          </button>
        ))}
      </div>
      <div className="mt-2.5 flex gap-2">
        <input
          value={newAddress}
          onChange={(e) => setNewAddress(e.target.value)}
          placeholder="I2 atau O1"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs outline-none dark:border-border-dark"
        />
        <Button
          size="sm"
          variant="outline"
          type="button"
          onClick={() => {
            const a = newAddress.toUpperCase().trim();
            if (!a || valueMap[a] !== undefined) return;
            onToggle(a, false);
            setNewAddress('');
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
