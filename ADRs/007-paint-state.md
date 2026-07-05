Provide special hook:
```js
let [get_x, set_x] = usePaintState(() => 0);
```

`get_x()` can only be called in `paint()` (and maybe in event handlers, I'm not sure yet), but not in `ui_fn()`.
When you call `get_x()` in `paint()`, the corresponding `Rez` instance is registered as a subscriber to this piece of state,
and will be repainted when it changes, bypassing React rerenders.

TODO: describe purpose and typical usage
