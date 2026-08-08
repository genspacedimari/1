import { supabase } from '@/services/supabaseClient';
import type { School } from '@/types/user';

export async function searchSchools(query: string): Promise<School[]> {
  if (!query || query.trim().length < 2) return [];
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, city, province, country')
    .ilike('name', `%${query.trim()}%`)
    .order('name')
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    province: r.province,
    country: r.country,
  }));
}

export async function requestSchool(input: {
  name: string;
  city?: string;
  province?: string;
  country?: string;
}): Promise<void> {
  const { error } = await supabase.from('school_requests').insert({
    name: input.name,
    city: input.city ?? '',
    province: input.province ?? '',
    country: input.country ?? 'Indonesia',
  });
  if (error) throw error;
}

export async function fetchSchoolById(id: string): Promise<School | null> {
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, city, province, country')
    .eq('id', id)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  return { id: data.id, name: data.name, city: data.city, province: data.province, country: data.country };
}
