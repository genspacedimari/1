import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Crown, Medal, Globe, Building2, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useQuizStore } from '@/features/quiz/store';
import { useAuthStore } from '@/stores/authStore';
import { fetchMyRanks } from '@/features/quiz/services';
import type { LeaderboardScope } from '@/features/quiz/types';
import { supabase } from '@/services/supabaseClient';
import { cn } from '@/utils/cn';

const SCOPES: { value: LeaderboardScope; label: string; icon: typeof Globe }[] = [
  { value: 'global', label: 'Global', icon: Globe },
  { value: 'school', label: 'Community', icon: Building2 },
  { value: 'class', label: 'Class', icon: Users },
];

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { leaderboard, loadLeaderboard } = useQuizStore();
  const profile = useAuthStore((s) => s.profile);
  const [scope, setScope] = useState<LeaderboardScope>('global');
  const [ranks, setRanks] = useState<{ global: number | null; school: number | null; class: number | null }>({ global: null, school: null, class: null });
  const [hasSchool, setHasSchool] = useState(false);
  const [hasClass, setHasClass] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetchMyRanks().then(setRanks).catch(() => {});
  }, []);

  useEffect(() => {
    // Check if user has school and class
    async function checkMembership() {
      if (profile?.schoolId) {
        setHasSchool(true);
      } else {
        setHasSchool(false);
      }
      const { data: cs } = await supabase
        .from('class_students')
        .select('id')
        .eq('student_id', useAuthStore.getState().user?.id ?? '')
        .limit(1);
      setHasClass((cs ?? []).length > 0);
    }
    checkMembership();
  }, [profile?.schoolId]);

  useEffect(() => {
    setPage(0);
    loadLeaderboard(scope, undefined, 0);
  }, [scope, loadLeaderboard]);

  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboards' }, () => {
        loadLeaderboard(scope, undefined, page);
        fetchMyRanks().then(setRanks).catch(() => {});
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [scope, page, loadLeaderboard]);

  const rankIcons = [Crown, Medal, Trophy];
  const rankColors = ['#F26B3A', '#9CA3AF', '#D97706'];

  const handleScopeChange = (newScope: LeaderboardScope) => {
    if (newScope === 'school' && !hasSchool) return;
    if (newScope === 'class' && !hasClass) return;
    setScope(newScope);
  };

  const showEmptyState = (scope === 'school' && !hasSchool) || (scope === 'class' && !hasClass);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/quiz/history')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-2xl font-semibold">Leaderboard</h1>
      </div>

      {/* Your Rank cards */}
      <div className="grid grid-cols-3 gap-3">
        <RankCard label="Global" rank={ranks.global} icon={Globe} color="#F26B3A" active={scope === 'global'} onClick={() => handleScopeChange('global')} />
        <RankCard label="Community" rank={ranks.school} icon={Building2} color="#0891B2" active={scope === 'school'} disabled={!hasSchool} onClick={() => handleScopeChange('school')} />
        <RankCard label="Class" rank={ranks.class} icon={Users} color="#D97706" active={scope === 'class'} disabled={!hasClass} onClick={() => handleScopeChange('class')} />
      </div>

      {/* Scope tabs */}
      <div className="flex gap-2">
        {SCOPES.map((s) => {
          const disabled = (s.value === 'school' && !hasSchool) || (s.value === 'class' && !hasClass);
          return (
            <button
              key={s.value}
              onClick={() => handleScopeChange(s.value)}
              disabled={disabled}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-medium transition-all',
                scope === s.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/30 dark:border-border-dark',
                disabled && 'cursor-not-allowed opacity-40'
              )}
              style={{ minHeight: 44 }}
            >
              <s.icon size={16} /> {s.label}
            </button>
          );
        })}
      </div>

      {/* Leaderboard list */}
      {showEmptyState ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Trophy size={32} className="text-muted-foreground/50" />
            {scope === 'school' && !hasSchool && (
              <p className="text-sm text-muted-foreground">You haven't joined a community yet. Use the invite code from your teacher to join.</p>
            )}
            {scope === 'class' && !hasClass && (
              <p className="text-sm text-muted-foreground">You haven't joined a class yet. Use a class code to join.</p>
            )}
          </CardContent>
        </Card>
      ) : leaderboard.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Trophy size={32} className="text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No entries yet. Complete exams to climb the ranks!</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {leaderboard.map((entry, i) => {
              const RankIcon = rankIcons[i] ?? null;
              const rankColor = rankColors[i] ?? '#6B7280';
              const isMe = profile && entry.studentName === profile.fullName;
              return (
                <motion.div key={entry.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                  <Card className={cn(isMe && 'border-2 border-primary')}>
                    <CardContent className={cn('flex items-center gap-3 p-4', i < 3 && 'border-2')} style={i < 3 ? { borderColor: `${rankColor}40` } : undefined}>
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-display text-sm font-bold"
                        style={{ backgroundColor: `${rankColor}15`, color: rankColor }}
                      >
                        {RankIcon ? <RankIcon size={20} /> : entry.rank ?? (i + 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn('truncate text-sm font-medium', isMe && 'text-primary')}>{entry.studentName}{isMe && ' (You)'}</p>
                        <p className="text-xs text-muted-foreground">{entry.examCount} exams · {entry.avgScore} avg</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-display text-lg font-semibold text-primary">{entry.totalXp}</p>
                        <p className="text-xs text-muted-foreground">XP</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
          <button
            onClick={() => { const p = page + 1; setPage(p); loadLeaderboard(scope, undefined, p); }}
            className="w-full rounded-2xl border border-border py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/30 dark:border-border-dark"
            style={{ minHeight: 44 }}
          >
            Load More
          </button>
        </>
      )}
    </div>
  );
}

function RankCard({ label, rank, icon: Icon, color, active, disabled, onClick }: {
  label: string; rank: number | null; icon: typeof Globe; color: string; active: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-2xl border p-3 text-center transition-all',
        active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/20 dark:border-border-dark',
        disabled && 'cursor-not-allowed opacity-40'
      )}
      style={{ minHeight: 70 }}
    >
      <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15`, color }}>
        <Icon size={14} />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-semibold">{rank ? `#${rank}` : '-'}</p>
    </button>
  );
}
