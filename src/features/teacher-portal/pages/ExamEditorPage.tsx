import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, RefreshCw, Search, X, Clock, Award, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTeacherStore } from '../store';
import { regenerateExamCode } from '../services';
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS } from '../types';
import {
  getExamEndTimeLabel,
  DURATION_MINUTES_MIN,
  DURATION_MINUTES_MAX,
  LATE_JOIN_MINUTES_MIN,
  LATE_JOIN_MINUTES_MAX,
} from '../examSchedule';
import { cn } from '@/utils/cn';

export function ExamEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const { questions, classes, loadClasses, loadExams, loadQuestions, createExam, updateExam, setExamQuestions } = useTeacherStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [examDate, setExamDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [lateJoinMinutes, setLateJoinMinutes] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [passingScore, setPassingScore] = useState(70);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [showResultAfter, setShowResultAfter] = useState(true);
  const [allowReview, setAllowReview] = useState(true);
  const [examCode, setExamCode] = useState('');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<'school' | 'selected_class'>('selected_class');
  const [targetAllClasses, setTargetAllClasses] = useState(false);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const dirtyRef = useRef(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  useEffect(() => {
    loadQuestions();
    loadClasses();
    if (isEdit) {
      loadExams().then(() => {
        const exam = useTeacherStore.getState().exams.find((e) => e.id === id);
        if (exam) {
          setName(exam.name);
          setDescription(exam.description ?? '');
          setDuration(exam.durationMinutes);
          setExamDate(exam.examDate ?? '');
          setStartTime(exam.startTime ?? '');
          setLateJoinMinutes(exam.lateJoinMinutes ?? 0);
          setMaxAttempts(exam.maxAttempts);
          setPassingScore(exam.passingScore);
          setShuffleQuestions(exam.shuffleQuestions);
          setShuffleAnswers(exam.shuffleAnswers);
          setShowResultAfter(exam.showResultAfter);
          setAllowReview(exam.allowReview);
          setExamCode(exam.examCode);
          setVisibility(exam.visibility ?? 'selected_class');
          setTargetAllClasses(exam.targetAllClasses ?? false);
          setSelectedClassIds(exam.classIds ?? []);
          setSelectedQuestionIds(exam.questionIds);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Auto-save every 30s when editing
  useEffect(() => {
    if (!isEdit || !id) return;
    const interval = setInterval(() => {
      if (dirtyRef.current) { handleSave(true); }
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  const handleSave = async (auto = false) => {
    if (saving) return; // guard against double-submit (double-click / auto-save overlap)
    if (!name.trim()) { if (!auto) alert('Exam name is required'); return; }
    if (!examDate) { if (!auto) alert('Exam Date is required'); return; }
    if (!startTime) { if (!auto) alert('Start Time is required'); return; }
    if (duration < DURATION_MINUTES_MIN || duration > DURATION_MINUTES_MAX) {
      if (!auto) alert(`Duration must be between ${DURATION_MINUTES_MIN} and ${DURATION_MINUTES_MAX} minutes`);
      return;
    }
    if (lateJoinMinutes < LATE_JOIN_MINUTES_MIN || lateJoinMinutes > LATE_JOIN_MINUTES_MAX) {
      if (!auto) alert(`Late Join Tolerance must be between ${LATE_JOIN_MINUTES_MIN} and ${LATE_JOIN_MINUTES_MAX} minutes`);
      return;
    }
    setSaving(true);
    try {
      const input = {
        name,
        description,
        durationMinutes: duration,
        examDate,
        startTime,
        lateJoinMinutes,
        maxAttempts,
        passingScore,
        shuffleQuestions,
        shuffleAnswers,
        showResultAfter,
        allowReview,
        visibility,
        targetAllClasses,
        classIds: visibility === 'selected_class' ? (targetAllClasses ? [] : selectedClassIds) : undefined,
      };
      if (isEdit && id) {
        await updateExam(id, input);
        await setExamQuestions(id, selectedQuestionIds);
      } else {
        // Single insert with the full payload — no more create → reload →
        // guess-the-array-index → update round trip. The exam id comes
        // straight back from the insert, so there's no race with a
        // second exam being created concurrently.
        const created = await createExam(input);
        await setExamQuestions(created.id, selectedQuestionIds);
        setCreatedId(created.id);
      }
      dirtyRef.current = false;
      if (auto) { setSaveIndicator(true); setTimeout(() => setSaveIndicator(false), 1500); }
      else navigate('/teacher/exams');
    } catch (err) {
      console.error('[EXAM_EDITOR] save failed:', err instanceof Error ? err.message : err);
      if (!auto) alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateCode = async () => {
    const targetId = id ?? createdId;
    if (!targetId) return;
    setRegenerating(true);
    try {
      const newCode = await regenerateExamCode(targetId);
      setExamCode(newCode);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to regenerate code');
    } finally {
      setRegenerating(false);
    }
  };

  const toggleQuestion = (qid: string) => {
    setSelectedQuestionIds((prev) => prev.includes(qid) ? prev.filter((x) => x !== qid) : [...prev, qid]);
    dirtyRef.current = true;
  };

  const filteredQuestions = questions.filter((q) =>
    q.question.toLowerCase().includes(search.toLowerCase())
  );

  const inputClass = 'w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none transition-colors focus:border-primary dark:border-border-dark dark:bg-surface-dark';
  const toggleClass = (on: boolean) => cn(
    'relative h-6 w-11 rounded-full transition-colors',
    on ? 'bg-primary' : 'bg-muted/60 dark:bg-white/10'
  );

  const Toggle = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => { onChange(!on); dirtyRef.current = true; }} className={toggleClass(on)} style={{ minHeight: 24 }}>
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', on ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/teacher/exams')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-xl font-semibold">{isEdit ? 'Edit Exam' : 'New Exam'}</h1>
            {saveIndicator && <p className="text-xs text-emerald-600">Saved</p>}
          </div>
        </div>
        <Button onClick={() => handleSave(false)} disabled={saving}>
          <Save size={16} /> {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* Exam code */}
      {examCode && (
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Exam Code</p>
              <p className="font-mono text-lg font-semibold text-primary">{examCode}</p>
            </div>
            <button onClick={handleRegenerateCode} disabled={regenerating} className="flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted/30 dark:border-border-dark" style={{ minHeight: 44 }}>
              <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} /> Regenerate
            </button>
          </CardContent>
        </Card>
      )}

      {/* Settings */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Exam Name</label>
            <input value={name} onChange={(e) => { setName(e.target.value); dirtyRef.current = true; }} className={inputClass} placeholder="Mid-term Exam" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Description</label>
            <textarea value={description} onChange={(e) => { setDescription(e.target.value); dirtyRef.current = true; }} rows={2} className={inputClass} placeholder="Exam description..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground"><Clock size={12} /> Duration (minutes)</label>
              <input type="number" value={duration} onChange={(e) => { setDuration(Number(e.target.value)); dirtyRef.current = true; }} className={inputClass} min={DURATION_MINUTES_MIN} max={DURATION_MINUTES_MAX} />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground"><Award size={12} /> Passing Score (%)</label>
              <input type="number" value={passingScore} onChange={(e) => { setPassingScore(Number(e.target.value)); dirtyRef.current = true; }} className={inputClass} min={0} max={100} />
            </div>
          </div>

          {/* Classroom scheduling */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Exam Date</label>
              <input type="date" value={examDate} onChange={(e) => { setExamDate(e.target.value); dirtyRef.current = true; }} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Start Time</label>
              <input type="time" value={startTime} onChange={(e) => { setStartTime(e.target.value); dirtyRef.current = true; }} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Late Join Tolerance (minutes)</label>
              <input type="number" value={lateJoinMinutes} onChange={(e) => { setLateJoinMinutes(Number(e.target.value)); dirtyRef.current = true; }} className={inputClass} min={LATE_JOIN_MINUTES_MIN} max={LATE_JOIN_MINUTES_MAX} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Exam Ends At</label>
              <input type="text" value={startTime ? getExamEndTimeLabel({ examDate, startTime, durationMinutes: duration, lateJoinMinutes }) : '--:--'} readOnly disabled className={cn(inputClass, 'cursor-not-allowed opacity-70')} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Max Attempts</label>
            <input type="number" value={maxAttempts} onChange={(e) => { setMaxAttempts(Number(e.target.value)); dirtyRef.current = true; }} className={inputClass} min={1} />
          </div>

          {/* Exam Visibility */}
          <div className="border-t border-border pt-3 dark:border-border-dark">
            <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground"><Eye size={12} /> Exam Visibility</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'school', label: 'Community' },
                { value: 'selected_class', label: 'Class' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setVisibility(opt.value); dirtyRef.current = true; }}
                  className={cn(
                    'rounded-2xl border px-3 py-2.5 text-sm font-medium transition-all',
                    visibility === opt.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/20 dark:border-border-dark'
                  )}
                  style={{ minHeight: 44 }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {visibility === 'school' && 'All members of your community can see and take this exam.'}
              {visibility === 'selected_class' && 'Only students in selected classes can see and take this exam.'}
            </p>

            {visibility === 'selected_class' && (
              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={targetAllClasses}
                    onChange={(e) => { setTargetAllClasses(e.target.checked); dirtyRef.current = true; }}
                    className="h-4 w-4 rounded border-border"
                  />
                  All my classes
                </label>
                {!targetAllClasses && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Select classes:</p>
                    <div className="max-h-40 overflow-y-auto space-y-1 rounded-2xl border border-border p-2 dark:border-border-dark">
                      {classes.length === 0 ? (
                        <p className="px-2 py-1.5 text-xs text-muted-foreground">No classes available. Create a class first.</p>
                      ) : (
                        classes.map((c) => (
                          <label key={c.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-muted/20 dark:hover:bg-white/5">
                            <input
                              type="checkbox"
                              checked={selectedClassIds.includes(c.id)}
                              onChange={(e) => {
                                setSelectedClassIds((prev) =>
                                  e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)
                                );
                                dirtyRef.current = true;
                              }}
                              className="h-4 w-4 rounded border-border"
                            />
                            <span className="truncate">{c.name}</span>
                            <span className="ml-auto text-xs text-muted-foreground">{c.studentCount} students</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Toggles */}
          <div className="space-y-3 border-t border-border pt-3 dark:border-border-dark">
            <ToggleRow label="Shuffle Questions" on={shuffleQuestions} onChange={setShuffleQuestions} toggle={Toggle} />
            <ToggleRow label="Shuffle Answers" on={shuffleAnswers} onChange={setShuffleAnswers} toggle={Toggle} />
            <ToggleRow label="Show Result After Submit" on={showResultAfter} onChange={setShowResultAfter} toggle={Toggle} />
            <ToggleRow label="Allow Review" on={allowReview} onChange={setAllowReview} toggle={Toggle} />
          </div>
        </CardContent>
      </Card>

      {/* Question selection */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-sm font-semibold">Questions ({selectedQuestionIds.length} selected)</h2>
          </div>
          <div className="border-t border-border px-5 py-3 dark:border-border-dark">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions..." className="w-full rounded-2xl border border-border bg-surface pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark" style={{ minHeight: 44 }} />
            </div>
          </div>
          <div className="border-t border-border dark:border-border-dark" />
          <div className="max-h-80 overflow-y-auto divide-y divide-border dark:divide-border-dark">
            {filteredQuestions.map((q) => {
              const selected = selectedQuestionIds.includes(q.id);
              return (
                <button
                  key={q.id}
                  onClick={() => toggleQuestion(q.id)}
                  className={cn('flex w-full items-center gap-3 px-5 py-3 text-left transition-colors', selected ? 'bg-primary/5' : 'hover:bg-muted/20 dark:hover:bg-white/5')}
                  style={{ minHeight: 44 }}
                >
                  <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors', selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border dark:border-border-dark')}>
                    {selected && <X size={12} className="rotate-45" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{q.question}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{QUESTION_TYPE_LABELS[q.type]}</span>
                      <span>{DIFFICULTY_LABELS[q.difficulty]}</span>
                      <span>{q.points} pts</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleRow({ label, on, onChange, toggle: Toggle }: {
  label: string; on: boolean; onChange: (v: boolean) => void;
  toggle: (props: { on: boolean; onChange: (v: boolean) => void }) => React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}