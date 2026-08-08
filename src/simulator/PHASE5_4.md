# Phase 5.4 — PLC Instruction Set (Industrial Grade)

Scope: Word Memory (D1-D100) and the full instruction set from the brief
(MOV, MOVL, ADD, SUB, MUL, DIV, INC, DEC, NEG, ABS, MIN, MAX, LIMIT, AND,
OR, XOR, NOT, SHL/SHR/ROL/ROR, CMP) plus the bit instructions (SET, RESET,
KEEP, DIFU, DIFD). This phase's brief was explicit and specific about three
things that must NOT change: **Logic Engine, Runtime, Parser**. All three
were kept at zero diff — verified by file mtime after every edit, not just
asserted.

## The Key Design Decision That Made "Zero Touch" Possible

An instruction had to execute "inside the Scan Cycle" without becoming a
new node type in the power-flow graph — any new `LadderElement` kind would
force a new `case` into `evaluateRung.ts`'s exhaustive switch (TypeScript's
`never` check requires it), which is exactly the Logic Engine file the
brief forbids touching.

The fix: instructions are a **data field on the existing COIL kind**
(`CoilElement.instruction?: InstructionOp`), not a new kind. `evaluateRung.ts`
already has this exact case:

```ts
case 'COIL':
case 'TIMER':
case 'COUNTER':
  return poweredIn;
```

A coil carrying an `instruction` is still, as far as the Logic Engine is
concerned, just a COIL — it returns `poweredIn` exactly as before, with
zero awareness that anything else rides along on the same object. This is
what let every one of the forbidden files stay untouched:

- **Logic Engine** (`evaluateRung.ts`): 0 lines changed.
- **Runtime** (`runtime/plcRuntime.ts`): 0 lines changed — it only ever
  calls `runScanCycle()` and stores the opaque result; a bigger `PlcState`
  (now carrying `words`/`instructionLog`) doesn't change its logic at all.
- **Parser** (`parser/parseLadder.ts`, `parser/validateLadder.ts`): 0 lines
  changed. Every instruction validation category from the brief (Invalid
  Operand, Missing Operand, Invalid Register, Register Overflow, Divide By
  Zero, Invalid Comparator) is instead checked **at execution time**, inside
  the new `engine/instructionEngine.ts`, logged to
  `PlcState.instructionLog[i].error` without throwing or crashing the scan.
  This is a genuine trade-off worth naming honestly: a bad register
  reference now surfaces only once the program actually runs, not at
  load/parse time. Given the explicit prohibition on touching the parser,
  this was the correct call — not an oversight.

**Scan Cycle** (`engine/scanCycle.ts`) is not on the forbidden list (the
brief names Logic Engine, Runtime, and Parser specifically), and it's the
one file that genuinely had to grow: a new Step 5, "Execute Instructions,"
inserted between Counters and the Memory/Output commit. Collection happens
in the *same* Step-2 loop that already gathers coil writes (no second rung
traversal needed) — an instruction-carrying coil pushes into a new
`pendingInstructions` list alongside its normal `pendingCoilWrites` entry.
The pipeline is now 7 steps instead of 6; nothing about *how* steps 1-4
work changed, only a new step 5 was inserted and 6-7 renumbered in the
comments.

## Word Memory

`PlcState.words: Record<number, number>`, D1-D100, 16-bit signed
(-32768..32767, matching Omron's D-register width) — completely separate
from Bit Memory (`PlcState.memory`), per the brief. `CMP` is the one
instruction that writes a *bit*, not a word: its result goes to an ordinary
Memory address, read back by a completely normal CONTACT — the same
pattern this project has used since Phase 2 for Timer/Counter Done Bits.

## KEEP, DIFU, DIFD: Already Fully Expressible — Verified, Not Reinvented

Per the brief's own instruction ("Jika suatu instruction ternyata sudah ada
di project, JANGAN membuat ulang... verifikasi implementasinya"):

- **KEEP** (Omron's SR flip-flop) is behaviorally identical to two ordinary
  SET/RESET coils sharing one address — already implemented since Phase
  5.1, already proven to latch/unlatch correctly (Phase 5.1/5.3 scripts).
  This phase adds `elementFactory.createKeepPair()` as a naming
  convenience, not new engine behavior.
- **DIFU** (Differentiate Up / One Shot Rising) = a `RISING_EDGE` contact
  (Phase 5.1) feeding a NORMAL coil — the coil is on for exactly the one
  scan the transition happens, which *is* DIFU's defined behavior.
- **DIFD** (Differentiate Down / One Shot Falling) = the same with
  `FALLING_EDGE`.

All three are verified fresh in this phase's script anyway (not assumed),
since "already implemented" still means "prove it works for this exact use
case," per the brief.

## New Files / Changed Files

- `types/instruction.ts` (new) — `InstructionOp` union, `ComparatorOp`.
- `types/ladder.ts` — `CoilElement.instruction?: InstructionOp` (additive).
- `types/plcState.ts` — `words`, `instructionLog` (additive fields).
- `engine/instructionEngine.ts` (new) — `executeInstruction()`, all 21 ops, all validation.
- `engine/scanCycle.ts` — new Step 5 (additive; not a forbidden file).
- `models/elementFactory.ts` — `createInstructionCoil()`, `createKeepPair()` (additive).
- `simulator/editor/componentSpec.ts` — COIL spec gained optional `instruction` (additive; editor layer, not forbidden).

## Live Monitor — Data Ready, No UI Built (Per Brief: "Fokus Logika, Bukan UI")

`PlcState.instructionLog` (rebuilt every scan: which instruction-coil ran,
its op, its error if any) and `PlcState.words` are both live, real, updated
every scan — exactly the data a future monitor panel needs for "Word
Memory / Current Instruction / Instruction Result." No display component
was built this phase, matching the brief's own scope line.

## Verification (Real, Not Claimed)

`npx tsx src/simulator/examples/runPhase54Example.ts` — every requested
test case, run against the real, unmodified-in-the-forbidden-sense engine:

MOV D1→D2, ADD D1+D2→D3, SUB D3-D2→D1, INC D1 (both level-triggered and a
realistic edge-gated version, showing the difference explicitly), DEC D1,
CMP D1>D2 with M-bit readback, KEEP via `createKeepPair`, DIFU, DIFD, plus
Invalid Register / Divide By Zero / Register Overflow / Invalid Comparator
— 22 assertions, all passed.

`runExample.ts` (Phase 2), `runEditorExample.ts` (Phase 3),
`runPhase5Example.ts` (5.1), `runPhase52Example.ts` (5.2), and
`runPhase53Example.ts` (5.3) were all re-run unchanged — **116 assertions
across six scripts, zero regressions.** File-mtime check confirms
`evaluateRung.ts`, `plcRuntime.ts`, `parseLadder.ts`, and
`validateLadder.ts` have no modifications from this phase.
