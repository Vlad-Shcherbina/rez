# `<Rez>` takes `ui_fn` instead of a list of zones

That's because when generating the list of zones, it could be necessary to access canvas and resolution, and they only become available after render.
Alternative approaches (based on refs and effects) seem more complex.
