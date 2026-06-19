# Jujutsu

This project uses Jujutsu in git-colocated mode. Prefer `jj` commands over `git`.

# Testing

```
pnpm tsc
pnpm lint
```

# Style

In TypeScript, use snake_case for variable and function names.

Never run code formatters (they will create churn in unrelated places).

# Error strategy

Top priority: never mask errors. Second priority: keep the happy path straightforward and readable.

Uncaught exceptions are preferred ways to deal with errors (the only users are the developers themselves).

# Anchors

If you see an `anchor: <ID>` comment, search the codebase for that ID to find connected code.
Changes in one place may require updates to the others.
For the curious, see https://github.com/Vlad-Shcherbina/anchor
