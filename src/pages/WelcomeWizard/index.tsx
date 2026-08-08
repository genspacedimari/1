import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Search, Plus, Check, CircleAlert as AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { searchCommunities, createCommunity, joinCommunityAsTeacher } from '@/services/communityService';
import type { Community } from '@/services/communityService';

export default function WelcomeWizardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  const [mode, setMode] = useState<'choose' | 'create' | 'search'>('choose');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Community[]>([]);
  const [searching, setSearching] = useState(false);

  // Create form
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [country, setCountry] = useState('Indonesia');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    setError(null);
    try {
      const results = await searchCommunities(searchQuery);
      setSearchResults(results);
    } catch {
      setError('Failed to search communities.');
    } finally {
      setSearching(false);
    }
  };

  const handleJoinExisting = async (communityId: string) => {
    if (!user) return;
    setCreating(true);
    setError(null);
    try {
      await joinCommunityAsTeacher(communityId, user.id);
      await refreshProfile();
      setDone(true);
      setTimeout(() => navigate('/'), 1500);
    } catch {
      setError('Failed to join community.');
    } finally {
      setCreating(false);
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    if (!name.trim()) {
      setError('Community name is required.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createCommunity({
        name: name.trim(),
        city: city.trim(),
        province: province.trim(),
        country: country.trim(),
        teacherId: user.id,
      });
      await refreshProfile();
      setDone(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create community.');
    } finally {
      setCreating(false);
    }
  };

  const inputClass = 'w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark';

  if (done) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                <Check size={32} />
              </div>
              <h2 className="font-display text-lg font-semibold">Community Ready!</h2>
              <p className="text-sm text-muted-foreground">Redirecting to your dashboard...</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="pt-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles size={28} />
        </div>
        <h1 className="font-display text-2xl font-semibold">Welcome to GENSPACE PLC</h1>
        <p className="mt-1 text-sm text-muted-foreground">Create your learning community to get started.</p>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'choose' && (
          <motion.div key="choose" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
            <button onClick={() => setMode('create')} className="w-full text-left" style={{ minHeight: 44 }}>
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="flex items-center gap-3 p-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Plus size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="font-display text-base font-semibold">Create Community</p>
                    <p className="text-xs text-muted-foreground">Start a new learning community (school).</p>
                  </div>
                  <ArrowRight size={20} className="text-muted-foreground" />
                </CardContent>
              </Card>
            </button>
            <button onClick={() => setMode('search')} className="w-full text-left" style={{ minHeight: 44 }}>
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="flex items-center gap-3 p-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600">
                    <Search size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="font-display text-base font-semibold">Join Existing Community</p>
                    <p className="text-xs text-muted-foreground">Search for your school and join as a teacher.</p>
                  </div>
                  <ArrowRight size={20} className="text-muted-foreground" />
                </CardContent>
              </Card>
            </button>
          </motion.div>
        )}

        {mode === 'create' && (
          <motion.div key="create" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-2">
                  <button onClick={() => setMode('choose')} className="text-xs text-muted-foreground hover:text-foreground">&larr; Back</button>
                </div>
                <h2 className="font-display text-lg font-semibold">Create New Community</h2>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">School / Community Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SMK Negeri 1 Bandung" className={inputClass} style={{ minHeight: 44 }} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">City</label>
                  <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Bandung" className={inputClass} style={{ minHeight: 44 }} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Province</label>
                  <input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="e.g. Jawa Barat" className={inputClass} style={{ minHeight: 44 }} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Country</label>
                  <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass} style={{ minHeight: 44 }} />
                </div>
                {error && (
                  <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
                  </div>
                )}
                <Button onClick={handleCreate} disabled={creating} className="w-full" size="lg">
                  {creating ? 'Creating...' : 'Create Community'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {mode === 'search' && (
          <motion.div key="search" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-2">
                  <button onClick={() => setMode('choose')} className="text-xs text-muted-foreground hover:text-foreground">&larr; Back</button>
                </div>
                <h2 className="font-display text-lg font-semibold">Search Communities</h2>
                <div className="flex gap-2">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search school name..."
                    className={inputClass}
                    style={{ minHeight: 44 }}
                  />
                  <Button onClick={handleSearch} disabled={searching} size="lg">
                    <Search size={18} />
                  </Button>
                </div>
                {error && (
                  <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
                  </div>
                )}
                <div className="space-y-2">
                  {searchResults.map((c) => (
                    <button key={c.id} onClick={() => handleJoinExisting(c.id)} disabled={creating} className="w-full text-left" style={{ minHeight: 44 }}>
                      <Card className="transition-colors hover:border-primary/50">
                        <CardContent className="flex items-center gap-3 p-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Building2 size={20} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{c.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{c.city}, {c.province}</p>
                          </div>
                          <ArrowRight size={18} className="shrink-0 text-muted-foreground" />
                        </CardContent>
                      </Card>
                    </button>
                  ))}
                  {searchResults.length === 0 && searchQuery.trim().length >= 2 && !searching && (
                    <p className="py-4 text-center text-sm text-muted-foreground">No communities found. Try creating a new one.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
