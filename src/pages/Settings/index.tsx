import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon, FileSliders as Sliders, CreditCard as Edit3, Database, Info,
  RotateCcw, ChevronRight, Download, Upload, Trash2, Zap, Moon, Globe, Sparkles, Volume2,
  Smartphone, Monitor, Grid3x3, Magnet, GitBranch, MapPin, Gauge, Activity, Crosshair,
  ZoomIn, Grid2x2, Circle, History, Save, Github,
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

const REPO_URL = 'https://github.com/gsprojectt1/tumbasdimariv1';

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

/** Inline row — icon/label/description on the left, a compact control (Switch,
 * or a short 2-3 option Segmented) on the right. Stays a single line even on
 * mobile since these controls are small and don't need room to breathe. */
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
    <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:gap-4 sm:px-5 sm:py-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">{label}</p>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Stacked row — icon/label/description on top, a wide control (Segmented with
 * 3+ options) below, full-width. On >= sm screens it collapses back to the
 * same inline layout as Row, since desktop has the horizontal room. This is
 * the fix for the "badly scaled" mobile controls: a 4-5 option segmented
 * control gets the full row width to breathe instead of being squeezed next
 * to the label text on a 360px-wide screen. */
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
    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">{label}</p>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="w-full sm:w-auto">{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="mx-4 border-t border-border dark:border-border-dark sm:mx-5" />;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="mb-2 mt-5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:mt-6">
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

  // --- Storage info (real data, read from the active local DB adapter) ---
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
      /* keep defaults — no fake data */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    refreshStorageInfo();
  }, [refreshStorageInfo]);

  const storageType = isNativePlatform() ? 'SQLite (Android)' : 'IndexedDB (Browser)';

  // --- Handlers ---
  const handleExportAll = useCallback(async () => {
    try {
      const projects = await sqliteService.listProjects();
      const blob = new Blob([JSON.stringify({ format: 'genspace-backup', projects }, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `genspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(t('storage_export_success'), 'success');
    } catch {
      showToast(t('storage_import_fail'), 'error');
    }
  }, [showToast, t]);

  const handleImportBackup = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data.projects)) {
          for (const p of data.projects) {
            await sqliteService.saveProject(p);
          }
          refreshStorageInfo();
          showToast(`${data.projects.length} ${t('storage_import_success')}`, 'success');
        } else {
          showToast(t('storage_import_fail'), 'error');
        }
      } catch {
        showToast(t('storage_import_fail'), 'error');
      }
    };
    input.click();
  }, [refreshStorageInfo, showToast, t]);

  const handleClearCache = useCallback(() => {
    setConfirm({
      title: t('cache_clear_title'),
      message: t('cache_clear_message'),
      confirmLabel: t('storage_clearcache'),
      onConfirm: async () => {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        setConfirm(null);
        refreshStorageInfo();
      },
    });
  }, [refreshStorageInfo, t]);

  // Real cleanup: removes simulation_cache rows whose parent project no
  // longer exists. Never touches offline_projects — nothing user-authored
  // is deleted.
  const handleOptimizeDb = useCallback(() => {
    setConfirm({
      title: t('optimize_title'),
      message: t('optimize_message'),
      confirmLabel: t('storage_optimize'),
      onConfirm: async () => {
        try {
          const [projects, cacheEntries] = await Promise.all([
            sqliteService.listProjects(),
            getLocalDb().list<SimulationCacheEntry>('simulation_cache'),
          ]);
          const validIds = new Set(projects.map((p) => p.id));
          const orphans = cacheEntries.filter((entry) => !validIds.has(entry.projectId));
          await Promise.all(orphans.map((entry) => getLocalDb().remove('simulation_cache', entry.projectId)));
          setConfirm(null);
          refreshStorageInfo();
          showToast(
            orphans.length > 0
              ? `${orphans.length} ${t('storage_optimize_result')}`
              : t('storage_optimize_clean'),
            'success'
          );
        } catch {
          setConfirm(null);
          showToast(t('storage_import_fail'), 'error');
        }
      },
    });
  }, [refreshStorageInfo, showToast, t]);

  const resetActions: { labelKey: TranslationKey; descKey: TranslationKey; action: () => void }[] = [
    { labelKey: 'reset_simulator_label', descKey: 'reset_simulator_desc', action: s.resetSimulator },
    { labelKey: 'reset_editor_label', descKey: 'reset_editor_desc', action: s.resetEditor },
    { labelKey: 'reset_general_label', descKey: 'reset_general_desc', action: s.resetGeneral },
    { labelKey: 'reset_all_label', descKey: 'reset_all_desc', action: s.resetAll },
  ];

  // Local click feedback for the plain <Button> actions on this page (the
  // shared Button component isn't touched — it's used across the whole app —
  // so the Sound/Haptic settings are applied here instead, scoped to Settings).
  const clickFx = () => {
    if (s.soundEffects) playClickSound();
    triggerHapticIfEnabled(s.hapticFeedback, 8);
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="mx-auto max-w-4xl">
      {/* Section selector — horizontal scroll on mobile, sidebar on desktop */}
      <div className="mb-5 flex gap-2 overflow-x-auto scrollbar-hide pb-1 sm:mb-6 md:hidden">
        {SECTIONS.map((sec) => (
          <button
            key={sec.id}
            onClick={() => {
              clickFx();
              setActiveSection(sec.id);
            }}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-colors',
              activeSection === sec.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground dark:bg-white/5'
            )}
            style={{ minHeight: 44 }}
          >
            <sec.icon size={16} />
            {t(sec.labelKey)}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <div className="hidden md:block w-56 shrink-0">
          <div className="sticky top-4 flex flex-col gap-1">
            {SECTIONS.map((sec) => (
              <button
                key={sec.id}
                onClick={() => {
                  clickFx();
                  setActiveSection(sec.id);
                }}
                className={cn(
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
                  activeSection === sec.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5'
                )}
              >
                <sec.icon size={18} />
                {t(sec.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Content area */}
        <div className="min-w-0 flex-1">
          {/* GENERAL */}
          {activeSection === 'general' && (
            <motion.div variants={stagger} initial="hidden" animate="show">
              <SectionHeader title={t('section_general')} />
              <Card>
                <CardContent className="p-0">
                  <motion.div variants={itemVar}>
                    <StackRow icon={Save} label={t('autosave_label')} description={t('autosave_desc')}>
                      <Segmented
                        aria-label={t('autosave_label')}
                        fullWidth
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
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Globe} label={t('language_label')} description={t('language_desc')}>
                      <Segmented
                        aria-label={t('language_label')}
                        value={s.language}
                        onChange={(v) => s.update({ language: v })}
                        options={[
                          { label: 'Indonesia', value: 'id' },
                          { label: 'English', value: 'en' },
                        ]}
                      />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Sparkles} label={t('animations_label')} description={t('animations_desc')}>
                      <Switch checked={s.animations} onChange={(v) => s.update({ animations: v })} aria-label={t('animations_label')} />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Volume2} label={t('sound_label')} description={t('sound_desc')}>
                      <Switch checked={s.soundEffects} onChange={(v) => s.update({ soundEffects: v })} aria-label={t('sound_label')} />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row
                      icon={Smartphone}
                      label={t('haptic_label')}
                      description={isHapticsSupported() ? t('haptic_desc') : t('haptic_unsupported')}
                    >
                      <Switch checked={s.hapticFeedback} onChange={(v) => s.update({ hapticFeedback: v })} aria-label={t('haptic_label')} />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row
                      icon={Monitor}
                      label={t('keepscreen_label')}
                      description={isWakeLockSupported() ? t('keepscreen_desc') : t('keepscreen_unsupported')}
                    >
                      <Switch checked={s.keepScreenOn} onChange={(v) => s.update({ keepScreenOn: v })} aria-label={t('keepscreen_label')} />
                    </Row>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* SIMULATOR */}
          {activeSection === 'simulator' && (
            <motion.div variants={stagger} initial="hidden" animate="show">
              <SectionHeader title={t('section_simulator')} />
              <Card>
                <CardContent className="p-0">
                  <motion.div variants={itemVar}>
                    <StackRow icon={Gauge} label={t('scantime_label')} description={t('scantime_desc')}>
                      <Segmented
                        aria-label={t('scantime_label')}
                        fullWidth
                        value={s.defaultScanTime}
                        onChange={(v) => s.update({ defaultScanTime: v })}
                        options={[
                          { label: '20ms', value: 20 },
                          { label: '50ms', value: 50 },
                          { label: '100ms', value: 100 },
                          { label: '200ms', value: 200 },
                        ]}
                      />
                    </StackRow>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Grid3x3} label={t('showgrid_label')} description={t('showgrid_desc')}>
                      <Switch checked={s.showGrid} onChange={(v) => s.update({ showGrid: v })} aria-label={t('showgrid_label')} />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Magnet} label={t('snapgrid_label')} description={t('snapgrid_desc')}>
                      <Switch checked={s.snapToGrid} onChange={(v) => s.update({ snapToGrid: v })} aria-label={t('snapgrid_label')} />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={GitBranch} label={t('highlightpath_label')} description={t('highlightpath_desc')}>
                      <Switch checked={s.highlightActivePath} onChange={(v) => s.update({ highlightActivePath: v })} aria-label={t('highlightpath_label')} />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={MapPin} label={t('showcoords_label')} description={t('showcoords_desc')}>
                      <Switch checked={s.showCoordinates} onChange={(v) => s.update({ showCoordinates: v })} aria-label={t('showcoords_label')} />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Activity} label={t('showfps_label')} description={t('showfps_desc')}>
                      <Switch checked={s.showFPS} onChange={(v) => s.update({ showFPS: v })} aria-label={t('showfps_label')} />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Zap} label={t('wireanim_label')} description={t('wireanim_desc')}>
                      <Switch checked={s.wireAnimation} onChange={(v) => s.update({ wireAnimation: v })} aria-label={t('wireanim_label')} />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Crosshair} label={t('autocenter_label')} description={t('autocenter_desc')}>
                      <Switch checked={s.canvasAutoCenter} onChange={(v) => s.update({ canvasAutoCenter: v })} aria-label={t('autocenter_label')} />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <StackRow icon={ZoomIn} label={t('zoom_label')} description={t('zoom_desc')}>
                      <Segmented
                        aria-label={t('zoom_label')}
                        fullWidth
                        value={s.defaultZoom}
                        onChange={(v) => s.update({ defaultZoom: v })}
                        options={[
                          { label: '50%', value: 50 },
                          { label: '75%', value: 75 },
                          { label: '100%', value: 100 },
                          { label: '125%', value: 125 },
                        ]}
                      />
                    </StackRow>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* EDITOR */}
          {activeSection === 'editor' && (
            <motion.div variants={stagger} initial="hidden" animate="show">
              <SectionHeader title={t('section_editor')} />
              <Card>
                <CardContent className="p-0">
                  <motion.div variants={itemVar}>
                    <StackRow icon={Grid2x2} label={t('gridsize_label')} description={t('gridsize_desc')}>
                      <Segmented
                        aria-label={t('gridsize_label')}
                        fullWidth
                        value={s.gridSize}
                        onChange={(v) => s.update({ gridSize: v })}
                        options={[
                          { label: '20px', value: 20 },
                          { label: '40px', value: 40 },
                          { label: '60px', value: 60 },
                        ]}
                      />
                    </StackRow>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Circle} label={t('nodesize_label')} description={t('nodesize_desc')}>
                      <Segmented
                        aria-label={t('nodesize_label')}
                        value={s.nodeSize}
                        onChange={(v) => s.update({ nodeSize: v })}
                        options={[
                          { label: t('nodesize_small'), value: 'small' },
                          { label: t('nodesize_medium'), value: 'medium' },
                          { label: t('nodesize_large'), value: 'large' },
                        ]}
                      />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <StackRow icon={History} label={t('undolimit_label')} description={t('undolimit_desc')}>
                      <Segmented
                        aria-label={t('undolimit_label')}
                        fullWidth
                        value={s.undoHistoryLimit}
                        onChange={(v) => s.update({ undoHistoryLimit: v })}
                        options={[
                          { label: '50', value: 50 },
                          { label: '100', value: 100 },
                          { label: '200', value: 200 },
                          { label: '500', value: 500 },
                        ]}
                      />
                    </StackRow>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Save} label={t('autobackup_label')} description={t('autobackup_desc')}>
                      <Switch checked={s.autoBackup} onChange={(v) => s.update({ autoBackup: v })} aria-label={t('autobackup_label')} />
                    </Row>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* STORAGE */}
          {activeSection === 'storage' && (
            <motion.div variants={stagger} initial="hidden" animate="show">
              <SectionHeader title={t('section_storage')} />
              <Card>
                <CardContent className="p-0">
                  <div className="space-y-3 px-4 py-4 sm:px-5">
                    {[
                      { label: t('storage_projects'), value: String(storageInfo.projectCount) },
                      { label: t('storage_quota'), value: storageInfo.storageQuota },
                      { label: t('storage_used'), value: storageInfo.storageUsed },
                      { label: t('storage_lastsave'), value: storageInfo.lastAutoSave },
                      { label: t('storage_type'), value: storageType },
                    ].map((row) => (
                      <motion.div key={row.label} variants={itemVar} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">{row.label}</span>
                        <span className="text-sm font-medium">{row.value}</span>
                      </motion.div>
                    ))}
                  </div>
                  <Divider />
                  <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5">
                    <Button variant="outline" onClick={() => { clickFx(); handleExportAll(); }} className="w-full justify-start">
                      <Download size={18} /> {t('storage_export')}
                    </Button>
                    <Button variant="outline" onClick={() => { clickFx(); handleImportBackup(); }} className="w-full justify-start">
                      <Upload size={18} /> {t('storage_import')}
                    </Button>
                    <Button variant="outline" onClick={() => { clickFx(); handleClearCache(); }} className="w-full justify-start">
                      <Trash2 size={18} /> {t('storage_clearcache')}
                    </Button>
                    <Button variant="outline" onClick={() => { clickFx(); handleOptimizeDb(); }} className="w-full justify-start">
                      <Zap size={18} /> {t('storage_optimize')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ABOUT */}
          {activeSection === 'about' && (
            <motion.div variants={stagger} initial="hidden" animate="show">
              <SectionHeader title={t('section_about')} />
              <Card>
                <CardContent className="p-5 sm:p-6">
                  <motion.div variants={itemVar} className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-sm">
                      <span className="font-display text-2xl font-bold">G</span>
                    </div>
                    <h3 className="font-display text-xl font-semibold">GENSPACE PLC</h3>
                    <p className="text-sm text-muted-foreground">{t('about_tagline')}</p>
                  </motion.div>
                  <div className="mt-6 space-y-3">
                    {[
                      { label: t('about_version'), value: pkg.version },
                      { label: t('about_build'), value: import.meta.env.MODE === 'production' ? 'Production' : 'Development' },
                      { label: t('about_platform'), value: isNativePlatform() ? 'Android (Capacitor)' : 'Web' },
                      { label: t('about_engine'), value: storageType },
                      { label: t('about_developer'), value: 'GENSPACE Team' },
                      { label: t('about_license'), value: 'MIT' },
                    ].map((row) => (
                      <motion.div key={row.label} variants={itemVar} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">{row.label}</span>
                        <span className="text-sm font-medium">{row.value}</span>
                      </motion.div>
                    ))}
                  </div>
                  <div className="mt-6 space-y-2">
                    <motion.a
                      variants={itemVar}
                      href={REPO_URL}
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={clickFx}
                      className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/40 dark:hover:bg-white/5"
                      style={{ minHeight: 44 }}
                    >
                      <span className="flex items-center gap-2">
                        <Github size={16} />
                        {t('about_source')}
                      </span>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </motion.a>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* RESET */}
          {activeSection === 'reset' && (
            <motion.div variants={stagger} initial="hidden" animate="show">
              <SectionHeader title={t('section_reset')} />
              <Card>
                <CardContent className="p-0">
                  {resetActions.map((action, idx) => (
                    <motion.div key={action.labelKey} variants={itemVar}>
                      {idx > 0 && <Divider />}
                      <button
                        onClick={() => {
                          clickFx();
                          setConfirm({
                            title: t(action.labelKey),
                            message: `${t(action.descKey)}. ${t('reset_confirm_message')}`,
                            confirmLabel: t(action.labelKey),
                            onConfirm: () => {
                              action.action();
                              setConfirm(null);
                              showToast(t(action.labelKey), 'success');
                            },
                          });
                        }}
                        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 dark:hover:bg-white/5 sm:px-5 sm:py-4"
                        style={{ minHeight: 44 }}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                            <RotateCcw size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-tight">{t(action.labelKey)}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{t(action.descKey)}</p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                      </button>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel}
        cancelLabel={t('reset_cancel')}
        destructive
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />

      <ToastViewport toast={toast} onDismiss={dismissToast} />
    </motion.div>
  );
}
