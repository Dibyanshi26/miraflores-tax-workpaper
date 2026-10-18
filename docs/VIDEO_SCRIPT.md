# Video walkthrough script

Target: 7-9 minutes. This is a script to adapt in your own words, not a transcript to
read verbatim - the brief asks for *your* technical decisions and tradeoffs, so pause
anywhere marked **[your take]** and actually say what you'd say.

Suggested recording setup: screen share the running app at a reasonable zoom level (the UI
assumes ~1440px wide), role switcher and as-of slider visible in the top bar throughout.

---

## 1. Open with the problem (30-45s)

"This is a workpaper for the Okafor-Lindqvist 2025 return - stock comp, a one-person
business, two brokerages and crypto, a Swedish account, a rental sold, two K-1s, an S-corp
with basis gaps, a backdoor Roth, and a household that moved from California to Texas
mid-year. The brief was explicit: don't build a spreadsheet, and don't recreate traditional
workpapers in any form. So before touching any view, I asked what a workpaper actually has to
prove - where every number came from, what was done to it, who checked it, what's still
open - and designed from that, not from what workpapers have looked like before."

## 2. The core idea (60-90s)

Navigate to **Home**.

"Two ideas carry the whole app. First: the packet - the documents, the extracted values,
the engine's three computed versions - is immutable source truth. I never mutate it.
Second: every human action - a verification, an adjustment, a note, a sign-off - is an
event, appended to a log and never edited in place. Everything you see - the return
summary, the checks list, who's signed off - is a fold over that event list, computed
fresh every time. That's the whole architecture."

Click **Load demo worked file** if not already loaded.

"This seeds a plausible season of events so the app isn't empty - a preparer accepting
fixes, a reviewer leaving a note, a partner resolving it and signing off. Everything you'll
see from here on is just that event log rendered different ways."

**[your take]**: why an event log instead of a database table per feature - what you got for
free (undo, since-you-last-looked, version compare, sign-off reopening) and what it cost you
(every view needs to fold the log instead of reading a flat field).

## 3. Trace a number (60s)

Navigate to **Return summary**. Click **trace** next to a line, e.g. Total tax.

"Any number opens a trace drawer: its value across v1, v2, v3 and the prior year, the
formula tree of what it's built from, the rule the engine applied, and its sources - which
click straight through to the source document with the exact text highlighted."

Click an evidence chip to jump into **Documents**, point out the highlighter-yellow span
matching the extracted value.

"These are simulated documents built from the packet's `printed_content`, since we weren't
given real source PDFs - but the renderer takes `{document, highlightEvId}` as its whole
interface, so a real PDF renderer drops in without touching any call site."

## 4. Checks - the errors (2-2.5 min, the core of the demo)

Navigate to **Checks**.

"The packet contains confident mistakes - the brief says so directly. These are 31
independent checks: code that recomputes an expected value from the raw documents and
questionnaire, and compares it to what the engine produced. It doesn't trust
`return_versions` at all."

Expand **RSU sales taxed with $0 basis**.

"Corvane's supplemental statement gives real cost basis for every lot sold - the engine
only applied it to the ESPP lot, so the three RSU lots get taxed on $0 basis when the
income's already in the W-2. Accepting this one check alone is a $15,536 federal swing -
the single largest item in the file. Two of the three lots sold while the household was
still California-resident, so their California effect uses a different rate than the
third, which sold after the move to Texas - $2,765 combined. Expected, actual, the
evidence, and a proposed adjustment with a live-computed federal and California effect."

Click **Accept adjustment**. Point out it just appended an event - show it land on **Return
summary** as part of the workpaper total, then flip to **Home**: the top strip's
"Workpaper (accepted)" column for Total tax just moved. Accept the federal
estimated-payments check next and point out it moves the **Payments** row instead - same
event type, same UI, different consequence, because a payment correction never touches
total tax.

