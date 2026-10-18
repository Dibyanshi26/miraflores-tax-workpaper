import { useStore } from "../store/useStore";
import { PageHeader, Section, Card } from "../components/Section";
import { fmtMoney, fmtDate } from "../data/index";
import "./Carryforward.css";

function dictRows(d: Record<string, unknown>) {
  return Object.entries(d).filter(([, v]) => typeof v === "number" || typeof v === "string");
}

export function Carryforward() {
  const { index } = useStore();
  if (!index) return null;
  const co = index.latestVersion.carryovers_out;
  const planning = index.packet.planning_reference_2026 as {
    federal_estimate_due_dates: string[]; federal_safe_harbor: string;
    california_estimate_due_dates: string[]; california_installment_percentages: number[]; california_safe_harbor: string;
    known_2026_changes_for_this_household: string[];
  };
  const basisRecords = index.packet.prior_years.basis_records;

  return (
    <>
      <PageHeader title="Carryforward / 2026 plan" subtitle="What carries forward, basis by year, and next year's safe-harbor estimates." />

      <Section title="Federal carryovers to 2026">
        <Card>
          <table className="datatable">
            <thead><tr><th>Item</th><th className="num">Amount</th></tr></thead>
            <tbody>{dictRows(co.federal).map(([k, v]) => <tr key={k}><td>{k.replace(/_/g, " ")}</td><td className="num">{typeof v === "number" ? fmtMoney(v) : String(v)}</td></tr>)}</tbody>
          </table>
        </Card>
      </Section>

      <Section title="California carryovers to 2026">
        <Card>
          <table className="datatable">
            <thead><tr><th>Item</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {dictRows(co.california).filter(([k]) => k !== "depreciation_basis_differences").map(([k, v]) => <tr key={k}><td>{k.replace(/_/g, " ")}</td><td className="num">{typeof v === "number" ? fmtMoney(v) : String(v)}</td></tr>)}
            </tbody>
          </table>
          <h4 className="cf-subhead">Depreciation basis differences (federal vs. California)</h4>
          <table className="datatable">
            <thead><tr><th>Asset</th><th className="num">Difference</th></tr></thead>
            <tbody>
              {Object.entries((co.california as { depreciation_basis_differences?: Record<string, number> }).depreciation_basis_differences ?? {}).map(([k, v]) => (
                <tr key={k}><td className="mono">{k}</td><td className="num">{fmtMoney(v)}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section title="Basis by year" subtitle="From prior_years.basis_records - gaps are real gaps.">
        <div className="cf-basis-grid">
          {Object.entries(basisRecords).map(([key, records]) => (
            <Card key={key}>
              <h4>{key.replace(/_/g, " ")}</h4>
              <table className="datatable">
                <tbody>
                  {records.map((r, i) => (
                    <tr key={i}>
                      <td>{"year" in r ? String(r.year) : "event" in r ? String(r.event) : i}</td>
                      <td className="num">{JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => k !== "year" && k !== "source" && k !== "event")))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="2026 safe-harbor plan">
        <div className="cf-basis-grid">
          <Card>
            <h4>Federal</h4>
            <p className="cf-rule">{planning.federal_safe_harbor}</p>
            <div className="cf-dates">{planning.federal_estimate_due_dates.map((d) => <span key={d}>{fmtDate(d)}</span>)}</div>
          </Card>
          <Card>
            <h4>California</h4>
            <p className="cf-rule">{planning.california_safe_harbor}</p>
            <div className="cf-dates">{planning.california_estimate_due_dates.map((d, i) => <span key={d}>{fmtDate(d)} ({Math.round((planning.california_installment_percentages[i] ?? 0) * 100)}%)</span>)}</div>
          </Card>
        </div>
      </Section>

      <Section title="Known 2026 changes for this household">
        <Card>
          <ul className="cf-changes">{planning.known_2026_changes_for_this_household.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </Card>
      </Section>
    </>
  );
}
