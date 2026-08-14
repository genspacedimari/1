import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Shield, Building2, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/services/supabaseClient';
import { fetchUserBadges, bestPlacement, type UserBadge } from '@/features/badges/services';
import { AvatarFrame } from '@/features/badges/AvatarFrame';
import { BadgeSummaryRow, BadgeShowcaseGrid } from '@/features/badges/BadgeDisplay';

const ROLE_LABEL: Record<string, string> = { student: 'Student', teacher: 'Teacher', admin: 'Admin' };

interface PublicProfile {
  id: string;
  fullName: string;
  username: string;
  role: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  schoolName: string | null;
}

export default function PublicProfilePage() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true); setError(null);
    (async () => {
      try {
        const { data: row, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, username, role, avatar_url, level, xp, school_id')
          .eq('id', userId)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!row) { if (!cancelled) setError('Profil tidak ditemukan.'); return; }

        let schoolName: string | null = null;
        if (row.school_id) {
          const { data: school } = await supabase.from('schools').select('name').eq('id', row.school_id).maybeSingle();
          schoolName = (school as { name: string } | null)?.name ?? null;
        }

        const userBadges = await fetchUserBadges(row.id);

        if (!cancelled) {
          setProfile({ id: row.id, fullName: row.full_name, username: row.username, role: row.role, avatarUrl: row.avatar_url, level: row.level, xp: row.xp, schoolName });
          setBadges(userBadges);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Gagal memuat profil.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) return <div className="mx-auto max-w-2xl p-8 text-center text-sm text-muted-foreground">Memuat profil...</div>;
  if (error || !profile) return <div className="mx-auto max-w-2xl p-8 text-center text-sm text-red-500">{error ?? 'Profil tidak ditemukan.'}</div>;

  const tier = bestPlacement(badges);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-lg font-semibold">Profil</h1>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
          <AvatarFrame avatarUrl={profile.avatarUrl} fullName={profile.fullName} placement={tier} size={72} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold">{profile.fullName}</h2>
            <p className="text-xs text-muted-foreground">@{profile.username}</p>
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Badge variant="outline"><Shield size={12} /> {ROLE_LABEL[profile.role] ?? profile.role}</Badge>
              {profile.schoolName && <Badge variant="outline"><Building2 size={12} /> {profile.schoolName}</Badge>}
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Zap size={12} /> Lv {profile.level} · {profile.xp} XP</span>
            </div>
            <div className="mt-2 flex justify-center sm:justify-start"><BadgeSummaryRow badges={badges} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h3 className="text-sm font-semibold">Prestasi GENSPACE</h3>
          <BadgeShowcaseGrid badges={badges} />
        </CardContent>
      </Card>
    </div>
  );
}
