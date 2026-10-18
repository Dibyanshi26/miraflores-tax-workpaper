import { useMemo } from "react";
import { useStore } from "../store/useStore";
import { PageHeader, Section, Card } from "../components/Section";
import { StatusBadge } from "../components/StatusBadge";
import { useUiStore } from "../store/uiStore";
import { fmtMoney } from "../data/index";
import { runIndependentChecks } from "../data/checks/run";
import "./BooksToTax.css";

interface BridgeRow { label: string; lineKey: string; checkCode?: string }

const EXPENSE_ROWS: BridgeRow[] = [
  { label: "Advertising", lineKey: "SchC.8" },
  { label: "Car and truck (mileage)", lineKey: "SchC.9", checkCode: "MILEAGE-DUPLICATE-PAGE" },
  { label: "Contract labor", lineKey: "SchC.11" },
  { label: "Depreciation and §179", lineKey: "SchC.13" },
  { label: "Insurance", lineKey: "SchC.15" },
  { label: "Legal and professional", lineKey: "SchC.17" },
  { label: "Office expense", lineKey: "SchC.18" },
  { label: "Supplies", lineKey: "SchC.22" },
  { label: "Travel", lineKey: "SchC.24a" },
  { label: "Meals (50%)", lineKey: "SchC.24b" },
  { label: "Utilities (phone/internet)", lineKey: "SchC.25", checkCode: "PERSONAL-USE-SPLIT" },
  { label: "Software and subscriptions", lineKey: "SchC.27a.1", checkCode: "PERSONAL-USE-SPLIT" },
  { label: "Bank and merchant fees", lineKey: "SchC.27a.2" },
  { label: "Home office (simplified)", lineKey: "SchC.30" },
];

export function BooksToTax() {
  const { index } = useStore();
  const checks = useMemo(() => (index ? runIndependentChecks(index) : []), [index]);
  const checkByCode = new Map(checks.map((c) => [c.code, c]));

  if (!index) return null;
  const line = (k: string) => index.latestVersion.lines.find((l) => l.key === k);
  const grossReceipts = line("SchC.1");
  const totalExpenses = line("SchC.28");
  const netProfit = line("SchC.31");
  const schcCheck = checkByCode.get("SCHC-1099K-DOUBLE");

  return (
    <>
      <PageHeader title="Books → tax" subtitle="Lindqvist Studio: business books taken to Schedule C taxable income." />

      <Section title="Revenue">
        <Card>
          <table className="datatable">
            <thead><tr><th>Source</th><th className="num">Amount</th><th>Note</th></tr></thead>
            <tbody>
              <tr><td>1099-NEC payers (books)</td><td className="num">{fmtMoney(142000)}</td><td className="muted">Atlas Outdoor Gear + other 1099-NEC clients</td></tr>
              <tr><td>Non-1099 clients (books)</td><td className="num">{fmtMoney(9300)}</td><td className="muted">Under the $600 reporting threshold</td></tr>
              <tr className="btt-subtotal"><td>Books revenue</td><td className="num">{fmtMoney(151300)}</td><td /></tr>
              <tr>
                <td>1099-K amounts not matched to books</td>
                <td className="num">{fmtMoney(12400)}</td>
                <td>
                  <StatusBadge status="blocking">double-counted</StatusBadge> the Paywell 1099-K <em>is</em> part of the Atlas 1099-NEC total, already in books
                </td>
              </tr>
              <tr className="btt-total clickable" onClick={() => useUiStore.getState().openTrace("SchC.1")}>
                <td>Gross receipts reported (SchC.1)</td>
                <td className="num">{fmtMoney(grossReceipts?.value as number)}</td>
                <td>{schcCheck && <span className="muted">should be {fmtMoney(151300)} - see Checks</span>}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </Section>

      <Section title="Expenses">
        <Card>
          <table className="datatable">
            <thead><tr><th>Category</th><th className="num">Tax (SchC)</th><th>Bridge note</th></tr></thead>
            <tbody>
              {EXPENSE_ROWS.map((r) => {
                const l = line(r.lineKey);
                const check = r.checkCode ? checkByCode.get(r.checkCode) : undefined;
                return (
                  <tr key={r.lineKey} className="clickable" onClick={() => useUiStore.getState().openTrace(r.lineKey)}>
                    <td>{r.label}</td>
                    <td className="num">{typeof l?.value === "number" ? fmtMoney(l.value) : "—"}</td>
                    <td>{check && check.status === "fail" ? <StatusBadge status="open">{check.title}</StatusBadge> : <span className="muted">book = tax</span>}</td>
                  </tr>
                );
              })}
              <tr className="btt-total">
                <td>Total expenses (SchC.28)</td>
                <td className="num">{fmtMoney(totalExpenses?.value as number)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </Card>
      </Section>

      <Section title="Net profit">
        <Card>
          <div className="btt-netprofit">
            <span>Net profit (SchC.31)</span>
            <strong className="num">{fmtMoney(netProfit?.value as number)}</strong>
          </div>
          <p className="muted">Flows to Form 1040 Schedule 1 line 3, Schedule SE, and the QBI deduction (Form 8995).</p>
        </Card>
      </Section>
    </>
  );
}
