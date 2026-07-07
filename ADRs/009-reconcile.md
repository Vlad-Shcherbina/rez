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
- canvas size: `width`, `height`, `dpr` (owned by the ResizeObserver)
- last raw mouse event (`null` while the mouse is not over the canvas)

Paint states are a fifth input, but only `paint()` depends on them; they keep
their own subscription mechanism (see [./007-paint-state.md]) and stay outside
this scheme.

Setting the canvas resets size to zero (a stale size must not feed `ui_fn`
before the new ResizeObserver fires) and clears the mouse event (an `offsetX`
measured against the old canvas is meaningless).

Initialization is the same story as any other input change: size starts at
zero and the mouse event at `null`; `ui_fn` is never called while size is
zero, and the guaranteed initial ResizeObserver fire supplies the real size
(anchor: R0OI8LKK).

## Derived values

- `zones = ui_fn({canvas, width, height})` — the only costly computation.
  Cached behind an identity memo whose key is the complete set of inputs
  `ui_fn` can observe: `(ui_fn, canvas, width, height, dpr)`. `dpr` is in the
  key because `ui_fn` can read `canvas.width`, which is `width * dpr`
  (anchor: XQOEPuOg). There are no invalidation calls anywhere — staleness is
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
- `on_hover` is a *level* handler: it fires on every reconcile while the
  mouse is over a zone that has it. Apps rely on this for live coordinates
  (see [./006-drag-hack.md]), and it is what makes hover state
  path-independent across `ui_fn` changes. It must be idempotent (see the
  `Zone.on_hover` doc comment).
- `on_unhover` is a *transition* handler: it fires once, on the falling edge
  of "an on_hover has been dispatched", tracked by a single `hover_active`
  boolean written in one place. In particular it never fires while the mouse
  is elsewhere, so it cannot clobber a tooltip that meanwhile belongs to
  another element (or another Rez) sharing the same tooltip system. It should
  still tolerate redundant calls — the exactly-once behavior is an
  implementation nicety, not a contract.
- Cursor: idempotent assignment on every reconcile.

## Scheduling

Two timing regimes: "immediately, inside the input event" and "at
frame time". A ResizeObserver callback runs in the frame's rendering steps,
after layout and before the frame is presented — the same slot as rAF — so
the "synchronous" paint there is not out-of-band: it is a frame-time paint
that lands in the same frame where the resolution change cleared the bitmap,
which is exactly why there is no flicker.

| input change          | reconcile               | paint                                        |
|-----------------------|-------------------------|----------------------------------------------|
| `ui_fn` set           | microtask               | rAF                                          |
| canvas set            | microtask               | deferred to the initial RO fire (anchor: R0OI8LKK)   |
| resize / dpr (RO)     | sync, in RO callback    | sync, same callback (same frame slot as rAF) |
| pointer move/down/up  | sync, in event handler  | rAF                                          |
| pointerleave          | sync, in event handler  | rAF                                          |
| `PaintState.set`      | — (paint-only input)    | rAF, subscribers only                        |

Why the microtasks for `ui_fn` and canvas: both setters run mid-React-commit
(from `useLayoutEffect`). Reconciling synchronously would fire app handlers —
which call `setState` — before sibling effects of the same commit have run
(e.g. before `on_unhover` is reassigned on the next line), and would make the
`ui_fn -> on_hover -> setState -> rerender -> ui_fn` cycle recursive. The
microtask runs after the commit settles, so each round of that cycle is a
flat ping-pong, terminated by the app-side equality cutoffs. The canvas
reconcile can only dispatch `on_unhover` — the setter clears the mouse event,
so there is no zone to hover — but it is the same hazard, and deferring it
means the falling edge on a canvas swap reaches the freshly assigned
`on_unhover`, not the stale one. A microtask still runs before the initial
ResizeObserver fire, so derived values are settled before the first paint.

Why pointer events reconcile synchronously: `on_left_mouse_down/up` must be
dispatched to a `hovered_zone` computed from the very event being handled
(the pointer may have moved since the last pointermove). Consequence:
`on_hover` fires before `on_left_mouse_down`, so the down handler sees the
same world the hover handlers saw.

## Known limitations

- `mouse_pos` also depends on the canvas *position* in the page (`offsetX`
  was measured at event time). If layout moves the canvas without resizing it
  under a stationary cursor, the stored event is stale and nothing fires. The
  platform offers no "element moved" observer; path independence holds up to
  what the browser lets us observe.
- Moving directly from a zone whose `on_hover` set a tooltip onto a zone
  whose `on_hover` does not clear it produces no falling edge — the known
  inelegance of [./008-tooltips-and-unhover.md], unchanged.
