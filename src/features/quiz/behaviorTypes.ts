/**
 * Behavior-based grading — types.
 *
 * Replaces "compare student ladder JSON/AST to a reference ladder" with
 * "run the student's ladder in the real PlcRuntime and check the actual
 * I/O behavior over time". A test case is a timeline: at each step you can
 * set inputs and/or advance time, then check outputs/memory/timers/counters
 * at that point in time. Many different ladder structures can satisfy the
 * same TestCase — that's the point (see spec section 5-8).
 */

/** One point on the test's timeline. */
export interface TestStep {
  id: string;
  /** Optional human label shown in results, e.g. "t=0s" or "Tekan I1". */
  label?: string;
  /** Inputs to set (address number -> value) before this step runs.
   * Only addresses listed here are changed; everything else keeps its
   * previous value (inputs persist like real switches). */
  setInputs?: Record<number, boolean>;
  /**
   * How long to let the program run (in simulated ms) after applying
   * setInputs, before checking expectations. 0/undefined = check after a
   * single scan cycle. Use this for Timer/Counter/delay questions, e.g.
   * waitMs: 5000 to check "5 seconds after I1 turns on".
   */
  waitMs?: number;
  /** Expected output values at this point in time (address -> value).
   * Only addresses listed here are checked. */
  expectedOutputs?: Record<number, boolean>;
  /** Expected bit-memory values at this point in time. */
  expectedMemory?: Record<number, boolean>;
  /** Expected timer state (by timer address) at this point in time. */
  expectedTimers?: Record<number, { done?: boolean }>;
  /** Expected counter state (by counter address) at this point in time. */
  expectedCounters?: Record<number, { done?: boolean }>;
}

export interface TestCase {
  id: string;
  name: string;
  /** Relative weight used when computing the overall score. Defaults to 1
   * for every test case if omitted (i.e. all cases count equally). */
  weight?: number;
  steps: TestStep[];
}

/** One expectation that didn't match, for showing "Expected vs Actual". */
export interface Mismatch {
  stepId: string;
  stepLabel?: string;
  target: 'output' | 'memory' | 'timer' | 'counter';
  address: number;
  expected: boolean;
  actual: boolean;
}

export interface TestCaseResult {
  testCaseId: string;
  testCaseName: string;
  passed: boolean;
  /** Every mismatch found across all steps of this test case (empty if passed). */
  mismatches: Mismatch[];
  /** True if the program threw/failed to load/run at all during this case. */
  errored: boolean;
  errorMessage?: string;
}

export interface ProgramTestResult {
  /** Overall pass/fail — true only if every test case passed. */
  allPassed: boolean;
  /** Weighted score 0-100. */
  scorePercent: number;
  passedCount: number;
  totalCount: number;
  results: TestCaseResult[];
}
