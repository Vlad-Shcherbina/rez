# Cookbook

Recipes demonstrated in `src/examples/`.
Grep the anchor to find the code (see the anchor convention in AGENTS.md).

Basics:

- **Hover effect** — restyle in `paint({ hovered })`, plus `cursor` on the zone. anchor: 31ImAttW
- **Hover indicator in a separate zone** — when the effect needs a different priority
  (rings, shadows), a paint-only zone checks `hovered_zone`.
  See [../ADRs/004-hover.md]. anchor: H8XbZthF
- **Tooltips** — `set_tooltip()` in `on_hover`, `clear_tooltip()` in the global `on_unhover`.
  See `useTooltip()` in `src/tooltip.tsx` and [../ADRs/008-tooltips-and-unhover.md].
- **Generous hit areas** — sdf larger than the painted shape; overlapping targets
  split the hover area sensibly thanks to the SDF tie-break ([../ADRs/003-sdf.md]). anchor: tS4B9KXi
- **Catch-all zone** — `sdf: () => -1` makes a zone cover the whole canvas:
  background click actions, or suppressing interaction during a gesture. anchor: JYtu0kft

State:

- **State that needs canvas size** — compute the fallback in `ui_fn`,
  commit it with a render-time set_state. anchor: T02u6vSM
- **Live readout via paint state** — one zone's `on_hover` writes a paint state,
  another zone's `paint` reads it: repaint with no rerender and no `ui_fn`.
  See [../ADRs/007-paint-state.md]. anchor: spqEMBfi
- **Drag to pan** — committed/transient state split, catch-all overlay,
  global `ctx.translate` trick. See [../ADRs/006-drag-hack.md]. anchor: yFg3E1rq
- **Orthogonal hover aspects** — zones drive different subsets of hover state
  (tooltip, status bar, readouts); funnel every `on_hover` through one `apply_hover(partial)`
  that spreads the partial over defaults, so unmentioned aspects reset automatically. anchor: D76Qq7ZS
- **Path-dependent brush (drag to apply a tool)** — buttons only set a mode;
  the level-triggered `on_hover` applies the tool at the current cell, so a click is
  a zero-length drag; idempotent updates make the intentional re-dispatch safe. anchor: 5ZKcK8LO

Misc:

- **Wheel zoom** — fixed-point zoom about the cursor, d3-style sensitivity normalization
  (not rez-specific); listens on the canvas directly, bypassing rez. anchor: yFfLKf0l
- **Repaint economy debugging** — paint `ui_fn_count`/`paint_count` in a corner and watch
  them while interacting; `rez.log` prints timings. Every example's background zone does this.

Gotcha:

- `on_hover` intentionally reruns after every `ui_fn` change (path independence);
  when setting composite React state there, use an identity check to avoid an infinite
  update loop. See the `Zone.on_hover` doc comment in `src/rez.ts`.
