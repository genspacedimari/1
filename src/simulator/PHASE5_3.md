# Phase 5.3 — PLC Execution Instruction Engine

Scope: **logic only**, per the brief. TON/TOF/TP, CTU/CTD, and edge
detection (rising/falling/one-shot) already existed from Phase 5.1 — this
phase's real gap, after analysis, was that **Timer had no Reset**
(Counter has had `resetAddress` since Phase 5.1) and three validation
categories from the brief weren't checked yet (Invalid Preset, Invalid
Reference, plus confirming Missing Address/Duplicate Timer/Duplicate
Counter still hold from Phase 5.1/5.2). No new project, no new parser, no
architecture change — every edit below is additive or a small, justified
refactor (extracting one duplicated helper).

## What Changed

**types/ladder.ts** (additive)
- `TimerElement.resetAddress?: Address` — mirrors `CounterElement.resetAddress`, which has existed since Phase 5.1.

**engine/resetBit.ts** (new, small refactor)
- `counterEngine.ts` had a private `readResetBit()`. Since Timer now needs
  the identical function, it was extracted into this one shared file
  instead of duplicating it — a small, justified refactor, not a
  restructure. `counterEngine.ts`'s behavior is unchanged; it just imports
  the helper now.

**engine/timerEngine.ts**
- `updateTimer()`'s public signature gained one parameter (`state: PlcState`, needed to read `resetAddress`) — the only caller, `scanCycle.ts`, was updated in the same commit. TON/TOF/TP behavior for programs that don't use `resetAddress` is byte-for-byte unchanged (confirmed — see Verification). When Reset is active, current value and Done Bit are forced to 0/false for that scan regardless of the Enable Bit, checked once ahead of the TON/TOF/TP-specific logic.

**engine/scanCycle.ts**
- One-line change: passes `snapshot` as the new argument to `updateTimer()`. The 6-step pipeline (Read Input → Execute Logic → Timer → Counter → Memory → Output) is unchanged and already matches the brief's requested order exactly.

**models/elementFactory.ts / simulator/editor/componentSpec.ts** (additive)
- `createTimer()` gained an optional trailing `resetAddress` parameter (mirrors `createCounter`). `NewComponentSpec`'s TIMER variant gained an optional `resetAddress` field for parity with COUNTER's.

**parser/validateLadder.ts** (additive)
- **Invalid Preset**: a Timer with `presetMs <= 0` or a Counter with `presetCount <= 0` is now rejected — previously any number, including 0 or negative, silently passed through.
- **Invalid Reference**: a Timer/Counter `resetAddress` must be type `I` or `M` and a valid 1-26 address number. Before this, wiring a reset to, say, an Output address wouldn't error — it would just silently never fire, because `readResetBit()`'s fallback returns `false` for anything it doesn't recognize. That fallback still exists as defense-in-depth, but the real guard is now here, at load time, with a message naming the exact element.
- **Duplicate Timer / Duplicate Counter / Missing Address** were already implemented in Phase 5.1/5.2 (`validateProjectAddresses`, `ADDRESSED_KINDS` check) — reconfirmed still working, not re-implemented.

## PLC Memory, Confirmed Unchanged

The brief asks that "all Timer and Counter must read PLC Memory" and "all
Done Bit / Current Value are stored in Memory." This has been true since
Phase 2: `PlcState.timers[n]` / `.counters[n]` (`{ presetMs/presetCount,
accumulatedMs/accumulatedCount, done, poweredLastScan }`) *is* that memory
— there is no separate/parallel storage, and no code path where a
timer/counter reads anything other than this `PlcState`. Nothing needed to
change here; this section is a confirmation, not a diff.

## Live Monitor — Deliberately Not Touched This Phase

The brief's own instruction is "Fokus pada LOGIKA. BUKAN UI," so no new
display component was built for Timer/Counter current-value/preset/done.
The data those would show already updates live every scan
(`usePlcStore().state.timers` / `.counters`, unchanged from Phase 2) —
wiring that into a visible readout on the canvas is a UI task for a future
phase, not a logic gap.

## Verification (Real, Not Claimed)

`npx tsx src/simulator/examples/runPhase53Example.ts` — all 8 requested
test cases, plus the new Timer Reset feature and the two new validation
rules, run against the real engine:

1. START → TON → OUTPUT
2. START → CTU → OUTPUT
3. TON + Self-Holding — the timer's Done Bit feeds a seal-in latch that
   then keeps its own output on even after the timer itself resets
   (start released), and drops correctly on an NC stop
4. Counter + Reset (CTU, external reset bit)
5. Multiple Timer — two independently-running timers with different
   presets, confirmed to reach Done at their own correct times, not each
   other's
6. Multiple Counter — same independence check for two counters
7. Nested Branch + Timer — `I1 AND (I2 OR (I3 AND I4))` gating a TON's
   Enable Bit; confirmed the timer doesn't accumulate at all while the
   nested condition is false, and reaches Done once it becomes true
8. Nested Branch + Counter — the same nested condition driving a CTU's
   count input via rising edges

All 29 assertions passed. `runExample.ts` (Phase 2), `runEditorExample.ts`
(Phase 3), `runPhase5Example.ts` (5.1), and `runPhase52Example.ts` (5.2)
were re-run unchanged after every edit — 94 assertions total across all
five scripts, zero regressions, confirming `updateTimer`'s new parameter
and the stricter validation don't break any existing pattern (SET/RESET
coils, TOF/TP, CTD, edge detection, seal-in, nested branches, editor-built
diagrams).

## Compatibility

Files touched: `types/ladder.ts`, `engine/timerEngine.ts`,
`engine/scanCycle.ts` (one line), `engine/counterEngine.ts` (import swap
only), `models/elementFactory.ts`, `simulator/editor/componentSpec.ts`,
`parser/validateLadder.ts`, plus one new file `engine/resetBit.ts`.
`parser/parseLadder.ts`, `evaluateRung.ts`, the runtime, the editor's
`operations.ts`/`ladderEditorStore.ts`, and all UI/canvas code are
untouched this phase.
