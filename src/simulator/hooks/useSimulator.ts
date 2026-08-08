import { useEffect } from 'react';
import { usePlcStore } from '@/stores/plcStore';
import type { LadderProject } from '@/simulator/types/ladder';

/**
 * Convenience hook for the (future) Simulator UI: optionally auto-loads a
 * project on mount, then returns the same reactive slice usePlcStore
 * already provides. Lives in simulator/hooks (not stores/) because it's
 * specific to wiring a project into the runtime, not general app state.
 */
export function useSimulator(project?: LadderProject) {
  const store = usePlcStore();

  useEffect(() => {
    if (project) store.loadProject(project);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  return store;
}
