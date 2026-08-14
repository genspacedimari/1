import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, CircleAlert as AlertCircle, Clock, FileText, Trophy, Medal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCompetitionStore } from '@/features/competition/store';

function competitionRunState(info: { status: string; startAt: string | null; endAt: string | null }): 'not_started' | 'running' | 'finished' {
  if (info.status === 'finished') return 'finished';
  const now = Date.now();
  if (info.startAt && now < new Date(info.startAt).getTime()) return 'not_started';
  if (info.endAt && now > new Date(info.endAt).getTime()) return 'finished';
  return 'running';
}

export default function JoinCompetitionPage() {
  const navigate = useNavigate();
  const { activeCompetition, loading, error, joinByCode } = useCompetitionStore();
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleValidate = async () => {
    setLocalError(null);
    if (code.trim().length < 3) { setLocalError('Masukkan kode kompetisi yang valid.'); return; }
    const info = await joinByCode(code.trim());
    if (!info) setLocalError('Kompetisi tidak ditemukan. Cek kembali kodenya.');
  };

  const runState = activeCompetition ? competitionRunState(activeCompetition) : null;
  const alreadyJoined = !!activeCompetition?.myResult;
  const canStart = activeCompetition && runState === 'running' && !alreadyJoined;

  const scheduleMessage = (() => {
    if (!activeCompetition || !runState) return null;
    if (runState === 'not_started') return 'Kompetisi belum dimulai. Coba lagi nanti.';
    if (runState === 'finished') return 'Kompetisi ini sudah selesai / tidak menerima peserta baru.';
    return null;
  })();

  const handleStart = () => {
    if (canStart) navigate('/competition/player');
  };

  const inputClass = 'w-full rounded-2xl border border-border bg-surface px-4 py-3 text-center font-mono text-lg tracking-wider outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark';

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Trophy size={18} /></div>
        <h1 className="font-display text-xl font-semibold">🏅 GENSPACE Competition</h1>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Kode Kompetisi</label>
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setLocalError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
              placeholder="GSC26"
              className={inputClass}
              maxLength={20}
              style={{ minHeight: 44 }}
            />
          </div>

          <AnimatePresence>
            {(localError || error) && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{localError ?? error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <Button onClick={handleValidate} disabled={loading} className="w-full" size="lg">
            {loading ? 'Memeriksa...' : 'Cek Kode'}
          </Button>
        </CardContent>
      </Card>

      <AnimatePresence>
        {activeCompetition && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card>
              <CardContent className="space-y-4 p-5">
                <div>
                  <h2 className="font-display text-lg font-semibold">{activeCompetition.name}</h2>
                  {activeCompetition.description && <p className="mt-1 text-sm text-muted-foreground">{activeCompetition.description}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <InfoRow icon={Clock} label="Durasi" value={`${activeCompetition.durationMinutes} menit`} />
                  <InfoRow icon={FileText} label="Jumlah Soal" value={`${activeCompetition.quizData.length}`} />
                  <InfoRow icon={Award} label="Badge" value={activeCompetition.badgePrefix} />
                </div>

                <AnimatePresence>
                  {scheduleMessage && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <span>{scheduleMessage}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {alreadyJoined && activeCompetition.myResult && (
                  <div className="flex items-start gap-2 rounded-2xl bg-primary/5 px-4 py-3 text-sm dark:bg-primary/10">
                    <Medal size={16} className="mt-0.5 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">Kamu sudah ikut kompetisi ini.</p>
                      <p className="mt-0.5 text-muted-foreground">Skor: <b>{activeCompetition.myResult.score}</b>{activeCompetition.myResult.rank ? ` · Peringkat ${activeCompetition.myResult.rank} dari ${activeCompetition.myResult.totalParticipants}` : ''}</p>
                    </div>
                  </div>
                )}

                <Button onClick={handleStart} disabled={!canStart} className="w-full" size="lg">
                  {alreadyJoined ? 'Sudah Diikuti' : 'Mulai Kompetisi'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={16} className="shrink-0 text-muted-foreground" />
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
