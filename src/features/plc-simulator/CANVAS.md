# Real Visual Editor (Konva) — Phase 4

Scope: the actual `<Stage>` canvas UI. `simulator/engine`, `simulator/parser`,
`simulator/runtime`, `simulator/editor/operations.ts`, and
`stores/ladderEditorStore.ts` are all **used, not modified** (verified by
file mtime). No authentication was created.

## The 11 Requirements -> Where They Live

| # | Requirement | File |
|---|---|---|
| 1 | React Konva Stage | `LadderCanvas.tsx` |
| 2 | Infinite Grid Background | `GridBackground.tsx` — only draws lines inside the current viewport, recomputed every pan/zoom |
| 3 | Palette Drag & Drop | `ComponentPalette.tsx` (native HTML5 DnD) + `LadderCanvas.handleDropFromPalette` |
| 4 | Add Ladder Elements | drop handler calls the existing `addComponent` (Phase 3 store, untouched) |
| 5 | Drag Elements | `ElementNode` is Konva-draggable; wired to the existing `beginDrag`/`updateDragPosition`/`endDrag` |
| 6 | Connection Lines | `ConnectionLine.tsx`, one per `connectsTo` edge, colored by live power state |
| 7 | Branch Visual Editor | "Branch" toolbar mode — click two anchors, calls the existing `branch` action |
| 8 | Zoom | mouse wheel, zoom-to-cursor math in `handleWheel` |
| 9 | Pan | drag on empty canvas (manual pointer tracking, not Konva's built-in stage drag — see below) |
| 10 | Selection Box | Shift+drag on empty canvas — marquee rectangle, tests element world-position containment |
| 11 | Highlight Active Path | "Run" toggle exports the doc via the existing `exportToLadderJson`, feeds it to the existing `usePlcStore` (Phase 2 engine, untouched), and colors every element/wire from real `poweredElements` — not a decorative animation |

## Why Pan Is Hand-Rolled Instead of `<Stage draggable>`

Selection-box (shift+drag) and pan (plain drag) both start from a mousedown
on empty canvas. Konva's built-in stage dragging can't easily be told
"don't start this time" mid-gesture without fighting React's controlled
`draggable` prop. Tracking both gestures manually (`mousedown` decides
pan-vs-marquee by `shiftKey`, `mousemove` updates whichever is active,
`mouseup` finalizes it) avoids that entirely and keeps the two interactions
from ever conflicting.

## Why Element Drag Doesn't Feed Live Position Back Into Props

While the user is mid-drag, `ElementNode`'s Konva `Group` is left to move
itself natively — its `x`/`y` prop is NOT recomputed from the in-progress
`dragState` on every frame. If it were, React and Konva would both be
trying to own the node's position at once, and stutter. `beginDrag`/
`updateDragPosition` are still called throughout the gesture (satisfying
"integrate with the existing store"), but only `endDrag(true)` — fired
once, on release — feeds a new value back through the document into the
node's `x`/`y` prop. The visual result is actually a feature: the element
snaps to the nearest grid cell exactly on release.

## Address Allocation

Dropping a palette item doesn't prompt for an address number — 
`utils/addressAllocation.ts` picks the smallest unused number (1-26) of the
right type across the whole document. A properties panel to change it by
hand is a natural next step, not built this phase.

## What's Honestly Not Verified Yet

`konva`/`react-konva` aren't installed in this sandbox (no network), so
`tsc` could only catch ordinary TypeScript/React mistakes here — not
Konva-specific prop misuse, since unresolved-module imports fall back to
`any`. One real bug (`fontStyle="600"` instead of `"bold"` — Konva's Text
only accepts `'normal' | 'bold' | 'italic'`, not CSS numeric weights) was
caught by manual review, not the type checker, and fixed. Run `npm install`
and `npm run dev` to get real browser verification; if anything else in the
Konva API usage needs adjusting once it actually renders, that's expected
and worth a follow-up pass rather than a sign this was skipped.
