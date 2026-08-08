import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Upload, Image as ImageIcon, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTeacherStore } from '../store';
import { uploadQuestionImage } from '../services';
import {
  QUESTION_TYPE_LABELS, LADDER_MODE_LABELS, type QuestionType, type Difficulty, type LadderMode,
} from '../types';
import { cn } from '@/utils/cn';

export function QuestionEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const {
    categories, loadQuestions, loadCategories, createQuestion, updateQuestion,
  } = useTeacherStore();

  const [type, setType] = useState<QuestionType>('multiple_choice');
  const [questionText, setQuestionText] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [points, setPoints] = useState(10);
  const [explanation, setExplanation] = useState('');
  const [options, setOptions] = useState<{ label: string; isCorrect: boolean }[]>([
    { label: '', isCorrect: false },
    { label: '', isCorrect: false },
  ]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [ladderMode, setLadderMode] = useState<LadderMode>('build');
  const [ladderJson, setLadderJson] = useState<string>('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [answerLadderJson, setAnswerLadderJson] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [uploading, setUploading] = useState(false);
  const dirtyRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load existing question
  useEffect(() => {
    loadCategories();
    if (isEdit) {
      loadQuestions().then(() => {
        const q = useTeacherStore.getState().questions.find((q) => q.id === id);
        if (q) {
          setType(q.type);
          setQuestionText(q.question);
          setCategoryId(q.categoryId ?? '');
          setDifficulty(q.difficulty);
          setPoints(q.points);
          setExplanation(q.explanation ?? '');
          setOptions(q.options.length > 0 ? q.options.map((o) => ({ label: o.label, isCorrect: o.isCorrect })) : [{ label: '', isCorrect: false }, { label: '', isCorrect: false }]);
          setImageUrls(q.images.map((i) => i.imageUrl));
          if (q.ladderData) {
            setLadderMode(q.ladderData.mode);
            setLadderJson(q.ladderData.ladderJson ?? '');
            setExpectedOutput(q.ladderData.expectedOutput ?? '');
            setAnswerLadderJson(q.ladderData.answerLadderJson ?? '');
          }
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const markDirty = useCallback(() => { dirtyRef.current = true; }, []);

  // Auto-save every 30 seconds when editing
  useEffect(() => {
    if (!isEdit) return;
    const interval = setInterval(() => {
      if (dirtyRef.current) {
        handleSave(true);
      }
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  const handleSave = async (auto = false) => {
    if (saving) return; // guard against double-submit (double-click / auto-save overlap)
    if (!questionText.trim()) {
      if (!auto) alert('Question text is required');
      return;
    }
    if (type === 'multiple_choice' || type === 'image') {
      const filled = options.filter((o) => o.label.trim());
      if (filled.length < 2) {
        if (!auto) alert('At least two options are required');
        return;
      }
      if (!filled.some((o) => o.isCorrect)) {
        if (!auto) alert('Mark one option as the correct answer');
        return;
      }
    }
    setSaving(true);
    try {
      const input = {
        categoryId: categoryId || null,
        type,
        question: questionText,
        difficulty,
        points,
        explanation: explanation || null,
        options: type === 'multiple_choice' ? options.filter((o) => o.label.trim()).map((o, i) => ({ ...o, sortOrder: i })) : undefined,
        images: type === 'image' ? imageUrls.map((url) => ({ imageUrl: url })) as { imageUrl: string }[] : undefined,
        ladderData: type === 'ladder' ? {
          mode: ladderMode,
          ladderJson: ladderJson || null,
          expectedOutput: expectedOutput || null,
          answerLadderJson: answerLadderJson || null,
        } : null,
      };
      if (isEdit && id) {
        await updateQuestion(id, input);
      } else {
        await createQuestion(input);
      }
      dirtyRef.current = false;
      if (auto) {
        setSaveIndicator(true);
        setTimeout(() => setSaveIndicator(false), 1500);
      } else {
        navigate('/teacher/questions');
      }
    } catch (err) {
      console.error('[QUESTION_EDITOR] save failed:', err instanceof Error ? err.message : err);
      if (!auto) alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const url = await uploadQuestionImage(file);
        setImageUrls((prev) => [...prev, url]);
        markDirty();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const inputClass = 'w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none transition-colors focus:border-primary dark:border-border-dark dark:bg-surface-dark';

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/teacher/questions')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/40 dark:hover:bg-white/5">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-xl font-semibold">{isEdit ? 'Edit Question' : 'New Question'}</h1>
            {saveIndicator && <p className="text-xs text-emerald-600 dark:text-emerald-400">Saved</p>}
          </div>
        </div>
        <Button onClick={() => handleSave(false)} disabled={saving}>
          <Save size={16} /> {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* Type selector */}
      <Card>
        <CardContent className="p-5">
          <label className="mb-2 block text-xs font-medium text-muted-foreground">Question Type</label>
          <div className="grid grid-cols-3 gap-3">
            {(['multiple_choice', 'image', 'ladder'] as QuestionType[]).map((t) => (
              <button
                key={t}
                onClick={() => { setType(t); markDirty(); }}
                className={cn(
                  'rounded-2xl border p-3 text-center text-sm font-medium transition-all',
                  type === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/30 dark:border-border-dark'
                )}
                style={{ minHeight: 44 }}
              >
                {QUESTION_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Basic fields */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Question Text</label>
            <textarea
              value={questionText}
              onChange={(e) => { setQuestionText(e.target.value); markDirty(); }}
              rows={3}
              className={inputClass}
              placeholder="Enter your question..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Category</label>
              <select
                value={categoryId}
                onChange={(e) => { setCategoryId(e.target.value); markDirty(); }}
                className={inputClass}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => { setDifficulty(e.target.value as Difficulty); markDirty(); }}
                className={inputClass}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Points</label>
            <input
              type="number"
              value={points}
              onChange={(e) => { setPoints(Number(e.target.value)); markDirty(); }}
              className={inputClass}
              min={1}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Explanation (optional)</label>
            <textarea
              value={explanation}
              onChange={(e) => { setExplanation(e.target.value); markDirty(); }}
              rows={2}
              className={inputClass}
              placeholder="Explain the correct answer..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Multiple choice options */}
      {type === 'multiple_choice' && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Options</label>
              <button
                onClick={() => { setOptions([...options, { label: '', isCorrect: false }]); markDirty(); }}
                className="flex items-center gap-1 text-sm font-medium text-primary"
              >
                <Plus size={14} /> Add Option
              </button>
            </div>
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <button
                  onClick={() => { setOptions(options.map((o, i) => ({ ...o, isCorrect: i === idx }))); markDirty(); }}
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 transition-colors',
                    opt.isCorrect ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600' : 'border-border text-muted-foreground dark:border-border-dark'
                  )}
                  style={{ minHeight: 36 }}
                >
                  {opt.isCorrect ? '✓' : String.fromCharCode(65 + idx)}
                </button>
                <input
                  value={opt.label}
                  onChange={(e) => { setOptions(options.map((o, i) => i === idx ? { ...o, label: e.target.value } : o)); markDirty(); }}
                  className={inputClass}
                  placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                />
                {options.length > 2 && (
                  <button
                    onClick={() => { setOptions(options.filter((_, i) => i !== idx)); markDirty(); }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-red-500 transition-colors hover:bg-red-500/10"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Tap the circle to mark the correct answer.</p>
          </CardContent>
        </Card>
      )}

      {/* Image question */}
      {type === 'image' && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <label className="text-xs font-medium text-muted-foreground">Question Images</label>
            <div className="flex flex-wrap gap-3">
              {imageUrls.map((url, idx) => (
                <div key={idx} className="relative">
                  <img src={url} alt={`Question ${idx + 1}`} className="h-24 w-24 rounded-2xl object-cover" />
                  <button
                    onClick={() => { setImageUrls(imageUrls.filter((_, i) => i !== idx)); markDirty(); }}
                    className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex h-24 w-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary dark:border-border-dark"
              >
                {uploading ? <span className="text-xs">Uploading...</span> : (<><Upload size={20} /><span className="text-xs">Upload</span></>)}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={handleImageUpload} />

            {/* MC options for image question */}
            <div className="border-t border-border pt-3 dark:border-border-dark">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Options</label>
                <button
                  onClick={() => { setOptions([...options, { label: '', isCorrect: false }]); markDirty(); }}
                  className="flex items-center gap-1 text-sm font-medium text-primary"
                >
                  <Plus size={14} /> Add Option
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <button
                      onClick={() => { setOptions(options.map((o, i) => ({ ...o, isCorrect: i === idx }))); markDirty(); }}
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 transition-colors',
                        opt.isCorrect ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600' : 'border-border text-muted-foreground dark:border-border-dark'
                      )}
                    >
                      {opt.isCorrect ? '✓' : String.fromCharCode(65 + idx)}
                    </button>
                    <input
                      value={opt.label}
                      onChange={(e) => { setOptions(options.map((o, i) => i === idx ? { ...o, label: e.target.value } : o)); markDirty(); }}
                      className={inputClass}
                      placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                    />
                    {options.length > 2 && (
                      <button onClick={() => { setOptions(options.filter((_, i) => i !== idx)); markDirty(); }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-red-500">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ladder question */}
      {type === 'ladder' && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Ladder Mode</label>
              <select
                value={ladderMode}
                onChange={(e) => { setLadderMode(e.target.value as LadderMode); markDirty(); }}
                className={inputClass}
              >
                {Object.entries(LADDER_MODE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Ladder JSON (from the Ladder Editor)
              </label>
              <textarea
                value={ladderJson}
                onChange={(e) => { setLadderJson(e.target.value); markDirty(); }}
                rows={6}
                className={cn(inputClass, 'font-mono text-xs')}
                placeholder="Paste the ladder JSON exported from the Ladder Editor..."
              />
              <button
                onClick={() => navigate('/simulator')}
                className="mt-2 flex items-center gap-2 text-sm font-medium text-primary"
              >
                <ImageIcon size={14} /> Open Ladder Editor to create ladder
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Expected Output (optional)
              </label>
              <textarea
                value={expectedOutput}
                onChange={(e) => { setExpectedOutput(e.target.value); markDirty(); }}
                rows={3}
                className={inputClass}
                placeholder="Describe the expected output behavior..."
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Answer Ladder JSON (for complete/find_error modes)
              </label>
              <textarea
                value={answerLadderJson}
                onChange={(e) => { setAnswerLadderJson(e.target.value); markDirty(); }}
                rows={6}
                className={cn(inputClass, 'font-mono text-xs')}
                placeholder="Paste the correct/answer ladder JSON..."
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}