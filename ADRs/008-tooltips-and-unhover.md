Zones have `on_hover` event handler.
Rez has a global `on_unhover` event handler that is called when either no zone is hovered, or a zone without the `on_hover` handler is hovered.

So in `on_hover` you can call `set_tooltip()`, in `on_unhover()` call `clear_tooltip()` and it just works.

But it becomes inelegant if we have two orthogonal aspects of state that should change on hover (tooltips and something else),
only some of the zones have one aspect or the other.
Because we can't automatically enforce "when zone's `on_hover` doesn't call `set_tooltip()`, call `clear_tooltip()`".
This is solved by the hover state pattern (anchor: D76Qq7ZS).
