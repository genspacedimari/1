import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Chrome as Home, Cpu, User, Settings, Presentation, LayoutGrid } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useT, type TranslationKey } from '@/i18n/translations';

interface NavItem {
  to: string;
  labelKey: TranslationKey;
  icon: typeof Home;
  end?: boolean;
}

/** Base nav — available to everyone (authenticated + guest). */
const BASE_NAV: NavItem[] = [
  { to: '/', labelKey: 'nav_home', icon: Home, end: true },
  { to: '/simulator', labelKey: 'nav_simulator', icon: Cpu },
  { to: '/settings', labelKey: 'nav_settings', icon: Settings },
];

/** Profile entry — different label/icon for guest vs signed-in. */
function profileNav(isGuest: boolean): NavItem {
  return { to: '/profile', labelKey: isGuest ? 'nav_guest' : 'nav_profile', icon: User };
}

/**
 * Teacher Portal nav — Bank Soal, Community management, Classes, Students,
 * exam scheduling, etc. Reachable by both 'teacher' and 'admin' roles at
 * the route level (see /teacher's RequireAuth roles=['teacher','admin']),
 * so both roles need this nav item, not just teachers.
 */
const TEACHER_NAV: NavItem = { to: '/teacher', labelKey: 'nav_teacher', icon: Presentation };

/**
 * Content Center nav — where admin manages official/practice quizzes and
 * competitions (/admin and its sub-pages). This is SEPARATE from the
 * Teacher Portal above; admin needs both, not one or the other.
 */
const ADMIN_NAV: NavItem = { to: '/admin', labelKey: 'nav_admin', icon: LayoutGrid };

function buildNav(isGuest: boolean, role?: string): NavItem[] {
  const items = [...BASE_NAV, profileNav(isGuest)];
  if (!isGuest && role === 'admin') {
    items.splice(3, 0, ADMIN_NAV, TEACHER_NAV);
  } else if (!isGuest && role === 'teacher') {
    items.splice(3, 0, TEACHER_NAV);
  }
  return items;
}

/** Desktop: fixed left rail. Mobile: fixed bottom bar. Same data, two layouts. */
export function SidebarNav() {
  const isGuest = useAuthStore((s) => s.isGuest);
  const role = useAuthStore((s) => s.profile?.role);
  const items = buildNav(isGuest, role);
  const { t } = useT();

  return (
    <nav className="hidden md:flex md:w-20 lg:w-56 shrink-0 flex-col gap-1 border-r border-border dark:border-border-dark p-3 lg:p-4">
      <div className="mb-4 px-2 hidden lg:block">
        <p className="font-display text-sm font-semibold">GENSPACE</p>
        <p className="text-[11px] text-muted-foreground">One Space for Everything.</p>
      </div>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors',
              'lg:justify-start justify-center',
              isActive
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5'
            )
          }
        >
          <item.icon size={20} strokeWidth={2.25} />
          <span className="hidden lg:inline">{t(item.labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const isGuest = useAuthStore((s) => s.isGuest);
  const role = useAuthStore((s) => s.profile?.role);
  const items = buildNav(isGuest, role);
  const { t } = useT();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-center justify-around gap-1 p-2 md:hidden"
      style={{
        // Android Chrome (non-PWA tabs) reports env(safe-area-inset-bottom)
        // as 0 — unlike iOS, it has no home-indicator concept — so a bare
        // "0.5rem + env(...)" collapses to a razor-thin 8px gap and the
        // pill ends up hugging the very edge of the viewport. Give it a
        // real floor so it always sits comfortably clear of the edge,
        // and let env() add extra room on devices that do report it.
        paddingBottom: 'max(1rem, calc(0.5rem + env(safe-area-inset-bottom)))',
      }}
    >
      <div className="glass flex w-full items-center justify-around rounded-3xl px-2 py-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className="relative flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium"
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-active"
                    className="absolute inset-0 -z-10 rounded-2xl bg-primary/15"
                    transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
                  />
                )}
                <item.icon
                  size={20}
                  strokeWidth={2.25}
                  className={isActive ? 'text-primary' : 'text-muted-foreground'}
                />
                <span className={isActive ? 'text-primary' : 'text-muted-foreground'}>
                  {t(item.labelKey)}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
