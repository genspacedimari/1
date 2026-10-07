import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon, FileSliders as Sliders, CreditCard as Edit3, Database, Info,
  RotateCcw, ChevronRight, Download, Upload, Trash2, Zap, Moon, Globe, Sparkles, Volume2,
  Smartphone, Monitor, Grid3x3, Magnet, GitBranch, MapPin, Gauge, Activity, Crosshair,
  ZoomIn, Grid2x2, Circle, History, Save, Instagram,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Segmented } from '@/components/ui/segmented';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast, ToastViewport } from '@/components/ui/toast';
import { useSettingsStore } from '@/stores/settingsStore';
import { useThemeStore, type ThemeMode } from '@/stores/themeStore';
import { sqliteService, type SimulationCacheEntry } from '@/services/localDb/sqliteService';
import { isNativePlatform, getLocalDb } from '@/services/localDb';
import { cn } from '@/utils/cn';
import { useT, type TranslationKey } from '@/i18n/translations';
import { isHapticsSupported, triggerHapticIfEnabled } from '@/utils/haptics';
import { isWakeLockSupported } from '@/utils/wakeLock';
import { playClickSound } from '@/utils/sound';
import pkg from '../../../package.json';

const INSTAGRAM_URL = 'https://www.instagram.com/ghnisptra_/';

type SectionId = 'general' | 'simulator' | 'editor' | 'storage' | 'about' | 'reset';

