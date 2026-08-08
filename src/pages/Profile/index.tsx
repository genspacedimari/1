import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, LogOut, Trash2, Lock, Check, CircleAlert as AlertCircle, Eye, EyeOff, ChevronRight, Mail, AtSign, User as UserIcon, Shield, Building2, TrendingUp, Target, Award, Trophy, Zap, FileText, Medal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/services/supabaseClient';
import { cn } from '@/utils/cn';

const ROLE_LABEL: Record<string, string> = {
  student: 'Student',
  teacher: 'Teacher',
  admin: 'Admin',
};

function avatarInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const isGuest = useAuthStore((s) => s.isGuest);
  const status = useAuthStore((s) => s.status);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const changePassword = useAuthStore((s) => s.changePassword);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const signOut = useAuthStore((s) => s.signOut);
  const fileRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [schoolId, setSchoolId] = useState<string | null>(profile?.schoolId ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [showPwdForm, setShowPwdForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSaved, setPwdSaved] = useState(false);

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmGuestExit, setConfirmGuestExit] = useState(false);

  // --- Guest mode: show a simplified profile card ---
  if (isGuest) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground dark:bg-white/5">
              <UserIcon size={28} />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">Guest Mode</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You are using the app as a guest. Your simulator projects are saved locally but
                online features are unavailable.
              </p>
            </div>
            <div className="mt-2 flex gap-3">
              <Button variant="outline" onClick={() => setConfirmGuestExit(true)}>
                <LogOut size={16} /> Exit Guest
              </Button>
              <Button onClick={() => navigate('/login')}>
                Sign In
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="mb-2 text-sm font-semibold">Guest access</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>PLC Simulator</li>
              <li>Create & manage projects</li>
              <li>Import / Export projects</li>
              <li>Settings</li>
            </ul>
            <div className="mt-4 border-t border-border pt-3 dark:border-border-dark">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Not available</p>
              <ul className="space-y-2 text-sm text-muted-foreground/60">
                <li>Teacher Portal</li>
                <li>Online Ranking</li>
                <li>Cloud Sync</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <ConfirmDialog
          open={confirmGuestExit}
          title="Exit Guest Mode"
          message="You will be redirected to the login screen. Your locally saved projects will remain on this device."
          confirmLabel="Exit Guest"
          onConfirm={() => {
            useAuthStore.getState().exitGuest();
            setConfirmGuestExit(false);
            navigate('/login', { replace: true });
          }}
          onCancel={() => setConfirmGuestExit(false)}
        />
      </div>
    );
  }

  if (!profile) {
    // If authenticated but profile is null, profile loading failed — show retry, not "sign in"
    if (status === 'authenticated') {
      return (
        <div className="mx-auto max-w-md text-center">
          <p className="text-sm text-muted-foreground">Couldn't load your profile.</p>
          <Button className="mt-4" onClick={() => refreshProfile()}>Retry</Button>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-sm text-muted-foreground">Please sign in to view your profile.</p>
        <Button className="mt-4" onClick={() => navigate('/login')}>Sign In</Button>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await updateProfile({ fullName, username, bio, schoolId });
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setSaveError(null);
    try {
      const ext = file.name.split('.').pop() ?? 'png';
      const path = `${profile.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      await updateProfile({ avatarUrl: pub.publicUrl });
      await refreshProfile();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePasswordSave = async () => {
    setPwdError(null);
    if (newPassword.length < 8) {
      setPwdError('Password must be at least 8 characters');
      return;
    }
    try {
      await changePassword(newPassword);
      setNewPassword('');
      setShowPwdForm(false);
      setPwdSaved(true);
      setTimeout(() => setPwdSaved(false), 3000);
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Failed to change password');
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    try {
      await deleteAccount();
      navigate('/login', { replace: true });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to delete account');
    }
  };

  const handleLogout = async () => {
    setConfirmLogout(false);
    await signOut();
    navigate('/login', { replace: true });
  };

  const xp = profile.xp;
  const xpForNext = profile.level * 1000;
  const percent = Math.min(100, Math.round((xp / xpForNext) * 100));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      {/* Header */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.fullName}
                  className="h-16 w-16 rounded-2xl object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 font-display text-xl font-semibold text-primary">
                  {avatarInitials(profile.fullName)}
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ minHeight: 28 }}
                aria-label="Change photo"
              >
                <Camera size={14} />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
            <div>
              {editing ? (
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="rounded-xl border border-border bg-surface px-2 py-1 font-display text-lg font-semibold outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                />
              ) : (
                <h2 className="font-display text-lg font-semibold">{profile.fullName}</h2>
              )}
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline">
                  <Shield size={12} /> {ROLE_LABEL[profile.role] ?? profile.role}
                </Badge>
                <span className="text-xs text-muted-foreground">Lv {profile.level}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="font-display text-xl font-semibold text-primary">{profile.xp}</p>
              <p className="text-[10px] text-muted-foreground">XP</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* XP progress */}
      <div className="-mt-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {xp} / {xpForNext} XP to Level {profile.level + 1}
        </p>
      </div>

      {/* Profile details */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-5 py-4">
            <h3 className="text-sm font-semibold">Account Details</h3>
            <button
              onClick={() => {
                if (editing) {
                  setFullName(profile.fullName);
                  setUsername(profile.username);
                  setBio(profile.bio ?? '');
                  setSchoolId(profile?.schoolId ?? null);
                  setSaveError(null);
                }
                setEditing(!editing);
              }}
              className="text-sm font-medium text-primary transition-opacity hover:opacity-80"
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
          </div>
          <div className="border-t border-border dark:border-border-dark" />

          <div className="px-5 py-4 space-y-4">
            <DetailRow icon={UserIcon} label="Full Name">
              {editing ? (
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full max-w-[60%] rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                />
              ) : (
                <span className="text-sm font-medium">{profile.fullName}</span>
              )}
            </DetailRow>

            <DetailRow icon={AtSign} label="Username">
              {editing ? (
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full max-w-[60%] rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                />
              ) : (
                <span className="text-sm font-medium">@{profile.username}</span>
              )}
            </DetailRow>

            <DetailRow icon={Mail} label="Email">
              <span className="text-sm font-medium">{profile.email}</span>
            </DetailRow>

            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UserIcon size={18} />
                </div>
                <span className="text-sm text-muted-foreground">Bio</span>
              </div>
              {editing ? (
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  className="w-full max-w-[60%] rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                  placeholder="Tell us about yourself"
                />
              ) : (
                <span className="max-w-[60%] text-right text-sm font-medium">
                  {profile.bio || 'No bio yet'}
                </span>
              )}
            </div>

            {/* Community */}
            <div className="border-t border-border pt-4 dark:border-border-dark">
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 size={18} />
                </div>
                <span className="text-sm text-muted-foreground">Community</span>
              </div>
              <div className="ml-12">
                {profile.schoolName ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => navigate('/community')} style={{ minHeight: 44 }}>
                      <Badge variant="default"><Building2 size={12} className="mr-1" /> {profile.schoolName}</Badge>
                    </button>
                    {!editing && profile.role === 'student' && (
                      <button onClick={() => navigate('/join-community')} className="text-xs text-primary hover:underline" style={{ minHeight: 44 }}>Leave / Join another</button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">No community joined</span>
                    {!editing && (
                      <button onClick={() => navigate('/join-community')} className="text-xs text-primary hover:underline" style={{ minHeight: 44 }}>Join now</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {saveError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mx-5 mb-4 flex items-start gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{saveError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {editing && (
            <div className="px-5 pb-5">
              <Button onClick={handleSave} disabled={saving} className="w-full">
                <Check size={16} /> {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Academic Information */}
      <AcademicInfoCard profile={profile} />

      {/* Change password */}
      <Card>
        <CardContent className="p-0">
          <button
            onClick={() => setShowPwdForm(!showPwdForm)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/30 dark:hover:bg-white/5"
            style={{ minHeight: 44 }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Lock size={18} />
              </div>
              <div>
                <p className="text-sm font-medium">Change Password</p>
                <p className="text-xs text-muted-foreground">Update your account password</p>
              </div>
            </div>
            <ChevronRight size={16} className={cn('text-muted-foreground transition-transform', showPwdForm && 'rotate-90')} />
          </button>

          <AnimatePresence>
            {showPwdForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-border px-5 py-4 dark:border-border-dark">
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (min 8 characters)"
                      className="w-full rounded-2xl border border-border bg-surface px-4 py-3 pr-12 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                      style={{ minHeight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-label={showPwd ? 'Hide' : 'Show'}
                    >
                      {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {pwdError && <p className="mt-2 text-xs text-red-500">{pwdError}</p>}
                  {pwdSaved && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <Check size={12} /> Password updated successfully
                    </p>
                  )}
                  <Button onClick={handlePasswordSave} className="mt-3 w-full">
                    Update Password
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card>
        <CardContent className="p-0">
          <button
            onClick={() => setConfirmLogout(true)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/30 dark:hover:bg-white/5"
            style={{ minHeight: 44 }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <LogOut size={18} />
              </div>
              <p className="text-sm font-medium">Log Out</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
          <div className="border-t border-border dark:border-border-dark" />
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-red-500/5"
            style={{ minHeight: 44 }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                <Trash2 size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-red-500">Delete Account</p>
                <p className="text-xs text-muted-foreground">This cannot be undone</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmLogout}
        title="Log Out"
        message="You will be signed out of your account. You can sign back in anytime."
        confirmLabel="Log Out"
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete Account"
        message="This will permanently delete your account and profile data. This action cannot be undone."
        confirmLabel="Delete Account"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof UserIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={18} />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}

interface AcademicData {
  schoolName: string | null;
  className: string | null;
  teacherName: string | null;
  level: number;
  xp: number;
  averageScore: number;
  examsCompleted: number;
  accuracy: number;
  globalRank: number | null;
  schoolRank: number | null;
  classRank: number | null;
}

function AcademicInfoCard({ profile }: { profile: { id: string; schoolId?: string | null; schoolName?: string | null; xp: number; level: number } }) {
  const [data, setData] = useState<AcademicData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const sid = profile.id;
        // Fetch student_progress
        const { data: progress } = await supabase
          .from('student_progress')
          .select('*')
          .eq('student_id', sid)
          .maybeSingle();
        const sp = progress as { total_xp: number; level: number; exams_completed: number } | null;

        // Fetch all completed attempts for stats
        const { data: attempts } = await supabase
          .from('exam_attempts')
          .select('score, correct_count, wrong_count, exam_id')
          .eq('student_id', sid)
          .eq('status', 'completed');
        const att = (attempts ?? []) as Array<{ score: number; correct_count: number; wrong_count: number; exam_id: string }>;
        const totalCorrect = att.reduce((s, a) => s + a.correct_count, 0);
        const totalWrong = att.reduce((s, a) => s + a.wrong_count, 0);
        const avgScore = att.length > 0 ? Math.round(att.reduce((s, a) => s + a.score, 0) / att.length) : 0;
        const accuracy = (totalCorrect + totalWrong) > 0
          ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100)
          : 0;

        // Class info
        let className: string | null = null;
        let teacherName: string | null = null;
        const { data: csRows } = await supabase
          .from('class_students')
          .select('classes!inner(id, name, teacher_id)')
          .eq('student_id', sid)
          .order('joined_at', { ascending: false })
          .limit(1);
        const csRow = (csRows ?? []) as unknown as Array<{ classes: { id: string; name: string; teacher_id: string } }> | null;
        if (csRow && csRow.length > 0) {
          className = csRow[0].classes.name;
          const { data: teacher } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', csRow[0].classes.teacher_id)
            .maybeSingle();
          teacherName = (teacher as { full_name: string } | null)?.full_name ?? null;
        }

        // Ranks from leaderboards
        const { data: globalLb } = await supabase
          .from('leaderboards')
          .select('id, scope, scope_id, ranking_score')
          .eq('scope', 'global')
          .order('ranking_score', { ascending: false });
        const globalRows = (globalLb ?? []) as Array<{ id: string; ranking_score: number }>;
        // We need student_id to find rank, but RLS may not let us read all rows.
        // Instead, query our own row and count how many have higher score.
        const { data: myGlobal } = await supabase
          .from('leaderboards')
          .select('ranking_score')
          .eq('scope', 'global')
          .eq('student_id', sid)
          .maybeSingle();
        let globalRank: number | null = null;
        if (myGlobal) {
          const myScore = (myGlobal as { ranking_score: number }).ranking_score;
          const higher = globalRows.filter((r) => r.ranking_score > myScore).length;
          globalRank = higher + 1;
        }

        // School rank
        let schoolRank: number | null = null;
        if (profile.schoolId) {
          const { data: schoolLb } = await supabase
            .from('leaderboards')
            .select('student_id, ranking_score')
            .eq('scope', 'school')
            .eq('school_id', profile.schoolId)
            .order('ranking_score', { ascending: false });
          const schoolRows = (schoolLb ?? []) as Array<{ student_id: string; ranking_score: number }>;
          const idx = schoolRows.findIndex((r) => r.student_id === sid);
          schoolRank = idx >= 0 ? idx + 1 : null;
        }

        // Class rank
        let classRank: number | null = null;
        if (csRow && csRow.length > 0) {
          const classId = csRow[0].classes.id;
          const { data: classLb } = await supabase
            .from('leaderboards')
            .select('student_id, ranking_score')
            .eq('scope', 'class')
            .eq('scope_id', classId)
            .order('ranking_score', { ascending: false });
          const classRows = (classLb ?? []) as Array<{ student_id: string; ranking_score: number }>;
          const idx = classRows.findIndex((r) => r.student_id === sid);
          classRank = idx >= 0 ? idx + 1 : null;
        }

        if (!cancelled) {
          setData({
            schoolName: profile.schoolName ?? null,
            className,
            teacherName,
            level: sp?.level ?? profile.level,
            xp: sp?.total_xp ?? profile.xp,
            averageScore: avgScore,
            examsCompleted: sp?.exams_completed ?? att.length,
            accuracy,
            globalRank,
            schoolRank,
            classRank,
          });
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [profile.id, profile.schoolId, profile.schoolName, profile.xp, profile.level]);

  const xpForNextLevel = (data?.level ?? 1) * 1000;
  const xpProgress = data ? Math.min(100, (data.xp / xpForNextLevel) * 100) : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Loading academic info...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <h2 className="text-sm font-semibold">Academic Information</h2>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <AcademicStat label="Community" value={data.schoolName ?? 'Not set'} icon={Building2} color="#0891B2" />
          <AcademicStat label="Class" value={data.className ?? 'Not joined'} icon={UserIcon} color="#059669" />
          <AcademicStat label="Teacher" value={data.teacherName ?? '-'} icon={Shield} color="#F26B3A" />
          <AcademicStat label="Level" value={data.level} icon={Zap} color="#D97706" />
          <AcademicStat label="XP" value={data.xp} icon={Zap} color="#F26B3A" />
          <AcademicStat label="Exams Completed" value={data.examsCompleted} icon={FileText} color="#059669" />
          <AcademicStat label="Average Score" value={data.averageScore} icon={TrendingUp} color="#D97706" />
          <AcademicStat label="Accuracy" value={`${data.accuracy}%`} icon={Target} color="#22C55E" />
        </div>

        {/* Ranks */}
        <div className="grid grid-cols-3 gap-3">
          <RankCard label="Global" rank={data.globalRank} icon={Trophy} color="#F26B3A" />
          <RankCard label="Community" rank={data.schoolRank} icon={Award} color="#0891B2" />
          <RankCard label="Class" rank={data.classRank} icon={Medal} color="#D97706" />
        </div>

        {/* XP Progress */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">XP Progress</span>
            <span className="font-medium">{data.xp} / {xpForNextLevel}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted/40 dark:bg-white/10">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${xpProgress}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AcademicStat({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: typeof FileText; color: string }) {
  return (
    <div className="rounded-2xl border border-border p-3 dark:border-border-dark">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15`, color }}>
          <Icon size={14} />
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1.5 truncate font-display text-sm font-semibold">{value}</p>
    </div>
  );
}

function RankCard({ label, rank, icon: Icon, color }: { label: string; rank: number | null; icon: typeof Trophy; color: string }) {
  return (
    <div className="rounded-2xl border border-border p-3 text-center dark:border-border-dark">
      <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15`, color }}>
        <Icon size={16} />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-semibold">{rank ? `#${rank}` : '-'}</p>
    </div>
  );
}
