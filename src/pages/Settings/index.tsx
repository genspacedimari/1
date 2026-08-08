import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, FileSliders as Sliders, CreditCard as Edit3, Database, Info, RotateCcw, ChevronRight, Download, Upload, Trash2, Zap, Moon, Globe, Sparkles, Volume2, Smartphone, Monitor, Grid3x3, Magnet, GitBranch, MapPin, Gauge, Activity, Crosshair, ZoomIn, Grid2x2, Circle, History, Save } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Segmented } from '@/components/ui/segmented';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useSettingsStore } from '@/stores/settingsStore';
import { useThemeStore, type ThemeMode } from '@/stores/themeStore';
import { sqliteService } from '@/services/localDb/sqliteService';
import { isNativePlatform } from '@/services/localDb';
import { cn } from '@/utils/cn';

type SectionId = 'general' | 'simulator' | 'editor' | 'storage' | 'about' | 'reset';

const SECTIONS: { id: SectionId; label: string; icon: typeof SettingsIcon }[] = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'simulator', label: 'Simulator', icon: Sliders },
  { id: 'editor', label: 'Editor', icon: Edit3 },
  { id: 'storage', label: 'Storage', icon: Database },
  { id: 'about', label: 'About', icon: Info },
  { id: 'reset', label: 'Reset', icon: RotateCcw },
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
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">{label}</p>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="mx-5 border-t border-border dark:border-border-dark" />;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="mb-2 mt-6 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {title}
    </h2>
  );
}

