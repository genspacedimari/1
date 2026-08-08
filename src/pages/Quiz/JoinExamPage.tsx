import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, KeyRound, CircleAlert as AlertCircle, Clock, FileText, User, RefreshCw, CalendarClock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuizStore } from '@/features/quiz/store';
import type { ExamInfo } from '@/features/quiz/types';
import {
  getExamRunState,
  canJoinExam,
  getExamStartDateTime,
  getExamEndTimeLabel,
  formatExamDate,
  formatCountdown,
} from '@/features/teacher-portal/examSchedule';

export default function JoinExamPage() {
  const navigate = useNavigate();
  const { joinExam, loading } = useQuizStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [examInfo, setExamInfo] = useState<ExamInfo | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!examInfo) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [examInfo]);

  const handleValidate = async () => {
    setError(null);
    if (code.trim().length < 5) {
      setError('Enter a valid exam code');
      return;
    }
    const exam = await joinExam(code.trim());
    if (!exam) {
      setError('Exam not found. Check the code and try again.');
      setExamInfo(null);
    } else if (exam.attemptsRemaining <= 0) {
      setError('No attempts remaining for this exam.');
      setExamInfo(null);
    } else {
      setNow(new Date());
      setExamInfo(exam);
    }
  };

  const runState = examInfo ? getExamRunState(examInfo, now) : null;
  const canJoin = examInfo ? canJoinExam(examInfo, now) : false;

  const scheduleMessage = (() => {
    if (!examInfo) return null;
    if (runState === 'not_started') {
      const start = getExamStartDateTime(examInfo);
      const countdown = start ? formatCountdown(start.getTime() - now.getTime()) : null;
      return `Exam has not started. ${countdown ? `Starts in ${countdown}.` : ''}`.trim();
    }
    if (runState === 'finished') {
      return 'This exam has finished and is no longer accepting students.';
    }
    if (runState === 'running' && !canJoin) {
      return 'The late join window for this exam has closed.';
    }
    return null;
  })();

  const handleStart = async () => {
    if (examInfo && canJoin) {
      await useQuizStore.getState().startExam(examInfo);
      navigate('/quiz/exam/player');
    }
  };

  const inputClass = 'w-full rounded-2xl border border-border bg-surface px-4 py-3 text-center font-mono text-lg tracking-wider outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark';

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/quiz')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-xl font-semibold">Join Teacher Exam</h1>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-center pb-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <KeyRound size={28} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Exam Code</label>
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
              placeholder="PLC-XXXXXX"
              className={inputClass}
              maxLength={20}
              style={{ minHeight: 44 }}
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <Button onClick={handleValidate} disabled={loading} className="w-full" size="lg">
            {loading ? 'Validating...' : 'Validate Code'}
          </Button>
        </CardContent>
      </Card>

      <AnimatePresence>
        {examInfo && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card>
              <CardContent className="space-y-4 p-5">
                <div>
                  <h2 className="font-display text-lg font-semibold">{examInfo.name}</h2>
                  {examInfo.description && <p className="mt-1 text-sm text-muted-foreground">{examInfo.description}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <InfoRow icon={User} label="Teacher" value={examInfo.teacherName} />
                  <InfoRow icon={Clock} label="Duration" value={`${examInfo.durationMinutes} min`} />
                  <InfoRow icon={FileText} label="Questions" value={`${examInfo.questionCount}`} />
                  <InfoRow icon={RefreshCw} label="Attempts Left" value={`${examInfo.attemptsRemaining}`} />
                  {examInfo.examDate && examInfo.startTime && (
                    <InfoRow
                      icon={CalendarClock}
                      label="Schedule"
                      value={`${formatExamDate(examInfo.examDate)} · ${examInfo.startTime} - ${getExamEndTimeLabel(examInfo)}`}
                    />
                  )}
                </div>

                <AnimatePresence>
                  {scheduleMessage && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400"
                    >
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <span>{scheduleMessage}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button onClick={handleStart} disabled={!canJoin} className="w-full" size="lg">
                  Start Exam
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={16} className="shrink-0 text-muted-foreground" />
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
