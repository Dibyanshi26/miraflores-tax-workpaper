import { useMemo } from "react";
import { useStore } from "../store/useStore";
import { PageHeader, Section, Card } from "../components/Section";
import { StatusBadge } from "../components/StatusBadge";
import { fmtDate, fmtDateTime, fmtMoney, isDocumentVisible } from "../data/index";
import { runIndependentChecks } from "../data/checks/run";
import { computeWorkpaperTotals } from "../data/workpaperTotals";
import "./Filing.css";

const FILING_EVENT_NAMES = new Set([
  "extension_filed_with_payment", "client_approved_and_signed_8879", "efile_rejected",
  "efile_accepted_federal", "efile_accepted_california", "federal_balance_paid",
  "california_refund_issued", "quality_review_selected_return", "notice_received",
]);

export function Filing() {
  const { index, asOf, derived, appendEvent } = useStore();
  const checks = useMemo(() => (index ? runIndependentChecks(index) : []), [index]);

  if (!index) return null;
  const filingTimeline = index.packet.timeline.filter((t) => FILING_EVENT_NAMES.has(t.event) && t.at <= asOf);
  const frozen = (derived.byType.get("filing") ?? []).some((e) => e.payload.filing_event === "freeze");
  const letter566 = index.packet.tax_agency_records.notices.find((n) => n.id === "N-2025-L566");
  const letter566Doc = letter566?.document ? index.documentsById.get(letter566.document) : undefined;
  // Gate on the document's own received_at (2028-01-26), not the notice's `dated` field
  // (2028-01-20) - the notice itself isn't "in the file" until the document arrives.
  const letter566Visible = Boolean(letter566 && letter566Doc && isDocumentVisible(letter566Doc, asOf));
  const schcCheck = checks.find((c) => c.code === "SCHC-1099K-DOUBLE");
  const totals = computeWorkpaperTotals(index, derived);
  const workpaperFederalBalance = totals.federal.accepted.balanceDue;
  const federalOverpayment = workpaperFederalBalance < 0;

  return (
    <>
      <PageHeader title="Filing lifecycle" subtitle="Extension through acceptance, payments, freeze-and-amend, and notice response - gated by the as-of clock." />

      <Section title="Timeline">
        <div className="filing-timeline">
          {filingTimeline.map((t) => {
            const notApplicable = t.event === "federal_balance_paid" && federalOverpayment;
            return (
              <Card key={t.id} className={`filing-timeline-row${notApplicable ? " filing-timeline-row--na" : ""}`}>
                <span className="filing-timeline-event">{t.event.replace(/_/g, " ")}</span>
                <span className="muted">{fmtDateTime(t.at)}</span>
                {notApplicable ? (
                  <StatusBadge status="neutral">not applicable</StatusBadge>
                ) : (
                  t.detail && <span className="muted">{t.detail}</span>
                )}
              </Card>
            );
          })}
          {filingTimeline.length === 0 && <Card><span className="muted">Move the as-of slider forward to see filing events.</span></Card>}
          {federalOverpayment && filingTimeline.some((t) => t.event === "federal_balance_paid") && (
            <Card className="filing-na-explain">
              <strong>Why "federal balance paid" doesn't apply</strong>
              <p>
                The scripted transcript shows a payment because v3's engine balance due was {fmtMoney(index.latestVersion.summary.federal.balance_due)}. Once the
                workpaper's accepted adjustments are factored in, the federal return actually shows an overpayment of {fmtMoney(Math.abs(workpaperFederalBalance))} -
                there was nothing to pay by direct debit. This is exactly the kind of correction the workpaper is designed to surface: the historical
                record (what was filed) and the corrected workpaper figure (what should have been filed) can disagree, and both stay visible.
              </p>
            </Card>
          )}
        </div>
      </Section>

      <Section title="E-file submissions">
        <Card>
          <table className="datatable">
            <thead><tr><th>Date</th><th>Jurisdiction</th><th>Status</th><th>Errors</th></tr></thead>
            <tbody>
              {index.packet.tax_agency_records.efile.filter((e) => e.date <= asOf).map((e, i) => (
                <tr key={i}>
                  <td className="muted">{fmtDateTime(e.date)}</td>
                  <td>{e.jurisdiction}</td>
                  <td>
                    {e.status === "accepted" ? <StatusBadge status="verified">accepted</StatusBadge>
                      : e.status === "rejected" ? <StatusBadge status="blocking">rejected</StatusBadge>
                      : <StatusBadge status="open">{e.status}</StatusBadge>}
                  </td>
                  <td>{e.errors?.map((er) => `${er.code}: ${er.message}`).join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section title="IRS account transcript">
        <Card>
          <table className="datatable">
            <thead><tr><th>Date</th><th>Code</th><th>Description</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {(index.packet.tax_agency_records.irs_account_transcript_2025.at(-1)?.transactions ?? [])
                .filter((t) => t.date <= asOf)
                .map((t, i) => (
                  <tr key={i}>
                    <td className="muted">{fmtDate(t.date)}</td>
                    <td className="mono">{t.code}</td>
                    <td>{t.description}</td>
                    <td className="num">{typeof t.amount === "number" ? t.amount.toLocaleString() : t.amount}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section title="Freeze at filing" subtitle="Once filed, the workpaper freezes - further changes become amendments on top.">
        <Card className="filing-freeze-card">
          {frozen ? <StatusBadge status="verified">Frozen</StatusBadge> : <StatusBadge status="neutral">Not yet frozen</StatusBadge>}
          {!frozen && (
            <button className="btn btn--sm btn--primary" onClick={() => void appendEvent({ type: "filing", target: { kind: "filing", id: "return-2025", label: "2025 return" }, payload: { filing_event: "freeze" } })}>
              Freeze at filing
            </button>
          )}
        </Card>
      </Section>

      {letter566Visible && letter566 && (
        <Section title="Notice response: IRS Letter 566" subtitle={`Dated ${fmtDate(letter566.dated)} · received ${fmtDate(letter566Doc!.received_at)} · response due ${fmtDate(letter566.response_due)}`}>
          <Card className="filing-notice-card">
            <h4>Items under examination</h4>
            <ul>{letter566.items_under_examination?.map((it, i) => <li key={i}>{it}</li>)}</ul>
            <h4>Self-contained response</h4>
            <p>
              Schedule C gross receipts reconciliation: {schcCheck ? schcCheck.explanation : "see the SCHC-1099K-DOUBLE check"} - the workpaper's Checks view and the 1099-NEC/1099-K evidence (D15) answer this item directly.
              Noncash charitable contributions: see Form 8283 evidence (D66 1098-C, St. Brigid acknowledgment) in Documents and the vehicle-donation and St.-Brigid judgment items in Review.
            </p>
          </Card>
        </Section>
      )}
    </>
  );
}
