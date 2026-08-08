import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadFile } from '@/features/plc-simulator/projectTypes';
import type { Question, ExamResult } from './types';

// ============================================================
// Question Import
// ============================================================
//
// Template columns (Excel & CSV):
//   Question | Option A | Option B | Option C | Option D | Correct Answer
//   | Explanation | Difficulty | Category
// Correct Answer accepts: A | B | C | D (case-insensitive)
// Difficulty accepts: Easy | Medium | Hard (case-insensitive)
//
// JSON format:
//   [{ "question": "...", "options": ["...","...","...","..."],
//      "correctAnswer": "A", "explanation": "...", "difficulty": "Easy",
//      "category": "PLC" }]

export interface ImportRow {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  /** Normalized to 'A' | 'B' | 'C' | 'D' (uppercase) when recognizable, otherwise the raw value. */
  correctAnswer: string;
  explanation: string;
  /** Normalized to 'easy' | 'medium' | 'hard'. */
  difficulty: string;
  category: string;
}

export interface ValidatedImportRow {
  rowNumber: number;
  row: ImportRow;
  valid: boolean;
  reasons: string[];
}

export interface ImportPreview {
  totalRows: number;
  valid: ValidatedImportRow[];
  invalid: ValidatedImportRow[];
  all: ValidatedImportRow[];
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

/** Normalizes a header/key for tolerant matching: "Option A" / "option_a" / "OptionA" all become "optiona". */
function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function pick(row: Record<string, unknown>, ...aliases: string[]): string {
  const normalizedRow: Record<string, unknown> = {};
  for (const k of Object.keys(row)) normalizedRow[normalizeKey(k)] = row[k];
  for (const alias of aliases) {
    const v = normalizedRow[normalizeKey(alias)];
    if (v !== undefined && v !== null) return String(v).trim();
  }
  return '';
}

function normalizeDifficulty(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (v === 'easy' || v === 'medium' || v === 'hard') return v;
  return 'medium';
}

function normalizeCorrectAnswer(raw: string, options: string[]): string {
  const v = raw.trim().toUpperCase();
  if (OPTION_LETTERS.includes(v as typeof OPTION_LETTERS[number])) return v;
  // Fall back: some sources export the correct option's full text instead of a letter.
  const idx = options.findIndex((o) => o.trim().toLowerCase() === raw.trim().toLowerCase() && o.trim() !== '');
  if (idx >= 0) return OPTION_LETTERS[idx];
  return v; // keep raw (uppercased) so validation can report exactly what was wrong
}

function rawRowToImportRow(raw: Record<string, unknown>): ImportRow {
  const optionA = pick(raw, 'Option A', 'optionA', 'option_a', 'A');
  const optionB = pick(raw, 'Option B', 'optionB', 'option_b', 'B');
  const optionC = pick(raw, 'Option C', 'optionC', 'option_c', 'C');
  const optionD = pick(raw, 'Option D', 'optionD', 'option_d', 'D');
  const correctRaw = pick(raw, 'Correct Answer', 'correctAnswer', 'correct_answer');
  return {
    question: pick(raw, 'Question'),
    optionA,
    optionB,
    optionC,
    optionD,
    correctAnswer: normalizeCorrectAnswer(correctRaw, [optionA, optionB, optionC, optionD]),
    explanation: pick(raw, 'Explanation'),
    difficulty: normalizeDifficulty(pick(raw, 'Difficulty') || 'medium'),
    category: pick(raw, 'Category'),
  };
}

/** True if every field on the row is empty — used to silently skip blank rows. */
function isBlankRow(row: ImportRow): boolean {
  return !row.question.trim() && !row.optionA.trim() && !row.optionB.trim() &&
    !row.optionC.trim() && !row.optionD.trim() && !row.correctAnswer.trim();
}

export function parseCSV(text: string): ImportRow[] {
  const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { raw[h] = values[idx] ?? ''; });
    const row = rawRowToImportRow(raw);
    if (!isBlankRow(row)) rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; continue; }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

