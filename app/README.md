# Miraflores Workpaper

A web-native tax workpaper for the Okafor-Lindqvist 2025 return, built on an evidence
graph over an append-only event log (not a spreadsheet). See
[`docs/ONE_PAGER.md`](../docs/ONE_PAGER.md) for the core idea and data model,
[`docs/ERRORS.md`](../docs/ERRORS.md) for the 20 errors the independent checks surface,
and [`docs/AI_USAGE.md`](../docs/AI_USAGE.md) for how this was built.

**Live:** https://app-opal-tau-89.vercel.app

## Using the live app

**Role switcher** (top-right dropdown): the workpaper is role-aware - preparer, reviewer,
partner, a preparer without sensitive-data clearance, firm admin, quality reviewer, and
two client logins. Switching roles changes the nav (clients see a simplified view),
enforces standards live (e.g. a reviewer can't sign off work they also prepared), and
masks SSNs/account numbers for the no-clearance preparer everywhere they'd appear,
including inside the simulated source documents.

**Load demo worked file** (top bar): seeds a plausible season's worth of events -
verifications, accepted adjustments, a reviewer note, a partner sign-off that later
reopens - so the app isn't empty on first look. It's additive and safe to click more than
once; **Reset** (with a confirmation prompt) clears everything back to just the four
standing client questions that seed automatically.

**As-of clock** (top bar slider): replays the season. Documents and events dated after
the slider's position are hidden everywhere - the IRS Letter 566 examination notice, for
instance, only appears once the clock passes its actual received date in 2028.

**⌘K / Ctrl+K**: global search across documents, return lines, checks, and the
questionnaire.

Your work (accepted adjustments, notes, sign-offs, your role) lives in your browser's
IndexedDB/localStorage - nothing is sent to a server, and nothing is shared between
visitors. Open two tabs as different roles to see the multi-user BroadcastChannel sync.

## Local development

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build to dist/
```

## Testing

```bash
npm run test:unit                                            # vitest - checks' tax-effect math
npm run test:e2e                                              # playwright against localhost:5173
PW_BASE_URL=https://app-opal-tau-89.vercel.app npm run test:e2e   # playwright against the live deploy
```

## Deployment

Static site, deployed to Vercel from this directory (`vercel.json` rewrites every path to
`index.html` for client-side routing; `packet.json` and `/assets/*` are excluded from the
rewrite so they still serve directly). Redeploy with `vercel --prod` from `app/`.
