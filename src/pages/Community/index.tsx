import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Building2, Users, FileText, GraduationCap, Copy, Check, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/stores/authStore';
import { fetchCommunityById, fetchCommunityMembers, fetchCommunityClasses } from '@/services/communityService';
import type { Community } from '@/services/communityService';

/**
 * Read-only "who's in my community" view, available to any member
 * (teacher or student). Editing/deleting the community still lives in
 * the teacher-only /teacher/community page.
 */
export default function CommunityViewPage() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);

  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<{ teachers: { id: string; fullName: string; email: string }[]; students: { id: string; fullName: string; email: string }[] } | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string; joinCode: string; teacherName: string; studentCount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!profile?.schoolId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const c = await fetchCommunityById(profile.schoolId);
        if (cancelled) return;
        setCommunity(c);
      } catch (err) {
        console.error('Failed to load community:', err);
        if (!cancelled) setError('Failed to load your community.');
      }

      try {
        const m = await fetchCommunityMembers(profile.schoolId);
        if (!cancelled) setMembers(m);
      } catch (err) {
        console.error('Failed to load community members:', err);
      }

      try {
        const cls = await fetchCommunityClasses(profile.schoolId);
        if (!cancelled) setClasses(cls);
      } catch (err) {
        console.error('Failed to load community classes:', err);
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [profile?.schoolId]);

  const handleCopy = () => {
    if (!community?.inviteCode) return;
    navigator.clipboard.writeText(community.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!profile?.schoolId) {
    // Teachers and admins can either create a new community or join an
    // existing one. Students can only join. Creation itself lives in the
    // /welcome wizard (same flow used right after signup) — we just make
    // it reachable from here too, since previously the only way to reach
    // it was a one-time redirect during onboarding.
    const canCreate = profile?.role === 'teacher' || profile?.role === 'admin';
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Header navigate={navigate} />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Building2 size={32} className="text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">You haven't joined a community yet.</p>
            <div className="flex items-center gap-4">
              {canCreate && (
                <button onClick={() => navigate('/welcome')} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                  <Plus size={14} /> Create a community
                </button>
              )}
              <button onClick={() => navigate('/join-community')} className="text-sm font-medium text-primary hover:underline">Join a community</button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Header navigate={navigate} />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading community...</CardContent></Card>
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Header navigate={navigate} />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{error ?? 'Community not found.'}</CardContent></Card>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-2xl space-y-4">
      <Header navigate={navigate} />

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Building2 size={24} /></div>
            <div>
              <h2 className="font-display text-lg font-semibold">{community.name}</h2>
              <p className="text-xs text-muted-foreground">{community.city}, {community.province}, {community.country}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={GraduationCap} label="Students" value={members?.students.length ?? 0} color="#059669" />
            <Stat icon={Users} label="Teachers" value={members?.teachers.length ?? 0} color="#0891B2" />
            <Stat icon={FileText} label="Classes" value={classes.length} color="#F26B3A" />
          </div>
          {community.inviteCode && (
            <div className="flex items-center gap-2 rounded-2xl bg-muted/30 p-3 dark:bg-white/5">
              <span className="text-xs text-muted-foreground">Invite Code</span>
              <span className="flex-1 truncate text-right font-mono text-sm font-semibold text-primary">{community.inviteCode}</span>
              <button onClick={handleCopy} className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-muted/40 dark:hover:bg-white/5">
                {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} className="text-muted-foreground" />}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Teachers</h2>
          {members && members.teachers.length > 0 ? (
            <div className="space-y-2">
              {members.teachers.map((t) => (
                <button key={t.id} onClick={() => navigate(`/u/${t.id}`)} className="flex w-full items-center gap-3 rounded-2xl bg-muted/20 p-3 text-left transition-colors hover:bg-muted/40 dark:bg-white/5 dark:hover:bg-white/10">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600"><Users size={16} /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{t.fullName}</p><p className="truncate text-xs text-muted-foreground">{t.email}</p></div>
                  {t.id === community.ownerTeacherId && <span className="text-xs font-medium text-primary">Owner</span>}
                </button>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No teachers.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Classes</h2>
            {profile?.role === 'student' && (
              <button
                onClick={() => navigate('/quiz/join-class')}
                className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"
              >
                <Plus size={14} /> Join Class
              </button>
            )}
          </div>
          {classes.length > 0 ? (
            <div className="space-y-2">
              {classes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/class/${c.id}`)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-muted/20 p-3 text-left transition-colors hover:bg-muted/40 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText size={16} /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.teacherName} · {c.studentCount} students</p></div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <p className="text-sm text-muted-foreground">No classes yet.</p>
              {profile?.role === 'student' && (
                <button
                  onClick={() => navigate('/quiz/join-class')}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Have a class code? Join a class
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Students</h2>
          {members && members.students.length > 0 ? (
            <div className="space-y-2">
              {members.students.map((s) => (
                <button key={s.id} onClick={() => navigate(`/u/${s.id}`)} className="flex w-full items-center gap-3 rounded-2xl bg-muted/20 p-3 text-left transition-colors hover:bg-muted/40 dark:bg-white/5 dark:hover:bg-white/10">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><GraduationCap size={16} /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{s.fullName}</p><p className="truncate text-xs text-muted-foreground">{s.email}</p></div>
                </button>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No students yet.</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Header({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
        <ArrowLeft size={20} />
      </button>
      <h1 className="font-display text-xl font-semibold">Community</h1>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: typeof FileText; label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border border-border p-3 text-center dark:border-border-dark">
      <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15`, color }}><Icon size={16} /></div>
      <p className="font-display text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
