import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCompetitionStore } from '@/features/competition/store';
import { getRandomPostSubmitMessage } from '@/utils/postSubmitMessages';

export default function CompetitionResultPage() {
  const navigate = useNavigate();
  const { activeCompetition, lastResult, clear } = useCompetitionStore();
  const [message] = useState(getRandomPostSubmitMessage);

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
            <Sparkles size={36} className="text-primary" />
          </div>
          <div>
            <p className="font-display text-xl font-bold">Jawaban terkirim!</p>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          </div>

          {/* Score/rank are intentionally NEVER shown to participants for a
              GENSPACE Competition (poin 5) — only the GENSPACE team can see
              them, from the admin "Kelola" panel. Keeps it a real competition. */}
          <p className="flex items-start gap-2 rounded-2xl bg-muted/30 px-4 py-3 text-left text-xs text-muted-foreground dark:bg-white/5">
            <Lock size={28} className="mt-0.5 shrink-0 text-muted-foreground" />
            <span>
              Jawabanmu sudah tersimpan. Nilai dan peringkat kompetisi ini <b>dirahasiakan</b> — cuma GENSPACE Team yang bisa melihatnya.
              Pemenang 1st/2nd/3rd untuk badge <b>{activeCompetition.badgePrefix}</b> akan diumumkan resmi setelah kompetisi selesai.
            </span>
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
