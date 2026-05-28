@AGENTS.md

## Claude Code (frontend repo)

- Treat `AGENTS.md` in this directory as the single canonical instruction file for
  this repo. It is self-contained — you do not need to read the umbrella
  `../AGENTS.md` for frontend work unless the task explicitly crosses the seam to
  the backend.
- The deep-dive technical reference (FSD, CheckoutShell + flow registry, polling /
  SSE / forms / auth) is [`docs/frontend-architecture.md`](docs/frontend-architecture.md).
  Read it before any non-trivial change.
- Keep Claude-specific additions here only when they cannot live in `AGENTS.md`.
