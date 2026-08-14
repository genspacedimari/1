import { Award } from 'lucide-react';
import type { UserBadge } from './services';
import { cn } from '@/utils/cn';

const TIER_MEDAL: Record<string, string> = { '1st': '🥇', '2nd': '🥈', '3rd': '🥉' };
const TIER_CARD: Record<string, string> = {
  '1st': 'bg-gradient-to-br from-amber-400/15 via-yellow-300/10 to-amber-500/15 border-amber-400/40',
  '2nd': 'bg-gradient-to-br from-slate-300/15 via-slate-200/10 to-slate-400/15 border-slate-300/40',
  '3rd': 'bg-gradient-to-br from-orange-400/15 via-amber-600/10 to-orange-500/15 border-orange-400/40',
};

function badgeYear(badge: UserBadge): string | null {
  if (!badge.awardedAt) return null;
  return new Date(badge.awardedAt).getFullYear().toString();
}

/** Compact one-line summary, e.g. "🥇 1ST GSC26 2026 · 🥈 2ND GSC25 2025" — used right under a name. */
export function BadgeSummaryRow({ badges }: { badges: UserBadge[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {badges.map((b) => (
        <span key={b.id} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          {TIER_MEDAL[b.placement]} {b.placement.toUpperCase()} {b.code}{badgeYear(b) ? ` ${badgeYear(b)}` : ''}
        </span>
      ))}
    </div>
  );
}

/** Full "Achievements" grid — one premium card per badge, for a profile page (own or public). */
export function BadgeShowcaseGrid({ badges }: { badges: UserBadge[] }) {
  if (badges.length === 0) {
    return (
      <div className="rounded-2xl bg-muted/20 p-6 text-center dark:bg-white/5">
        <Award size={22} className="mx-auto mb-2 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Belum ada badge resmi GENSPACE.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {badges.map((b) => (
        <div key={b.id} className={cn('rounded-2xl border p-4', TIER_CARD[b.placement])}>
          <div className="flex items-start justify-between gap-2">
            <span className="text-2xl leading-none">{TIER_MEDAL[b.placement]}</span>
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground/70 dark:bg-white/10">
              {b.placement} · {badgeYear(b) ?? ''}
            </span>
          </div>
          <p className="mt-2 font-display text-sm font-bold">{b.placement.toUpperCase()} {b.code}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{b.competitionName ?? b.name}</p>
        </div>
      ))}
    </div>
  );
}
