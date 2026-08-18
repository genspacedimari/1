import { PlcRuntime } from '@/simulator/runtime/plcRuntime';
import type { LadderProject } from '@/simulator/types/ladder';
import type { Mismatch, ProgramTestResult, TestCase, TestCaseResult, TestStep } from './behaviorTypes';

/**
 * Behavior-based grading — engine.
 *
 * This is the replacement for src/features/quiz/ladderGrading.ts's
 * structural/AST comparison. Instead of asking "is the student's ladder
 * shaped like the reference ladder?", we ask "does the student's ladder
 * DO the right thing?" by actually running it in a real (headless)
 * PlcRuntime and checking I/O over time — exactly like a teacher clicking
 * through inputs manually, just scripted and automatic.
 *
 * A fresh PlcRuntime is created per run (never the shared `plcRuntime`
 * singleton) so grading never interferes with — or is interfered by — a
 * live Simulator screen the user might have open.
 */

/** Smaller than the UI's default scan interval so timer/counter waitMs
 * checks (e.g. "5 seconds after I1 turns on") land close to the exact
 * millisecond instead of being off by up to one scan. Grading runs
 * synchronously (no real setInterval delay), so a fast scan rate costs
 * nothing here. */
const GRADING_SCAN_INTERVAL_MS = 10;

function parseProgram(json: string): LadderProject {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.rungs)) {
    throw new Error('Program tidak valid: struktur rungs tidak ditemukan.');
  }
  return parsed as LadderProject;
}

/** Runs the runtime forward by at least `ms` of simulated time, in
 * GRADING_SCAN_INTERVAL_MS increments, so timers/counters accumulate
 * correctly. Always runs at least one scan (so a plain input change is
 * reflected even with waitMs omitted/0). */
function advance(runtime: PlcRuntime, ms: number | undefined): void {
  const target = Math.max(ms ?? 0, 0);
  const scans = Math.max(1, Math.ceil(target / GRADING_SCAN_INTERVAL_MS));
  for (let i = 0; i < scans; i++) {
    runtime.step();
  }
}

function checkStep(runtime: PlcRuntime, step: TestStep): Mismatch[] {
  const { state } = runtime.getSnapshot();
  const mismatches: Mismatch[] = [];

  const record = (
    target: Mismatch['target'],
    address: number,
    expected: boolean,
    actual: boolean | undefined
  ) => {
    if (actual !== expected) {
      mismatches.push({
        stepId: step.id,
        stepLabel: step.label,
        target,
        address,
        expected,
        actual: actual ?? false,
      });
    }
  };

  for (const [addr, expected] of Object.entries(step.expectedOutputs ?? {})) {
    record('output', Number(addr), expected, state.outputs[Number(addr)]);
  }
  for (const [addr, expected] of Object.entries(step.expectedMemory ?? {})) {
    record('memory', Number(addr), expected, state.memory[Number(addr)]);
  }
  for (const [addr, expected] of Object.entries(step.expectedTimers ?? {})) {
    if (expected.done !== undefined) {
      record('timer', Number(addr), expected.done, state.timers[Number(addr)]?.done);
    }
  }
  for (const [addr, expected] of Object.entries(step.expectedCounters ?? {})) {
    if (expected.done !== undefined) {
      record('counter', Number(addr), expected.done, state.counters[Number(addr)]?.done);
    }
  }

  return mismatches;
}

/** Runs one TestCase against a program (already-loaded runtime is not
 * reused across cases — each case gets a clean run from a fresh state,
 * since test cases are meant to be independent scenarios, e.g. "I1 ON,
 * I2 OFF" should not carry over latched memory from a previous case). */
export function runTestCase(project: LadderProject, testCase: TestCase): TestCaseResult {
  const runtime = new PlcRuntime(GRADING_SCAN_INTERVAL_MS);
  try {
    runtime.loadProject(project);
  } catch (err) {
    return {
      testCaseId: testCase.id,
      testCaseName: testCase.name,
      passed: false,
      mismatches: [],
      errored: true,
      errorMessage: err instanceof Error ? err.message : 'Program gagal dimuat.',
    };
  }

  const allMismatches: Mismatch[] = [];
  try {
    for (const step of testCase.steps) {
      for (const [addr, value] of Object.entries(step.setInputs ?? {})) {
        runtime.setInput(Number(addr), value);
      }
      advance(runtime, step.waitMs);
      allMismatches.push(...checkStep(runtime, step));
    }
  } catch (err) {
    return {
      testCaseId: testCase.id,
      testCaseName: testCase.name,
      passed: false,
      mismatches: allMismatches,
      errored: true,
      errorMessage: err instanceof Error ? err.message : 'Program berhenti dengan error saat dijalankan.',
    };
  } finally {
    runtime.stop();
  }

  return {
    testCaseId: testCase.id,
    testCaseName: testCase.name,
    passed: allMismatches.length === 0,
    mismatches: allMismatches,
    errored: false,
  };
}

/** Runs every TestCase against the student's (or teacher's, when using
 * "Test Answer") program and produces a weighted score. This is the main
 * entry point question authoring (Test Answer) and student submission
 * (Test / final grading) both call. */
export function runTestSuite(programJson: string, testCases: TestCase[]): ProgramTestResult {
  let project: LadderProject;
  try {
    project = parseProgram(programJson);
  } catch (err) {
    const results: TestCaseResult[] = testCases.map((tc) => ({
      testCaseId: tc.id,
      testCaseName: tc.name,
      passed: false,
      mismatches: [],
      errored: true,
      errorMessage: err instanceof Error ? err.message : 'Program JSON tidak valid.',
    }));
    return {
      allPassed: false,
      scorePercent: 0,
      passedCount: 0,
      totalCount: testCases.length,
      results,
    };
  }

  const results = testCases.map((tc) => runTestCase(project, tc));

  const totalWeight = testCases.reduce((sum, tc) => sum + (tc.weight ?? 1), 0) || 1;
  const earnedWeight = results.reduce((sum, r, i) => sum + (r.passed ? (testCases[i].weight ?? 1) : 0), 0);
  const passedCount = results.filter((r) => r.passed).length;

  return {
    allPassed: passedCount === testCases.length,
    scorePercent: Math.round((earnedWeight / totalWeight) * 100),
    passedCount,
    totalCount: testCases.length,
    results,
  };
}

/** Convenience wrapper: grade a student's raw ladder JSON string. Returns
 * a ProgramTestResult with a single failing case if the JSON itself is
 * unparsable/invalid — callers don't need a separate try/catch. */
export function gradeStudentProgram(studentLadderJson: string, testCases: TestCase[]): ProgramTestResult {
  return runTestSuite(studentLadderJson, testCases);
}
