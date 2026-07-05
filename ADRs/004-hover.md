# `paint()` accepts `hovered: bool`

The seems like a hacky special case, compared to the hover details mechanism.
But it makes it very easy to implement hover effects.

Sometimes, visualization of hover effect needs painting at a different priority (e.g. shadows).
So support that, `paint()` also accepts `hovered_zone: Zone | null`,
so the shadow can check whether the main element is hovered, and decide whether to paint itself.
