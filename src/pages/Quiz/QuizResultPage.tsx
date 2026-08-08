import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, CircleCheck as CheckCircle2, Circle as XCircle, Award, TrendingUp, ArrowRight, RotateCcw, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';

export default function QuizResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useAuthStore((s) => s.profile);

  const result = (location.state as { score: number; correct: number; wrong: number; xp: number } | null) ?? { score: 0, correct: 0, wrong: 0, xp: 0 };

  const passed = result.score >= 70;
  const itemVar = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };
  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };

  return (
    <div className="mx-auto max-w-md">
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
        {/* Score card */}
        <motion.div variants={itemVar}>
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="flex h-20 w-20 items-center justify-center rounded-full"
                style={{ backgroundColor: passed ? '#22C55E15' : '#F26B3A15' }}
              >
                <Trophy size={36} style={{ color: passed ? '#22C55E' : '#F26B3A' }} />
              </motion.div>

              <div>
                <p className="font-display text-4xl font-bold" style={{ color: passed ? '#22C55E' : '#F26B3A' }}>
                  {result.score}%
                </p>
                <p className="mt-1 text-sm font-medium" style={{ color: passed ? '#22C55E' : '#F26B3A' }}>
                  {passed ? 'PASSED' : 'NOT PASSED'}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats grid */}
        <motion.div variants={itemVar} className="grid grid-cols-2 gap-3">
          <StatCard icon={CheckCircle2} label="Correct" value={result.correct} color="#22C55E" />
          <StatCard icon={XCircle} label="Wrong" value={result.wrong} color="#EF4444" />
          <StatCard icon={Award} label="XP Earned" value={`+${result.xp}`} color="#F26B3A" />
          <StatCard icon={TrendingUp} label="Status" value={passed ? 'Pass' : 'Fail'} color={passed ? '#22C55E' : '#EF4444'} />
        </motion.div>

        {/* XP progress */}
        <motion.div variants={itemVar}>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total XP</span>
                <span className="font-display text-lg font-semibold text-primary">{profile?.xp ?? 0}</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted/60 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${((profile?.xp ?? 0) % 1000) / 10}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Level {profile?.level ?? 1} · {1000 - ((profile?.xp ?? 0) % 1000)} XP to next level
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Actions */}
        <motion.div variants={itemVar} className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate('/quiz/review')}>
            <Eye size={16} /> Review
          </Button>
          <Button className="flex-1" onClick={() => navigate('/quiz/history')}>
            History <ArrowRight size={16} />
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

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Trophy; label: string; value: string | number; color: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}15`, color }}>
          <Icon size={20} />
        </div>
        <p className="font-display text-xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
