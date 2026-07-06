Provide special hook:
```js
let [get_x, set_x] = usePaintState(() => 0);
```

`get_x()` can only be called in `paint()` and in event handlers, but not in `ui_fn()`.
When you call `get_x()` in `paint()`, the corresponding `Rez` instance is registered as a subscriber to this piece of state,
and will be repainted when it changes, bypassing React rerenders.

Purpose — the committed/transient rule: state that changes zone structure
(which zones exist, their sdfs and handlers) belongs in React state;
state that only changes pixels belongs in paint state.
Typical use: the live pointer position during a drag (see [./006-drag-hack.md]).
