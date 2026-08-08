export type UserRole = 'student' | 'teacher' | 'admin';

export type AuthMode = 'authenticated' | 'guest';

/** Visible role for the login/register screens — admin is never shown. */
export type PublicRole = 'student' | 'teacher';

export interface School {
  id: string;
  name: string;
  city: string;
  province: string;
  country: string;
}

export interface Profile {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
  bio?: string | null;
  xp: number;
  level: number;
  schoolId?: string | null;
  schoolName?: string | null;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string | null;
}

/** Row shape returned by Supabase for the profiles table. */
export interface ProfileRow {
  id: string;
  full_name: string;
  username: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  bio: string | null;
  xp: number;
  level: number;
  school_id: string | null;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export function profileRowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    email: row.email,
    role: row.role,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    xp: row.xp,
    level: row.level,
    schoolId: row.school_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLogin: row.last_login,
  };
}
