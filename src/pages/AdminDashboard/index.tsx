import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Swords, ArrowRight } from 'lucide-react';

const items = [
  {
    to: '/admin/official',
    icon: Trophy,
    title: '🏆 GENSPACE Official Quiz',
    description: 'Quiz resmi dari GENSPACE Team',
    accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  {
    to: '/admin/competition',
    icon: Swords,
    title: '🏅 GENSPACE Competition',
    description: 'Kompetisi resmi GENSPACE',
    accent: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">GENSPACE TEAM</p>
        <h1 className="mt-2 font-display text-2xl font-semibold">Content Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">Kelola seluruh konten resmi GENSPACE dari satu tempat.</p>
      </motion.div>

      <div className="grid gap-4">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div key={item.to} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}>
              <Link to={item.to} className="group flex items-center gap-4 rounded-3xl border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md dark:border-border-dark dark:bg-surface-dark">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${item.accent}`}>
                  <Icon size={26} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-base font-semibold">{item.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
                <ArrowRight size={20} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
