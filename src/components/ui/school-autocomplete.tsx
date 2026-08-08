import { useState, useRef, useEffect } from 'react';
import { Search, Plus, Check, X, Building2 } from 'lucide-react';
import { searchSchools, requestSchool } from '@/services/schoolService';
import type { School } from '@/types/user';

interface SchoolAutocompleteProps {
  value: string | null;
  schoolName?: string | null;
  onChange: (schoolId: string | null, schoolName: string | null) => void;
  placeholder?: string;
}

export function SchoolAutocomplete({ value, schoolName, onChange, placeholder = 'Cari Sekolah...' }: SchoolAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<School[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<School | null>(
    value && schoolName ? { id: value, name: schoolName, city: '', province: '', country: '' } : null
  );
  const [showRequest, setShowRequest] = useState(false);
  const [requestName, setRequestName] = useState('');
  const [requestCity, setRequestCity] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value && schoolName && !selected) {
      setSelected({ id: value, name: schoolName, city: '', province: '', country: '' });
    }
  }, [value, schoolName, selected]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const schools = await searchSchools(q);
        setResults(schools);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const handleSelect = (school: School) => {
    setSelected(school);
    setQuery('');
    setOpen(false);
    onChange(school.id, school.name);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery('');
    onChange(null, null);
  };

  const handleRequest = async () => {
    if (!requestName.trim()) return;
    setRequesting(true);
    try {
      await requestSchool({ name: requestName, city: requestCity });
      setRequestSent(true);
      setRequestName('');
      setRequestCity('');
      setTimeout(() => {
        setShowRequest(false);
        setRequestSent(false);
      }, 2000);
    } catch {
      // ignore
    } finally {
      setRequesting(false);
    }
  };

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 size={18} className="shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{selected.name}</p>
            {selected.city && <p className="truncate text-xs text-muted-foreground">{selected.city}, {selected.province}</p>}
          </div>
        </div>
        <button onClick={handleClear} className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted/30 dark:hover:bg-white/10" aria-label="Change school">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-border bg-surface pl-9 pr-4 py-3 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
          style={{ minHeight: 44 }}
        />
        {loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">...</span>}
      </div>

      {open && (results.length > 0 || query.trim().length >= 2) && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-lg dark:border-border-dark dark:bg-surface-dark">
          {results.length > 0 ? (
            <div className="max-h-60 overflow-y-auto">
              {results.map((school) => (
                <button
                  key={school.id}
                  onClick={() => handleSelect(school)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/30 dark:hover:bg-white/5"
                  style={{ minHeight: 44 }}
                >
                  <Building2 size={16} className="shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{school.name}</p>
                    {school.city && <p className="truncate text-xs text-muted-foreground">{school.city}, {school.province}</p>}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            !loading && (
              <div className="p-3">
                <p className="mb-2 text-sm text-muted-foreground">Sekolah tidak ditemukan</p>
                {!showRequest ? (
                  <button
                    onClick={() => { setShowRequest(true); setRequestName(query); }}
                    className="flex w-full items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                    style={{ minHeight: 44 }}
                  >
                    <Plus size={16} /> Request New School
                  </button>
                ) : requestSent ? (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
                    <Check size={16} /> Request sent! Admin will review.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      value={requestName}
                      onChange={(e) => setRequestName(e.target.value)}
                      placeholder="School name"
                      className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                      style={{ minHeight: 40 }}
                    />
                    <input
                      value={requestCity}
                      onChange={(e) => setRequestCity(e.target.value)}
                      placeholder="City (optional)"
                      className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                      style={{ minHeight: 40 }}
                    />
                    <button
                      onClick={handleRequest}
                      disabled={requesting || !requestName.trim()}
                      className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                      style={{ minHeight: 40 }}
                    >
                      {requesting ? 'Sending...' : 'Submit Request'}
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
