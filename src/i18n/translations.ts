import { useSettingsStore, type Language } from '@/stores/settingsStore';

/**
 * Minimal, dependency-free i18n layer.
 *
 * Scope note: this project has no i18n infrastructure yet, so this file is
 * the whole thing — a flat key -> {id, en} dictionary plus a `useT()` hook
 * that reads the active language straight from `settingsStore.language`
 * (the same store the Settings page already writes to). No provider, no
 * routing changes, nothing outside the Settings system needed to change for
 * this to work; any component can opt in by calling `useT()`.
 *
 * Currently wired up in: the Settings page (full) and the app nav labels
 * (Home/Simulator/Settings/Profile/Teacher), so switching the Language
 * setting has an immediately visible, real effect on the interface.
 */

export const dictionary = {
  // --- Nav ---------------------------------------------------------------
  nav_home: { id: 'Beranda', en: 'Home' },
  nav_simulator: { id: 'Simulator', en: 'Simulator' },
  nav_settings: { id: 'Pengaturan', en: 'Settings' },
  nav_profile: { id: 'Profil', en: 'Profile' },
  nav_guest: { id: 'Tamu', en: 'Guest' },
  nav_teacher: { id: 'Guru', en: 'Teacher' },

  // --- Section tabs --------------------------------------------------------
  section_general: { id: 'Umum', en: 'General' },
  section_simulator: { id: 'Simulator', en: 'Simulator' },
  section_editor: { id: 'Editor', en: 'Editor' },
  section_storage: { id: 'Penyimpanan', en: 'Storage' },
  section_about: { id: 'Tentang', en: 'About' },
  section_reset: { id: 'Reset', en: 'Reset' },

  // --- General -------------------------------------------------------------
  autosave_label: { id: 'Simpan Otomatis', en: 'Auto Save' },
  autosave_desc: { id: 'Simpan pekerjaan Anda secara otomatis', en: 'Automatically save your work' },
  autosave_off: { id: 'MATI', en: 'OFF' },

  theme_label: { id: 'Tema', en: 'Theme' },
  theme_desc: { id: 'Terang, gelap, atau ikuti sistem', en: 'Light, dark, or system default' },
  theme_light: { id: 'Terang', en: 'Light' },
  theme_dark: { id: 'Gelap', en: 'Dark' },
  theme_system: { id: 'Sistem', en: 'System' },

  language_label: { id: 'Bahasa', en: 'Language' },
  language_desc: { id: 'Bahasa antarmuka aplikasi', en: 'Interface language' },

  animations_label: { id: 'Animasi', en: 'Animations' },
  animations_desc: { id: 'Aktifkan animasi dan transisi UI', en: 'Enable UI animations and transitions' },

  sound_label: { id: 'Efek Suara', en: 'Sound Effects' },
  sound_desc: { id: 'Putar suara saat berinteraksi', en: 'Play sounds on interactions' },

  haptic_label: { id: 'Getaran (Haptic)', en: 'Haptic Feedback' },
  haptic_desc: { id: 'Getar saat menyentuh kontrol (Android)', en: 'Vibrate on control touch (Android)' },
  haptic_unsupported: { id: 'Tidak didukung di perangkat ini', en: 'Not supported on this device' },

  keepscreen_label: { id: 'Layar Tetap Menyala', en: 'Keep Screen On' },
  keepscreen_desc: { id: 'Selama simulator sedang berjalan', en: 'While simulator is running' },
  keepscreen_unsupported: { id: 'Browser tidak mendukung Wake Lock', en: 'Wake Lock not supported by this browser' },

  // --- Simulator -----------------------------------------------------------
  scantime_label: { id: 'Waktu Scan Default', en: 'Default Scan Time' },
  scantime_desc: { id: 'Durasi siklus scan PLC', en: 'PLC scan cycle duration' },

  showgrid_label: { id: 'Tampilkan Grid', en: 'Show Grid' },
  showgrid_desc: { id: 'Tampilkan garis grid di kanvas', en: 'Display grid lines on canvas' },

  snapgrid_label: { id: 'Snap ke Grid', en: 'Snap To Grid' },
  snapgrid_desc: { id: 'Selaraskan elemen ke grid', en: 'Align elements to grid' },

  highlightpath_label: { id: 'Sorot Jalur Aktif', en: 'Highlight Active Path' },
  highlightpath_desc: { id: 'Tampilkan aliran daya saat mode Run', en: 'Show power-flow in run mode' },

  showcoords_label: { id: 'Tampilkan Koordinat', en: 'Show Coordinates' },
  showcoords_desc: { id: 'Tampilkan label baris/kolom sel', en: 'Display cell row/column labels' },

  showfps_label: { id: 'Tampilkan FPS', en: 'Show FPS' },
  showfps_desc: { id: 'Tampilkan overlay frame per detik', en: 'Display frames per second overlay' },

  wireanim_label: { id: 'Animasi Kabel', en: 'Wire Animation' },
  wireanim_desc: { id: 'Animasikan aliran daya pada kabel', en: 'Animate wire power flow' },

  autocenter_label: { id: 'Pusatkan Kanvas Otomatis', en: 'Canvas Auto Center' },
  autocenter_desc: { id: 'Pusatkan tampilan saat dimuat', en: 'Center view on load' },

  zoom_label: { id: 'Zoom Default', en: 'Default Zoom' },
  zoom_desc: { id: 'Level zoom awal', en: 'Initial zoom level' },

  // --- Editor ----------------------------------------------------------------
  gridsize_label: { id: 'Ukuran Grid', en: 'Grid Size' },
  gridsize_desc: { id: 'Ukuran sel dalam piksel', en: 'Cell size in pixels' },

  nodesize_label: { id: 'Ukuran Komponen', en: 'Node Size' },
  nodesize_desc: { id: 'Ukuran visual komponen', en: 'Component visual size' },
  nodesize_small: { id: 'Kecil', en: 'Small' },
  nodesize_medium: { id: 'Sedang', en: 'Medium' },
  nodesize_large: { id: 'Besar', en: 'Large' },

  undolimit_label: { id: 'Batas Riwayat Undo', en: 'Undo History Limit' },
  undolimit_desc: { id: 'Jumlah maksimum langkah undo tersimpan', en: 'Maximum undo steps stored' },

  autobackup_label: { id: 'Cadangan Otomatis', en: 'Auto Backup' },
  autobackup_desc: { id: 'Buat cadangan sebelum perubahan besar', en: 'Create backup before major changes' },

  // --- Storage -----------------------------------------------------------------
  storage_projects: { id: 'Jumlah Proyek', en: 'Number of Projects' },
  storage_quota: { id: 'Kuota Penyimpanan', en: 'Storage Quota' },
  storage_used: { id: 'Penyimpanan Terpakai', en: 'Storage Used' },
  storage_lastsave: { id: 'Simpan Otomatis Terakhir', en: 'Last Auto Save' },
  storage_type: { id: 'Jenis Penyimpanan', en: 'Storage Type' },
  storage_export: { id: 'Ekspor Semua Proyek', en: 'Export All Projects' },
  storage_import: { id: 'Impor Cadangan', en: 'Import Backup' },
  storage_clearcache: { id: 'Hapus Cache', en: 'Clear Cache' },
  storage_optimize: { id: 'Optimalkan Database', en: 'Optimize Database' },
  storage_never: { id: 'Belum ada', en: 'Never' },
  storage_export_success: { id: 'Cadangan berhasil diunduh', en: 'Backup downloaded' },
  storage_import_success: { id: 'proyek berhasil diimpor', en: 'project(s) imported' },
  storage_import_fail: { id: 'File cadangan tidak valid', en: 'Invalid backup file' },
  storage_optimize_result: { id: 'entri cache tidak terpakai dibersihkan', en: 'orphaned cache entr(y/ies) cleaned' },
  storage_optimize_clean: { id: 'Database sudah rapi, tidak ada yang perlu dibersihkan', en: 'Database already tidy — nothing to clean' },

  // --- About -------------------------------------------------------------------
  about_tagline: { id: 'Simulator Logika Ladder PLC', en: 'PLC Ladder Logic Simulator' },
  about_version: { id: 'Versi', en: 'Version' },
  about_build: { id: 'Mode Build', en: 'Build Mode' },
  about_developer: { id: 'Pengembang', en: 'Developer' },
  about_license: { id: 'Lisensi', en: 'License' },
  about_platform: { id: 'Platform', en: 'Platform' },
  about_engine: { id: 'Mesin Penyimpanan', en: 'Storage Engine' },
  about_source: { id: 'Lihat Kode Sumber di GitHub', en: 'View Source on GitHub' },

  // --- Reset ---------------------------------------------------------------------
  reset_simulator_label: { id: 'Reset Pengaturan Simulator', en: 'Reset Simulator Settings' },
  reset_simulator_desc: { id: 'Waktu scan, grid, zoom, animasi', en: 'Scan time, grid, zoom, animations' },
  reset_editor_label: { id: 'Reset Pengaturan Editor', en: 'Reset Editor Settings' },
  reset_editor_desc: { id: 'Ukuran grid, ukuran node, batas undo, cadangan', en: 'Grid size, node size, undo limit, backup' },
  reset_general_label: { id: 'Reset Pengaturan UI', en: 'Reset UI Settings' },
  reset_general_desc: { id: 'Tema, bahasa, animasi, suara', en: 'Theme, language, animations, sound' },
  reset_all_label: { id: 'Reset Semua Pengaturan', en: 'Reset Everything' },
  reset_all_desc: { id: 'Kembalikan semua pengaturan ke default pabrik', en: 'Restore all settings to factory defaults' },
  reset_confirm_message: {
    id: 'Nilai pengaturan akan dikembalikan ke default. Proyek dan data yang tersimpan TIDAK akan dihapus.',
    en: 'Setting values will be restored to default. Your saved projects and data will NOT be deleted.',
  },
  reset_cancel: { id: 'Batal', en: 'Cancel' },

  // --- Common dialogs ------------------------------------------------------------
  cache_clear_title: { id: 'Hapus Cache', en: 'Clear Cache' },
  cache_clear_message: {
    id: 'Ini akan menghapus cache simulasi di browser. Proyek Anda tidak akan terpengaruh.',
    en: 'This clears the browser simulation cache. Your projects will not be affected.',
  },
  optimize_title: { id: 'Optimalkan Database', en: 'Optimize Database' },
  optimize_message: {
    id: 'Membersihkan entri cache simulasi yang sudah tidak terpakai (proyeknya sudah dihapus). Proyek yang masih ada tidak akan tersentuh.',
    en: 'Removes simulation-cache entries whose project no longer exists. Existing projects are left untouched.',
  },
} as const;

export type TranslationKey = keyof typeof dictionary;

export function translate(key: TranslationKey, lang: Language): string {
  return dictionary[key][lang] ?? dictionary[key].en;
}

/** Reads the active language from settingsStore and returns a `t(key)` translator. */
export function useT() {
  const lang = useSettingsStore((s) => s.language);
  return {
    lang,
    t: (key: TranslationKey) => translate(key, lang),
  };
}
