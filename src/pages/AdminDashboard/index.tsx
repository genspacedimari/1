import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, Shield, GraduationCap, Presentation, Search, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/services/supabaseClient';
import { profileRowToProfile, type ProfileRow, type Profile } from '@/types/user';

const ROLE_ICONS: Record<string, typeof Users> = {
  student: GraduationCap,
  teacher: Presentation,
  admin: Shield,
};

export default function AdminDashboardPage() {
  const profile = useAuthStore((s) => s.profile);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        setUsers((data as ProfileRow[]).map(profileRowToProfile));
      }
    } catch {
      /* RLS restricts this to admin users only */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filtered = users.filter(
    (u) =>
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: users.length,
    students: users.filter((u) => u.role === 'student').length,
    teachers: users.filter((u) => u.role === 'teacher').length,
    admins: users.filter((u) => u.role === 'admin').length,
  };

  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
  const itemVar = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="mx-auto max-w-4xl">
      <motion.div variants={itemVar} className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage users and monitor platform activity.
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVar} className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Users} label="Total Users" value={stats.total} />
        <StatCard icon={GraduationCap} label="Students" value={stats.students} />
        <StatCard icon={Presentation} label="Teachers" value={stats.teachers} />
        <StatCard icon={Shield} label="Admins" value={stats.admins} />
      </motion.div>

      {/* User list */}
      <motion.div variants={itemVar}>
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-sm font-semibold">User Management</h2>
            </div>
            <div className="border-t border-border px-5 py-3 dark:border-border-dark">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, username, or email"
                  className="w-full rounded-2xl border border-border bg-surface pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                  style={{ minHeight: 44 }}
                />
              </div>
            </div>
            <div className="border-t border-border dark:border-border-dark" />

            {loading ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading users...</div>
            ) : filtered.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">No users found.</div>
            ) : (
              <div className="divide-y divide-border dark:divide-border-dark">
                {filtered.map((u) => {
                  const Icon = ROLE_ICONS[u.role] ?? Users;
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{u.fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            @{u.username} · {u.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={u.role === 'admin' ? 'default' : 'muted'}>
                          {u.role}
                        </Badge>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.p variants={itemVar} className="mt-4 text-xs text-muted-foreground">
        Signed in as admin: {profile?.email}
      </motion.p>
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon size={20} />
        </div>
        <p className="font-display text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
