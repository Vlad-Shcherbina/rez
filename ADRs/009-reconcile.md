# Incremental update model: inputs, derived values, reconcile

Rez is an incremental computation: external inputs, derived values, reactions
(handler dispatch, cursor, repaint). Historically each input handler re-derived
its own downstream checklist, which bred bugs of the species "handler forgot a
step" (hover not reconciled after resize; pointerleave diverging from the
mouse-clearing path). The fix is structural: every input mutation is followed
by exactly one call to `reconcile()`, the single place where derived values are
recomputed and reactions are decided. An input change cannot forget a reaction;
it would have to opt out explicitly.

## Inputs

- `ui_fn`
- canvas identity (attach / detach / swap)
- canvas size: `measured = {width, height, dpr}` (owned by the ResizeObserver;
  `null` while unmeasured)
- last raw mouse event (`null` while the mouse is not over the canvas)

Paint states are a fifth input, but only `paint()` depends on them; they keep
their own subscription mechanism (see [007-paint-state.md](./007-paint-state.md)) and stay outside
this scheme.

Setting the canvas resets `measured` to `null` (a stale size must not feed
`ui_fn` before the new ResizeObserver fires) and clears the mouse event (an
`offsetX` measured against the old canvas is meaningless).

Initialization is the same story as any other input change: `measured` starts
at `null` and the mouse event at `null`; `ui_fn` is never called while
unmeasured (or while the size is genuinely zero), and the initial
ResizeObserver fire supplies the real size. That fire only happens once the
canvas is rendered with a nonzero size — until then there is nothing to paint
anyway, and the canvas-set reconcile (a microtask, not the ResizeObserver)
is what settles hover and derived state in the meantime.

## Derived values

- `zones = ui_fn({canvas, width, height})` — the only costly computation.
  Cached behind an identity memo whose key is the complete set of inputs
  `ui_fn` can observe: `(ui_fn, canvas, width, height, dpr)`. `dpr` is in the
  key because `ui_fn` can read `canvas.width`, which is `width * dpr`.
  There are no invalidation calls anywhere — staleness is
  checked at the point of use, so a new route for mutating an existing input
  cannot forget to invalidate. A genuinely new dependency requires extending
  the key: one declared list, in one place, next to the `ui_fn` call.
- `mouse_pos` — recomputed eagerly from the raw event on every reconcile. It
  is one multiplication, and it depends on canvas size too, so caching it
  would be a staleness liability for no gain.
- `hovered_zone` — recomputed eagerly (an O(n) sdf pass, needed on every
  mouse move anyway). The previous value is kept for edge detection (repaint
  cutoff, cursor), not as a cache. Neither `hovered_zone` nor `zones` has a
  "not computed" state: reconcile runs before any paint can, so the fields
  paint reads are always fresh.

## Reactions, decided inside reconcile

- Repaint is derived, not pushed: repaint iff `zones` or `hovered_zone`
  changed identity. The only push-style trigger left is `PaintState.set`.
- `on_hover` is a *level* handler; `on_unhover` is a *transition* handler on
  the falling edge of "an on_hover has been dispatched". The exact semantics,
  the reasons for the asymmetry, and the handler contracts live at the
  dispatch site and on the handler declarations (anchor: m0h5cK7X).
- Cursor: idempotent assignment on every reconcile.

## Scheduling

Two timing regimes: "immediately, inside the input event" and "at
frame time". Even the "sync" paint in the resize row below is frame-time:
a ResizeObserver callback runs in the frame's rendering steps, the same slot
as rAF (why painting there is what avoids flicker: anchor: IJ5uYVqh).

| input change          | reconcile               | paint                                        |
|-----------------------|-------------------------|----------------------------------------------|
| `ui_fn` set           | microtask               | rAF                                          |
| canvas set            | microtask               | deferred to the initial RO fire              |
| resize / dpr (RO)     | sync, in RO callback    | sync, same callback (same frame slot as rAF) |
| pointer move/down/up  | sync, in event handler  | rAF                                          |
| pointerleave          | sync, in event handler  | rAF                                          |
| `PaintState.set`      | — (paint-only input)    | rAF, subscribers only                        |

Why the microtasks for `ui_fn` and canvas: both setters run mid-React-commit
(from `useLayoutEffect`), where reconciling synchronously would dispatch app
handlers too early (anchor: 76UVNDC4 spells out how). Deferring keeps the
`ui_fn -> on_hover -> setState -> rerender -> ui_fn` cycle a flat ping-pong,
terminated by the app-side equality cutoffs. A microtask still runs before
the initial ResizeObserver fire, so derived values are settled before the
first paint.

Teardown uses the same deferred path (`canvas = null` from the `useRez`
cleanup), so the final `on_unhover` lands after the unmount, when the hooks it
touches may be gone. Releasing it synchronously instead would reach a bit more
of the app - destroys also run in hook declaration order, so only the hooks
declared above `useRez` would be gone by then - but not enough to be worth a
second dispatch path, since the hooks declared above are exactly where the
tooltip sits. Handlers tolerate the late call instead (anchor: qX3vNbW8).

Why pointer events reconcile synchronously: `on_left_mouse_down/up` must be
dispatched to a `hovered_zone` computed from the very event being handled;
consequence: `on_hover` fires before `on_left_mouse_down`, so the down
handler sees the same world the hover handlers saw.

## Known limitations

- `mouse_pos` also depends on the canvas *position* in the page (`offsetX`
  was measured at event time). If layout moves the canvas without resizing it
  under a stationary cursor, the stored event is stale and nothing fires. The
  platform offers no "element moved" observer; path independence holds up to
  what the browser lets us observe.
- Moving directly from a zone whose `on_hover` set a tooltip onto a zone
  whose `on_hover` does not clear it produces no falling edge — the known
  inelegance of [008-tooltips-and-unhover.md](./008-tooltips-and-unhover.md), unchanged.
