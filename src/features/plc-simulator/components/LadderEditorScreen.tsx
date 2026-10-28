import { useThemeStore, resolveTheme } from '@/stores/themeStore';
import SimulatorEditorScreen from './SimulatorEditorScreen';
import type { LadderProject } from '@/simulator/types/ladder';

export interface LadderEditorScreenProps {
  initialProject?: LadderProject | null;
  initialLadderJson?: string | null;
  onSaveLadder?: (ladderJson: string) => void;
  saveLabel?: string;
  readOnly?: boolean;
  isTeacherMode?: boolean;
  isStudentMode?: boolean;
  onChangeLadder?: (ladderJson: string) => void;
}

/**
 * LadderEditorScreen delegating directly to the real PLC Simulator (SimulatorEditorScreen).
 * Guarantees 100% visual and tool synchronicity between Challenge Editor, Quiz, and Simulator.
 */
export function LadderEditorScreen({
  initialProject = null,
  initialLadderJson = null,
  onSaveLadder,
  saveLabel = 'Simpan Program',
  readOnly = false,
  isTeacherMode = false,
  isStudentMode = false,
  onChangeLadder,
}: LadderEditorScreenProps) {
  const mode = useThemeStore((s) => s.mode);
  const rawJson = initialLadderJson || (initialProject ? JSON.stringify(initialProject) : null);

  return (
    <div className="w-full h-full min-h-[560px] relative rounded-2xl overflow-hidden border border-border dark:border-border-dark shadow-sm">
      <SimulatorEditorScreen
        projectName={readOnly ? 'Program Asli (Kunci Jawaban)' : isTeacherMode ? 'Editor Soal (Simulator)' : 'Jawaban Siswa'}
        theme={resolveTheme(mode)}
        initialLadderJson={rawJson}
        readOnly={readOnly}
        isEmbedded={true}
        isTeacherMode={isTeacherMode}
        isStudentMode={isStudentMode}
        saveLabel={saveLabel}
        onChangeLadder={onChangeLadder}
        onSaveLadder={onSaveLadder}
      />
    </div>
  );
}
