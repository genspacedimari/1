import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2, Users, FileText, GraduationCap, Copy, Check, RefreshCw, Trash2, Save, QrCode, CircleAlert as AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import {
  fetchCommunityById, regenerateInviteCode, updateCommunity, deleteCommunity,
  fetchCommunityMembers, fetchCommunityClasses, ensureInviteCode,
} from '@/services/communityService';
import type { Community } from '@/services/communityService';
import { useToast, ToastViewport } from '@/components/ui/toast';

export function CommunityPage() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const { toast, showToast, dismissToast } = useToast();

  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<{ teachers: { id: string; fullName: string; email: string }[]; students: { id: string; fullName: string; email: string }[] } | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string; joinCode: string; teacherName: string; studentCount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  // Distinguishes "we checked and there's genuinely no community row" from
  // "the fetch failed" — only the former should ever render "Community not found".
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editProvince, setEditProvince] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isOwner = community?.ownerTeacherId === profile?.id;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!profile?.schoolId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError(null);

      // Fetch the community independently first. Members/classes are
      // secondary data — if they fail to load (e.g. RLS restrictions on
      // other users' rows), that must NEVER block the community itself
      // from rendering. Previously this all lived in one Promise.all(),
      // so any single failure (in members or classes) left `community`
      // stuck at null and produced a false "Community not found".
      let loadedCommunity: Community | null = null;
      try {
        loadedCommunity = await fetchCommunityById(profile.schoolId);
      } catch (err) {
        console.error('Failed to load community:', err);
        if (!cancelled) {
          setLoadError('Failed to load your community. Please try again.');
          showToast('Failed to load your community.', 'error');
          setLoading(false);
        }
        return;
      }

      if (cancelled) return;

      if (loadedCommunity) {
        // Auto-generate invite code/link if this community somehow doesn't
        // have one yet (older row, or the DB trigger never fired).
        if (!loadedCommunity.inviteCode || !loadedCommunity.inviteLink) {
          try {
            loadedCommunity = await ensureInviteCode(loadedCommunity);
          } catch (err) {
            console.error('Failed to generate invite code:', err);
            showToast('Could not generate an invite code. Please try Regenerate.', 'error');
          }
        }
        setCommunity(loadedCommunity);
        setEditName(loadedCommunity.name);
        setEditCity(loadedCommunity.city);
        setEditProvince(loadedCommunity.province);
        setEditCountry(loadedCommunity.country);
      } else {
        setCommunity(null);
      }

      // Members and classes are best-effort: log + toast on failure, but
      // never let them affect the community's own loading/error state.
      try {
        const m = await fetchCommunityMembers(profile.schoolId);
        if (!cancelled) setMembers(m);
      } catch (err) {
        console.error('Failed to load community members:', err);
        if (!cancelled) showToast('Some member data could not be loaded.', 'error');
      }

      try {
        const cls = await fetchCommunityClasses(profile.schoolId);
        if (!cancelled) setClasses(cls);
      } catch (err) {
        console.error('Failed to load community classes:', err);
        if (!cancelled) showToast('Some class data could not be loaded.', 'error');
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [profile?.schoolId]);

  const handleCopy = (text: string, type: 'code' | 'link') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRegenerate = async () => {
    if (!community) return;
    try {
      const newCode = await regenerateInviteCode(community.id, community.name);
      const updated = await fetchCommunityById(community.id);
      setCommunity(updated);
      setCopied(null);
      showToast('Invite code regenerated.', 'success');
      void newCode;
    } catch (err) {
      console.error('Failed to regenerate invite code:', err);
      setError('Failed to regenerate code.');
      showToast('Failed to regenerate code.', 'error');
    }
  };

  const handleSave = async () => {
    if (!community) return;
    setSaving(true);
    setError(null);
    try {
      await updateCommunity(community.id, { name: editName, city: editCity, province: editProvince, country: editCountry });
      const updated = await fetchCommunityById(community.id);
      setCommunity(updated);
      setEditing(false);
      showToast('Community settings saved.', 'success');
    } catch (err) {
      console.error('Failed to save community settings:', err);
      setError('Failed to save settings.');
      showToast('Failed to save settings.', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!community) return;
    try {
      await deleteCommunity(community.id);
      await refreshProfile();
      showToast('Community deleted.', 'success');
    } catch (err) {
      console.error('Failed to delete community:', err);
      setError('Failed to delete community.');
      showToast('Failed to delete community.', 'error');
    }
  };

  if (loading) return <div className="mx-auto max-w-3xl text-sm text-muted-foreground">Loading...</div>;

  if (!profile?.schoolId) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card><CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground">You haven't created or joined a community yet.</p>
        </CardContent></Card>
      </div>
    );
  }

  // A load error is NOT the same as "not found" — the community likely
  // exists (profile.schoolId is set) but the fetch itself failed. Show a
  // retryable error state instead of falsely claiming it doesn't exist.
  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{loadError}</span>
        </div>
        <Button onClick={() => window.location.reload()} className="w-full">Retry</Button>
        <ToastViewport toast={toast} onDismiss={dismissToast} />
      </div>
    );
  }

  // Only reachable when the fetch succeeded but genuinely found no row.
  if (!community) {
    return (
      <div className="mx-auto max-w-3xl text-sm text-muted-foreground">
        Community not found.
        <ToastViewport toast={toast} onDismiss={dismissToast} />
      </div>
    );
  }

  const inputClass = 'w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Community</h1>
        <p className="mt-1 text-sm text-muted-foreground">{isOwner ? 'You are the owner of this community.' : 'You are a teacher in this community.'}</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* Community Info */}
      <Card>
        <CardContent className="space-y-4 p-5">
          {editing ? (
            <div className="space-y-3">
              <div><label className="mb-1 block text-xs text-muted-foreground">Name</label><input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputClass} style={{ minHeight: 44 }} /></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">City</label><input value={editCity} onChange={(e) => setEditCity(e.target.value)} className={inputClass} style={{ minHeight: 44 }} /></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">Province</label><input value={editProvince} onChange={(e) => setEditProvince(e.target.value)} className={inputClass} style={{ minHeight: 44 }} /></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">Country</label><input value={editCountry} onChange={(e) => setEditCountry(e.target.value)} className={inputClass} style={{ minHeight: 44 }} /></div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleSave} disabled={saving} className="flex-1">{saving ? 'Saving...' : 'Save'}</Button>
              </div>
            </div>
          ) : (
            <>
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
              {isOwner && (
                <Button variant="outline" onClick={() => setEditing(true)} className="w-full"><Save size={16} /> Edit Community Settings</Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Invite Code & Link */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">Invite Students</h2>
          <div className="rounded-2xl bg-muted/30 p-4 dark:bg-white/5">
            <p className="text-xs text-muted-foreground">Invite Code</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="flex-1 font-mono text-lg font-semibold text-primary">{community.inviteCode ?? 'N/A'}</p>
              <button onClick={() => community.inviteCode && handleCopy(community.inviteCode, 'code')} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted/40 dark:hover:bg-white/5" style={{ minHeight: 44 }}>
                {copied === 'code' ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} className="text-muted-foreground" />}
              </button>
            </div>
          </div>
          <div className="rounded-2xl bg-muted/30 p-4 dark:bg-white/5">
            <p className="text-xs text-muted-foreground">Invite Link</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="flex-1 truncate text-sm text-muted-foreground">{community.inviteLink ?? 'N/A'}</p>
              <button onClick={() => community.inviteLink && handleCopy(community.inviteLink, 'link')} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted/40 dark:hover:bg-white/5" style={{ minHeight: 44 }}>
                {copied === 'link' ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} className="text-muted-foreground" />}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowQR(!showQR)} className="flex-1"><QrCode size={16} /> {showQR ? 'Hide QR' : 'Show QR'}</Button>
            {isOwner && <Button variant="outline" onClick={handleRegenerate} className="flex-1"><RefreshCw size={16} /> Regenerate</Button>}
          </div>
          {showQR && community.inviteLink && (
            <div className="flex flex-col items-center gap-2 py-4">
              <QRCodePlaceholder text={community.inviteLink} />
              <p className="text-xs text-muted-foreground">Students scan this QR to join</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Teachers list */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Teachers</h2>
          {members && members.teachers.length > 0 ? (
            <div className="space-y-2">
              {members.teachers.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-muted/20 p-3 dark:bg-white/5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600"><Users size={16} /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{t.fullName}</p><p className="truncate text-xs text-muted-foreground">{t.email}</p></div>
                  {t.id === community.ownerTeacherId && <span className="text-xs font-medium text-primary">Owner</span>}
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No teachers.</p>}
        </CardContent>
      </Card>

      {/* Classes list */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Classes</h2>
          {classes.length > 0 ? (
            <div className="space-y-2">
              {classes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/teacher/students?class=${encodeURIComponent(c.name)}`)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-muted/20 p-3 text-left hover:bg-muted/40 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText size={16} /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.teacherName} · {c.studentCount} students</p></div>
                  <span className="font-mono text-xs text-muted-foreground">{c.joinCode}</span>
                </button>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No classes yet.</p>}
        </CardContent>
      </Card>

      {/* Students list */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Students</h2>
          {members && members.students.length > 0 ? (
            <div className="space-y-2">
              {members.students.slice(0, 10).map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-muted/20 p-3 dark:bg-white/5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><GraduationCap size={16} /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{s.fullName}</p><p className="truncate text-xs text-muted-foreground">{s.email}</p></div>
                </div>
              ))}
              {members.students.length > 10 && <p className="text-center text-xs text-muted-foreground">+ {members.students.length - 10} more</p>}
            </div>
          ) : <p className="text-sm text-muted-foreground">No students yet.</p>}
        </CardContent>
      </Card>

      {/* Danger zone — owner only */}
      {isOwner && (
        <Card className="border-red-500/30">
          <CardContent className="p-5">
            <h2 className="mb-2 text-sm font-semibold text-red-600">Danger Zone</h2>
            <p className="mb-3 text-xs text-muted-foreground">Deleting a community removes it permanently. Students will lose their school association.</p>
            {!confirmDelete ? (
              <Button variant="outline" onClick={() => setConfirmDelete(true)} className="w-full text-red-600 border-red-500/30"><Trash2 size={16} /> Delete Community</Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setConfirmDelete(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleDelete} className="flex-1 bg-red-600 text-white hover:bg-red-700">Confirm Delete</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <ToastViewport toast={toast} onDismiss={dismissToast} />
    </motion.div>
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

function QRCodePlaceholder({ text }: { text: string }) {
  // Generate a simple QR-like visual using a free QR API as fallback
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
  return <img src={qrUrl} alt="QR Code" width={200} height={200} className="rounded-2xl border border-border dark:border-border-dark" />;
}
