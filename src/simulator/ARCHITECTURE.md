# PLC Simulator Core Engine — Architecture

Scope of this phase: **engine only**. No UI was touched (verified — see repo
history). This document is the "why" behind the code in this folder.

## Folder Map

```
src/simulator/
  types/      Pure type definitions. Zero logic, zero runtime code.
  models/     Element factories + address-range constants. Building blocks
              for a future drag-and-drop editor to construct valid elements.
  parser/     Ladder JSON -> validated, graph-compiled Executable Runtime Tree.
  engine/     The three things that actually run every scan: power-flow
              evaluation, timer logic, counter logic, and the scan-cycle
              orchestrator that ties them together in the correct order.
  runtime/    PlcRuntime — a framework-agnostic class wrapping engine+parser
              behind start/stop/reset/step/subscribe.
  hooks/      The one place React touches this folder (useSimulator.ts).
  utils/      Address parsing, id generation, deep clone.
  examples/   A standalone, runnable script proving the engine against six
              scenarios (see "Verification" below).
```

**Hard rule enforced throughout:** `types/`, `models/`, `parser/`, `engine/`,
`runtime/`, and `utils/` never import React, Zustand, or Supabase. Only
`hooks/useSimulator.ts` (and, outside this folder, `stores/plcStore.ts`)
bridge the pure engine into the React world. This is what makes the engine
unit-testable headlessly and reusable unchanged from a future Arduino or
Industrial-Simulation module (see "Future-Proofing" below).

## Key Design Decisions

### 1. Parallel/branch logic needs no special data model

A rung is a graph: elements point at their successors via `connectsTo`.
Series is a chain (one predecessor each). **Parallel falls out for free**:
if two elements share the same predecessor (a fan-out) and both feed the
same successor (a fan-in), that successor's power-in is naturally the OR of
both paths — because `evaluateRung` computes every node's power-in as
`predecessors.some(pred => evalNode(pred))`. `BRANCH_START`/`BRANCH_END`
element kinds exist in the type system purely as visual markers for a future
editor to know where to draw the branch box — the evaluator treats them as
transparent pass-throughs and doesn't need them to compute the correct
result.

This is also *why* nested branches are already supported, not just
"future work" as the brief allows: the algorithm is generic recursive graph
evaluation with memoization. A branch inside a branch is just more fan-out/
fan-in nodes deeper in the same graph — there's no recursion depth limit
tied to branch nesting, and no separate code path for "nested" vs "flat."

### 2. The scan cycle commits in two stages, not rung-by-rung

`engine/scanCycle.ts` solves every rung's logic against a frozen snapshot
*first* (Step 2), and only commits timer/counter/memory/output changes
*afterward* (Steps 3-6). If it instead mutated state immediately after each
rung, the result would depend on rung order — Rung 5 reading a memory bit
Rung 1 just wrote in the *same* scan would behave differently than if the
rungs were listed in the opposite order. Real PLCs avoid this by using
separate input/output image tables updated once per scan; this engine
mirrors that on purpose, not as an accident of implementation.

### 3. Done bits are read via a separate CONTACT, never by chaining after the block

A `TIMER`/`COUNTER` element does not hand ladder power to whatever's wired
after it (in practice they're terminal — empty `connectsTo`). Its `done` bit
lives in `PlcState.timers[n].done` / `.counters[n].done` and is read by a
completely ordinary `CONTACT` element with `address.type: 'TIM' | 'CTU'`,
possibly in a different rung entirely. `examples/timerExample.json` and
`counterExample.json` both demonstrate this cross-rung pattern. One
consequence worth knowing: because Execute Logic (step 2) runs *before*
Update Timers/Counters (steps 3-4), a contact reading a done bit sees last
scan's value — a one-scan latency, exactly like a real PLC's I/O image
table. `examples/runExample.ts` calls this out explicitly where it applies.

### 4. Address is one unified type, not readable/writable variants

`{ type: 'I'|'O'|'TIM'|'CTU'|'M', number }` covers every element. A CONTACT
can read any of them (including O, for simple simulators that allow reading
an output back); a COIL can only target O or M (enforced in
`parser/validateLadder.ts`, not by the type system, so the error message can
name the offending element). Adding an Arduino `DIGITAL_PIN` or `PWM_OUTPUT`
later is one more `AddressType` member — not a parallel type hierarchy.

## Future-Proofing (Arduino / Industrial Simulation)

Nothing in `parser/` or `engine/evaluateRung.ts` is PLC-specific — they only
know about "elements with addresses and connections." A future Arduino
simulator or an Industrial Simulation preset (Traffic Light, Water Tank,
Conveyor) needs:
- new `AddressType` members (or a parallel address namespace)
- new `LadderElement` variants (or a sibling `ArduinoElement` union)
- one new `resolveElementOutput` case per new element kind

...but reuses `evaluateRung`'s graph-walking algorithm, `parseLadder`'s
validation pipeline, and `PlcRuntime`'s start/stop/step/subscribe contract
completely unchanged. The Industrial Simulation presets specifically don't
need any of that — they're just pre-built `LadderProject` JSON files, no
different from the six in `models/examples/`.

## Verification

`examples/runExample.ts` is a standalone script (no React/Vite needed) that
loads all six example projects, drives inputs across multiple scans, and
prints actual-vs-expected for every scenario: simple pass-through, series
(AND), parallel (OR), TON timer (including non-retentive reset), CTU counter
(including edge-detection and external reset), and a cross-rung memory
latch. Run it with:

```bash
npx tsx src/simulator/examples/runExample.ts
```

This was run during development and every scenario matched its expected
value — this isn't a claim, it's a script anyone can re-run.

## What This Phase Deliberately Does NOT Include

Per the Phase 2 brief: no authentication, no leaderboard, no teacher
dashboard, and no UI changes. Additionally, out of scope for *this* engine
phase specifically (left for later, structurally ready when they land):
- Wiring `PlcSimulator` page's canvas/toolbar to `usePlcStore` (the store is
  ready; the page still renders its own local decorative preview state)
- Persisting `LadderProject` to `sqliteService`/Supabase (parser/runtime
  don't know about storage at all — by design)
- TOF/TP timer types, CTD counter type — only TON/CTU were requested
