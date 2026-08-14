import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PartyPopper, ArrowRight, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuizStore } from '@/features/quiz/store';
import { getRandomPostSubmitMessage } from '@/utils/postSubmitMessages';

export default function QuizResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeExam = useQuizStore((s) => s.activeExam);

  // Read once per mount so the message doesn't change on re-render.
  const [message] = useState(getRandomPostSubmitMessage);

  // location.state carries { score, correct, wrong, xp } from submitExam(), but
  // per poin 5 the score is intentionally never shown here — students only see
  // it once everyone assigned to the exam has finished (via the leaderboard link
  // below, gated server-side by get_exam_leaderboard()).
  const xpEarned = (location.state as { xp?: number } | null)?.xp ?? 0;

  const itemVar = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };
  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };

  return (
    <div className="mx-auto max-w-md">
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
        <motion.div variants={itemVar}>
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"
              >
                <PartyPopper size={36} className="text-primary" />
              </motion.div>
              <div>
                <p className="font-display text-xl font-bold">Selesai mengerjakan!</p>
                <p className="mt-2 text-sm text-muted-foreground">{message}</p>
              </div>
              <p className="rounded-2xl bg-muted/30 px-4 py-3 text-xs text-muted-foreground dark:bg-white/5">
                Nilai baru akan tampil di leaderboard setelah semua peserta selesai mengerjakan exam ini.
                {xpEarned > 0 && <> Kamu tetap dapat <b>+{xpEarned} XP</b> untuk usahamu.</>}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVar} className="flex gap-3">
          <Button
            className="flex-1"
            disabled={!activeExam}
            onClick={() => activeExam && navigate(`/quiz/exam/${activeExam.id}/leaderboard`)}
          >
            Leaderboard <ArrowRight size={16} />
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => navigate('/quiz/history')}>
            History
          </Button>
        </motion.div>

        <motion.div variants={itemVar}>
          <Button variant="ghost" className="w-full" onClick={() => navigate('/quiz')}>
            <RotateCcw size={16} /> Back to Quiz
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
