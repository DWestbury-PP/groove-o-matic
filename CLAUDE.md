# CLAUDE.md: groove-o-matic

Browser groove box (acid synth and drum machine). It's a static SPA:
TypeScript, React 19, Vite, Vitest. There's no backend.

- Architecture and design decisions: `docs/architecture.md`. Plan:
  `docs/roadmap.md`.
- Run `npm run check` (typecheck, lint, tests) before every PR. Run
  `npm run build` when changing worklets or the build config.
- Layering: `ui → state → engine → model`.
  - `model/` must not use browser APIs.
  - Keep DSP and sequencing logic in plain TS (`engine/dsp`,
    `engine/sequencer.ts`) so it's testable. AudioWorklet files are thin
    shells around them.
- Never import a `*.worklet.ts` from main-thread code; it calls
  `registerProcessor`. Shared constants go in `engine/acid-messages.ts`.
- New continuous controls get a parameter ID in `model/params.ts`.
- Untrusted song JSON always goes through `songFromJson`.
- Audio changes need live verification in a browser. In dev builds,
  `window.__groove` exposes `{ engine, store }`; tap nodes with
  AnalyserNodes to check levels.
- IP: use original instrument names, designs, and demo patterns. Don't use
  trademarked hardware or product names, and don't recreate specific
  records.
- Publish the demo with `npm run publish:site`. The here.now key lives in `.env`
  (gitignored), never in commits. The slug is in `herenow.json`.
- Work on a branch, open a PR, then merge. Commit trailer:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
