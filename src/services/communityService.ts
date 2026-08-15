import { supabase } from '@/services/supabaseClient';
import type { School } from '@/types/user';

export interface Community extends School {
  ownerTeacherId: string | null;
  inviteCode: string | null;
  inviteLink: string | null;
}

export interface CommunityPreview {
  id: string;
  name: string;
  city: string;
  province: string;
  country: string;
  ownerTeacherName: string | null;
  totalClasses: number;
  totalStudents: number;
  inviteCode: string | null;
}

function rowToCommunity(row: Record<string, unknown>): Community {
  return {
    id: row.id as string,
    name: row.name as string,
    city: row.city as string,
    province: row.province as string,
    country: row.country as string,
    ownerTeacherId: (row.owner_teacher_id as string | null) ?? null,
    inviteCode: (row.invite_code as string | null) ?? null,
    inviteLink: (row.invite_link as string | null) ?? null,
  };
}

function generateInviteCode(name: string): string {
  const prefix = name.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase() || 'GEN';
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${random}`;
}

export async function searchCommunities(query: string): Promise<Community[]> {
  if (!query || query.trim().length < 2) return [];
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, city, province, country, owner_teacher_id, invite_code, invite_link')
    .ilike('name', `%${query.trim()}%`)
    .order('name')
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((r) => rowToCommunity(r as Record<string, unknown>));
}

export async function createCommunity(input: {
  name: string;
  city?: string;
  province?: string;
  country?: string;
  teacherId: string;
}): Promise<Community> {
  const inviteCode = generateInviteCode(input.name);
  const inviteLink = `${window.location.origin}/join/${inviteCode}`;
  const { data, error } = await supabase
    .from('schools')
    .insert({
      name: input.name.trim(),
      city: input.city ?? '',
      province: input.province ?? '',
      country: input.country ?? 'Indonesia',
      owner_teacher_id: input.teacherId,
      invite_code: inviteCode,
      invite_link: inviteLink,
    })
    .select('id, name, city, province, country, owner_teacher_id, invite_code, invite_link')
    .single();
  if (error) throw error;

  // Set school_id on the teacher's profile
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ school_id: (data as Record<string, unknown>).id })
    .eq('id', input.teacherId);
  if (profileErr) throw profileErr;

  return rowToCommunity(data as Record<string, unknown>);
}

export async function joinCommunityAsTeacher(communityId: string, teacherId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ school_id: communityId })
    .eq('id', teacherId);
  if (error) throw error;
}

export async function lookupCommunityByCode(code: string): Promise<CommunityPreview | null> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return null;

  const { data: schoolRow, error } = await supabase
    .from('schools')
    .select('id, name, city, province, country, owner_teacher_id, invite_code')
    .eq('invite_code', cleanCode)
    .maybeSingle();
  if (error || !schoolRow) return null;

  const row = schoolRow as Record<string, unknown>;
  const ownerTeacherId = row.owner_teacher_id as string | null;

  // Fetch owner teacher name
  let ownerTeacherName: string | null = null;
  if (ownerTeacherId) {
    const { data: teacher } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', ownerTeacherId)
      .maybeSingle();
    ownerTeacherName = (teacher as { full_name: string } | null)?.full_name ?? null;
  }

  // Count classes
  const { count: totalClasses } = await supabase
    .from('classes')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', row.id as string);

  // Count students (profiles with this school_id)
  const { count: totalStudents } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', row.id as string)
    .eq('role', 'student');

  return {
    id: row.id as string,
    name: row.name as string,
    city: row.city as string,
    province: row.province as string,
    country: row.country as string,
    ownerTeacherName,
    totalClasses: totalClasses ?? 0,
    totalStudents: totalStudents ?? 0,
    inviteCode: (row.invite_code as string | null) ?? null,
  };
}

export async function joinCommunity(communityId: string, studentId: string): Promise<void> {
  // Check if student already has a community
  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', studentId)
    .maybeSingle();
  const existingSchoolId = (profile as { school_id: string | null } | null)?.school_id;
  if (existingSchoolId) {
    throw new Error('You are already in a community. Leave it first to join a new one.');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ school_id: communityId })
    .eq('id', studentId);
  if (error) throw error;
}

export async function leaveCommunity(studentId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ school_id: null })
    .eq('id', studentId);
  if (error) throw error;
}

/**
 * Fetches a community (school) by id.
 *
 * IMPORTANT: unlike the old implementation, this NEVER silently swallows
 * a real database/RLS error — it logs it and re-throws so the caller can
 * distinguish "community genuinely doesn't exist" (returns null, no error)
 * from "the fetch failed" (throws). Swallowing errors here was the root
 * cause of the Community page incorrectly showing "Community not found"
 * even when the row existed.
 */
export async function fetchCommunityById(id: string): Promise<Community | null> {
  console.log('Fetching school...', id);
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, city, province, country, owner_teacher_id, invite_code, invite_link')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('fetchCommunityById error:', error.message, error);
    throw error;
  }
  if (!data) {
    console.log('School loaded — no row found for id', id);
    return null;
  }
  console.log('School loaded', data);
  return rowToCommunity(data as Record<string, unknown>);
}

export async function regenerateInviteCode(communityId: string, name: string): Promise<string> {
  const inviteCode = generateInviteCode(name);
  const inviteLink = `${window.location.origin}/join/${inviteCode}`;
  const { error } = await supabase
    .from('schools')
    .update({ invite_code: inviteCode, invite_link: inviteLink })
    .eq('id', communityId);
  if (error) {
    console.error('regenerateInviteCode error:', error.message, error);
    throw error;
  }
  return inviteCode;
}

/**
 * Guarantees a community has an invite_code + invite_link.
 * If either is missing (older rows created before invite codes existed,
 * or a row where the DB trigger didn't fire), generates and persists them.
 * Returns the community with invite_code/invite_link guaranteed non-null.
 */
export async function ensureInviteCode(community: Community): Promise<Community> {
  if (community.inviteCode && community.inviteLink) return community;
  console.log('Community missing invite code — generating one', community.id);
  const inviteCode = community.inviteCode ?? generateInviteCode(community.name);
  const inviteLink = community.inviteLink ?? `${window.location.origin}/join/${inviteCode}`;
  const { data, error } = await supabase
    .from('schools')
    .update({ invite_code: inviteCode, invite_link: inviteLink })
    .eq('id', community.id)
    .select('id, name, city, province, country, owner_teacher_id, invite_code, invite_link')
    .single();
  if (error) {
    console.error('ensureInviteCode error:', error.message, error);
    throw error;
  }
  return rowToCommunity(data as Record<string, unknown>);
}

export async function updateCommunity(
  communityId: string,
  input: { name?: string; city?: string; province?: string; country?: string }
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.city !== undefined) row.city = input.city;
  if (input.province !== undefined) row.province = input.province;
  if (input.country !== undefined) row.country = input.country;
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase.from('schools').update(row).eq('id', communityId);
  if (error) throw error;
}

export async function deleteCommunity(communityId: string): Promise<void> {
  const { error } = await supabase.from('schools').delete().eq('id', communityId);
  if (error) throw error;
}

export async function fetchCommunityMembers(communityId: string): Promise<{
  teachers: { id: string; fullName: string; email: string; avatarUrl: string | null }[];
  students: { id: string; fullName: string; email: string; avatarUrl: string | null }[];
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, avatar_url')
    .eq('school_id', communityId)
    .order('full_name');
  if (error) {
    console.error('fetchCommunityMembers error:', error.message, error);
    throw error;
  }
  const rows = (data ?? []) as Array<{ id: string; full_name: string; email: string; role: string; avatar_url: string | null }>;
  return {
    teachers: rows.filter((r) => r.role === 'teacher').map((r) => ({ id: r.id, fullName: r.full_name, email: r.email, avatarUrl: r.avatar_url ?? null })),
    students: rows.filter((r) => r.role === 'student').map((r) => ({ id: r.id, fullName: r.full_name, email: r.email, avatarUrl: r.avatar_url ?? null })),
  };
}

export async function fetchCommunityClasses(communityId: string): Promise<{
  id: string;
  name: string;
  joinCode: string;
  teacherName: string;
  studentCount: number;
}[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, join_code, teacher_id')
    .eq('school_id', communityId)
    .order('name');
  if (error) {
    console.error('fetchCommunityClasses error:', error.message, error);
    throw error;
  }
  const rows = (data ?? []) as Array<{ id: string; name: string; join_code: string; teacher_id: string }>;

  const result: { id: string; name: string; joinCode: string; teacherName: string; studentCount: number }[] = [];
  for (const cls of rows) {
    const { data: teacher } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', cls.teacher_id)
      .maybeSingle();
    const teacherName = (teacher as { full_name: string } | null)?.full_name ?? 'Unknown';

    const { count: studentCount } = await supabase
      .from('class_students')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', cls.id);

    result.push({
      id: cls.id,
      name: cls.name,
      joinCode: cls.join_code,
      teacherName,
      studentCount: studentCount ?? 0,
    });
  }
  return result;
}

export async function fetchAvailableClassesForCommunity(communityId: string): Promise<{
  id: string;
  name: string;
  joinCode: string;
  teacherName: string;
  studentCount: number;
}[]> {
  return fetchCommunityClasses(communityId);
}
