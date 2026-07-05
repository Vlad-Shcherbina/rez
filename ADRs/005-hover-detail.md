# Hover Detail

Status: superseded by [./007-paint-state.md]

It's a global piece of state internal to Rez.
It can be changed when mouse is moved, and its changes trigger repaints.

"Highlight hovered square on a chessboard" usecase justifies why we can't just repaint on any mouse move.

"Pan with mouse" usecase justifies why it has to be global (can be set by one zone and accessed by another):
there is a zone with low priority that uses hover detail to set canvas transform, and a high-priority zone that gets all `mouse_up` events and also sets hover detail.

Theoretical justification (not confirmed by performance experiments): this design allows to avoid unnecessary calls to `ui_fn()`, and perhaps to even bypass React rerenders, thus improving latency.

A generic parameter `HoverDetail` has to be added to everything (`Zone`, `UiFn`, `RezProps`, `Rez`), it's a bit annoying.