export function parseExcel(file: ArrayBuffer): ImportRow[] {
  const wb = XLSX.read(file, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  const rows: ImportRow[] = [];
  for (const raw of json) {
    const row = rawRowToImportRow(raw);
    if (!isBlankRow(row)) rows.push(row);
  }
  return rows;
}

export function parseJSON(text: string): ImportRow[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('JSON must be an array of question objects');
  const rows: ImportRow[] = [];
  for (const entry of data as Record<string, unknown>[]) {
    let optionA = '', optionB = '', optionC = '', optionD = '';
    if (Array.isArray(entry.options)) {
      const opts = (entry.options as unknown[]).map((o) => String(o ?? '').trim());
      [optionA, optionB, optionC, optionD] = [opts[0] ?? '', opts[1] ?? '', opts[2] ?? '', opts[3] ?? ''];
    } else {
      optionA = pick(entry, 'Option A', 'optionA', 'option_a');
      optionB = pick(entry, 'Option B', 'optionB', 'option_b');
      optionC = pick(entry, 'Option C', 'optionC', 'option_c');
      optionD = pick(entry, 'Option D', 'optionD', 'option_d');
    }
    const correctRaw = pick(entry, 'correctAnswer', 'correct_answer', 'Correct Answer');
    const row: ImportRow = {
      question: pick(entry, 'question', 'Question'),
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer: normalizeCorrectAnswer(correctRaw, [optionA, optionB, optionC, optionD]),
      explanation: pick(entry, 'explanation', 'Explanation'),
      difficulty: normalizeDifficulty(pick(entry, 'difficulty', 'Difficulty') || 'medium'),
      category: pick(entry, 'category', 'Category'),
    };
    if (!isBlankRow(row)) rows.push(row);
  }
  return rows;
}

/**
 * Validates every parsed row against the import rules:
 *   - question text is required
 *   - at least two non-empty options are required
 *   - Correct Answer must be A/B/C/D AND that lettered option must be non-empty
 * Blank rows are already filtered out by the parsers (skip silently).
 * Every row (valid or not) is returned in `all` with a `valid` flag and
 * human-readable `reasons`, so the preview can show a Validation Status
 * column for every row, not just the rejected ones.
 */
export function validateImportRows(rows: ImportRow[]): ImportPreview {
  const all: ValidatedImportRow[] = rows.map((row, i) => {
    const reasons: string[] = [];
    const options = [row.optionA, row.optionB, row.optionC, row.optionD];
    const filledCount = options.filter((o) => o.trim().length > 0).length;

    if (!row.question.trim()) reasons.push('Question text is empty');
    if (filledCount < 2) reasons.push('At least two options are required');

    const letterIdx = OPTION_LETTERS.indexOf(row.correctAnswer as typeof OPTION_LETTERS[number]);
    if (letterIdx === -1) {
      reasons.push(`Correct Answer must be A, B, C or D (got "${row.correctAnswer || ''}")`);
    } else if (!options[letterIdx]?.trim()) {
      reasons.push(`Correct Answer "${row.correctAnswer}" refers to an empty option`);
    }

    return { rowNumber: i + 1, row, valid: reasons.length === 0, reasons };
  });

  return {
    totalRows: all.length,
    valid: all.filter((r) => r.valid),
    invalid: all.filter((r) => !r.valid),
    all,
  };
}

// ============================================================
// Question Import Template (download)
// ============================================================

const TEMPLATE_HEADERS = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer', 'Explanation', 'Difficulty', 'Category'];
const TEMPLATE_EXAMPLE_ROWS = [
  ['Which instruction represents a Normally Open contact in ladder logic?', '-| |-', '-|/|-', '-( )-', '-(/)-', 'A', 'A Normally Open (NO) contact is drawn as -| |- and is true when its bit is ON.', 'Easy', 'PLC Basic'],
  ['What happens to a Timer (TON) when its input goes false before the preset time is reached?', 'It keeps counting', 'It resets to zero', 'It latches at the preset', 'It jumps to the next rung', 'B', 'A TON (Timer On-delay) resets its elapsed time to zero when the input goes false.', 'Medium', 'Timer'],
];

export function downloadQuestionImportTemplateCSV(): void {
  const lines = [TEMPLATE_HEADERS.join(',')];
  for (const row of TEMPLATE_EXAMPLE_ROWS) {
    lines.push(row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','));
  }
  downloadFile('question-import-template.csv', lines.join('\n'), 'text/csv');
}

