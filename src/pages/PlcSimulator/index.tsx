import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useThemeStore, resolveTheme } from '@/stores/themeStore';
import SimulatorEditorScreen from '@/features/plc-simulator/components/SimulatorEditorScreen';
import { useProjectStore } from '@/features/plc-simulator/projectStore';
import type { PlcProject } from '@/features/plc-simulator/projectTypes';

/**
 * The simulator renders full-screen, bypassing the app shell entirely via a
 * portal to document.body. The app layout's <main> uses `animate-fade-in`,
 * which applies a CSS transform — that creates a containing block that breaks
 * `position: fixed` children, trapping the simulator inside the padded main
 * area. Portaling to body sidesteps the layout's transform/padding so the
 * editor gets the true viewport it needs.
 *
 * The page now loads a specific project by ID from the project store, passes
 * it to the editor, and handles save/export on the editor's callback.
 */
export default function PlcSimulatorPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const mode = useThemeStore((s) => s.mode);
  const [mounted, setMounted] = useState(false);
  const [project, setProject] = useState<PlcProject | null>(null);
  const [loading, setLoading] = useState(true);
  const getProject = useProjectStore((s) => s.getProject);
  const saveLadder = useProjectStore((s) => s.saveLadder);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getProject(projectId).then(p => {
      if (p) setProject(p);
      setLoading(false);
    });
  }, [projectId, getProject]);

  if (!mounted) return null;

  if (loading) {
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B1B1B' }}>
        <p style={{ color: '#FFF6EE', fontFamily: 'Inter', fontSize: 14 }}>Loading project...</p>
      </div>,
      document.body,
    );
  }

  if (!project) {
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#1B1B1B' }}>
        <p style={{ color: '#FFF6EE', fontFamily: 'Inter', fontSize: 16, fontWeight: 600 }}>Project not found</p>
        <button
          onClick={() => navigate('/simulator')}
          style={{ backgroundColor: '#F26B3A', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', fontFamily: 'Inter', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          Back to Projects
        </button>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      <SimulatorEditorScreen
        projectName={project.name}
        theme={resolveTheme(mode)}
        project={project}
        onBack={() => navigate('/simulator')}
        onSaveLadder={(ladderJson) => saveLadder(project.id, ladderJson)}
      />
    </div>,
    document.body,
  );
}
