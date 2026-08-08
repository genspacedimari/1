import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Dumbbell, FileText, Clock, Award } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuizStore } from '@/features/quiz/store';

export default function QuizHistoryPage() {
  const navigate = useNavigate();
  const { practiceHistory, examHistory, loadPracticeHistory, loadExamHistory } = useQuizStore();

  useEffect(() => {
    loadPracticeHistory();
    loadExamHistory();
  }, [loadPracticeHistory, loadExamHistory]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString();
  const fmtDuration = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">History</h1>
        <button
          onClick={() => navigate('/quiz/leaderboard')}
          className="flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted/30 dark:border-border-dark"
          style={{ minHeight: 44 }}
        >
          <Award size={16} /> Leaderboard
        </button>
      </div>

      {/* Exam history */}
      <div>
        <h2 className="mb-2 text-sm font-semibold">Recent Exams</h2>
        {examHistory.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
              <FileText size={20} className="text-muted-foreground/50" /> No exams completed yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {examHistory.map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.examName}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock size={12} /> {fmtDuration(item.timeUsedSeconds)}</span>
                        <span>{fmtDate(item.submittedAt ?? item.startedAt)}</span>
                        <Badge variant={item.status === 'completed' ? 'success' : 'muted'}>{item.status}</Badge>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-lg font-semibold text-primary">{item.score}%</p>
                      <p className="text-xs text-muted-foreground">{item.correctCount}/{item.correctCount + item.wrongCount}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Practice history */}
      <div>
        <h2 className="mb-2 text-sm font-semibold">Recent Practice</h2>
        {practiceHistory.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
              <Dumbbell size={20} className="text-muted-foreground/50" /> No practice sessions yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {practiceHistory.map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.category}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="capitalize">{item.difficulty}</span>
                        <span className="flex items-center gap-1"><Clock size={12} /> {fmtDuration(item.durationSeconds)}</span>
                        <span>{fmtDate(item.completedAt)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-lg font-semibold text-primary">{item.score}%</p>
                      <p className="text-xs text-muted-foreground">{item.correctCount}/{item.totalQuestions}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