export function downloadQuestionImportTemplateExcel(): void {
  const data = TEMPLATE_EXAMPLE_ROWS.map((row) =>
    Object.fromEntries(TEMPLATE_HEADERS.map((h, i) => [h, row[i]]))
  );
  const ws = XLSX.utils.json_to_sheet(data, { header: TEMPLATE_HEADERS });
  ws['!cols'] = TEMPLATE_HEADERS.map(() => ({ wch: 28 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  XLSX.writeFile(wb, 'question-import-template.xlsx');
}

export function downloadQuestionImportTemplateJSON(): void {
  const example = [
    {
      question: 'Which instruction represents a Normally Open contact in ladder logic?',
      options: ['-| |-', '-|/|-', '-( )-', '-(/)-'],
      correctAnswer: 'A',
      explanation: 'A Normally Open (NO) contact is drawn as -| |- and is true when its bit is ON.',
      difficulty: 'Easy',
      category: 'PLC Basic',
    },
  ];
  downloadFile('question-import-template.json', JSON.stringify(example, null, 2), 'application/json');
}

// ============================================================
// Question Export
// ============================================================

export function exportQuestionsJSON(questions: Question[]): void {
  const data = questions.map((q) => ({
    type: q.type,
    question: q.question,
    difficulty: q.difficulty,
    points: q.points,
    explanation: q.explanation,
    options: q.options.map((o) => ({ label: o.label, isCorrect: o.isCorrect })),
    category: q.categoryId,
  }));
  downloadFile('questions.json', JSON.stringify(data, null, 2), 'application/json');
}

export function exportQuestionsCSV(questions: Question[]): void {
  const headers = ['type', 'question', 'optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'correctAnswer', 'difficulty', 'points', 'explanation'];
  const lines = [headers.join(',')];
  for (const q of questions) {
    const opts = q.options;
    const correct = opts.find((o) => o.isCorrect);
    const row = [
      q.type,
      `"${q.question.replace(/"/g, '""')}"`,
      `"${opts[0]?.label ?? ''}"`,
      `"${opts[1]?.label ?? ''}"`,
      `"${opts[2]?.label ?? ''}"`,
      `"${opts[3]?.label ?? ''}"`,
      `"${opts[4]?.label ?? ''}"`,
      `"${correct?.label ?? ''}"`,
      q.difficulty,
      q.points,
      `"${q.explanation?.replace(/"/g, '""') ?? ''}"`,
    ];
    lines.push(row.join(','));
  }
  downloadFile('questions.csv', lines.join('\n'), 'text/csv');
}

export function exportQuestionsExcel(questions: Question[]): void {
  const data = questions.map((q) => {
    const opts = q.options;
    const correct = opts.find((o) => o.isCorrect);
    return {
      type: q.type,
      question: q.question,
      optionA: opts[0]?.label ?? '',
      optionB: opts[1]?.label ?? '',
      optionC: opts[2]?.label ?? '',
      optionD: opts[3]?.label ?? '',
      optionE: opts[4]?.label ?? '',
      correctAnswer: correct?.label ?? '',
      difficulty: q.difficulty,
      points: q.points,
      explanation: q.explanation ?? '',
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  XLSX.writeFile(wb, 'questions.xlsx');
}

// ============================================================
// Results Export
// ============================================================

export function exportResultsCSV(results: ExamResult[]): void {
  const headers = ['Student', 'Email', 'Exam', 'Class', 'Score', 'Correct', 'Wrong', 'Time Used (s)', 'Submitted At', 'Rank', 'Status'];
  const lines = [headers.join(',')];
  for (const r of results) {
    lines.push([
      `"${r.studentName}"`,
      `"${r.studentEmail}"`,
      `"${r.examName}"`,
      `"${r.className ?? ''}"`,
      r.score,
      r.correctCount,
      r.wrongCount,
      r.timeUsedSeconds,
      r.completedAt,
      r.rank ?? '',
      r.status,
    ].join(','));
  }
  downloadFile('exam-results.csv', lines.join('\n'), 'text/csv');
}

export function exportResultsExcel(results: ExamResult[]): void {
  const data = results.map((r) => ({
    Student: r.studentName,
    Email: r.studentEmail,
    Exam: r.examName,
    Class: r.className ?? '',
    Score: r.score,
    Correct: r.correctCount,
    Wrong: r.wrongCount,
    'Time Used (s)': r.timeUsedSeconds,
    'Submitted At': r.completedAt,
    Rank: r.rank ?? '',
    Status: r.status,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Results');
  XLSX.writeFile(wb, 'exam-results.xlsx');
}

export function exportResultsPDF(results: ExamResult[]): void {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Exam Results', 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 27);

  autoTable(doc, {
    startY: 32,
    head: [['Student', 'Exam', 'Class', 'Score', 'Correct', 'Wrong', 'Time', 'Rank', 'Status']],
    body: results.map((r) => [
      r.studentName,
      r.examName,
      r.className ?? '-',
      r.score,
      r.correctCount,
      r.wrongCount,
      `${Math.floor(r.timeUsedSeconds / 60)}m ${r.timeUsedSeconds % 60}s`,
      r.rank ? `#${r.rank}` : '-',
      r.status,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [242, 107, 58] },
  });

  doc.save('exam-results.pdf');
}