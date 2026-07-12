<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Debugging Notes

- For Convex-backed integrations, prefer testing hypotheses against the dev deployment with `npx convex run ...` before adding speculative fixes.
- Keep this level of testing targeted. Use it when behavior depends on live remote data or deployment state, not for every small refactor.
