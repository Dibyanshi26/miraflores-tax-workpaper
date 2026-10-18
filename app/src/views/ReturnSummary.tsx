import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../store/useStore";
import { PageHeader, Section, Card } from "../components/Section";
import { StatusBadge } from "../components/StatusBadge";
import { useUiStore } from "../store/uiStore";
import { fmtMoney } from "../data/index";
import { aggregateAcceptedAdjustments } from "../data/taxEffect";
import { runIndependentChecks } from "../data/checks/run";
import "./ReturnSummary.css";

interface Row { label: string; py: number | undefined; v3: number; workpaper: number; flagPct?: boolean; flagAmt?: boolean; lineKey?: string }

export function ReturnSummary() {
  const { index, derived } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const highlightLine = params.get("line");

  const accepted = useMemo(
    () => (index ? aggregateAcceptedAdjustments(index.latestVersion, derived.activeEvents) : { federal: { tax: 0, payments: 0 }, california: { tax: 0, payments: 0 }, items: [] }),
    [index, derived]
  );
  const checks = useMemo(() => (index ? runIndependentChecks(index) : []), [index]);

  if (!index) return null;
  const v3 = index.latestVersion;
  const py = index.packet.prior_years.return_2024.lines;
  const standards = index.packet.firm.starter_standards.variance_review;

  const fedTotalTax = v3.summary.federal.total_tax + accepted.federal.tax;
  const fedPayments = v3.summary.federal.payments - accepted.federal.payments;
  const caTotalTax = v3.summary.california.total_tax + accepted.california.tax;
  const caPayments = v3.summary.california.payments - accepted.california.payments;

  const fedRows: Row[] = [
    { label: "Adjusted gross income", py: Number(py["F1040.11"]), v3: v3.summary.federal.agi, workpaper: v3.summary.federal.agi + accepted.federal.tax, lineKey: "F1040.11" },
    { label: "Taxable income", py: undefined, v3: v3.summary.federal.taxable_income, workpaper: v3.summary.federal.taxable_income + accepted.federal.tax, lineKey: "F1040.15" },
    { label: "Total tax", py: Number(py["F1040.24"]), v3: v3.summary.federal.total_tax, workpaper: fedTotalTax, lineKey: "F1040.24" },
    { label: "Payments", py: Number(py["F1040.33"]), v3: v3.summary.federal.payments, workpaper: fedPayments, lineKey: "F1040.26" },
    { label: "Balance due / (refund)", py: undefined, v3: v3.summary.federal.balance_due, workpaper: fedTotalTax - fedPayments, lineKey: "F1040.37" },
  ];
  const caRows: Row[] = [
    { label: "Total AGI", py: undefined, v3: v3.summary.california.total_agi, workpaper: v3.summary.california.total_agi },
    { label: "CA AGI", py: undefined, v3: v3.summary.california.ca_agi, workpaper: v3.summary.california.ca_agi + accepted.california.tax },
    { label: "Total tax", py: undefined, v3: v3.summary.california.total_tax, workpaper: caTotalTax },
    { label: "Payments", py: undefined, v3: v3.summary.california.payments, workpaper: caPayments },
    { label: "Balance due / (refund)", py: undefined, v3: v3.summary.california.balance_due, workpaper: caTotalTax - caPayments },
  ];

  for (const r of [...fedRows, ...caRows]) {
    if (r.py !== undefined && !Number.isNaN(r.py)) {
      const diff = Math.abs(r.workpaper - r.py);
      r.flagPct = r.py !== 0 && diff / Math.abs(r.py) > standards.flag_if_change_over_percent / 100;
      r.flagAmt = diff > standards.and_over_amount;
    }
  }

  const areas = Object.entries(index.packet.firm.budget_hours).filter(([k]) => k !== "partner_review");

  function RowLine({ r }: { r: Row }) {
    const flagged = r.flagPct && r.flagAmt;
    return (
      <tr className={r.lineKey === highlightLine ? "rs-row--highlight" : ""}>
        <td>
          {r.label}
          {flagged && <StatusBadge status="open"> &gt;10% &amp; $1,000</StatusBadge>}
        </td>
        <td className="num">{r.py !== undefined && !Number.isNaN(r.py) ? fmtMoney(r.py) : "—"}</td>
        <td className="num">{fmtMoney(r.v3)}</td>
        <td className="num">
          {fmtMoney(r.workpaper)}
          {r.lineKey && (
            <button className="rs-trace-btn" onClick={() => useUiStore.getState().openTrace(r.lineKey!)} title="Trace this number">trace</button>
          )}
        </td>
      </tr>
    );
  }

  return (
    <>
      <PageHeader
        title="Return summary"
        subtitle="v3 (engine) vs workpaper (v3 + accepted adjustments) vs 2024, with variance flags over 10% and $1,000."
        actions={<button className="btn btn--sm" onClick={() => navigate("/checks")}>{checks.filter((c) => c.status === "fail").length} open checks →</button>}
      />

      <Section title="Federal (Form 1040)">
        <Card>
          <table className="datatable">
            <thead><tr><th>Line</th><th className="num">2024</th><th className="num">v3</th><th className="num">Workpaper</th></tr></thead>
            <tbody>{fedRows.map((r) => <RowLine key={r.label} r={r} />)}</tbody>
          </table>
        </Card>
      </Section>

      <Section title="California (Form 540NR)">
        <Card>
          <table className="datatable">
            <thead><tr><th>Line</th><th className="num">2024</th><th className="num">v3</th><th className="num">Workpaper</th></tr></thead>
            <tbody>{caRows.map((r) => <RowLine key={r.label} r={r} />)}</tbody>
          </table>
        </Card>
      </Section>

      {accepted.items.length > 0 && (
        <Section
          title="Accepted adjustments rolled into the workpaper total"
          subtitle={`Net federal tax ${fmtMoney(accepted.federal.tax)}, payments ${fmtMoney(-accepted.federal.payments)} · California tax ${fmtMoney(accepted.california.tax)}, payments ${fmtMoney(-accepted.california.payments)}`}
        >
          <Card>
            <table className="datatable">
              <thead><tr><th>Item</th><th>Moves</th><th className="num">Federal</th><th className="num">California</th></tr></thead>
              <tbody>
                {accepted.items.map(({ event, federal, california, kind }) => (
                  <tr key={event.id}>
                    <td>{event.target.label ?? event.target.id}</td>
                    <td className="muted">{kind === "payments" ? "Payments" : "Total tax"}</td>
                    <td className="num">{fmtMoney(federal)}</td>
                    <td className="num">{fmtMoney(california)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Section>
      )}

      <Section title="Area status" subtitle="Click through to each area's trace drawer-backed detail.">
        <div className="rs-area-grid">
          {areas.map(([key, hours]) => {
            const areaChecks = checks.filter((c) => c.area === key);
            const failed = areaChecks.filter((c) => c.status === "fail").length;
            return (
              <Card key={key} className="rs-area-card" onClick={() => navigate(`/area/${key}`)}>
                <h4>{key.replace(/_/g, " ")}</h4>
                <div className="rs-area-card__row">
                  <span className="muted">Budget {hours}h</span>
                  {failed > 0 ? <StatusBadge status="open">{failed} open</StatusBadge> : <StatusBadge status="verified">clear</StatusBadge>}
                </div>
              </Card>
            );
          })}
        </div>
      </Section>
    </>
  );
}
