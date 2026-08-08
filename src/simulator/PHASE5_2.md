# Phase 5.2 — Logic Engine Hardening

Scope: **logic engine only** — no UI, no new parser, no new runtime, no
architecture change. Per the brief, this phase used the existing
parser/runtime/editor as-is and only strengthened `validateLadder.ts`
(additive checks) after confirming the evaluation algorithm itself already
handled every requested scenario correctly.

## What Was Actually Broken vs. What Just Needed Proof

Going in, the honest state was: series/parallel/self-holding were already
verified in Phase 5.1, but **nested branch** and **multi-branch** had never
been explicitly tested end-to-end. Running them (see Verification) showed
the engine already handles both correctly, with zero changes — this is the
payoff of Phase 2's design decision to make parallel/branch a property of
the graph (multiple predecessors = OR) rather than special-cased logic. So
"perfecting the logic execution" turned out to mean **proving** it, not
rewriting it.

What genuinely was missing: validation coverage. `validateLadder.ts` could
already catch dead-ends, unknown references, and duplicate ids, but not:

- **Floating Wire / disconnected island** — an element with a valid
  outgoing connection that's still unreachable from the left rail (not in
  `startIds`, not the target of anything). The old dead-end check only
  caught islands whose *first* element had nowhere to go — a two-element
  floating chain (A → B, both orphaned) slipped through. Now checked
  explicitly and verified against exactly that case.
- **Floating Branch** — a `BRANCH_START`/`BRANCH_END` without its matching
  other half (same `branchId`, same rung).
- **Duplicate Connection** — the same element listing the same target
  twice in its own `connectsTo`.
- **Invalid Loop, caught at parse time** — `evaluateRung.ts` already threw
  on a cycle, but only when a scan actually walked into it (i.e., after
  pressing Run). A static DFS in `validateLadder.ts` now catches it at
  parse/export time instead, so it surfaces as a normal validation message
  in the editor rather than a runtime crash.

All four are additive functions/checks in the same file, run inside the
same `validateRung()` the parser already calls — nothing about *when*
validation runs or *how* `parseLadder.ts` calls it changed.

## Contact Reads PLC Memory, Never UI State

Worth stating explicitly since the brief calls it out: `readBit()` in
`evaluateRung.ts` has only ever read from `PlcState` (`state.inputs` /
`.outputs` / `.memory` / `.timers[n].done` / `.counters[n].done`). There is
no code path where a contact's evaluation touches a React component, a
Konva node, or anything UI-side — the canvas reads the engine's output
(`poweredElements`) for display, never the reverse. This was already true
in Phase 2 and remains unchanged.

## Verification (Real, Not Claimed)

`npx tsx src/simulator/examples/runPhase52Example.ts` builds the exact six
scenarios from the brief, plus a bonus 3-way multi-branch, against the
unmodified parser + scan cycle:

1. Start → Output
2. Start/Stop (no seal-in — Output follows Start directly, drops when Stop is pressed)
3. Self-Holding (seal-in via the coil's own contact, broken by an NC stop)
4. Series / AND (3-contact chain)
5. Parallel / OR (2-way)
6. **Nested Branch**: `I1 AND (I2 OR (I3 AND I4))` — first real test of a branch containing its own internal series chain
   - Bonus: 3-way Multi Branch (`I1 OR I2 OR I3`)

All six (plus the bonus) matched expected output exactly, including every
nested-branch truth-table row. `runExample.ts` (Phase 2), `runEditorExample.ts`
(Phase 3), and `runPhase5Example.ts` (Phase 5.1) were re-run unchanged after
the validation edits — still 100% passing, confirming the stricter checks
don't false-positive on any existing pattern (seal-in, editor-built
branches, SET/RESET, TOF/TP/CTD, edge detection).

A separate validation-specific test confirmed each new check fires on a
genuinely bad diagram and stays silent on the valid equivalent (e.g. a
properly paired BRANCH_START/BRANCH_END is allowed; an unpaired one is
rejected with a message naming the exact element and branch id).

## Compatibility

Only one file changed: `parser/validateLadder.ts` (additive checks inside
the existing `validateRung()`, plus one new private `detectCycle()`
helper). `parser/parseLadder.ts`, every `engine/*` file, every
`simulator/editor/*` file, and all UI/canvas code are untouched this phase.
