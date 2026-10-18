// Judgment / completeness items: no engine fix, but they must be recorded per the brief
// ("prove completeness: every document used, every area considered, every outside filing
// identified"). These seed as suggested judgment-call events a preparer can accept/edit.

export interface JudgmentSeed {
  code: string;
  title: string;
  body: string;
  authority?: string;
  evidence: string[];
  area: string;
  needsClientInput?: boolean;
}

export const JUDGMENT_SEEDS: JudgmentSeed[] = [
  {
    code: "IRA-BASIS-CONFLICT",
    title: "IRA basis: client says none, documents say $7,000",
    body: "Ngozi says there was no prior IRA basis (qa-31), but the 2024 Form 8606 and 2024 Form 5498 both show $7,000 of basis. Documents win over recollection - the engine's $26 taxable conversion (Form 8606) is correct as computed. Record the conflict for the file.",
    authority: "Documentary evidence over client recollection; IRC §408(d), Form 8606 instructions",
    evidence: ["qa-31", "py:/return_2024/lines/F8606.14", "D42"],
    area: "pass_throughs_and_basis",
  },
  {
    code: "ST-BRIGID-RECEIPT-AMBIGUOUS",
    title: "St. Brigid receipt: digit ambiguous at 41% confidence",
    body: "The first digit of the St. Brigid gift receipt could be 1 or 7 (0.41 confidence). The client's phone confirmation plus check #2207 (msg-08) supports $1,500. A written acknowledgment is still required for a gift of $250 or more and should be requested before filing.",
    authority: "IRC §170(f)(8) - contemporaneous written acknowledgment required for gifts of $250+",
    evidence: ["msg-08"],
    area: "deductions_and_credits",
    needsClientInput: true,
  },
  {
    code: "SCORP-BASIS-EXCESS-DISTRIBUTION",
    title: "S corp basis: rolled forward through a late K-1, shows an excess distribution",
    body: "Stock basis rolled forward using the late 2023 K-1 (D40): 2022 end 21,300 → 2023: +14,100 -20,000 = 15,400 → 2024: +16,900 -30,000 = 2,300 → 2025: +18,485 -42,000 = -21,215, floored at zero with the $21,215 excess distribution taxed as long-term capital gain. The prior preparer's file notes 'assumed basis sufficient' without this computation.",
    authority: "IRC §1368(b) - distributions in excess of stock basis are capital gain",
    evidence: ["D40", "py:/basis_records/scorp_lindqvist_family_woodworks"],
    area: "pass_throughs_and_basis",
  },
  {
    code: "PRIOR-OPEN-3520",
    title: "Prior-preparer open item still open: Form 3520 for the 2023 inheritance",
    body: "A 2023 inheritance over $100,000 should have triggered Form 3520. It was never filed and is outside this engagement's scope - advise the client in writing per Circular 230 §10.21 and document that advice was given.",
    authority: "Circular 230 §10.21 (duty to advise of noncompliance); IRC §6039F",
    evidence: ["D07"],
    area: "intake_and_engagement",
    needsClientInput: true,
  },
  {
    code: "PRIOR-OPEN-HOME-OFFICE-SQFT",
    title: "Prior-preparer open item: home office square footage changed year over year",
    body: "D24 measures 220 sq ft for the Sacramento studio; the 2024 return used 300 sq ft. The 2024 over-deduction is about $400 - immaterial, no amendment recommended, but recorded for the file.",
    evidence: ["D24", "py:/return_2024"],
    area: "business",
  },
  {
    code: "OUTSIDE-FILING-FBAR",
    title: "Outside filing: FBAR (FinCEN 114)",
    body: "Maximum combined foreign account balance is approximately $149,600 (Sparbanken Norrland, converted at the 2025 year-end rate) - well above the $10,000 FBAR threshold.",
    authority: "31 U.S.C. §5314, 31 CFR 1010.350",
    evidence: ["F8938.1.max"],
    area: "california",
  },
  {
    code: "OUTSIDE-FILING-3520",
    title: "Outside filing: Form 3520 for the 2023 inheritance",
    body: "See PRIOR-OPEN-3520 - still outstanding, outside this engagement.",
    evidence: ["D07"],
    area: "intake_and_engagement",
  },
  {
    code: "OUTSIDE-FILING-1099NEC",
    title: "Outside filing: Forms 1099-NEC for two contractors (late)",
    body: "Call notes (call-01) confirm two contractors were paid by ACH with no 1099s filed. These are now late and should be filed, along with any applicable penalty abatement request.",
    authority: "IRC §6041; Form 1099-NEC instructions",
    evidence: ["call-01"],
    area: "business",
  },
  {
    code: "OUTSIDE-FILING-COMPOSITE",
    title: "Outside filing: Oregon and Arizona composite returns",
    body: "Already filed by the pass-through entities on Erik's behalf (see D39 for the Oregon composite tax paid). Recorded here as part of proving every outside filing was identified.",
    evidence: ["D39"],
    area: "pass_throughs_and_basis",
  },
  {
    code: "OUTSIDE-FILING-ADA",
    title: "Outside filing: Ada's own return",
    body: "Ada correctly checked 'can be claimed as a dependent' on her own return - no action needed, recorded for completeness.",
    evidence: ["household:ada"],
    area: "intake_and_engagement",
  },
  {
    code: "CA-AMT-ISO-NOT-COMPUTED",
    title: "California AMT on the ISO exercise is not computed",
    body: "The incentive stock option exercise happened 7/30, after the move to Texas - California AMT on the ISO preference item is not computed by this engine and needs a manual determination of whether any CA-source AMT applies for the pre-move period.",
    authority: "Cal. Rev. & Tax Code §17062",
    evidence: ["F6251.11"],
    area: "california",
  },
  {
    code: "QUESTIONNAIRE-CONFLICT-SALES",
    title: "Questionnaire conflict: 'no sales' vs 282 actual sales",
    body: "qa-14 answers 'no' to a sales question, but the brokerages report 282 sales across Meridian, Brightpath, Northlake and Coinhaven. Record the conflict; rely on the broker 1099s.",
    evidence: ["qa-14"],
    area: "investments_and_digital_assets",
  },
  {
    code: "QUESTIONNAIRE-CONFLICT-Q4-ESTIMATE",
    title: "Questionnaire conflict: Q4 estimated payment amount is wrong",
    body: "qa-41's estimate ('4,000 I think') conflicts with the IRS transcript's $3,000. See the FED-ESTIMATED-PAYMENTS check - the transcript wins.",
    evidence: ["qa-41"],
    area: "filing",
  },
  {
    code: "DUE-DILIGENCE-8867",
    title: "Form 8867 due diligence required: CTC/ODC and AOTC",
    body: "Due diligence documentation is required for the child tax credit, credit for other dependents, and American opportunity credit (even though AOTC fully phases out by MAGI - the due-diligence requirement to confirm that still applies).",
    authority: "IRC §6695(g), Form 8867 instructions",
    evidence: ["F8812.4", "F8812.6"],
    area: "deductions_and_credits",
  },
  {
    code: "EXTENSION-PAYMENT-SHORTFALL",
    title: "Extension payment was based on v2, not the final return",
    body: "The $36,000 extension payment (4/14/2026) was computed from v2's estimate. The final v3 balance differs, so interest and the failure-to-pay penalty apply to the portion paid 7/20/2026 after the 4/15 deadline.",
    evidence: ["timeline:extension-2026-04-14", "agency:/irs_account_transcript_2025"],
    area: "filing",
  },
];
