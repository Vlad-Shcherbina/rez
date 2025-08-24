A rewrite of rez miniframework.

- only used with React
- handle resolution and DPI
- simplicity, thin wrapper

One unfortunate thing: the original rez guaranteed that request handlers are always up-to-date with the state.
With React, it's tricky, and it's possible that an event handler refers to stale state.
