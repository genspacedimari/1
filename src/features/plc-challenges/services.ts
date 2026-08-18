import { supabase } from '@/services/supabaseClient';
import { useAuthStore } from '@/stores/authStore';
import type { MasterProgram } from './types';

function getTeacherId(): string {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

interface ProgramRow {
  id: string;
  teacher_id: string;
  name: string;
  description: string | null;
  ladder_json: string;
  created_at: string;
  updated_at: string;
}

function mapProgram(row: ProgramRow): MasterProgram {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    name: row.name,
    description: row.description ?? '',
    ladderJson: row.ladder_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchMasterPrograms(): Promise<MasterProgram[]> {
  const teacherId = getTeacherId();
  const { data, error } = await supabase
    .from('genspace_plc_programs')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as ProgramRow[]).map(mapProgram);
}

export async function createMasterProgram(input: {
  name: string;
  description?: string;
  ladderJson: string;
}): Promise<MasterProgram> {
  const teacherId = getTeacherId();
  const { data, error } = await supabase
    .from('genspace_plc_programs')
    .insert({
      teacher_id: teacherId,
      name: input.name,
      description: input.description ?? '',
      ladder_json: input.ladderJson,
    })
    .select()
    .single();
  if (error) throw error;
  return mapProgram(data as ProgramRow);
}

export async function updateMasterProgram(id: string, input: {
  name?: string;
  description?: string;
  ladderJson?: string;
}): Promise<void> {
  const teacherId = getTeacherId();
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.ladderJson !== undefined) payload.ladder_json = input.ladderJson;
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase
    .from('genspace_plc_programs')
    .update(payload)
    .eq('id', id)
    .eq('teacher_id', teacherId);
  if (error) throw error;
}
