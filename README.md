# Miraflores Workpaper

A web-native tax workpaper for the Okafor-Lindqvist 2025 return - built on an evidence
graph over an append-only event log, not a spreadsheet. Built for the Miraflores AI
"Redesign the Tax Workpaper" case study.

**Live app:** https://app-opal-tau-89.vercel.app

## Docs

- [`docs/ONE_PAGER.md`](docs/ONE_PAGER.md) - the core idea and the data model
- [`docs/ERRORS.md`](docs/ERRORS.md) - the 20 errors found, each check's exact federal/California
  effect, and how the design surfaces them
- [`docs/VIDEO_SCRIPT.md`](docs/VIDEO_SCRIPT.md) - the walkthrough script
- [`docs/AI_USAGE.md`](docs/AI_USAGE.md) - how this was built with Claude Code
- PDF exports of the one-pager and errors doc: [`submission/`](submission/)

## Repo layout

```
app/            Vite + React + TypeScript source, deployed as a static site
app/tests/      Playwright end-to-end tests
app/src/data/checks/run.test.ts        Unit tests for every check's tax-effect math
app/src/data/workpaperTotals.test.ts   Unit tests for the Home top-strip totals
docs/           The four required write-ups
submission/     PDF exports of the one-pager and errors doc
```

See [`app/README.md`](app/README.md) for local development, testing, and deployment
commands, and how to use the live app (role switcher, "Load demo worked file", the as-of
clock).
