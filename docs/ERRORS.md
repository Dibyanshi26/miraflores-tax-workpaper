# Errors found, and how the design surfaced them

All 20 errors below are implemented as independent checks in `app/src/data/checks/run.ts` -
plain code that recomputes an expected value from the raw packet (documents, extracted
values, questionnaire, agency records) and compares it to the engine's `return_versions[v3]`
output, the same way a reviewer would recompute by hand rather than trust the software. Every
check appears in the **Checks** view with expected vs. actual, cited evidence, a plain-English
explanation, and (where applicable) a proposed adjustment the preparer can accept or dismiss.
Accepting one records an `adjustment` event and the return's workpaper total updates live.

Federal tax-effect rates (per dollar, from `return_versions[v3].tax_effect_rates`): stcg
.348, ltcg .238, schc .355, interest .348, adjustment −.31, itemized −.26. California
`ca_source_income` rate: .064.

Each check's dollar effect below is what accepting it alone moves, at today's baseline
(no other checks yet accepted) - exactly the numbers the live app shows and
`app/src/data/checks/run.test.ts` pins in a unit test. **Moves** says which workpaper total
it hits: almost all of them are a **Tax** effect (AGI → total tax → balance due); the two
payment checks (#15, #16) are a **Payments** effect instead - a dollar-for-dollar correction
to estimated payments actually made, which never touches total tax, only the Payments line
and therefore balance due (`balance due = total tax − payments`).

| # | Check code | Error | Fed effect | CA effect | Moves | How the design surfaced it |
|---|---|---|--:|--:|---|---|
| 1 | `RSU-BASIS` | RSU sales taxed with $0 basis - the engine applied Corvane's supplemental-basis statement (D11) to the ESPP lot only, not the three RSU lots | −$15,536 | −$2,765 | Tax | The check reads D11's per-lot basis directly and compares it to the $0 basis baked into each F8949 lot's label. Two of the three lots (N1, N3) sold while still California-resident, so their California effect uses the `ca_source_income` rate (.064), not the blended `stcg` rate - the third (N4) sold after the move to Texas and uses the standard `ltcg` rate. Surfaced on **Home** (top of the ranked open-items list - this is the single largest effect in the file), **Checks**, and **Sales detail**'s exceptions-first section, which lists it before the 295-lot bulk table |
| 2 | `SCHC-1099K-DOUBLE` | Schedule C gross receipts double-counts a 1099-K ($12,400 Paywell amount is already part of the $41,200 Atlas deposit in the books) | −$4,402 | −$384 | Tax | The check sums 1099-NEC + non-1099 book revenue independently and compares to `SchC.1`. Surfaced on **Checks** and on **Books → tax**, which renders the revenue bridge with the duplicated line called out explicitly. This is also the item the 2028 IRS Letter 566 asks about - the **Filing** view's notice-response section answers it directly from this same check |
| 3 | `MILEAGE-DUPLICATE-PAGE` | A mileage log page is a second scan of the previous page, double-counting 3,700 miles | +$919 | +$80 | Tax | The check groups extracted trip rows by page, hashes each page's trips, and finds pages 2 and 3 identical - no hardcoded knowledge of which page is the duplicate. Surfaced on **Checks** and **Books → tax** (car-and-truck expense row) |
| 4 | `SE-HEALTH-INS` | Self-employed health insurance deducted despite Erik's eligibility for Ngozi's employer-subsidized family coverage | +$4,464 | +$605 | Tax | The check reads the questionnaire answer (qa-25) directly. Surfaced on **Checks**, with the 2024 return's matching treatment shown for context in the trace drawer on `Sch1.17` |
| 5 | `PERSONAL-USE-SPLIT` | Telephone/internet booked 100% business; a personal Spotify subscription booked as business software | +$541 | +$47 | Tax | The check applies call-01's own stated business-use percentages (phone 70%, internet 50%) and removes the named personal charge - disallowing an expense increases profit, so this is a positive effect. Surfaced on **Checks** and **Books → tax** |
| 6 | `SEP-LIMIT` | The $18,000 SEP contribution exceeds the deductible limit, and the limit itself keeps moving as Schedule C is corrected | $0 at baseline | $0 at baseline | Tax (live) | This check is **live**: it recomputes the 20%-of-(profit − half SE tax) limit from today's workpaper Schedule C profit - at the unedited baseline the engine's $15,214 deduction already matches that limit exactly (so the effect of accepting it alone is $0), but the $18,000 actually contributed already exceeds it by about $2,786, and accepting errors #2, #3 and #5 first tightens the limit further and grows that excess in real time. Any excess is subject to a 6% excise tax on Form 5329 unless withdrawn. Surfaced on **Checks**, flagged on **Home** as a blocker |
| 7 | `HVAC-CAPITALIZE` | An $11,000 HVAC system replacement (with a permit) expensed as a repair instead of capitalized | +$3,633 | +$896 | Tax (what_if) | Too many downstream lines (depreciation, passive-loss release, AMT) for a single tax-effect-rate multiply, so this check surfaces the engine's own precomputed `what_if.hvac_improvement` alternative instead of inventing one. Surfaced on **Checks** and the dedicated **What-ifs** view, either of which can apply it |
| 8 | `NORTHLAKE-DUPLICATE-INTEREST` | $1,840 of sweep-account interest reported on both a composite 1099 and a standalone 1099-INT for the same account | −$640 | −$127 | Tax | Direct comparison of the two source amounts. Surfaced on **Checks** and **Reconciliations** |
| 9 | `SPARBANKEN-FX-YEAR` | Swedish interest converted at the 2024 average exchange rate instead of 2025's | +$43 | +$9 | Tax | The check re-divides the SEK amount by `fx_rates.SEK_per_USD["2025_average"]` and compares to the engine's figure, which cites the 2024 rate. Surfaced on **Checks** |
| 10 | `MERIDIAN-MISSING-LOT` | A 1099-B lot (page 32 of 32) was never extracted, leaving a $250 gap between the detail total and the summary | −$21 | −$2 | Tax | The check sums all extracted lot proceeds for the document and compares to the broker's own summary total extracted value - the gap itself is the evidence, no external knowledge of lot M18 required to detect it. Surfaced on **Checks**, **Sales detail** exceptions, and the **Reconciliations** box-total table |
| 11 | `CRYPTO-BASIS-MISSING` | A crypto lot has no cost basis or acquisition date, taxed as a $5,325 short-term gain | −$1,312 | −$104 | Tax | Flagged from the engine's own `DIGITAL_ASSET_BASIS_MISSING` diagnostic; the client's message (msg-07) supplies the missing basis and date. Surfaced on **Checks** and **Sales detail** exceptions; the demo worked file shows the question-to-client → answer → adjustment flow end to end |
| 12 | `MORTGAGE-PAYOFF-DOUBLE` | Payoff interest counted twice - the payoff statement says plainly it's already in the Form 1098 box 1 figure | +$559 | +$103 | Tax | Direct comparison of the two source documents' interest amounts. Surfaced on **Checks** |
| 13 | `PROPERTY-TAX-SELLER-CREDIT` | Home property tax includes the seller's pre-closing share (credited at closing), and the Oregon composite tax paid on Erik's behalf is omitted from the SALT total | +$1,051 | +$332 | Tax | The federal effect isn't the raw dollar correction - the check applies the $40,000 SALT cap first: the corrected uncapped total ($35,958) falls under the cap, so the federal deduction moves by the full $4,042 gap to the cap, not the $5,332 raw correction. California has no SALT cap but also never deducts state income tax at all, so only the real-estate-tax correction ($6,912) affects the California side - the Oregon composite tax is federal-only. Surfaced on **Checks** |
| 14 | `VEHICLE-DONATION-LIMIT` | A donated vehicle claimed at the client's $6,000 KBB estimate instead of the $2,900 the charity actually received at sale | +$806 | +$149 | Tax | Direct comparison to Form 1098-C box 4c. Surfaced on **Checks** |
| 15 | `FED-ESTIMATED-PAYMENTS` | A federal Q4 estimated payment taken from the client's hedged recollection ("4,000 I think") instead of the IRS transcript | +$1,000 | — | **Payments** | The check sums the IRS account transcript's own `670` transactions and compares to the claimed total - the $1,000 overclaim reduces the federal Payments line (total tax is untouched), raising balance due by the same amount. Surfaced on **Checks**, **Reconciliations**, **Filing** (transcript table), and **Home**'s top strip (the Payments row, not Total tax) |
| 16 | `CA-ESTIMATED-PAYMENT-MISDESIGNATED` | A California estimated payment was designated to the wrong tax year at the FTB and shouldn't count toward 2025 | — | +$3,500 | **Payments** | Compares the client's Web Pay confirmation to the FTB account record, which shows the payment held as a 2024 credit - it reduces the California Payments line, not Total tax. Surfaced on **Checks** and **Home**'s top strip |
| 17 | `CA-SOURCE-WAGES-PAYROLL-ERROR` | California-source wages use the full-year W-2 Box 16 instead of the actual CA work period (payroll kept coding CA after the move) | $0 | −$5,685 | Tax (`ca_source_income`) | Box 1 federal wages don't change at all - only how much of them is CA-source - so this is a pure `ca_source_income` reallocation with a zero federal effect by construction, not a reduced federal `wages` rate. The check compares Box 16 to the paystub's own year-to-date CA wages as of the move date, corroborated by the client's note (qa-45). Surfaced on **Checks**, **Home** blocker, and the **State split** view's flagged section |
| 18 | `THEO-SSN-TYPO` | A transposed SSN digit in the organizer caused a federal e-file rejection | no tax effect | no tax effect | — | Compares the organizer's entry to the Social Security card and the 2024 return. Surfaced on **Checks**; the rejection itself is visible in **Filing**'s e-file submissions table once the as-of clock passes 7/13 |
| 19 | `LITTLE-SPROUTS-EIN-MISREAD` | A daycare provider EIN misread at 97% confidence (digits transposed) | no tax effect | no tax effect | — | Low-confidence extraction flagged directly. Surfaced on **Checks** and the document's own confidence badge in **Documents** |
| 20 | `BRIGHT-OAK-NAME-MISMATCH` | A care provider's name on Form 2441 doesn't match its own statement or the 2024 return | no tax effect | no tax effect | — | Direct string comparison. Surfaced on **Checks** |

## The combined effect, if every check is accepted

Home's top strip shows this live, as three columns per jurisdiction (engine v3 /
workpaper as accepted so far / workpaper if every still-pending check were also
accepted). Accepting all 20 checks moves:

