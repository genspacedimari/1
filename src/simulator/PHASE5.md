# Phase 5 — CX-Programmer-Grade PLC Behavior

Scope: make the simulator behave like a real PLC (Omron CX-Programmer
reference), extending the existing engine/editor/canvas **additively**.
No existing file was renamed, no folder was restructured, no existing
public function signature changed — every change below either adds a new
optional field (safe for all Phase 2-4 data) or extends a union type
(existing values still valid).

## Address Naming: Why This Still Uses I/O/TIM/CTU/M, Not I/Q/M/T/C

The brief's own examples use Siemens/generic-PLC-style prefixes (Q for
output, T for timer, C for counter). The existing architecture — every
type, the parser, the engine, the editor, the canvas, and all six Phase 2
example JSONs — is built on **I/O/TIM/CTU/M**. Renaming the address system
to match the brief literally would itself be the "mengubah arsitektur
existing" the brief explicitly forbids, and would break every project file
already on disk. This phase keeps I/O/TIM/CTU/M and implements everything
the brief actually asks for (SET/RESET coils, TOF/TP/CTD, edge detection,
self-holding, double-click properties, etc.) on top of it.

## What Changed, File by File

**types/ladder.ts** (additive)
- `ContactMode`: `'NO' | 'NC'` → `'NO' | 'NC' | 'RISING_EDGE' | 'FALLING_EDGE'`
- `CoilElement.coilMode?: 'NORMAL' | 'SET' | 'RESET'` (new optional field, defaults to NORMAL)
- `TimerElement.timerType`: `'TON'` → `'TON' | 'TOF' | 'TP'`
- `CounterElement.counterType`: `'CTU'` → `'CTU' | 'CTD'`
- `BaseElement` gains optional `comment?: string` / `alias?: string` (double-click dialog metadata)

**types/plcState.ts** (additive)
- `PlcState.edgeMemory: Record<string, boolean>` — one bit per edge-detect
  CONTACT instance (keyed by element id, matching how real differentiate-up/
  down instructions each keep independent memory)

**engine/evaluateRung.ts**
- `evaluateRung`'s return changed from a bare `Map` to `{ powered, edgeMemoryUpdates }`. The only caller (`scanCycle.ts`) was updated in the same commit. Series/parallel/nested-branch logic is byte-for-byte unchanged — it's still pure predecessor-OR graph evaluation (see Phase 2 ARCHITECTURE.md decision #1); RISING_EDGE/FALLING_EDGE is a new case inside contact evaluation, not a change to the graph algorithm.

**engine/timerEngine.ts / engine/counterEngine.ts**
- Public `updateTimer`/`updateCounter` signatures **unchanged**; both now dispatch internally on `timerType`/`counterType`. TON/CTU behavior for existing programs is identical to Phase 2 — verified by re-running `runExample.ts` unchanged (see Verification below).

**engine/scanCycle.ts**
- Coil commits now go through `applyCoilWrite()`, which honors SET (latch on)/RESET (latch off)/NORMAL (follow rung result) instead of blindly overwriting. Still deterministic, still top-to-bottom rung order, still the same 6-step pipeline — see the updated file header comment for how that maps onto the brief's 8-step description.

**parser/validateLadder.ts / parser/parseLadder.ts** (additive)
- New `validateProjectAddresses()` catches duplicate Timer/Counter addresses and duplicate NORMAL-coil addresses across the *whole* project (existing `validateRung()` only ever saw one rung). Multiple SET/RESET coils sharing one address is correctly **allowed** (that's the standard latching pattern) — only NORMAL-vs-NORMAL and NORMAL-vs-SET/RESET on the same address are flagged.

**models/elementFactory.ts** (additive)
- `createCoil`/`createTimer`/`createCounter` gained optional trailing parameters (`coilMode`, `timerType`, `counterType`) with defaults matching prior behavior — every Phase 3/4 call site still compiles unchanged.

**simulator/editor/operations.ts** (additive)
- New `updateElementProperties()` backs the double-click dialog. Nothing existing in this file was touched.

## New UI, Built On the Existing Store/Canvas

- **Double-click property dialog** (`PropertyDialog.tsx`): Address/Comment/Alias, wired through a new `updateElement` action on the *existing* `ladderEditorStore.ts` (additive, same `guarded()` error-handling pattern as every other action there).
- **Palette**: SET/RESET coils, TOF/TP timers, CTD counter, rising/falling-edge contacts — all through the existing `specForDragKind` → `createElementFromSpec` → `elementFactory` pipeline, no new drop-handling code needed in `LadderCanvas.tsx`.
- **Simulation Panel** (`SimulationPanel.tsx`): I1-I26 toggles, O1-O26 lamps, reading/writing the existing `usePlcStore`.
- **Toolbar**: Reset and Step buttons expose `usePlcStore`'s `reset()`/`step()` — both already existed in Phase 2's `PlcRuntime`, just not surfaced in the UI until now. Added a Continuous/Single-Scan mode toggle and a scan-count + scan-duration readout (`state.scanCount`/`state.lastScanDurationMs`, also already existing fields).
- **Live monitor color**: powered elements/wires now render in green (`COLOR_POWER_ON`), matching CX-Programmer's convention. Scoped to this one rendering concern — the app's orange brand color is untouched everywhere else (buttons, badges, theme).

## Verification (Real, Not Claimed)

`npx tsx src/simulator/examples/runPhase5Example.ts` builds seven scenarios
against the real engine and checks actual-vs-expected for each:

1. Self-holding/seal-in circuit + NC stop button — proves the classic
   "Start OR (seal-in via own contact), AND NOT Stop" latch works with
   **zero engine changes** (contacts reading a coil's own address already
   worked in Phase 2; it's a one-scan-delayed reference, not a graph cycle).
2. SET/RESET coil latching, independent of the powering rung.
3. TOF timer — instant-on, delayed-off, cancel-on-repower.
4. TP timer — fixed-duration pulse that ignores early input release.
5. CTD counter — loads full, counts down on rising edge, done at zero, reset reloads to preset.
6. RISING_EDGE/FALLING_EDGE contacts — exactly one scan of power per transition.
7. Duplicate-address validation — rejects two NORMAL coils or two Timers sharing an address, and confirms SET+RESET sharing an address is correctly allowed.

Every scenario matched its expected output. `runExample.ts` (Phase 2) and
`runEditorExample.ts` (Phase 3) were also re-run unchanged after every
engine edit in this phase and still pass identically — nothing regressed.

A JSON round-trip test (export → `JSON.parse(JSON.stringify(...))` →
import) confirmed `comment`, `alias`, `coilMode`, and edge `mode` all
survive save/reload.

## Honestly Not Done This Pass

- Re-syncing a running simulation when the diagram is edited mid-RUN (current behavior: Stop, edit, Run again — same "download program" mental model as real PLC software, not silently live-patched).
- A dedicated "RES" coil/instruction distinct from `CounterElement.resetAddress` — the brief's "RES Counter" is implemented as the reset-bit input that already existed in Phase 2, not a new coil type. If a standalone RES *coil* (writable from any rung, not just a reset-bit wired to the counter) turns out to be what's wanted, that's a small additive follow-up.
- Horizontal-vs-vertical branch as visually distinct tools in the Branch UI — the engine/editor already support arbitrary nested branches (Phase 2 design decision #1), but the canvas's Branch mode is still the one generic "click two anchors" gesture from Phase 4, not separate horizontal/vertical affordances.
