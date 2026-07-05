A mini-framework for graphical user interfaces using HTML5 canvas.

"rez" stands for "reactive zones".

Intended applications:
- simple interactive ad hoc visualizations (e.g. a special kind of chart not supported by chart libraries)
- simple vector editors
- simple turn-based games with no visual effects (e.g. chess)

Philosophy:
- make good UI easy to implement (most notably, interactive elements should visibly react to hover)
- make bad things impossible or unlikely (in particular, current UI state should depend on final mouse position, but not on mouse path; this elimitates the class of bugs like forgetting to handle mouseLeave causes stuck tooltip)
