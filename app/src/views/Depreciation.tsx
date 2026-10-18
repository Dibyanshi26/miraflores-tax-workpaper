import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { PageHeader, Section, Card } from "../components/Section";
import { StatusBadge } from "../components/StatusBadge";
import { EventTimeline } from "../components/EventTimeline";
import { fmtMoney, fmtDate } from "../data/index";
import "./Depreciation.css";

export function Depreciation() {
  const { assetId } = useParams();
  const { index } = useStore();
  const navigate = useNavigate();

  const assets = index?.latestVersion.assets ?? [];
  const selected = assetId ? assets.find((a) => a.asset_id === assetId) : undefined;

  const totals = useMemo(() => {
    return assets.reduce(
      (acc, a) => ({
        federal: acc.federal + a.federal.depreciation_2025,
        california: acc.california + a.california.depreciation_2025,
        amtDiff: acc.amtDiff + a.amt.difference_from_regular,
      }),
      { federal: 0, california: 0, amtDiff: 0 }
    );
  }, [assets]);

  if (!index) return null;

  if (selected) {
    return (
      <>
        <PageHeader title={selected.description} subtitle={selected.activity} actions={<button className="btn btn--sm" onClick={() => navigate("/depreciation")}>← All assets</button>} />
        <Section title="Depreciation detail">
          <div className="dep-detail-grid">
            <Card>
              <h4>Federal</h4>
              <dl>
                <dt>Cost</dt><dd className="num">{fmtMoney(selected.cost)}</dd>
                <dt>Land (not depreciated)</dt><dd className="num">{fmtMoney(selected.land_value_not_depreciated ?? 0)}</dd>
                <dt>Method / life</dt><dd>{selected.method} / {selected.life_years}y</dd>
                <dt>Placed in service</dt><dd>{fmtDate(selected.placed_in_service)}</dd>
                <dt>Prior accumulated</dt><dd className="num">{fmtMoney(selected.federal.prior_accumulated)}</dd>
                <dt>2025 depreciation</dt><dd className="num">{fmtMoney(selected.federal.depreciation_2025)}</dd>
                <dt>Accumulated end</dt><dd className="num">{fmtMoney(selected.federal.accumulated_end)}</dd>
              </dl>
            </Card>
            <Card>
              <h4>California</h4>
              <dl>
                <dt>Prior accumulated</dt><dd className="num">{fmtMoney(selected.california.prior_accumulated)}</dd>
                <dt>2025 depreciation</dt><dd className="num">{fmtMoney(selected.california.depreciation_2025)}</dd>
                <dt>Accumulated end</dt><dd className="num">{fmtMoney(selected.california.accumulated_end)}</dd>
              </dl>
              <h4 style={{ marginTop: 14 }}>AMT</h4>
              <dl>
                <dt>2025 depreciation</dt><dd className="num">{fmtMoney(selected.amt.depreciation_2025)}</dd>
                <dt>Difference from regular</dt><dd className="num">{fmtMoney(selected.amt.difference_from_regular)}</dd>
              </dl>
            </Card>
          </div>
          {selected.disposed && (
            <Card style={{ marginTop: 10 }}>
              <h4>Disposal</h4>
              <pre className="dep-disposed">{JSON.stringify(selected.disposed, null, 2)}</pre>
            </Card>
          )}
        </Section>
        <Section title="Activity">
          <Card><EventTimeline target={{ kind: "asset", id: selected.asset_id, label: selected.description }} /></Card>
        </Section>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Depreciation by asset" subtitle={`${assets.length} assets · federal ${fmtMoney(totals.federal)} · CA ${fmtMoney(totals.california)} 2025 depreciation`} />
      <Card>
        <table className="datatable">
          <thead>
            <tr><th>Asset</th><th>Activity</th><th>Method / life</th><th>Placed in service</th><th className="num">Federal 2025</th><th className="num">CA 2025</th><th className="num">AMT diff</th><th>Status</th></tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.asset_id} className="clickable" onClick={() => navigate(`/depreciation/${a.asset_id}`)}>
                <td>{a.description}</td>
                <td className="muted">{a.activity}</td>
                <td className="muted">{a.method} / {a.life_years}y</td>
                <td className="muted">{fmtDate(a.placed_in_service)}</td>
                <td className="num">{fmtMoney(a.federal.depreciation_2025)}</td>
                <td className="num">{fmtMoney(a.california.depreciation_2025)}</td>
                <td className="num">{a.amt.difference_from_regular !== 0 ? fmtMoney(a.amt.difference_from_regular) : "—"}</td>
                <td>{a.disposed ? <StatusBadge status="info">disposed</StatusBadge> : <StatusBadge status="verified">in service</StatusBadge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
