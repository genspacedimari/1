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
    return suffix === 'DN' ? !!timer.done : (timer.valueMs > 0);
  }
  if (type === 'CTU' || type === 'CTD') {
    const counter = snapshot.state.counters[number];
    if (!counter) return false;
    return suffix === 'DN' ? !!counter.done : counter.value > 0;
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
        if (expectation.valueMsAtLeast !== undefined && timer.valueMs < expectation.valueMsAtLeast) return false;
        return true;
      });
      const countersOk = Object.entries(testCase.expectedCounters ?? {}).every(([address, expectation]) => {
        const number = Number(address.replace(/[^0-9]/g, ''));
        const counter = snapshot.state.counters[number];
        if (!counter) return false;
        if (expectation.done !== undefined && counter.done !== expectation.done) return false;
        if (expectation.valueAtLeast !== undefined && counter.value < expectation.valueAtLeast) return false;
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
 * Behavior-based grading for new PLC challenge questions.
 * The student's ladder shape is never compared to the reference answer.
 * We run the submitted program against every teacher-authored test case.
 */
export async function gradeLadderQuestionScore(question: QuizQuestion, studentLadderJson: string): Promise<number> {
  if (question.testCases && question.testCases.length > 0) {
    const result = await gradeLadderProgram(studentLadderJson, question.testCases);
    return result.percent / 100;
  }

  // Backward compatibility only for old questions created before the visual
  // challenge system. New questions always use test cases above.
  if (!question.answerLadderJson) return 0;
  const studentProject = parseProject(studentLadderJson);
  const answerProject = parseProject(question.answerLadderJson);
  if (!studentProject || !answerProject) return 0;
  const studentSig = legacyExtractSignature(studentProject);
  const answerSig = legacyExtractSignature(answerProject);
  if (question.ladderMode === 'find_error') return legacySignaturesEqual(studentSig, answerSig) ? 0 : 1;
  return legacySignaturesEqual(studentSig, answerSig) ? 1 : 0;
}

export function gradeLadderQuestion(question: QuizQuestion, studentLadderJson: string): boolean {
  if (!question.testCases || question.testCases.length === 0) {
    if (!question.answerLadderJson) return false;
    const studentProject = parseProject(studentLadderJson);
    const answerProject = parseProject(question.answerLadderJson);
    if (!studentProject || !answerProject) return false;
    return legacySignaturesEqual(
      legacyExtractSignature(studentProject),
      legacyExtractSignature(answerProject),
    );
  }
  return false;
}
