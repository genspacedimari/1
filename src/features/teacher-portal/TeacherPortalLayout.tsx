import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Database,
  FileText,
  Users,
  GraduationCap,
  BarChart3,
  Settings,
  ArrowLeft,
  Building2,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/authStore';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/teacher', label: 'Dashboard', icon: LayoutDashboard, },
  { to: '/teacher/community', label: 'Community', icon: Building2 },
  { to: '/teacher/questions', label: 'Question Bank', icon: Database },
  { to: '/teacher/exams', label: 'Exams', icon: FileText },
  { to: '/teacher/classes', label: 'Classes', icon: Users },
  { to: '/teacher/students', label: 'Students', icon: GraduationCap },
  { to: '/teacher/results', label: 'Results', icon: BarChart3 },
  { to: '/teacher/settings', label: 'Settings', icon: Settings },
];

export function TeacherPortalLayout() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);

  return (
    <div className="flex min-h-screen bg-secondary/30 dark:bg-surface-dark">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border dark:border-border-dark bg-surface dark:bg-surface-dark/50">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border dark:border-border-dark">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="font-display text-lg font-bold">G</span>
          </div>
          <div>
            <p className="font-display text-sm font-semibold">Teacher Portal</p>
            <p className="text-[11px] text-muted-foreground">{profile?.fullName}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/teacher'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5'
                )
              }
            >
              <item.icon size={20} strokeWidth={2.25} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-3 dark:border-border-dark">
          <button
            onClick={() => navigate('/')}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 dark:hover:bg-white/5"
          >
            <ArrowLeft size={20} />
            Back to App
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden dark:border-border-dark dark:bg-surface-dark/50">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowLeft size={18} /> Back
          </button>
          <span className="font-display text-sm font-semibold">Teacher Portal</span>
          <div className="w-8" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Outlet />
          </motion.div>
        </div>

        {/* Mobile bottom nav */}
        <nav className="flex items-center justify-around border-t border-border bg-surface px-2 py-2 md:hidden dark:border-border-dark dark:bg-surface-dark/50">
          {NAV_ITEMS.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/teacher'}
              className="flex flex-col items-center gap-0.5 py-1.5 px-2"
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    size={20}
                    className={isActive ? 'text-primary' : 'text-muted-foreground'}
                  />
                  <span className={`text-[10px] ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
