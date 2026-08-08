import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, ChevronRight, Trophy, Cpu, ListChecks, BookOpen, Globe, Building2, Users, Crown, Medal, KeyRound, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuthStore } from '@/stores/authStore';
import { fetchLeaderboard } from '@/features/quiz/services';
import type { LeaderboardEntry } from '@/features/quiz/types';
import { supabase } from '@/services/supabaseClient';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const rankIcons = [Crown, Medal, Trophy];
const rankColors = ['#F26B3A', '#9CA3AF', '#D97706'];

export default function HomePage() {
  const profile = useAuthStore((s) => s.profile);
  const navigate = useNavigate();
  const [globalLb, setGlobalLb] = useState<LeaderboardEntry[]>([]);
  const [schoolLb, setSchoolLb] = useState<LeaderboardEntry[]>([]);
  const [classLb, setClassLb] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    fetchLeaderboard('global', undefined, 0, 5).then(setGlobalLb).catch(() => {});
    if (profile?.schoolId) {
      fetchLeaderboard('school', profile.schoolId, 0, 5).then(setSchoolLb).catch(() => {});
    }
    async function loadClassLb() {
      const sid = useAuthStore.getState().user?.id;
      if (!sid) return;
      const { data: cs } = await supabase
        .from('class_students')
        .select('class_id')
        .eq('student_id', sid)
        .order('joined_at', { ascending: false })
        .limit(1);
      const classRows = (cs ?? []) as Array<{ class_id: string }>;
      if (classRows.length > 0) {
        fetchLeaderboard('class', classRows[0].class_id, 0, 5).then(setClassLb).catch(() => {});
      }
    }
    loadClassLb();
  }, [profile?.schoolId]);

  const xpForNextLevel = (profile?.level ?? 1) * 1000;
  const xpProgress = profile ? Math.min(100, (profile.xp / xpForNextLevel) * 100) : 0;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="mx-auto flex max-w-5xl flex-col gap-4">
      {/* Welcome Banner */}
      <motion.div variants={item} className="relative overflow-hidden rounded-3xl glass p-6 md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-40 blur-3xl" style={{ background: 'radial-gradient(circle, #F26B3A 0%, transparent 70%)' }} />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Halo, {profile?.fullName ?? 'Student'} 👋</p>
            <h2 className="mt-1 font-display text-2xl font-semibold md:text-3xl">Lanjut belajar PLC hari ini?</h2>
            {profile && (
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <Badge variant="default"><Flame size={12} className="mr-1 text-primary" /> Level {profile.level}</Badge>
                <span>{profile.xp} XP</span>
                {profile.schoolName && <Badge variant="muted">{profile.schoolName}</Badge>}
              </div>
            )}
          </div>
          {profile && (
            <Badge variant="default" className="hidden sm:inline-flex">
              <Flame size={14} className="text-primary" />
              {profile.xp} XP
            </Badge>
          )}
        </div>
        {profile && (
          <div className="relative mt-4 max-w-xs">
            <Progress value={xpProgress} />
            <p className="mt-1 text-xs text-muted-foreground">{profile.xp} / {xpForNextLevel} XP to Level {profile.level + 1}</p>
          </div>
        )}
      </motion.div>

      {/* Bento grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {/* Continue Project — wide tile */}
        <motion.div variants={item} className="col-span-2 md:col-span-2 md:row-span-2">
          <Card className="flex h-full flex-col justify-between">
            <CardContent className="flex h-full flex-col justify-between p-5">
              <div>
                <Badge variant="muted">Simulator PLC</Badge>
                <h3 className="mt-3 font-display text-lg font-semibold">Buat & Simulasi Ladder</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Rancang ladder logic, jalankan simulasi real-time, dan simpan project kamu.
                </p>
              </div>
              <div className="mt-6 space-y-3">
                <Button className="w-full" onClick={() => navigate('/simulator')}>
                  Buka Simulator <ChevronRight size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Global Leaderboard preview */}
        <motion.div variants={item} className="col-span-1 md:col-span-2">
          <Card className="h-full">
            <CardContent className="p-5">
              <button onClick={() => navigate('/quiz/leaderboard')} className="mb-3 flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe size={16} className="text-primary" />
                  <h3 className="text-sm font-semibold">Top 5 Global</h3>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
              <LeaderboardPreview entries={globalLb} />
            </CardContent>
          </Card>
        </motion.div>

        {/* School Leaderboard preview */}
        <motion.div variants={item} className="col-span-1 md:col-span-2">
          <Card className="h-full">
            <CardContent className="p-5">
              <button onClick={() => navigate('/quiz/leaderboard')} className="mb-3 flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-primary" />
                  <h3 className="text-sm font-semibold">Top 5 Community</h3>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
              {schoolLb.length > 0 ? <LeaderboardPreview entries={schoolLb} /> : (
                <p className="py-4 text-center text-xs text-muted-foreground">Join a community to see community rankings.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Class Leaderboard preview */}
        <motion.div variants={item} className="col-span-2 md:col-span-2">
          <Card className="h-full">
            <CardContent className="p-5">
              <button onClick={() => navigate('/quiz/leaderboard')} className="mb-3 flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-primary" />
                  <h3 className="text-sm font-semibold">Top 5 Class</h3>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
              {classLb.length > 0 ? <LeaderboardPreview entries={classLb} /> : (
                <p className="py-4 text-center text-xs text-muted-foreground">Join a class to see class rankings.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Join Community card — for students without a community */}
      {profile?.role === 'student' && !profile.schoolId && (
        <motion.div variants={item}>
          <Card className="border-primary/30">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <KeyRound size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-base font-semibold">Join Learning Community</h3>
                  <p className="text-xs text-muted-foreground">Enter the invite code from your teacher to join.</p>
                </div>
                <Button onClick={() => navigate('/join-community')} size="lg">Join <ArrowRight size={16} /></Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Feature cards — quick access */}
      <motion.div variants={item} className="grid grid-cols-3 gap-3">
        {[
          { label: 'Simulator', icon: Cpu, to: '/simulator' },
          { label: 'Quiz', icon: ListChecks, to: '/quiz' },
          { label: 'Materi', icon: BookOpen, to: '/materials' },
        ].map((f) => (
          <Link key={f.label} to={f.to}>
            <Card className="hover:bg-white/70 dark:hover:bg-white/10 transition-colors">
              <CardContent className="flex flex-col items-center gap-2 py-5 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <f.icon size={20} />
                </div>
                <span className="text-xs font-medium">{f.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </motion.div>
    </motion.div>
  );
}

function LeaderboardPreview({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">No data yet. Complete exams to appear here!</p>;
  }
  return (
    <div className="space-y-2.5">
      {entries.map((u, i) => {
        const RankIcon = rankIcons[i];
        const rankColor = rankColors[i] ?? '#6B7280';
        return (
          <div key={u.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {RankIcon ? <RankIcon size={14} style={{ color: rankColor }} /> : <span className="text-muted-foreground">{i + 1}.</span>}
              <span className="truncate">{u.studentName}</span>
            </div>
            <span className="text-xs text-muted-foreground">{u.totalXp} XP</span>
          </div>
        );
      })}
    </div>
  );
}
