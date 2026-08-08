import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Award, Clock, Star, Search, WifiOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuizStore } from '@/features/quiz/store';
import type { OfficialQuiz } from '@/features/quiz/types';


const STORAGE_KEY = 'genspace_official_quiz_cache';

export default function OfficialQuizPage() {
  const navigate = useNavigate();
  const { officialQuizzes, loading, loadOfficialQuizzes } = useQuizStore();
  const [search, setSearch] = useState('');
  const [cached, setCached] = useState<OfficialQuiz[]>([]);

  useEffect(() => {
    loadOfficialQuizzes();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCached(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [loadOfficialQuizzes]);

  useEffect(() => {
    if (officialQuizzes.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(officialQuizzes));
      setCached(officialQuizzes);
    }
  }, [officialQuizzes]);

  const display = officialQuizzes.length > 0 ? officialQuizzes : cached;
  const filtered = display.filter((q) => q.title.toLowerCase().includes(search.toLowerCase()));

  const diffColor: Record<string, string> = {
    easy: '#22C55E',
    medium: '#F26B3A',
    hard: '#EF4444',
  };

  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
  const itemVar = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/quiz')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-display text-xl font-semibold">Official Quizzes</h1>
          <p className="text-xs text-muted-foreground">GENSPACE-curated PLC quizzes</p>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search quizzes..."
          className="w-full rounded-2xl border border-border bg-surface pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
          style={{ minHeight: 44 }}
        />
      </div>

      {loading && display.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/30 dark:bg-white/5" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Award size={32} className="text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {cached.length > 0 ? 'No quizzes match your search.' : 'No official quizzes available yet.'}
            </p>
            {cached.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <WifiOff size={14} /> Showing cached quizzes (offline)
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
          {filtered.map((quiz) => (
            <motion.div key={quiz.id} variants={itemVar}>
              <Card>
                <CardContent className="flex items-start gap-4 p-4">
                  {quiz.thumbnailUrl ? (
                    <img src={quiz.thumbnailUrl} alt={quiz.title} className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Award size={28} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-sm font-semibold">{quiz.title}</h3>
                    {quiz.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{quiz.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="flex items-center gap-1" style={{ color: diffColor[quiz.difficulty] }}>
                        <Star size={12} /> {quiz.difficulty}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Award size={12} /> {quiz.questionCount} Q
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock size={12} /> {quiz.estimatedMinutes} min
                      </span>
                      <Badge variant="outline" className="text-primary">+{quiz.xpReward} XP</Badge>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/quiz/official/${quiz.id}`)}
                    className="shrink-0 rounded-2xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    style={{ minHeight: 44 }}
                  >
                    Start
                  </button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