| | Federal | California |
|---|--:|--:|
| Total tax: v3 → all accepted | $81,962 → $72,068 | $18,874 → $12,027 |
| Payments: v3 → all accepted | $77,742 → $76,742 | $27,130 → $23,630 |
| Balance due: v3 → all accepted | $4,220 due → **$4,674 refund** | $8,256 refund → **$11,603 refund** |

Total tax moves by the sum of the 18 tax-effect checks only; Payments moves by the two
payment corrections only (#15, #16); balance due is always `total tax − payments`,
recomputed, never shifted directly - which is exactly the bug a payment correction used to
cause before `app/src/data/workpaperTotals.test.ts` pinned both totals down.

## Judgment and completeness items (no engine fix, but recorded)

These don't have a single "correct" numeric answer - they're judgment calls, conflicts, or
outside-filing items the brief requires proving were considered. They live in
`data/judgmentItems.ts` and appear on the **Review notes & sign-offs** view, where a
preparer records each one as a `judgment` event citing its authority (per the firm standard
"every judgment call records the authority relied on"):

- **IRA basis conflict** - client says no prior basis; the 2024 Form 8606 and 5498 both show
  $7,000. Documents win; the engine's $26 taxable conversion is correct as computed.
- **St. Brigid receipt** - an ambiguous digit (41% confidence) resolved by a client
  message and a specific check number; a written acknowledgment is still required for gifts
  of $250+.
- **S corp basis** - rolled forward through a late K-1 to a $21,215 excess distribution
  (taxed as long-term gain), which the prior preparer's file simply "assumed... sufficient."
- **Prior-preparer open items** - two resolved by newly-received documents, one immaterial
  (home office square footage), one still open (Form 3520 for a 2023 inheritance, outside
  this engagement - advised in writing per Circular 230 §10.21).
- **Outside filings identified**: FBAR, Form 3520, two late 1099-NECs, Oregon/Arizona
  composite returns already filed by the entities, and Ada's own dependent return.
- **California AMT on the ISO exercise** - not computed by the engine; recorded as a
  judgment call given the exercise date fell after the move to Texas.
- **Questionnaire conflicts** - "no sales" (qa-14) vs. 282 actual sales; a wrong Q4 estimate
  (qa-41, see check #15).
- **Due diligence** - Form 8867 required for CTC/ODC/AOTC, tracked as a standing item.
- **Extension shortfall** - the April extension payment was sized from v2's estimate; the
  final balance differs, so interest and a failure-to-pay penalty apply to the late portion.

## What the engine got right (passed checks)

Eleven checks pass today, shown alongside the failures in the same **Checks** view so a
reviewer sees the full independent-verification picture, not just the bad news: W-2
de-duplication, the corrected Meridian 1099 superseding the original, 260 Brightpath lots
reconciling exactly, excess Social Security, Form 8959, Form 8938's threshold, Form 8606's
pro-rata math, every asset's depreciation roll-forward, the rental sale's §1250 recapture,
CTC phase-out, and passive-loss release on the sale.
