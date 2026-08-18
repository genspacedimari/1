import type { LadderChallengeType, LadderTestCase } from '@/features/quiz/types';

export interface MasterProgram {
  id: string;
  teacherId: string;
  name: string;
  description: string;
  ladderJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface LadderChallengeDraft {
  challengeType: LadderChallengeType;
  masterProgramId: string | null;
  baseProgramJson: string | null;
  starterProgramJson: string | null;
  answerProgramJson: string | null;
  expectedOutput: string | null;
  testCases: LadderTestCase[];
}

export function createTestCase(index = 1): LadderTestCase {
  return {
    id: `tc-${Date.now()}-${index}`,
    name: `Test Case ${index}`,
    durationMs: 0,
    weight: 1,
    inputs: { I1: false },
    expectedOutputs: { O1: false },
    expectedMemory: {},
    expectedTimers: {},
    expectedCounters: {},
  };
}
