import { supabase } from '@/services/supabaseClient';

export type BadgePlacement = '1st' | '2nd' | '3rd';

export interface UserBadge {
  id: string;
  code: string;
  name: string;
  placement: BadgePlacement;
  competitionId: string | null;
  competitionName: string | null;
  awardedAt: string | null;
}

const PLACEMENT_RANK: Record<BadgePlacement, number> = { '1st': 0, '2nd': 1, '3rd': 2 };

/** Highest (best) placement among a set of badges — 1st beats 2nd beats 3rd. Used to pick the avatar frame tier. */
export function bestPlacement(badges: UserBadge[]): BadgePlacement | null {
  if (badges.length === 0) return null;
  return badges.reduce<BadgePlacement>((best, b) => (PLACEMENT_RANK[b.placement] < PLACEMENT_RANK[best] ? b.placement : best), badges[0].placement);
}

/**
 * Fetches every official GENSPACE badge a user has ever won, newest first.
 * Requires the `select_badges_for_authenticated` / `select_badge_awards_for_authenticated`
 * RLS policies (20260814093000 migration) so this works for ANY user's id,
 * not just the signed-in viewer's own.
 */
export async function fetchUserBadges(userId: string): Promise<UserBadge[]> {
  const { data, error } = await supabase
    .from('genspace_badge_awards')
    .select('id, placement, awarded_at, genspace_badges!inner(code, name, competition_id)')
    .eq('user_id', userId)
    .order('awarded_at', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as any[];
  const competitionIds = Array.from(new Set(rows.map((r) => r.genspace_badges?.competition_id).filter(Boolean)));
  let competitionNames = new Map<string, string>();
  if (competitionIds.length > 0) {
    const { data: comps } = await supabase.from('genspace_competitions').select('id, name').in('id', competitionIds);
    competitionNames = new Map((comps ?? []).map((c: any) => [c.id, c.name]));
  }

  return rows.map((row) => ({
    id: row.id,
    code: row.genspace_badges?.code ?? '',
    name: row.genspace_badges?.name ?? '',
    placement: (row.placement ?? '3rd') as BadgePlacement,
    competitionId: row.genspace_badges?.competition_id ?? null,
    competitionName: row.genspace_badges?.competition_id ? competitionNames.get(row.genspace_badges.competition_id) ?? null : null,
    awardedAt: row.awarded_at ?? null,
  }));
}
