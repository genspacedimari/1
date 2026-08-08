import { parseLadder } from '@/simulator/parser/parseLadder';
import type { LadderProject } from '@/simulator/types/ladder';
import type { QuizQuestion } from './types';

/**
 * Ladder grading — compares logical structure (AST), never pixel layout.
 *
 * For "predict_output" mode: we run both the student's ladder and the
 * reference ladder through the parser and compare the resulting rung
 * graphs (element kinds, addresses, connections). If they match, correct.
 *
 * For "build/complete/choose_correct" modes: same structural comparison
 * against the stored answer ladder.
 *
 * For "find_error" mode: we check that the student's ladder differs from
 * the reference in at least one meaningful way (kind/address/connectsTo).
 */

interface RungSignature {
  startIds: string[];
  elements: Array<{
    kind: string;
    address: unknown;
    mode: string | undefined;
    connectsTo: string[];
  }>;
}

function extractSignature(project: LadderProject): RungSignature[] {
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

function signaturesEqual(a: RungSignature[], b: RungSignature[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ra = a[i], rb = b[i];
    if (ra.startIds.length !== rb.startIds.length) return false;
    if (ra.elements.length !== rb.elements.length) return false;
    for (let j = 0; j < ra.elements.length; j++) {
      const ea = ra.elements[j], eb = rb.elements[j];
      if (ea.kind !== eb.kind) return false;
      if (ea.address !== eb.address) return false;
      if (ea.mode !== eb.mode) return false;
      if (ea.connectsTo.length !== eb.connectsTo.length) return false;
      const sortedA = [...ea.connectsTo].sort();
      const sortedB = [...eb.connectsTo].sort();
      if (sortedA.some((id, k) => id !== sortedB[k])) return false;
    }
  }
  return true;
}

export function gradeLadderQuestion(question: QuizQuestion, studentLadderJson: string): boolean {
  if (!question.ladderMode) return false;

  let studentProject: LadderProject;
  try {
    studentProject = JSON.parse(studentLadderJson);
  } catch {
    return false;
  }

  const studentSig = extractSignature(studentProject);
  if (studentSig.length === 0) return false;

  switch (question.ladderMode) {
    case 'predict_output':
    case 'build':
    case 'complete':
    case 'choose_correct': {
      if (!question.answerLadderJson) return studentSig.length > 0;
      let answerProject: LadderProject;
      try {
        answerProject = JSON.parse(question.answerLadderJson);
      } catch {
        return false;
      }
      const answerSig = extractSignature(answerProject);
      return signaturesEqual(studentSig, answerSig);
    }
    case 'find_error': {
      // Student must produce a ladder that DIFFERS from the reference
      if (!question.ladderJson) return studentSig.length > 0;
      let refProject: LadderProject;
      try {
        refProject = JSON.parse(question.ladderJson);
      } catch {
        return false;
      }
      const refSig = extractSignature(refProject);
      return !signaturesEqual(studentSig, refSig) && studentSig.length > 0;
    }
    default:
      return false;
  }
}
