import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import * as admin from '@/features/genspace-admin/services';
import type { Competition } from '@/features/genspace-admin/types';

const statusLabel: Record<Competition['status'], string> = {
  draft: 'Draft',
  published: 'Published',
  live: 'Live',
  finished: 'Finished',
};

export default function CompetitionListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await admin.listCompetitions());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat kompetisi.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm('Hapus kompetisi ini?')) return;
    try { await admin.deleteCompetition(id); load(); } catch (e) { setError(e instanceof Error ? e.message : 'Gagal menghapus.'); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin')} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-xl font-semibold">🏅 GENSPACE Competition</h1>
            <p className="text-xs text-muted-foreground">Kompetisi resmi GENSPACE Team</p>
          </div>
        </div>
        <Button onClick={() => navigate('/admin/competition/new')}><Plus size={16} /> Buat Kompetisi</Button>
      </div>

      {error && <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</div>}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Memuat...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Belum ada kompetisi. Klik "Buat Kompetisi" untuk mulai.</div>
          ) : (
            items.map((c) => (
              <div key={c.id} className="flex items-center gap-3 border-b border-border p-4 last:border-b-0 dark:border-border-dark">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Kode: <b>{c.accessCode}</b> · Badge: <b>{c.badgePrefix}</b> · {statusLabel[c.status]}</p>
                </div>
                <button onClick={() => navigate(`/admin/competition/${c.id}`)} className="rounded-xl px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10">Kelola</button>
                <button onClick={() => remove(c.id)} className="rounded-xl p-2 text-muted-foreground hover:text-red-500"><Trash2 size={16} /></button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
