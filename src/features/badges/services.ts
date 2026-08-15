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
 * Batched version of fetchUserBadges + bestPlacement for rendering a list of
 * avatars (class members, community members, leaderboards, etc.) without
 * firing one query per user. Returns a map of userId -> best placement
 * (or undefined if that user has no official GSC badge).
 */
export async function fetchBestPlacements(userIds: string[]): Promise<Map<string, BadgePlacement | null>> {
  const result = new Map<string, BadgePlacement | null>();
  if (userIds.length === 0) return result;

  const { data, error } = await supabase
    .from('genspace_badge_awards')
    .select('user_id, placement')
    .in('user_id', userIds);
  if (error) {
    // Non-fatal — avatars just render without a badge frame.
    return result;
  }

  const rows = (data ?? []) as Array<{ user_id: string; placement: BadgePlacement }>;
  for (const row of rows) {
    const current = result.get(row.user_id);
    if (!current || PLACEMENT_RANK[row.placement] < PLACEMENT_RANK[current]) {
      result.set(row.user_id, row.placement);
    }
  }
  return result;
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
