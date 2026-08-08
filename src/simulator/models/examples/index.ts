import type { LadderProject } from '@/simulator/types/ladder';
import simpleExample from './simpleExample.json';
import seriesExample from './seriesExample.json';
import parallelExample from './parallelExample.json';
import timerExample from './timerExample.json';
import counterExample from './counterExample.json';
import memoryExample from './memoryExample.json';

// Cast through `unknown` rather than `as LadderProject` directly — these
// files are meant to be hand-editable JSON, so we don't want TS silently
// widening/narrowing literal `kind` strings in a way that hides a typo.
export const EXAMPLES = {
  simple: simpleExample as unknown as LadderProject,
  series: seriesExample as unknown as LadderProject,
  parallel: parallelExample as unknown as LadderProject,
  timer: timerExample as unknown as LadderProject,
  counter: counterExample as unknown as LadderProject,
  memory: memoryExample as unknown as LadderProject,
};
