import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, KeyRound, CircleAlert as AlertCircle, Building2, User, Users, FileText, Check, ChevronRight, LogOut } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { lookupCommunityByCode, joinCommunity, leaveCommunity, fetchAvailableClassesForCommunity } from '@/services/communityService';
import type { CommunityPreview } from '@/services/communityService';
import { supabase } from '@/services/supabaseClient';

interface ClassOption {
  id: string;
  name: string;
  joinCode: string;
  teacherName: string;
  studentCount: number;
}

export default function JoinCommunityPage() {
  const navigate = useNavigate();
  const params = useParams<{ code?: string }>();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  const [code, setCode] = useState(params.code ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CommunityPreview | null>(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [showClasses, setShowClasses] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const handleValidate = async () => {
    setError(null);
    setPreview(null);
    if (code.trim().length < 5) {
      setError('Enter a valid community invite code');
      return;
    }
    setLoading(true);
    try {
      const result = await lookupCommunityByCode(code);
      if (!result) {
        setError('Community not found. Check the code and try again.');
        return;
      }
      setPreview(result);
    } catch {
      setError('Failed to validate community code.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!preview || !user) return;
    setJoining(true);
    setError(null);
    try {
      await joinCommunity(preview.id, user.id);
      await refreshProfile();
      // Joining the community itself succeeded at this point — everything
      // after this must NEVER be reported back to the user as a failed
      // join. Fetching the class list is best-effort only.
      setJoined(true);
      setShowClasses(true);
      try {
        const cls = await fetchAvailableClassesForCommunity(preview.id);
        setClasses(cls);
      } catch (err) {
        console.error('Failed to load available classes:', err);
        setClasses([]);
      }
    } catch (err) {
      console.error('Failed to join community:', err);
      setError(err instanceof Error ? err.message : 'Failed to join community.');
    } finally {
      setJoining(false);
    }
  };

  const handleJoinClass = async (cls: ClassOption) => {
    if (!user) return;
    try {
      const { error: joinErr } = await supabase.from('class_students').insert({ class_id: cls.id, student_id: user.id });
      if (joinErr) throw joinErr;
      navigate('/quiz');
    } catch (err) {
      console.error('Failed to join class:', err);
      setError('Failed to join class.');
    }
  };

  const handleLeave = async () => {
    if (!user) return;
    setLeaving(true);
    setLeaveError(null);
    try {
      await leaveCommunity(user.id);
      await refreshProfile();
      // After leaving, fall through to the join form below.
    } catch (err) {
      console.error('Failed to leave community:', err);
      setLeaveError(err instanceof Error ? err.message : 'Failed to leave community.');
    } finally {
      setLeaving(false);
    }
  };

  const inputClass = 'w-full rounded-2xl border border-border bg-surface px-4 py-3 text-center font-mono text-lg tracking-wider outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark';

  // If already in a community, show a Leave button so switching communities
  // doesn't require a trip back to the Profile page.
  if (profile?.schoolId && !joined) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-display text-xl font-semibold">Join Community</h1>
        </div>
        <Card>
          <CardContent className="space-y-4 p-6 text-center">
            <p className="text-sm text-muted-foreground">You are already in a community. Leave it to join a new one.</p>
            {leaveError && (
              <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-left text-sm text-red-600 dark:text-red-400">
                <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{leaveError}</span>
              </div>
            )}
            <Button variant="outline" onClick={handleLeave} disabled={leaving} className="w-full text-red-600 border-red-500/30">
              <LogOut size={16} /> {leaving ? 'Leaving...' : 'Leave Community'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-xl font-semibold">Join Community</h1>
      </div>

      {!showClasses && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-center pb-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <KeyRound size={28} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Community Invite Code</label>
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); setPreview(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
                placeholder="GEN-XXXX-XXXX"
                className={inputClass}
                maxLength={20}
                style={{ minHeight: 44 }}
              />
            </div>
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>
            <Button onClick={handleValidate} disabled={loading} className="w-full" size="lg">
              {loading ? 'Validating...' : 'Validate Code'}
            </Button>
          </CardContent>
        </Card>
      )}

      <AnimatePresence>
        {preview && !joined && !showClasses && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card>
              <CardContent className="space-y-4 p-5">
                <div>
                  <h2 className="font-display text-lg font-semibold">{preview.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Review the community details before joining.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow icon={User} label="Teacher" value={preview.ownerTeacherName ?? 'Unknown'} />
                  <InfoRow icon={Building2} label="Location" value={`${preview.city}, ${preview.province}`} />
                  <InfoRow icon={FileText} label="Classes" value={`${preview.totalClasses}`} />
                  <InfoRow icon={Users} label="Students" value={`${preview.totalStudents}`} />
                </div>
                <div className="rounded-2xl bg-muted/30 p-3 text-center dark:bg-white/5">
                  <p className="text-xs text-muted-foreground">Invite Code</p>
                  <p className="font-mono text-lg font-semibold text-primary">{preview.inviteCode}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setPreview(null); setCode(''); }} className="flex-1">Cancel</Button>
                  <Button onClick={handleJoin} disabled={joining} className="flex-1">
                    {joining ? 'Joining...' : 'Join Community'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {joined && showClasses && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card>
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <Check size={28} />
                </div>
                <p className="text-sm font-medium">Successfully joined {preview?.name}!</p>
                <p className="text-xs text-muted-foreground">Now join a class to start learning.</p>
              </CardContent>
            </Card>

            <div>
              <h2 className="mb-3 text-sm font-semibold">Available Classes</h2>
              {classes.length === 0 ? (
                <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No classes available yet. Ask your teacher for a class join code.</CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {classes.map((cls) => (
                    <Card key={cls.id}>
                      <CardContent className="flex items-center gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{cls.name}</p>
                          <p className="text-xs text-muted-foreground">{cls.teacherName} · {cls.studentCount} students</p>
                        </div>
                        <Button onClick={() => handleJoinClass(cls)} size="sm">Join</Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              <button onClick={() => navigate('/')} className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground" style={{ minHeight: 44 }}>
                Skip for now <ChevronRight size={14} className="inline" />
              </button>
            </div>
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
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
