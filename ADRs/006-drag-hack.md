# How to express dragging or panning in this system

The gesture state is split in two (see [./007-paint-state.md]):

- The drag origin lives in React state: its changes alter zone structure
  (the drag overlay appears, elements that shouldn't be interactive mid-drag disappear).
  This costs two rerenders per gesture, on mouse down and mouse up.
- The live pointer position lives in paint state, prefixed `live_*` by convention:
  each pointermove costs one repaint, with no rerender and no `ui_fn()`.

While the drag is active:

- A catch-all zone (`sdf: () => -1`) at high priority captures `on_hover`
  (which records the live position) and `on_left_mouse_up` (which commits),
  and suppresses hover interaction with everything underneath.
- A paint-only zone at low priority applies `ctx.translate(live - origin)`,
  shifting everything painted after it. This deliberately exploits the shared-ctx
  paint order contract (see `Zone.paint`), so individual zones don't need to know
  about the transient offset.

On mouse up, the accumulated delta is folded into committed React state,
and the drag zones disappear.

Consequence: paint state can move pixels but never geometry, so hit testing sees
un-shifted positions during the gesture (enforced: `sdf` cannot read paint state).
For panning this doesn't matter because the catch-all suppresses interaction anyway;
gestures that need live hit testing (e.g. drop targets) need their own zones
positioned from committed state.

See `src/examples/pan_and_zoom.tsx`.
