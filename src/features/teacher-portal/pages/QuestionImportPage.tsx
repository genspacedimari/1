import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Upload, FileSpreadsheet, FileJson, FileText, Download,
  CircleCheck as CheckCircle2, Circle as XCircle, TriangleAlert as AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTeacherStore } from '../store';
import * as svc from '../services';
import {
  parseCSV, parseExcel, parseJSON, validateImportRows,
  downloadQuestionImportTemplateCSV, downloadQuestionImportTemplateExcel, downloadQuestionImportTemplateJSON,
  type ImportPreview, type ValidatedImportRow,
} from '../importExport';
import { cn } from '@/utils/cn';

type ImportFormat = 'csv' | 'xlsx' | 'json';
const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export function QuestionImportPage() {
  const navigate = useNavigate();
  const { categories, loadQuestions, loadCategories } = useTeacherStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const importingRef = useRef(false); // hard lock against double-submit, independent of React state timing

  const [format, setFormat] = useState<ImportFormat>('csv');
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; failed: { row: ValidatedImportRow; reason: string }[] } | null>(null);

  const resetFile = () => {
    setFileName(null);
    setPreview(null);
    setParseError(null);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    if (format === 'csv') downloadQuestionImportTemplateCSV();
    else if (format === 'xlsx') downloadQuestionImportTemplateExcel();
    else downloadQuestionImportTemplateJSON();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setImportResult(null);
    setFileName(file.name);
    try {
      const parsed = format === 'csv' ? parseCSV(await file.text())
        : format === 'xlsx' ? parseExcel(await file.arrayBuffer())
        : parseJSON(await file.text());
      if (parsed.length === 0) {
        setPreview(null);
        setParseError('No usable rows were found in this file (blank rows are skipped automatically). Check that the header row matches the template.');
        return;
      }
      setPreview(validateImportRows(parsed));
    } catch (err) {
      setPreview(null);
      setParseError(err instanceof Error ? err.message : 'Failed to parse file');
    }
  };

  const handleImport = async () => {
    if (!preview || preview.valid.length === 0) return;
    if (importingRef.current) return; // prevents duplicate inserts from a fast double-click
    importingRef.current = true;
    setImporting(true);

    try {
      // Resolve/create categories once per unique name, reused across all rows
      // in this batch, so importing 500 rows in "PLC Basic" never creates 500
      // duplicate categories.
      const categoryCache = new Map<string, string | null>();
      for (const c of categories) categoryCache.set(c.name.trim().toLowerCase(), c.id);

      async function resolveCategoryId(name: string): Promise<string | null> {
        const key = name.trim().toLowerCase();
        if (!key) return null;
        if (categoryCache.has(key)) return categoryCache.get(key)!;
        const created = await svc.createCategory(name.trim());
        categoryCache.set(key, created.id);
        return created.id;
      }

      let imported = 0;
      const failed: { row: ValidatedImportRow; reason: string }[] = [];

      // Sequential on purpose: avoids hammering Supabase with a burst of
      // concurrent inserts (rate limits / connection pool) and keeps
      // category creation race-free without extra locking.
      for (const item of preview.valid) {
        const { row } = item;
        const options = [row.optionA, row.optionB, row.optionC, row.optionD]
          .map((label, idx) => ({ label, isCorrect: OPTION_LETTERS[idx] === row.correctAnswer, sortOrder: idx }))
          .filter((o) => o.label.trim().length > 0);

        try {
          const categoryId = await resolveCategoryId(row.category);
          await svc.createQuestion({
            categoryId,
            type: 'multiple_choice',
            question: row.question,
            difficulty: row.difficulty as 'easy' | 'medium' | 'hard',
            points: 10,
            explanation: row.explanation || null,
            options,
          });
          imported++;
        } catch (err) {
          failed.push({ row: item, reason: err instanceof Error ? err.message : 'Failed to save' });
        }
      }

      // Question Bank and category list refresh once, after the whole batch —
      // not per row — so imported questions "appear immediately" without
      // hundreds of redundant refetches.
      await Promise.all([loadQuestions(), loadCategories()]);
      setImportResult({ imported, failed });
    } finally {
      importingRef.current = false;
      setImporting(false);
    }
  };

  const formatOptions = [
    { value: 'csv' as ImportFormat, label: 'CSV', icon: FileText },
    { value: 'xlsx' as ImportFormat, label: 'Excel', icon: FileSpreadsheet },
    { value: 'json' as ImportFormat, label: 'JSON', icon: FileJson },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/teacher/questions')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-xl font-semibold">Import Questions</h1>
      </div>

      <AnimatePresence mode="wait">
        {importResult ? (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card>
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                <div className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-2xl',
                  importResult.failed.length === 0 ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'
                )}>
                  <CheckCircle2 size={28} />
                </div>
                <h2 className="font-display text-lg font-semibold">Import Complete</h2>
                <p className="text-sm text-muted-foreground">
                  {importResult.imported} question{importResult.imported === 1 ? '' : 's'} imported successfully and added to your Question Bank.
                </p>
                {importResult.failed.length > 0 && (
                  <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-left text-xs">
                    <p className="mb-1 font-medium text-amber-600">{importResult.failed.length} row(s) failed to save:</p>
                    <ul className="space-y-0.5 text-muted-foreground">
                      {importResult.failed.map((f, i) => (
                        <li key={i}>Row {f.row.rowNumber}: {f.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetFile}>Import Another File</Button>
                  <Button onClick={() => navigate('/teacher/questions')}>Go to Question Bank</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Format selection */}
            <Card>
              <CardContent className="p-5">
                <label className="mb-2 block text-xs font-medium text-muted-foreground">1. Choose a file format</label>
                <div className="grid grid-cols-3 gap-3">
                  {formatOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setFormat(opt.value); resetFile(); }}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all',
                        format === opt.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/30 dark:border-border-dark'
                      )}
                      style={{ minHeight: 44 }}
                    >
                      <opt.icon size={24} />
                      <span className="text-sm font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Template download */}
            <Card>
              <CardContent className="flex items-center justify-between gap-3 p-5">
                <div>
                  <p className="text-sm font-medium">2. Download the template</p>
                  <p className="text-xs text-muted-foreground">
                    Columns: Question, Option A–D, Correct Answer (A/B/C/D), Explanation, Difficulty (Easy/Medium/Hard), Category.
                  </p>
                </div>
                <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2 shrink-0">
                  <Download size={16} /> Template
                </Button>
              </CardContent>
            </Card>

            {/* File upload */}
            <Card>
              <CardContent className="p-5">
                <label className="mb-2 block text-xs font-medium text-muted-foreground">3. Upload your filled-in file</label>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border py-8 transition-colors hover:border-primary dark:border-border-dark"
                >
                  <Upload size={32} className="text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {fileName ? fileName : `Click to upload a ${format.toUpperCase()} file`}
                  </span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept={format === 'csv' ? '.csv' : format === 'xlsx' ? '.xlsx,.xls' : '.json'}
                  className="hidden"
                  onChange={handleFile}
                />
                {parseError && (
                  <p className="mt-3 flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-500">
                    <AlertTriangle size={14} className="shrink-0" /> {parseError}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Preview */}
            {preview && (
              <Card>
                <CardContent className="p-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
                    <h2 className="text-sm font-semibold">4. Preview &amp; Validate</h2>
                    <div className="flex gap-3 text-xs">
                      <span className="text-muted-foreground">{preview.totalRows} total</span>
                      <span className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 size={14} /> {preview.valid.length} valid
                      </span>
                      {preview.invalid.length > 0 && (
                        <span className="flex items-center gap-1 text-red-500">
                          <XCircle size={14} /> {preview.invalid.length} invalid
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-border dark:border-border-dark" />

                  <div className="max-h-96 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/30 dark:bg-white/5">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">#</th>
                          <th className="px-3 py-2 text-left font-medium">Question</th>
                          <th className="px-3 py-2 text-left font-medium">Options</th>
                          <th className="px-3 py-2 text-left font-medium">Correct</th>
                          <th className="px-3 py-2 text-left font-medium">Difficulty</th>
                          <th className="px-3 py-2 text-left font-medium">Category</th>
                          <th className="px-3 py-2 text-left font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border dark:divide-border-dark">
                        {preview.all.map((item) => (
                          <tr key={item.rowNumber} className={!item.valid ? 'bg-red-500/5' : undefined}>
                            <td className="px-3 py-2 text-muted-foreground">{item.rowNumber}</td>
                            <td className="max-w-[220px] truncate px-3 py-2">{item.row.question || <span className="italic text-muted-foreground">(empty)</span>}</td>
                            <td className="max-w-[240px] px-3 py-2">
                              <ul className="space-y-0.5">
                                {[item.row.optionA, item.row.optionB, item.row.optionC, item.row.optionD].map((opt, i) => (
                                  opt.trim() ? (
                                    <li key={i} className={cn('truncate', OPTION_LETTERS[i] === item.row.correctAnswer && 'font-medium text-emerald-600')}>
                                      {OPTION_LETTERS[i]}. {opt}
                                    </li>
                                  ) : null
                                ))}
                              </ul>
                            </td>
                            <td className="px-3 py-2">{item.row.correctAnswer || '—'}</td>
                            <td className="px-3 py-2 capitalize">{item.row.difficulty}</td>
                            <td className="px-3 py-2">{item.row.category || <span className="text-muted-foreground">—</span>}</td>
                            <td className="px-3 py-2">
                              {item.valid ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600">
                                  <CheckCircle2 size={12} /> Valid
                                </span>
                              ) : (
                                <span
                                  title={item.reasons.join('; ')}
                                  className="inline-flex cursor-help items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 font-medium text-red-500"
                                >
                                  <XCircle size={12} /> {item.reasons[0]}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {preview && (
              <Button
                onClick={handleImport}
                disabled={importing || preview.valid.length === 0}
                className="w-full"
              >
                {importing
                  ? 'Importing...'
                  : preview.valid.length === 0
                    ? 'No valid rows to import'
                    : `Import ${preview.valid.length} Question${preview.valid.length === 1 ? '' : 's'}`}
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}