export default function SettingsPage() {
  const s = useSettingsStore();
  const themeMode = useThemeStore((st) => st.mode);
  const setThemeMode = useThemeStore((st) => st.setMode);
  const [activeSection, setActiveSection] = useState<SectionId>('general');

  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // --- Storage info ---
  const [storageInfo, setStorageInfo] = useState({
    projectCount: 0,
    dbSize: '—',
    storageUsed: '—',
    lastAutoSave: '—',
  });

  const refreshStorageInfo = useCallback(async () => {
    try {
      const projects = await sqliteService.listProjects();
      const estimate = navigator.storage?.estimate;
      let used = '—';
      let total = '—';
      if (estimate) {
        const est = await estimate();
        used = formatBytes(est.usage ?? 0);
        total = formatBytes(est.quota ?? 0);
      }
      setStorageInfo({
        projectCount: projects.length,
        dbSize: total,
        storageUsed: used,
        lastAutoSave: projects.length > 0
          ? new Date(Math.max(...projects.map((p) => new Date(p.updatedAt).getTime()))).toLocaleString()
          : '—',
      });
    } catch {
      /* keep defaults */
    }
  }, []);

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
    } catch { /* ignore */ }
  }, []);

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
        }
      } catch { /* ignore invalid file */ }
    };
    input.click();
  }, [refreshStorageInfo]);

  const handleClearCache = useCallback(() => {
    setConfirm({
      title: 'Clear Cache',
      message: 'This will clear the simulation cache. Your projects will not be affected.',
      confirmLabel: 'Clear Cache',
      onConfirm: () => {
        if ('caches' in window) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
        setConfirm(null);
        refreshStorageInfo();
      },
    });
  }, [refreshStorageInfo]);

  const handleOptimizeDb = useCallback(() => {
    setConfirm({
      title: 'Optimize Database',
      message: 'This will compact the local database. It may take a few seconds.',
      confirmLabel: 'Optimize',
      onConfirm: () => {
        setConfirm(null);
        refreshStorageInfo();
      },
    });
  }, [refreshStorageInfo]);

  const resetActions: { label: string; desc: string; action: () => void }[] = [
    { label: 'Reset Simulator Settings', desc: 'Scan time, grid, zoom, animations', action: s.resetSimulator },
    { label: 'Reset Editor Settings', desc: 'Grid size, node size, undo limit, backup', action: s.resetEditor },
    { label: 'Reset UI Settings', desc: 'Theme, language, animations, sound', action: s.resetGeneral },
    {
      label: 'Reset Everything',
      desc: 'Restore all settings to factory defaults',
      action: s.resetAll,
    },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="mx-auto max-w-4xl">
      {/* Section selector — horizontal scroll on mobile, sidebar on desktop */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2 md:hidden">
        {SECTIONS.map((sec) => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors',
              activeSection === sec.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground dark:bg-white/5'
            )}
            style={{ minHeight: 44 }}
          >
            <sec.icon size={16} />
            {sec.label}
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
                onClick={() => setActiveSection(sec.id)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
                  activeSection === sec.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5'
                )}
              >
                <sec.icon size={18} />
                {sec.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content area */}
        <div className="min-w-0 flex-1">
          {/* GENERAL */}
          {activeSection === 'general' && (
            <motion.div variants={stagger} initial="hidden" animate="show">
              <SectionHeader title="General" />
              <Card>
                <CardContent className="p-0">
                  <motion.div variants={itemVar}>
                    <Row icon={Save} label="Auto Save" description="Automatically save your work">
                      <Segmented
                        aria-label="Auto Save"
                        value={s.autoSave}
                        onChange={(v) => s.update({ autoSave: v })}
                        options={[
                          { label: 'OFF', value: 'off' },
                          { label: '30s', value: '30s' },
                          { label: '1m', value: '1m' },
                          { label: '5m', value: '5m' },
                          { label: '10m', value: '10m' },
                        ]}
                      />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Moon} label="Theme" description="Light, dark, or system default">
                      <Segmented
                        aria-label="Theme"
                        value={themeMode}
                        onChange={(v) => setThemeMode(v as ThemeMode)}
                        options={[
                          { label: 'Light', value: 'light' },
                          { label: 'Dark', value: 'dark' },
                          { label: 'System', value: 'system' },
                        ]}
                      />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Globe} label="Language" description="Interface language">
                      <Segmented
                        aria-label="Language"
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
                    <Row icon={Sparkles} label="Animations" description="Enable UI animations and transitions">
                      <Switch checked={s.animations} onChange={(v) => s.update({ animations: v })} aria-label="Animations" />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Volume2} label="Sound Effects" description="Play sounds on interactions">
                      <Switch checked={s.soundEffects} onChange={(v) => s.update({ soundEffects: v })} aria-label="Sound Effects" />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Smartphone} label="Haptic Feedback" description="Vibration on touch (Android)">
                      <Switch checked={s.hapticFeedback} onChange={(v) => s.update({ hapticFeedback: v })} aria-label="Haptic Feedback" />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Monitor} label="Keep Screen On" description="While simulator is running">
                      <Switch checked={s.keepScreenOn} onChange={(v) => s.update({ keepScreenOn: v })} aria-label="Keep Screen On" />
                    </Row>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* SIMULATOR */}
          {activeSection === 'simulator' && (
            <motion.div variants={stagger} initial="hidden" animate="show">
              <SectionHeader title="Simulator" />
              <Card>
                <CardContent className="p-0">
                  <motion.div variants={itemVar}>
                    <Row icon={Gauge} label="Default Scan Time" description="PLC scan cycle duration">
                      <Segmented
                        aria-label="Scan Time"
                        value={s.defaultScanTime}
                        onChange={(v) => s.update({ defaultScanTime: v })}
                        options={[
                          { label: '20ms', value: 20 },
                          { label: '50ms', value: 50 },
                          { label: '100ms', value: 100 },
                          { label: '200ms', value: 200 },
                        ]}
                      />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Grid3x3} label="Show Grid" description="Display grid lines on canvas">
                      <Switch checked={s.showGrid} onChange={(v) => s.update({ showGrid: v })} aria-label="Show Grid" />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Magnet} label="Snap To Grid" description="Align elements to grid">
                      <Switch checked={s.snapToGrid} onChange={(v) => s.update({ snapToGrid: v })} aria-label="Snap To Grid" />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={GitBranch} label="Highlight Active Path" description="Show power-flow in run mode">
                      <Switch checked={s.highlightActivePath} onChange={(v) => s.update({ highlightActivePath: v })} aria-label="Highlight Active Path" />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={MapPin} label="Show Coordinates" description="Display cell row/column labels">
                      <Switch checked={s.showCoordinates} onChange={(v) => s.update({ showCoordinates: v })} aria-label="Show Coordinates" />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Activity} label="Show FPS" description="Display frames per second overlay">
                      <Switch checked={s.showFPS} onChange={(v) => s.update({ showFPS: v })} aria-label="Show FPS" />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Zap} label="Wire Animation" description="Animate wire power flow">
                      <Switch checked={s.wireAnimation} onChange={(v) => s.update({ wireAnimation: v })} aria-label="Wire Animation" />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Crosshair} label="Canvas Auto Center" description="Center view on load">
                      <Switch checked={s.canvasAutoCenter} onChange={(v) => s.update({ canvasAutoCenter: v })} aria-label="Canvas Auto Center" />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={ZoomIn} label="Default Zoom" description="Initial zoom level">
                      <Segmented
                        aria-label="Default Zoom"
                        value={s.defaultZoom}
                        onChange={(v) => s.update({ defaultZoom: v })}
                        options={[
                          { label: '50%', value: 50 },
                          { label: '75%', value: 75 },
                          { label: '100%', value: 100 },
                          { label: '125%', value: 125 },
                        ]}
                      />
                    </Row>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* EDITOR */}
          {activeSection === 'editor' && (
            <motion.div variants={stagger} initial="hidden" animate="show">
              <SectionHeader title="Editor" />
              <Card>
                <CardContent className="p-0">
                  <motion.div variants={itemVar}>
                    <Row icon={Grid2x2} label="Grid Size" description="Cell size in pixels">
                      <Segmented
                        aria-label="Grid Size"
                        value={s.gridSize}
                        onChange={(v) => s.update({ gridSize: v })}
                        options={[
                          { label: '20px', value: 20 },
                          { label: '40px', value: 40 },
                          { label: '60px', value: 60 },
                        ]}
                      />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Circle} label="Node Size" description="Component visual size">
                      <Segmented
                        aria-label="Node Size"
                        value={s.nodeSize}
                        onChange={(v) => s.update({ nodeSize: v })}
                        options={[
                          { label: 'Small', value: 'small' },
                          { label: 'Medium', value: 'medium' },
                          { label: 'Large', value: 'large' },
                        ]}
                      />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={History} label="Undo History Limit" description="Maximum undo steps stored">
                      <Segmented
                        aria-label="Undo Limit"
                        value={s.undoHistoryLimit}
                        onChange={(v) => s.update({ undoHistoryLimit: v })}
                        options={[
                          { label: '50', value: 50 },
                          { label: '100', value: 100 },
                          { label: '200', value: 200 },
                          { label: '500', value: 500 },
                        ]}
                      />
                    </Row>
                  </motion.div>
                  <Divider />
                  <motion.div variants={itemVar}>
                    <Row icon={Save} label="Auto Backup" description="Create backup before major changes">
                      <Switch checked={s.autoBackup} onChange={(v) => s.update({ autoBackup: v })} aria-label="Auto Backup" />
                    </Row>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* STORAGE */}
          {activeSection === 'storage' && (
            <motion.div variants={stagger} initial="hidden" animate="show">
              <SectionHeader title="Storage" />
              <Card>
                <CardContent className="p-0">
                  <div className="px-5 py-4 space-y-3">
                    {[
                      { label: 'Number of Projects', value: String(storageInfo.projectCount) },
                      { label: 'Database Size', value: storageInfo.dbSize },
                      { label: 'Storage Used', value: storageInfo.storageUsed },
                      { label: 'Last Auto Save', value: storageInfo.lastAutoSave },
                      { label: 'Storage Type', value: storageType },
                    ].map((row) => (
                      <motion.div key={row.label} variants={itemVar} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{row.label}</span>
                        <span className="text-sm font-medium">{row.value}</span>
                      </motion.div>
                    ))}
                  </div>
                  <Divider />
                  <div className="p-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Button variant="outline" onClick={handleExportAll} className="w-full justify-start">
                      <Download size={18} /> Export All Projects
                    </Button>
                    <Button variant="outline" onClick={handleImportBackup} className="w-full justify-start">
                      <Upload size={18} /> Import Backup
                    </Button>
                    <Button variant="outline" onClick={handleClearCache} className="w-full justify-start">
                      <Trash2 size={18} /> Clear Cache
                    </Button>
                    <Button variant="outline" onClick={handleOptimizeDb} className="w-full justify-start">
                      <Zap size={18} /> Optimize Database
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ABOUT */}
          {activeSection === 'about' && (
            <motion.div variants={stagger} initial="hidden" animate="show">
              <SectionHeader title="About" />
              <Card>
                <CardContent className="p-6">
                  <motion.div variants={itemVar} className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-sm">
                      <span className="font-display text-2xl font-bold">G</span>
                    </div>
                    <h3 className="font-display text-xl font-semibold">GENSPACE PLC</h3>
                    <p className="text-sm text-muted-foreground">PLC Ladder Logic Simulator</p>
                  </motion.div>
                  <div className="mt-6 space-y-3">
                    {[
                      { label: 'Version', value: '1.0.0' },
                      { label: 'Build Number', value: '100' },
                      { label: 'Developer', value: 'GENSPACE Team' },
                      { label: 'License', value: 'MIT' },
                    ].map((row) => (
                      <motion.div key={row.label} variants={itemVar} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{row.label}</span>
                        <span className="text-sm font-medium">{row.value}</span>
                      </motion.div>
                    ))}
                  </div>
                  <div className="mt-6 space-y-2">
                    {['Privacy Policy', 'Terms of Service', 'Open Source Licenses'].map((link) => (
                      <motion.button
                        key={link}
                        variants={itemVar}
                        className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/40 dark:hover:bg-white/5"
                        style={{ minHeight: 44 }}
                      >
                        {link}
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </motion.button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* RESET */}
          {activeSection === 'reset' && (
            <motion.div variants={stagger} initial="hidden" animate="show">
              <SectionHeader title="Reset" />
              <Card>
                <CardContent className="p-0">
                  {resetActions.map((action, idx) => (
                    <motion.div key={action.label} variants={itemVar}>
                      {idx > 0 && <Divider />}
                      <button
                        onClick={() =>
                          setConfirm({
                            title: action.label,
                            message: `${action.desc}. This cannot be undone.`,
                            confirmLabel: action.label,
                            onConfirm: () => {
                              action.action();
                              setConfirm(null);
                            },
                          })
                        }
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40 dark:hover:bg-white/5"
                        style={{ minHeight: 44 }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                            <RotateCcw size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-medium leading-tight">{action.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
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
        destructive
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </motion.div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
