# Ladder Editor — Phase 3

Scope: **editor data layer only**. `engine/`, `parser/`, `runtime/` from
Phase 2 are untouched (verified by file mtime — see Phase 3 delivery notes).
No UI/canvas code was written — this phase prepares the data shapes and
operations a future React Konva canvas will call.

## Why editor data isn't just LadderProject

`EditorDocument`/`EditorRung` (types.ts) are keyed by element id
(`Record<string, LadderElement>`) instead of Phase 2's flat arrays, so
add/delete/update are O(1) — important once a canvas is calling these on
every pointer event. They also never store `startIds`: an element nothing
points to is, by definition, wired to the left rail, so
`exportToLadderJson.ts` derives it automatically. A canvas/editor UI never
has to keep that bookkeeping in sync by hand.

Interaction-only state — current selection, the live position while
dragging — lives in the Zustand store (`stores/ladderEditorStore.ts`), not
in `EditorDocument`. That's what keeps a Konva `onDragMove` firing dozens of
times a second cheap: it only updates `DragState.previewX/Y`, not the
committed document, until `endDrag(true)`.

## The 7 Features -> Where They Live

| # | Feature | Function | Notes |
|---|---|---|---|
| 1 | Add Component | `operations.addElement` (+ `componentSpec.createElementFromSpec`) | Dispatches to Phase 2's untouched `models/elementFactory.ts` |
| 2 | Delete Component | `operations.deleteElement` | Also strips dangling `connectsTo` references pointing at the deleted id |
| 3 | Connect Elements | `operations.connectElements` / `disconnectElements` | Rejects cycles up front via `cycleCheck.wouldCreateCycle` (DFS) |
| 4 | Create Branch | `operations.createBranch` | Adds a parallel path (`BRANCH_START`/`BRANCH_END` markers); OR-merge happens automatically per Phase 2 design — see engine ARCHITECTURE.md decision #1 |
| 5 | Drag Element | `ladderEditorStore.beginDrag` / `updateDragPosition` / `endDrag` | Live preview only; nothing commits until `endDrag(true)` |
| 6 | Move Element | `operations.moveElement` / store's `moveComponent` | Direct commit, no drag gesture needed (nudge, snap-to-grid, programmatic layout) |
| 7 | Convert Editor Data to Ladder JSON | `exportToLadderJson.exportToLadderJson` | Derives `startIds`, stamps `meta`, and — by default — validates the result through Phase 2's untouched `parseLadder` |

A supporting, non-headline piece: `importFromLadderJson.ts` reverses the
conversion, used both as a verification tool (round-trip an existing example
through the editor) and, later, as "open an existing project for editing."

## Error Handling Philosophy

`operations.ts` functions throw a plain `EditorOperationError` when a
mutation is invalid (missing element, would-be cycle, self-connection).
`ladderEditorStore.ts` wraps every call to them in `guarded()`, which
catches that error, records the message in `lastErrors`, and leaves the
document untouched — it never lets an invalid drag/connect/branch gesture
throw up into a canvas event handler. `exportToLadderJson` follows the same
spirit: an unfinished/invalid diagram doesn't throw, it just comes back with
a non-empty `errors` array the UI can show as inline warnings.

## Verification

`examples/runEditorExample.ts` builds a series circuit and a parallel
circuit **using only the editor operations above** (no hand-written JSON),
exports them, and runs the result through the untouched Phase 2 engine —
proving the conversion is correct and the engine really wasn't modified. It
also proves dangling-reference cleanup on delete, and that cycle prevention
actually rejects a real attempt. Run it with:

```bash
npx tsx src/simulator/examples/runEditorExample.ts
```

All four scenarios matched their expected output during development.

## What's Ready for the Future Konva Canvas, and What Isn't Built Yet

Ready: every element carries `gridX`/`gridY` a canvas can bind directly to
pixel coordinates; `DragState` separates live pointer feedback from
committed state; `EditorOperationError` messages are UI-displayable as-is;
`lastErrors` is a ready-made place to surface validation warnings.

Not built (correctly out of scope this phase): any actual `<Stage>`/`<Layer>`
Konva rendering, pointer-event wiring, the component palette UI, or
connecting `pages/PlcSimulator/index.tsx` to this store at all — that page
still renders its own Phase-UI decorative preview, untouched.
