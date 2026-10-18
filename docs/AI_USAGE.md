# AI usage

Built with [Claude Code](https://claude.com/claude-code) (Claude Sonnet 5). This is a note
on how it was used - edit it to reflect what actually happened in your own hands before
submitting.

## What Claude Code did

- **Read the brief and the packet first.** Before writing any code, it read the case-study
  PDF, the packet's `readme` section in full, and ran small Python scripts against
  `okafor_lindqvist_2025_packet.json` to inspect structure, confirm field shapes, and pull
  the exact extracted-value ids, document ids, and engine parameters behind each of the 20
  known errors - rather than hardcoding the answers from the brief's own error table, most
  checks recompute from the cited documents and extracted values directly.
- **Scaffolded the app**: Vite + React + TypeScript, the packet copied to `public/packet.json`,
  the event-sourcing store (IndexedDB + BroadcastChannel for multi-tab roles), and the
  design system (paper/ink-navy palette, status colors, the highlighter-thread trace
  pattern) from the brief in `CLAUDE.md`.
- **Wrote the independent checks engine** (`app/src/data/checks/run.ts`) - 20 failing checks
  and 11 passing checks, each a readable function that recomputes an expected value from raw
  packet data and compares it to the engine's output.
- **Built all 17 views** (Home, Return summary, Area pages with a shared trace-drawer
  component, Documents, Sales detail, Depreciation, Books→tax, State split, Reconciliations,
  Checks, Changes, What-ifs, Review & sign-offs, Client portal, Filing, Carryforward, Firm
  admin), plus global Cmd-K search and a seeded demo event log.
- **Tested with Playwright** against the running dev server across every route and every
  role (8 actors × 18 routes), checking for console errors and visually reviewing
  screenshots - not just a build pass. This caught and fixed three real bugs along the way:
  a parsing mismatch that made Form 8949 box totals always show "gap" instead of reconciling,
  invalid `<button>`-inside-`<button>` HTML in the document sidebar, and sensitive data that
  was masked in the sidebar list but not inside the simulated document body itself.
- **Wrote this docs/ set** (`ONE_PAGER.md`, `ERRORS.md`, `VIDEO_SCRIPT.md`, this file) as a
  first draft for you to edit.

## What you should do before submitting

- Record the video yourself, in your own words - `VIDEO_SCRIPT.md` is a script to adapt, not
  read verbatim, and the brief specifically asks for *your* tradeoffs.
- Skim `app/src/data/checks/run.ts` and spot-check a couple of the dollar figures against the
  packet yourself; verify you understand and agree with each check's logic, since you're the
  one vouching for it.
- Decide whether the area-classification heuristic (`app/src/data/areaClassifier.ts`, which
  sorts `return_versions[].lines[]` into budget-hours areas by form prefix) is good enough or
  worth refining - it was flagged during the build as a pragmatic, not certified,
  categorization.
- Update this file with anything you changed by hand after the fact.
