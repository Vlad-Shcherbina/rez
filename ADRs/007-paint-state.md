Provide special hook:
```js
let [get_x, set_x] = usePaintState(() => 0);
```

When you call `get_x()` in `paint()`, the corresponding `Rez` instance is registered as a subscriber to this piece of state,
and will be repainted when it changes, bypassing React rerenders.
Anywhere else `get_x()` is a plain unsubscribed read, fresh at the moment of the call -
fine in event handlers of any kind (zone handlers, React handlers, window listeners) and in polling loops.

The dangerous contexts are the ones whose output is cached without tracking paint state,
so a read there bakes in a value that goes stale on the next `set_x()`:

- `ui_fn()` - zones are memoized. Enforced: `get_x()` throws there.
  (State that zone structure depends on is committed state anyway, see below.)
- React render, `useMemo`, effects - not observable from rez, so this is a convention,
  the same trust level as not reading a ref during render. Wanting a paint-state value
  in JSX is also a design smell: by the rule below it's committed state.

Rejected alternative: forbid reads everywhere except `paint()` and rez-dispatched handlers.
That would also enforce the render/effects rule, but rez can't recognize foreign handlers,
so every React handler or window listener reading paint state would need an explicit
scope wrapper (`in_handler(() => get_x())`). Not worth it: the render-read bug is the
familiar stale-ref hazard and gets diagnosed quickly, while the wrapper tax is paid on
every legitimate read. The `ui_fn()` guard is kept because rez controls that call site,
so it costs nothing, and the bug it catches (hit-test regions silently desynced from
painted pixels, self-healing on unrelated rerenders) is the expensive kind.

Purpose - the committed/transient rule: state that changes zone structure
(which zones exist, their sdfs and handlers) belongs in React state;
state that only changes pixels belongs in paint state.
Typical use: the live pointer position during a drag (see [./006-drag-hack.md]).
