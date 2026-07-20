* open design question: when we have stateful mouse down, how to ensure that mouse up event is not lost?
  (that all zones have a handler that does the right thing)
  In the current examples, "pan&zoom" and "paintbrush", we have a single catch-all zone that receives mouse up.
* Separate handlers for mouse_click and mouse_down
  (also use threshold for begin_drag)
* demos
  - chessboard
  - drag with sticking
* CI and GitHub Pages
* docs
  - overview
  - explain how on_hover serves dual function (tooltips and path dependency escape hatch); also explain on_unhover