Point at the third column, "Workpaper (all pending accepted)" - the hypothetical if every
remaining check were accepted too: federal total tax drops from $81,962 to about $72,068
and the $4,220 balance due flips to a $4,674 refund; California drops from $18,874 to about
$12,027 and the refund grows from $8,256 to $11,603. "That's the whole file's worth of
errors, netted out, without me doing any arithmetic by hand."

Expand **SEP contribution exceeds the deductible limit**.

"This one's live: the 20% SEP limit depends on Schedule C profit, so it recomputes against
whatever Schedule C adjustments are currently accepted. Accept the 1099-K double-count or
the mileage duplicate and watch the excess contribution change in front of you - that's the
event-log architecture paying off, not a special case."

Briefly scroll the full list - call out the mix of blocking vs. info severity, and the
**Passed** tab.

"Eleven checks pass too - shown in the same place, not buried, because a trustworthy
workpaper has to show its work on what's *right*, not just what's wrong."

## 5. Large detail without swamping review (45s)

Navigate to **Sales detail**.

"302 Form 8949 lines, 295 individual lots. Exceptions first - the lots the checks actually
flagged - then box totals reconciled against the sum of their own lots, then the full table
behind a box/search filter. Nobody reviews 295 lots in isolation; they review the three that
are wrong and confirm the rest tie out in aggregate."

## 6. Change, review, sign-off reopening (60-75s)

Navigate to **Review notes & sign-offs**.

"Partner sign-off here is 'reopened' - because after Helen signed off, the preparer accepted
one more adjustment. The sign-off stores a fingerprint of everything it covered; any event
touching that set after the fact changes the live fingerprint, and the UI just shows the
mismatch. No separate 'did anything change' tracking - it's the same fold."

Point out the **self-review block** if visible for the current role ("you prepared this
work and can't review your own").

## 7. Roles and the as-of clock (60s)

Switch role via the top-right dropdown to **Marcus Bell — Preparer (no clearance)**.
Navigate to a W-2 **document**.

"Marcus has no sensitive-data clearance, so SSNs are masked - in the sidebar *and* inside
the simulated document body, since the raw source would show them too. Revealing is a
deliberate click, and it's logged - Firm admin has the full access log."

Switch to **client** role, show **Client portal**.

Drag the **as-of** slider back toward January, then forward past July.

"This replays the season - documents received after the as-of date disappear, and the
scripted post-filing events (e-file rejection, acceptance, payments, the 2028 notice) appear
only once the clock passes them."

## 8. Technical decisions and tradeoffs (60-90s) - **say this in your own words**

Talking points to hit, adapted to how you'd actually explain them:

- **Why Vite + React + TS, static-only, no backend.** The packet is fetched once; the event
  log is per-browser IndexedDB with a BroadcastChannel for multi-tab roles. [your take: what
  you'd change for a real multi-user deployment - sync the same event log to a server, same
  shape, different transport]
- **Why the independent checks are plain TypeScript functions, not a rules engine.** [your
  take: readability for a reviewer asking "why did it flag this" vs. extensibility]
- **Where you spent the least time on purpose, and why.** [your take - maybe area
  classification heuristics, maybe the time-vs-budget proxy on Firm admin]
- **One thing you'd do differently with more time.**

## 9. Close (15s)

"That's the workpaper - an evidence graph over an append-only event log, with independent
checks that don't trust the engine, surfaced to whoever's looking at it: preparer, reviewer,
partner, client, or an examiner years later replaying the as-of clock."

---

### Recording checklist
- [ ] Packet loads from a public link (no local-only dependency)
- [ ] Demo worked file loaded before recording starts
- [ ] At least one check accepted on camera, shown landing on Return summary
- [ ] Trace drawer opened at least once, through to a highlighted document
- [ ] Role switch + masking demonstrated
- [ ] As-of slider moved
- [ ] Your own technical tradeoffs spoken, not read
