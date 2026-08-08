# Phase 5.5 — PLC Runtime Verification & Debugger

Scope: **verify first, tool second**, per the brief ("Debugger hanyalah
alat. Prioritas utama adalah Runtime Verification"). No new project, no
architecture change, no new parser, no Runtime Engine replacement. Every
file below is either brand new (isolated, additive) or an additive
extension of an existing non-forbidden file.

## Runtime Verification — the actual finding

Before writing any Debugger code, the whole Runtime was read end-to-end
against the brief's compliance checklist: Scan Cycle order, Power Flow,
Memory Update, Contact, Coil, Timer, Counter, Edge Detection, Instruction
Execution.

**Result: the existing engine already matches industrial PLC behavior on
every point in the checklist.** Specifically confirmed by reading the code
(not assumed):

- **Scan Cycle** (`engine/scanCycle.ts`): already the exact order the
  brief asks for — Read Inputs → Execute Ladder → Execute Timer → Execute
  Counter → (Execute Instructions, Phase 5.4) → Commit Memory → Write
  Outputs, all within one frozen-snapshot-then-commit pass, every scan.
- **Power Flow** (`engine/evaluateRung.ts`): series = AND, parallel = OR,
  nested/multiple branches all fall out of one generic recursive
  graph-walk with memoization — confirmed no special-cased branch logic
  exists, and confirmed power never "jumps" a node (every node's power-in
  is strictly `predecessors.some(evalNode)`) and stops the instant a
  condition is false (a CONTACT returns `poweredIn && contactPasses`, not
  an unconditional pass-through).
- **Contact & Coil** (`evaluateRung.ts` + `scanCycle.ts`): NO/NC/rising/
  falling all read `PlcState` bits via `readBit()`, never UI/component
  state. SET/RESET coils latch correctly (`applyCoilWrite`), NORMAL coils
  follow the rung every scan.
- **Self Holding** (Start → Seal-In → Stop → Reset): not a special engine
  feature — it's an ordinary parallel branch (START OR seal-in contact)
  in series with an NC STOP contact, feeding a coil that also seals itself
  in. Verified end-to-end in the new automated test (below) rather than
  assumed from the architecture.
- **Timer** (`engine/timerEngine.ts`): TON/TOF/TP all present and correct
  — Preset, Current Value (`accumulatedMs`), Done Bit, Enable Bit
  (`isPowered`), Reset (`resetAddress`, Phase 5.3) are all there, all
  driven by `scanIntervalMs` accumulation inside the Scan Cycle. **No
  `setTimeout()` anywhere in the engine** — confirmed by reading the file,
  not by grep alone.
- **Counter** (`engine/counterEngine.ts`): CTU/CTD both present, both
  driven by `risingEdge = isPowered && !wasPowered` — confirmed a counter
  held `true` across multiple scans increments exactly once (see the CTU
  test below), RES correctly zeroes/reloads via `resetAddress`.
- **Edge Detection** (`evaluateRung.ts`'s `evaluateContactMode` +
  `PlcState.edgeMemory`): RISING_EDGE/FALLING_EDGE contacts compare
  against last scan's raw bit and are true for exactly one scan —
  confirmed via the DIFU/DIFD tests below (a contact held true for 3
  scans only pulses on scan 1).
- **Instruction Execution** (`engine/instructionEngine.ts`, Phase 5.4):
  re-confirmed correct with a fresh MOV test under this phase's own
  harness (not just re-trusting Phase 5.4's script).

Given this, **Phase 5.5's actual work was building the verification proof
and the Debugger tooling around a Runtime that needed no logic changes** —
not silently "fixing" anything, since there was nothing non-compliant to
fix. This is stated plainly rather than padded with invented changes.

## New Files (all additive — nothing forbidden touched)

### `engine/runtimeVerification.ts` + `examples/runPhase55Example.ts`

The Automated Runtime Test the brief asks for, minimum set and then some:
Start/Stop, Self Holding, Series (AND), Parallel (OR), Nested Branch, TON,
TOF, TP, CTU, CTD, RES, SET/RESET, DIFU, DIFD, plus one Instruction Coil
sanity check. Every test builds a real `LadderProject` via the existing
`elementFactory`, compiles it with the real, unmodified `parseLadder`, and
drives it through the real, unmodified `runScanCycle` — nothing mocked.
Each test returns `{ name, pass, detail, executionTimeMs }`, matching the
brief's "PASS / FAIL / Execution Time" requirement exactly. The CLI
script and the in-app Debugger's "Run Automated Runtime Test" button both
call `runAllRuntimeTests()` — one source of truth, not two copies of the
same assertions.

Run with:
```bash
npx tsx src/simulator/examples/runPhase55Example.ts
```
**Result: 15/15 PASSED**, ~9ms total. All six prior phases' scripts
(`runExample`, `runEditorExample`, `runPhase5Example`, `runPhase52Example`,
`runPhase53Example`, `runPhase54Example`) were also re-run — **zero
regressions**, matching the pattern every prior phase doc has established.

### `engine/runtimeDiagnostics.ts`

**Detects nothing new.** `validateRung()` and `validateProjectAddresses()`
(`parser/validateLadder.ts`, zero lines changed) already catch Broken Wire
(floating element / no outgoing connection), Floating Branch (unmatched
BRANCH_START/END), Duplicate Address (Timer/Counter/coil), Invalid
Address, Invalid Timer/Counter (bad preset or address type), and Invalid
Loop (cycle) — this file's only job is to call those exact validators
per-rung inside try/catch and collect every result instead of
fail-fast-on-first, because a Debugger needs "show me everything wrong at
once," while the parser correctly needs "refuse to load a broken program."
Two categories from the brief the parser doesn't already name explicitly
are added here: **Dead Branch** (a BRANCH_START wired straight to its
matching BRANCH_END with nothing inside) and **Memory Overflow**
(surfaced live from Phase 5.4's `PlcState.instructionLog[i].error`, not
re-derived — `instructionEngine.ts`'s `clampWord` already detects this).

### `engine/crossReference.ts`

Find Usage / Find Definition, per the brief's "klik Q1 → tampilkan semua
Contact dan Coil yang menggunakan Q1" (click Q1 → show every Contact and
Coil using Q1). Purely an index over `LadderProject.rungs[].elements[]`
— every element already carries its own `address`, so this reads what's
already there rather than tracking anything new. `parseAddressLabel()`
accepts both engine-native (`M1`) and Omron-flavored (`Q1` for output,
`T1` for timer, `C1` for counter) address text for the search box.

### `engine/scanStats.ts`

Scan Time Monitor's reducer. `runScanCycle()` has returned `durationMs`
every scan since Phase 2 — this only keeps a rolling window (cap 500
samples) and computes current/average/max/min, plus `countProgramSize()`
for Instruction Count / Rung Count from the already-compiled program. No
new timing source.

## Extended Files (additive only — behavior for existing callers unchanged)

### `runtime/plcRuntime.ts`

Not the Logic Engine, Parser, or Scan Cycle — this is the framework-
agnostic wrapper class the brief's own "PROJECT" section doesn't list
among the forbidden files, and Phase 5.4 already established the pattern
of extending it additively. Every Phase 2-5.4 method
(`loadProject`/`start`/`stop`/`reset`/`step`/`setInput`/`subscribe`) is
byte-for-byte unchanged in behavior; new methods only:

- `forceBit(type, number, value)` / `releaseForce(...)` /
  `releaseAllForces()` / `getForcedAddresses()` — **Force Mode**. Forces
  are applied as a state override immediately *after* each scan commits
  (`applyForces()`), never by skipping or altering the Scan Cycle itself —
  this is what "Force tidak menghentikan Scan Cycle" (Force does not halt
  the Scan Cycle) means in practice: the scan runs exactly as before,
  forcing only pins the visible bit afterward, same as a real PLC's force
  table sitting on top of (not instead of) the I/O scan.
- `findUsages(address)` — thin delegation to `engine/crossReference.ts`.
- `getSnapshot()` gained three additive fields on `RuntimeSnapshot`:
  `scanStats`, `programSize`, `diagnostics` (static diagnostics
  recomputed once per `loadProject()`, live instruction diagnostics
  recomputed every `step()` from that scan's `instructionLog`).

### `stores/plcStore.ts`

Same shape as before — every action still just delegates to `plcRuntime`,
zero simulation logic added here. New reactive slices
(`scanStats`/`programSize`/`diagnostics`) and new actions
(`forceBit`/`releaseForce`/`releaseAllForces`/`getForcedAddresses`/
`findUsages`) are thin pass-throughs, exactly like every existing action.

## Debugger UI (new, additive)

`features/plc-simulator/components/DebuggerPanel.tsx` — seven tabs, all
presentation over data the Runtime already produces every scan:

- **Watch Window** — I/Q/M/T/C/D, live, straight from `PlcState`.
- **Live Memory Viewer** — Current/Previous/Last-Scan-Change/Address/Type.
  "Previous" is computed by diffing against last render's snapshot
  client-side (a plain ref) — `PlcState` itself only ever needs to carry
  "now," matching how a real PLC's memory table works; the diffing is the
  Debugger's job, not the Runtime's.
- **Force Mode** — Force ON / Force OFF / Release Force / Release All.
- **Scan Time Monitor** — Current/Average/Max/Min scan time, Scan Count,
  Instruction Count, Rung Count.
- **Runtime Diagnostics** — live list from `runtimeDiagnostics.ts`.
- **Cross Reference** — address search box (`Q1`, `T2`, ...) → usage list.
- **Automated Runtime Test** — a button that runs the same
  `runAllRuntimeTests()` the CLI script uses and renders PASS/FAIL +
  execution time per test, in-app.

Wired into `LadderEditorScreen.tsx` behind a "Show Debugger" toggle (one
new button, one new boolean, one new conditional render) — the canvas,
palette, toolbar, and `SimulationPanel` are all otherwise untouched.

## Verification (real, not claimed)

- `npx tsx src/simulator/examples/runPhase55Example.ts` — **15/15 PASSED**.
- `runExample.ts`, `runEditorExample.ts`, `runPhase5Example.ts`,
  `runPhase52Example.ts`, `runPhase53Example.ts`, `runPhase54Example.ts`
  all re-run unchanged — **zero regressions** (0 `MISMATCH` lines across
  all six).
- `npx tsc -b` — no errors introduced by any Phase 5.5 file. A handful of
  pre-existing errors remain in files this phase never touched
  (`vite.config.ts`, `NavBar.tsx`, `evaluateRung.ts`,
  `instructionEngine.ts`, `elementFactory.ts`, `editor/componentSpec.ts`,
  `editor/operations.ts`) — these predate this phase and are out of scope
  per the brief's own prohibition on touching the Logic Engine/Parser;
  fixing them was not attempted.
- `npx vite build` — full production bundle succeeds (2135 modules,
  ~748kB JS), confirming the new Debugger UI compiles and bundles
  correctly end-to-end, not just in isolation.

## What This Phase Deliberately Did NOT Change

Per the brief: no new project, no new parser, no architecture change, no
Runtime Engine replacement, no Logic Engine behavior change. `evaluateRung.ts`,
`parser/parseLadder.ts`, and `parser/validateLadder.ts` have zero lines
changed from Phase 5.4. `scanCycle.ts`, `timerEngine.ts`, and
`counterEngine.ts` are equally untouched — Phase 5.5 found them already
compliant and proved it, rather than editing them to match a checklist
they already satisfied.
