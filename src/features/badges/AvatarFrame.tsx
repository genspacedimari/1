import { Crown } from 'lucide-react';
import type { BadgePlacement } from './services';
import { cn } from '@/utils/cn';

const TIER_STYLE: Record<BadgePlacement, { ring: string; glow: string; crown: string }> = {
  '1st': { ring: 'from-amber-300 via-yellow-400 to-amber-500', glow: 'shadow-[0_0_16px_rgba(245,158,11,0.55)]', crown: 'text-amber-500' },
  '2nd': { ring: 'from-slate-300 via-slate-200 to-slate-400', glow: 'shadow-[0_0_14px_rgba(148,163,184,0.5)]', crown: 'text-slate-400' },
  '3rd': { ring: 'from-orange-400 via-amber-600 to-orange-500', glow: 'shadow-[0_0_14px_rgba(194,120,52,0.5)]', crown: 'text-orange-500' },
};

function avatarInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

/**
 * Renders an avatar (photo or initials) with an optional champion frame.
 * `placement` is the user's BEST badge tier (see bestPlacement() in
 * services.ts) — null renders a plain avatar with no frame, exactly like
 * before badges existed.
 */
export function AvatarFrame({
  avatarUrl,
  fullName,
  placement,
  size = 64,
}: {
  avatarUrl?: string | null;
  fullName: string;
  placement: BadgePlacement | null;
  size?: number;
}) {
  const tier = placement ? TIER_STYLE[placement] : null;
  const inner = size - (tier ? 8 : 0);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {tier && (
        <div className={cn('absolute inset-0 rounded-2xl bg-gradient-to-br p-[3px]', tier.ring, tier.glow)}>
          <div className="h-full w-full rounded-[13px] bg-surface dark:bg-surface-dark" />
        </div>
      )}
      <div
        className="absolute flex items-center justify-center overflow-hidden rounded-2xl"
        style={{ width: inner, height: inner, top: tier ? 4 : 0, left: tier ? 4 : 0 }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/15 font-display font-semibold text-primary" style={{ fontSize: inner * 0.32 }}>
            {avatarInitials(fullName)}
          </div>
        )}
      </div>
      {tier && (
        <div className={cn('absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-surface p-0.5 dark:bg-surface-dark', tier.crown)}>
          <Crown size={14} fill="currentColor" />
        </div>
      )}
    </div>
  );
}