const SECTIONS: { id: SectionId; labelKey: TranslationKey; icon: typeof SettingsIcon }[] = [
  { id: 'general', labelKey: 'section_general', icon: SettingsIcon },
  { id: 'simulator', labelKey: 'section_simulator', icon: Sliders },
  { id: 'editor', labelKey: 'section_editor', icon: Edit3 },
  { id: 'storage', labelKey: 'section_storage', icon: Database },
  { id: 'about', labelKey: 'section_about', icon: Info },
  { id: 'reset', labelKey: 'section_reset', icon: RotateCcw },
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const itemVar = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

function Row({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon: typeof SettingsIcon;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 sm:gap-4 md:px-5 md:py-4">
      <div className="flex min-w-0 items-start sm:items-center gap-3 md:gap-4">
        <div className="flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={18} strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] md:text-[15px] font-medium leading-tight">{label}</p>
          {description && <p className="mt-1 text-[12px] md:text-[13px] leading-snug text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="shrink-0 self-end sm:self-center mt-2 sm:mt-0">{children}</div>
    </div>
  );
}

function StackRow({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon: typeof SettingsIcon;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6 md:px-5 md:py-4">
      <div className="flex min-w-0 items-start gap-3 md:gap-4">
        <div className="flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={18} strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] md:text-[15px] font-medium leading-tight">{label}</p>
          {description && <p className="mt-1 text-[12px] md:text-[13px] leading-snug text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="w-full lg:w-auto mt-2 lg:mt-0">{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="mx-4 border-t border-border dark:border-border-dark md:mx-5" />;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="mb-2 mt-4 px-1 text-[12px] md:text-[13px] font-semibold uppercase tracking-wider text-muted-foreground md:mb-3 md:mt-6">
      {title}
    </h2>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function SettingsPage() {
  const s = useSettingsStore();
  const themeMode = useThemeStore((st) => st.mode);
  const setThemeMode = useThemeStore((st) => st.setMode);
  const [activeSection, setActiveSection] = useState<SectionId>('general');
  const { t, lang } = useT();
  const { toast, showToast, dismissToast } = useToast();

  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const [storageInfo, setStorageInfo] = useState({
    projectCount: 0,
    storageQuota: '—',
    storageUsed: '—',
    lastAutoSave: '—' as string,
  });

  const refreshStorageInfo = useCallback(async () => {
    try {
      const projects = await sqliteService.listProjects();
      const estimate = navigator.storage?.estimate;
      let used = '—';
      let quota = '—';
      if (estimate) {
        const est = await estimate();
        used = formatBytes(est.usage ?? 0);
        quota = formatBytes(est.quota ?? 0);
      }
      setStorageInfo({
        projectCount: projects.length,
        storageQuota: quota,
        storageUsed: used,
        lastAutoSave:
          projects.length > 0
            ? new Date(Math.max(...projects.map((p) => new Date(p.updatedAt).getTime()))).toLocaleString(
                lang === 'id' ? 'id-ID' : 'en-US'
              )
            : t('storage_never'),
      });
    } catch {
      /* keep defaults */
    }
  }, [lang, t]);

  useEffect(() => {
    refreshStorageInfo();
  }, [refreshStorageInfo]);

  const storageType = isNativePlatform() ? 'SQLite (Android)' : 'IndexedDB (Browser)';

  const handleExportAll = useCallback(async () => { /* ... logikamu ... */ }, []);
  const handleImportBackup = useCallback(() => { /* ... logikamu ... */ }, []);
  const handleClearCache = useCallback(() => { /* ... logikamu ... */ }, []);
  const handleOptimizeDb = useCallback(() => { /* ... logikamu ... */ }, []);

  const resetActions: { labelKey: TranslationKey; descKey: TranslationKey; action: () => void }[] = [
    { labelKey: 'reset_simulator_label', descKey: 'reset_simulator_desc', action: s.resetSimulator },
    { labelKey: 'reset_editor_label', descKey: 'reset_editor_desc', action: s.resetEditor },
    { labelKey: 'reset_general_label', descKey: 'reset_general_desc', action: s.resetGeneral },
    { labelKey: 'reset_all_label', descKey: 'reset_all_desc', action: s.resetAll },
  ];

  const clickFx = () => {
    if (s.soundEffects) playClickSound();
    triggerHapticIfEnabled(s.hapticFeedback, 8);
  };

  return (
    {/* OUTER CONTAINER: Ditambahkan padding dan max-width yang menyesuaikan device */}
    <motion.div variants={stagger} initial="hidden" animate="show" className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-6 md:pb-8 lg:px-8">
      
      {/* MOBILE TABS: Hanya tampil di HP (md:hidden) */}
      <div className="relative mb-6 -mx-4 sm:-mx-6 md:hidden">
        <div className="flex snap-x snap-proximity gap-2 overflow-x-auto scroll-px-4 px-4 pb-2 scrollbar-hide sm:px-6">
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              onClick={() => { clickFx(); setActiveSection(sec.id); }}
              aria-current={activeSection === sec.id}
              className={cn(
                'flex shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-full px-5 py-2.5 text-[14px] font-semibold transition-all',
                activeSection === sec.id
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted/60 text-muted-foreground active:bg-muted dark:bg-white/5'
              )}
            >
              <sec.icon size={16} strokeWidth={2.5} />
              {t(sec.labelKey)}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" />
      </div>

      {/* MAIN GRID LAYOUT: Mengatur sidebar dan konten utama */}
      <div className="flex flex-col md:flex-row gap-6 lg:gap-10">
        
        {/* DESKTOP/TABLET SIDEBAR: Menyembunyikan di HP, tampil proporsional di Tablet/Desktop */}
        <div className="hidden md:block md:w-56 lg:w-64 shrink-0">
          <div className="sticky top-6 flex flex-col gap-1.5">
            <h3 className="mb-4 px-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">Settings</h3>
            {SECTIONS.map((sec) => (
              <button
                key={sec.id}
                onClick={() => { clickFx(); setActiveSection(sec.id); }}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-4 py-3.5 text-[15px] font-medium transition-all duration-200',
                  activeSection === sec.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/50 dark:hover:bg-white/5'
                )}
              >
                <sec.icon size={20} />
                {t(sec.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* CONTENT AREA: Menyesuaikan 100% lebar layar yang tersisa */}
        <div className="min-w-0 flex-1">
          {/* GENERAL SECTION (Sebagai Contoh) */}
          {activeSection === 'general' && (
            <motion.div variants={stagger} initial="hidden" animate="show">
              <SectionHeader title={t('section_general')} />
              <Card className="overflow-hidden border-border/50 shadow-sm">
                <CardContent className="p-0">
                  <motion.div variants={itemVar}>
                    <StackRow icon={Save} label={t('autosave_label')} description={t('autosave_desc')}>
                      <Segmented
                        aria-label={t('autosave_label')}
                        value={s.autoSave}
                        onChange={(v) => s.update({ autoSave: v })}
                        options={[
                          { label: t('autosave_off'), value: 'off' },
                          { label: '30s', value: '30s' },
                          { label: '1m', value: '1m' },
                          { label: '5m', value: '5m' },
                          { label: '10m', value: '10m' },
                        ]}
                      />
                    </StackRow>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Moon} label={t('theme_label')} description={t('theme_desc')}>
                      <Segmented
                        aria-label={t('theme_label')}
                        value={themeMode}
                        onChange={(v) => setThemeMode(v as ThemeMode)}
                        options={[
                          { label: t('theme_light'), value: 'light' },
                          { label: t('theme_dark'), value: 'dark' },
                          { label: t('theme_system'), value: 'system' },
                        ]}
                      />
                    </Row>
                  </motion.div>
                  {/* ... Tambahkan sisa divider dan opsi lainnya di sini ... */}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* STORAGE SECTION: Dioptimalkan grid tombolnya untuk Tablet & Desktop */}
          {activeSection === 'storage' && (
            <motion.div variants={stagger} initial="hidden" animate="show">
              <SectionHeader title={t('section_storage')} />
              <Card className="overflow-hidden border-border/50 shadow-sm">
                <CardContent className="p-0">
                  <div className="space-y-4 px-5 py-5 lg:px-6 lg:py-6">
                    {/* Info baris penyimpanan */}
                    {[
                      { label: t('storage_projects'), value: String(storageInfo.projectCount) },
                      { label: t('storage_quota'), value: storageInfo.storageQuota },
                      { label: t('storage_used'), value: storageInfo.storageUsed },
                    ].map((row) => (
                      <motion.div key={row.label} variants={itemVar} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3">
                        <span className="text-sm text-muted-foreground">{row.label}</span>
                        <span className="text-[15px] font-semibold">{row.value}</span>
                      </motion.div>
                    ))}
                  </div>
                  <Divider />
                  {/* GRID BUTTON: 1 Kolom di HP, 2 Kolom di Tablet, 2 Kolom di Desktop dengan gap lebih besar */}
                  <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:gap-4 lg:p-6">
                    <Button variant="outline" onClick={() => { clickFx(); handleExportAll(); }} className="w-full justify-start py-5">
                      <Download size={18} className="mr-2" /> {t('storage_export')}
                    </Button>
                    <Button variant="outline" onClick={() => { clickFx(); handleImportBackup(); }} className="w-full justify-start py-5">
                      <Upload size={18} className="mr-2" /> {t('storage_import')}
                    </Button>
                    <Button variant="outline" onClick={() => { clickFx(); handleClearCache(); }} className="w-full justify-start py-5 text-red-500 hover:text-red-600">
                      <Trash2 size={18} className="mr-2" /> {t('storage_clearcache')}
                    </Button>
                    <Button variant="outline" onClick={() => { clickFx(); handleOptimizeDb(); }} className="w-full justify-start py-5">
                      <Zap size={18} className="mr-2" /> {t('storage_optimize')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Sisa code section lain disesuaikan mengikuti struktur Card > CardContent di atas... */}
        </div>
      </div>

      <ConfirmDialog /* Props dialog Anda */ />
      <ToastViewport toast={toast} onDismiss={dismissToast} />
    </motion.div>
  );
}
