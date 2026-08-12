# Basic assumptions and scope

Desktop-only, with a mouse (no attempt to support touch).

Mainly used inside a React app, but implemented with a React-free core.

Only full repaints (partial repaints are complicated and error-prone).

O(n) for hit testing is ok (so no spatial data structures, etc.)

Flat element list (no nesting, no containers and scrollbars, no clipping).

Reasonable effort to avoid excessive repaints.
Repainting after every user interaction (keyboard or mouse click, but not mouse move) is ok.
Repainting every frame even if nothing changed is definitely not ok.
Repainting on mouse move is a gray area: sometimes we do have to repaint a lot (e.g. when dragging),
but typically it's possible to only repaint when something visible changed (e.g. the mouse hovered over a different element).

Encourage path-independent behavior. Path dependency only where necessary (e.g. brush painting). Open question: amazon triangle.

Encourage hover effects (interactive elements should change their appearance on hover).

Encourage DPI-independence.

Decouple from tooltip system (but support integration and encourage tooltips).

No support for testing (though in theory it would be nice, especially random clicking).
