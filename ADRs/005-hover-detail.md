# Hover Detail

Status: superseded by [007-paint-state.md](./007-paint-state.md)

It's a global piece of state internal to Rez.
It can be changed when the mouse is moved, and its changes trigger repaints.

The "highlight the hovered square on a chessboard" use case justifies why we can't just repaint on any mouse move.

The "pan with the mouse" use case justifies why it has to be global (it can be set by one zone and accessed by another):
there is a zone with low priority that uses hover detail to set canvas transform, and a high-priority zone that gets all `mouse_up` events and also sets hover detail.

Theoretical justification (not confirmed by performance experiments): this design avoids unnecessary calls to `ui_fn()` and perhaps even bypasses React rerenders, thus improving latency.

A generic parameter `HoverDetail` has to be added to everything (`Zone`, `UiFn`, `RezProps`, `Rez`), it's a bit annoying.
