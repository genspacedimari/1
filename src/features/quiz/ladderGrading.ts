import type { QuizQuestion, LadderTestCase } from './types';
import { PlcRuntime } from '@/simulator/runtime/plcRuntime';
import type { LadderProject } from '@/simulator/types/ladder';
import { parseLadder } from '@/simulator/parser/parseLadder';

interface LegacySignature {
  startIds: string[];
  elements: Array<{ kind: string; address: unknown; mode: string | undefined; connectsTo: string[] }>;
}

function legacyExtractSignature(project: LadderProject): LegacySignature[] {
  try {
    const compiled = parseLadder(project);
    return compiled.rungs.map((r) => ({
      startIds: r.startIds,
      elements: Array.from(r.nodes.values()).map((node) => ({
        kind: node.element.kind,
        address: 'address' in node.element ? node.element.address : undefined,
        mode: 'mode' in node.element ? (node.element as { mode?: string }).mode : undefined,
        connectsTo: node.successors,
      })),
    }));
  } catch {
    return [];
  }
}

function legacySignaturesEqual(a: LegacySignature[], b: LegacySignature[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ra = a[i], rb = b[i];
    if (ra.startIds.length !== rb.startIds.length || ra.elements.length !== rb.elements.length) return false;
    for (let j = 0; j < ra.elements.length; j++) {
      const ea = ra.elements[j], eb = rb.elements[j];
      if (ea.kind !== eb.kind || ea.address !== eb.address || ea.mode !== eb.mode) return false;
      const aNext = [...ea.connectsTo].sort();
      const bNext = [...eb.connectsTo].sort();
      if (aNext.length !== bNext.length || aNext.some((id, k) => id !== bNext[k])) return false;
    }
  }
  return true;
}

