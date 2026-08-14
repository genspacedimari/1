import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Clock, Medal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCompetitionStore } from '@/features/competition/store';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function CompetitionResultPage() {
  const navigate = useNavigate();
  const { activeCompetition, lastResult, clear } = useCompetitionStore();

  // Guard: only makes sense right after finishing a competition.
  useEffect(() => {
    if (!lastResult) navigate('/competition/join', { replace: true });
  }, [lastResult, navigate]);

  if (!lastResult || !activeCompetition) {
    return <div className="mx-auto max-w-md py-12 text-center text-sm text-muted-foreground">Memuat hasil...</div>;
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Trophy size={36} className="text-primary" />
          </div>
          <div>
            <p className="font-display text-4xl font-bold text-primary">{lastResult.score}%</p>
            <p className="mt-1 text-sm text-muted-foreground">{lastResult.correctCount} dari {lastResult.correctCount + lastResult.wrongCount} benar</p>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Clock size={16} className="text-muted-foreground" />
              <span>{formatDuration(lastResult.timeUsedSeconds)}</span>
            </div>
            {lastResult.rank && (
              <div className="flex items-center gap-1.5">
                <Medal size={16} className="text-muted-foreground" />
                <span>Peringkat {lastResult.rank} / {lastResult.totalParticipants}</span>
              </div>
            )}
          </div>

          <p className="rounded-2xl bg-muted/30 px-4 py-3 text-xs text-muted-foreground dark:bg-white/5">
            Jawabanmu sudah tersimpan. Pemenang 1st/2nd/3rd untuk badge <b>{activeCompetition.badgePrefix}</b> akan diumumkan oleh GENSPACE Team setelah kompetisi selesai.
          </p>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { clear(); navigate('/competition/join'); }}>Kompetisi Lain</Button>
            <Button onClick={() => { clear(); navigate('/quiz'); }}>Selesai</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
