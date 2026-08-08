# GENSPACE PLC — Phase 1: Foundation

Fondasi project sesuai blueprint arsitektur. Scope Phase 1 **sengaja dibatasi** ke:

1. Project folder structure
2. React + Vite + TypeScript setup
3. Tailwind setup (design tokens dari brief: primary #F26B3A, secondary #FFF6EE, dark #1B1B1B, gray/muted #E5E5E5)
4. shadcn/ui-pattern components (Button, Card) — ditulis manual mengikuti konvensi shadcn, karena `npx shadcn-ui init` butuh koneksi internet saat generate
5. Routing (React Router, 7 halaman placeholder)
6. Zustand store per domain (theme, user, plc, quiz, gamification)
7. Supabase client
8. SQLite Service (lihat catatan penting di bawah)
9. Basic theme system (light/dark/system, persisted, dengan toggle animasi)

**Belum dibuat** (sengaja, sesuai instruksi): PLC engine, ladder canvas, quiz logic, teacher dashboard logic, gamifikasi logic, nav bar penuh/bottom nav, Capacitor/APK.

## Cara Menjalankan

```bash
npm install
npm run dev
```

`.env` sudah diisi dengan kredensial Supabase yang kamu berikan. `.env.example` disediakan untuk referensi/tim lain.

## Catatan Penting: SQLite Service

Item #8 ("SQLite Service") di Phase 1 ini diimplementasikan sebagai:
- `src/services/localDb/types.ts` → kontrak `ILocalDb` (storage-agnostic)
- `src/services/localDb/indexedDbAdapter.ts` → implementasi berbasis **IndexedDB browser** (tanpa dependency tambahan, tanpa perlu instalasi wasm/sql.js)
- `src/services/localDb/sqliteService.ts` → facade bertipe yang dipakai fitur lain, method-nya (`saveProject`, `getProject`, dst) mengikuti skema `offline_projects`, `offline_materials`, `offline_settings`, `simulation_cache` dari blueprint

Kenapa bukan SQLite asli sekarang: SQLite native baru relevan lewat `@capacitor-community/sqlite` setelah project dibungkus Capacitor (Week 11 di roadmap 12 minggu). Sebelum itu, di browser (dev/web), tidak ada SQLite asli yang bisa dipakai — jadi Phase 1 pakai IndexedDB sebagai implementasi sementara yang punya kontrak (`ILocalDb`) identik. Saat masuk fase APK, tinggal buat satu class baru (`CapacitorSqliteAdapter implements ILocalDb`) dan ganti satu baris di `getLocalDb()` — tidak ada kode fitur lain yang perlu diubah.

## Struktur Folder

```
src/
  app/            # App shell, router, providers (ThemeProvider)
  pages/          # Route-level screens (masih placeholder, kecuali Home)
  components/
    ui/           # Primitif shadcn-style (Button, Card)
    layout/       # RootLayout, ThemeToggle
  stores/         # Zustand — satu file per domain
  services/
    supabaseClient.ts
    localDb/      # ILocalDb, IndexedDB adapter, sqliteService facade
  database/
    sqlite/       # Reference schema offline (.sql)
    supabase/     # Catatan schema Supabase (SQL lengkap ada di dokumen blueprint)
  simulator/
    engine/       # Sengaja kosong — dibangun di fase engine (belum sekarang)
  types/
  utils/
  styles/         # globals.css (Tailwind layers + efek glass)
```

## Langkah Selanjutnya (di luar scope Phase 1 ini)
- Bangun PLC engine di `src/simulator/engine` (parser, runtime, scan cycle)
- Bangun Home dashboard lengkap + bottom nav/sidebar
- Jalankan SQL schema Supabase (profiles, projects, exams, dst + RLS) dari dokumen blueprint
- Auth flow (login/signup) mengisi `userStore`

---

## Update: UI 4 Halaman (Home, Simulator, Quiz, Profile)

Ditambahkan setelah Phase 1: **UI murni**, tanpa business logic, untuk 4 halaman:

- **Home** — bento grid (Welcome Banner, Continue Project, Daily Challenge, Leaderboard Preview, Recent Activity, Feature Cards), semua data dummy/hardcoded.
- **Simulator** — toolbar (Undo/Redo/Zoom/Run/Stop/Reset/Save), palette 9 komponen ladder dengan glyph SVG IEC-style yang digambar manual (bukan icon generik), canvas mock 2 rung ladder. Tombol Run cuma toggle animasi CSS/SVG dekoratif (`isPreviewRunning`) — **bukan** scan cycle sungguhan.
- **Quiz** — layar join-kode (5 kotak OTP-style) dan layar contoh soal (progress bar, tipe soal, 4 opsi jawaban yang bisa dipilih secara visual). Toggle antar layar cuma `useState` lokal untuk keperluan preview, tidak ada validasi kode/grading nyata.
- **Profile** — XP ring (SVG animated), streak, grid badge (unlocked/locked), achievements, teaser sertifikat. Semua angka hardcoded.

Ditambahkan juga:
- `SidebarNav` (desktop) + `BottomNav` (mobile) di `src/components/layout/NavBar.tsx` — nav-nya sengaja cuma mencakup 4 halaman ini (Home/Simulator/Quiz/Profile); Materials/Ranking/Teacher Dashboard masih ada route-nya dari Phase 1 tapi belum masuk nav sampai UI-nya dibangun.
- `Badge` dan `Progress` sebagai komponen shadcn-style baru di `src/components/ui/`.

Semua halaman ini type-check bersih (dicek manual pakai `tsc --noEmit`, error yang muncul cuma "module not found" karena `node_modules` belum di-install — akan hilang otomatis setelah `npm install`).