function parseProject(json: string): LadderProject | null {
  try {
    const parsed = JSON.parse(json) as LadderProject;
    if (!parsed || !Array.isArray(parsed.rungs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readAddress(snapshot: ReturnType<PlcRuntime['getSnapshot']>, address: string): boolean {
  const match = /^([A-Z]+)(\d+)(?:\.(DN|CV))?$/.exec(address.toUpperCase());
  if (!match) return false;
  const type = match[1];
  const number = Number(match[2]);
  const suffix = match[3];
  if (type === 'I') return !!snapshot.state.inputs[number];
  if (type === 'O') return !!snapshot.state.outputs[number];
  if (type === 'M') return !!snapshot.state.memory[number];
  if (type === 'TIM') {
    const timer = snapshot.state.timers[number];
    if (!timer) return false;
    return suffix === 'DN' ? !!timer.done : (timer.accumulatedMs > 0);
  }
  if (type === 'CTU' || type === 'CTD') {
    const counter = snapshot.state.counters[number];
    if (!counter) return false;
    return suffix === 'DN' ? !!counter.done : counter.accumulatedCount > 0;
  }
  return false;
}

function matchesBooleanMap(
  snapshot: ReturnType<PlcRuntime['getSnapshot']>,
  expected: Record<string, boolean> | undefined,
  addressReader = readAddress,
): boolean {
  return Object.entries(expected ?? {}).every(([address, expectedValue]) => addressReader(snapshot, address) === expectedValue);
}

export async function gradeLadderProgram(
  studentProgramJson: string,
  testCases: LadderTestCase[],
): Promise<{ passed: number; total: number; percent: number; failed: string[] }> {
  const project = parseProject(studentProgramJson);
  if (!project || testCases.length === 0) return { passed: 0, total: testCases.length, percent: 0, failed: ['Program/test cases tidak valid'] };

  let passed = 0;
  let passedWeight = 0;
  let totalWeight = 0;
  const failed: string[] = [];
  const runtime = new PlcRuntime(100);

  for (const testCase of testCases) {
    const weight = Number.isFinite(testCase.weight) && testCase.weight > 0 ? testCase.weight : 1;
    totalWeight += weight;
    try {
      runtime.loadProject(project);
      for (const [address, value] of Object.entries(testCase.inputs)) {
        const m = /^I(\d+)$/i.exec(address);
        if (m) runtime.setInput(Number(m[1]), value);
        else {
          const mm = /^M(\d+)$/i.exec(address);
          if (mm) runtime.forceBit('M', Number(mm[1]), value);
        }
      }

      const scans = Math.max(1, Math.ceil(testCase.durationMs / 100));
      for (let i = 0; i < scans; i++) runtime.step();

      const snapshot = runtime.getSnapshot();
      const outputOk = matchesBooleanMap(snapshot, testCase.expectedOutputs);
      const memoryOk = matchesBooleanMap(snapshot, testCase.expectedMemory);
      const timersOk = Object.entries(testCase.expectedTimers ?? {}).every(([address, expectation]) => {
        const timerNumber = Number(address.replace(/[^0-9]/g, ''));
        const timer = snapshot.state.timers[timerNumber];
        if (!timer) return false;
        if (expectation.done !== undefined && timer.done !== expectation.done) return false;
        if (expectation.valueMsAtLeast !== undefined && timer.accumulatedMs < expectation.valueMsAtLeast) return false;
        return true;
      });
      const countersOk = Object.entries(testCase.expectedCounters ?? {}).every(([address, expectation]) => {
        const number = Number(address.replace(/[^0-9]/g, ''));
        const counter = snapshot.state.counters[number];
        if (!counter) return false;
        if (expectation.done !== undefined && counter.done !== expectation.done) return false;
        if (expectation.valueAtLeast !== undefined && counter.accumulatedCount < expectation.valueAtLeast) return false;
        return true;
      });

      if (outputOk && memoryOk && timersOk && countersOk) {
        passed++;
        passedWeight += weight;
      } else failed.push(testCase.name);
    } catch {
      failed.push(testCase.name);
    }
  }

  return {
    passed,
    total: testCases.length,
    percent: totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0,
    failed,
  };
}

/**
 * Checks the structural fidelity between student program and answer program.
 * Checks for missing placeholders, matching component kinds, addresses, modes, and connections.
 */
export function gradeStructuralLadder(
  studentProject: LadderProject,
  answerProject: LadderProject
): { score: number; passed: boolean; feedback: string[] } {
  const feedback: string[] = [];

  // 1. Check for any unresolved PLACEHOLDER elements in the student's submission
  let placeholderCount = 0;
  for (const r of studentProject.rungs) {
    for (const el of r.elements) {
      if (el.kind === 'PLACEHOLDER') placeholderCount++;
    }
  }
  if (placeholderCount > 0) {
    feedback.push(`Terdapat ${placeholderCount} komponen yang masih bertanda [ KOSONG ]. Harap lengkapi semua bagian.`);
    return { score: 0, passed: false, feedback };
  }

  // 2. Extract signatures for both projects
  const studentSig = legacyExtractSignature(studentProject);
  const answerSig = legacyExtractSignature(answerProject);

  if (legacySignaturesEqual(studentSig, answerSig)) {
    feedback.push('Struktur rangkaian, jenis komponen, alamat I/O, dan percabangan 100% cocok dengan kunci jawaban.');
    return { score: 100, passed: true, feedback };
  }

  // Count matches in elements and addresses
  const answerElements = answerProject.rungs.flatMap((r) => r.elements);
  const studentElements = studentProject.rungs.flatMap((r) => r.elements);

  let matchedElements = 0;
  const remainingStudent = [...studentElements];

  for (const ansEl of answerElements) {
    const ansAddr = 'address' in ansEl && ansEl.address ? `${ansEl.address.type}${ansEl.address.number}` : null;
    const ansMode = 'mode' in ansEl ? (ansEl as { mode?: string }).mode : 'coilMode' in ansEl ? (ansEl as { coilMode?: string }).coilMode : null;

    const matchIdx = remainingStudent.findIndex((sEl) => {
      if (sEl.kind !== ansEl.kind) return false;
      const sAddr = 'address' in sEl && sEl.address ? `${sEl.address.type}${sEl.address.number}` : null;
      if (ansAddr && sAddr !== ansAddr) return false;
      const sMode = 'mode' in sEl ? (sEl as { mode?: string }).mode : 'coilMode' in sEl ? (sEl as { coilMode?: string }).coilMode : null;
      if (ansMode && sMode !== ansMode) return false;
      return true;
    });

    if (matchIdx >= 0) {
      matchedElements++;
      remainingStudent.splice(matchIdx, 1);
      const label = ansAddr ? `${ansEl.kind} ${ansAddr}${ansMode ? ` (${ansMode})` : ''}` : ansEl.kind;
      feedback.push(`Komponen ${label} cocok dengan kunci jawaban.`);
    } else {
      const label = ansAddr ? `${ansEl.kind} ${ansAddr}${ansMode ? ` (${ansMode})` : ''}` : ansEl.kind;
      feedback.push(`Komponen ${label} belum sesuai atau hilang pada rangkaian.`);
    }
  }

  const structuralScore = answerElements.length > 0 ? Math.round((matchedElements / answerElements.length) * 100) : 0;
  return {
    score: structuralScore,
    passed: structuralScore >= 95,
    feedback,
  };
}

/**
 * Automatically derives test cases from an answer ladder program by detecting
 * all I/O addresses and recording actual circuit behavior under PlcRuntime.
 */
export function autoGenerateTestCasesFromAnswer(answerProgramJson: string): LadderTestCase[] {
  const project = parseProject(answerProgramJson);
  if (!project) return [];

  const inputs = new Set<string>();
  const outputs = new Set<string>();

  for (const rung of project.rungs) {
    for (const el of rung.elements) {
      if ('address' in el && el.address) {
        const addrStr = `${el.address.type}${el.address.number}`;
        if (el.address.type === 'I') inputs.add(addrStr);
        if (el.address.type === 'O') outputs.add(addrStr);
      }
    }
  }

  const inputList = Array.from(inputs).sort();
  const outputList = Array.from(outputs).sort();
  if (inputList.length === 0 && outputList.length === 0) return [];

  const runtime = new PlcRuntime(100);
  const testCases: LadderTestCase[] = [];

  const runAndRecord = (name: string, inMap: Record<string, boolean>, durationMs = 0): LadderTestCase => {
    runtime.loadProject(project);
    for (const [addr, val] of Object.entries(inMap)) {
      const m = /^I(\d+)$/i.exec(addr);
      if (m) runtime.setInput(Number(m[1]), val);
    }
    const scans = Math.max(1, Math.ceil(durationMs / 100));
    for (let i = 0; i < scans; i++) runtime.step();
    const snap = runtime.getSnapshot();

    const expectedOutputs: Record<string, boolean> = {};
    for (const o of outputList) {
      expectedOutputs[o] = readAddress(snap, o);
    }

    return {
      id: `tc-auto-${Date.now()}-${testCases.length + 1}`,
      name,
      durationMs,
      weight: 1,
      inputs: inMap,
      expectedOutputs,
    };
  };

  // Case 1: All inputs OFF
  const allOff: Record<string, boolean> = {};
  inputList.forEach((inp) => { allOff[inp] = false; });
  testCases.push(runAndRecord('Kondisi Awal (Semua Input OFF)', allOff));

  // Case 2: Each input activated individually
  inputList.forEach((inp) => {
    const singleOn = { ...allOff, [inp]: true };
    testCases.push(runAndRecord(`Uji Input ${inp} Aktif (ON)`, singleOn));
  });

  // Case 3: If multiple inputs, test all ON
  if (inputList.length > 1) {
    const allOn: Record<string, boolean> = {};
    inputList.forEach((inp) => { allOn[inp] = true; });
    testCases.push(runAndRecord('Semua Input Aktif (ON)', allOn));
  }

  return testCases;
}

/**
 * Behavior-based and/or structural grading for PLC challenge questions.
 */
export async function gradeLadderQuestionScore(question: QuizQuestion, studentLadderJson: string): Promise<number> {
  const result = await gradeLadderDetailed(question, studentLadderJson);
  return result.score / 100;
}

export async function gradeLadderDetailed(
  question: QuizQuestion,
  studentLadderJson: string
): Promise<{
  score: number;
  passed: boolean;
  structureScore: number;
  logicScore: number;
  feedback: string[];
}> {
  const studentProject = parseProject(studentLadderJson);
  const answerProject = question.answerLadderJson || question.answerProgramJson
    ? parseProject(question.answerLadderJson || question.answerProgramJson!)
    : null;

  let structureScore = 0;
  let logicScore = 0;
  const feedback: string[] = [];

  // Structural check
  if (studentProject && answerProject) {
    const struct = gradeStructuralLadder(studentProject, answerProject);
    structureScore = struct.score;
    feedback.push(...struct.feedback);
  }

  // Logic test cases check
  const testCases = (question.testCases && question.testCases.length > 0)
    ? question.testCases
    : (answerProject ? autoGenerateTestCasesFromAnswer(JSON.stringify(answerProject)) : []);

  if (testCases.length > 0) {
    const logic = await gradeLadderProgram(studentLadderJson, testCases);
    logicScore = logic.percent;
    if (logic.failed.length > 0) {
      feedback.push(`Gagal pada pengujian logika: ${logic.failed.join(', ')}`);
    } else {
      feedback.push(`Pengujian logika: ${logic.passed}/${logic.total} skenario pengujian berhasil.`);
    }
  } else {
    logicScore = structureScore;
  }

  // Final score logic
  // If alternative logic is accepted and logic test passed 100%, award full score
  let finalScore = logicScore;
  if (structureScore > 0 && testCases.length > 0) {
    // Balanced: 50% structure, 50% logic behavior, or 100% if logic passes completely
    finalScore = logicScore === 100 ? 100 : Math.round((structureScore * 0.4) + (logicScore * 0.6));
  } else if (structureScore > 0 && testCases.length === 0) {
    finalScore = structureScore;
  }

  return {
    score: finalScore,
    passed: finalScore >= 80,
    structureScore,
    logicScore,
    feedback,
  };
}

export function gradeLadderQuestion(question: QuizQuestion, studentLadderJson: string): boolean {
  if (question.testCases && question.testCases.length > 0) {
    // Sync wrapper - returns false if logic test cases present (caller should use gradeLadderQuestionScore)
    return false;
  }
  if (!question.answerLadderJson && !question.answerProgramJson) return false;
  const studentProject = parseProject(studentLadderJson);
  const answerProject = parseProject((question.answerLadderJson || question.answerProgramJson)!);
  if (!studentProject || !answerProject) return false;
  return gradeStructuralLadder(studentProject, answerProject).passed;
}
