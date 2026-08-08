-- Reference schema for the device-local store.
-- The IndexedDB adapter (Phase 1) mirrors these four tables as object
-- stores; this file becomes the literal migration once real SQLite
-- (@capacitor-community/sqlite) is wired in during the APK phase.

create table offline_projects (
  id text primary key,
  name text not null,
  description text not null default '',
  plc_type text not null default 'generic',
  scan_rate integer not null default 50,
  version text not null default '1.0',
  created_at text not null,
  updated_at text not null,
  ladder_json text not null,
  address_map text not null default '{}',
  synced integer not null default 0
);

create table offline_materials (
  id text primary key,
  title text not null,
  content text not null,
  category text not null
);

create table offline_settings (
  key text primary key,
  value text
);

create table simulation_cache (
  project_id text not null,
  scan_state text not null,
  updated_at text not null
);
