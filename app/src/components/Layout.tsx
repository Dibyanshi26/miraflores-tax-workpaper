import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ACTORS } from "../types/domain";
import { useStore, roleLabel } from "../store/useStore";
import { fmtDate } from "../data/index";
import { pctForDate, dateForPct } from "../lib/timelineScale";
import { NAV_GROUPS } from "./nav";
import { CommandPalette } from "./CommandPalette";
import { TraceDrawer } from "./TraceDrawer";
import "./Layout.css";

export function Layout() {
  const { currentActor, setActor, asOf, setAsOf, packet, loadDemoWorkedFile, exportEventLog, importEventLog, resetEventLog, events } = useStore();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const visibleGroups = useMemo(
    () => NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.hideFor?.includes(currentActor.role)) })).filter((g) => g.items.length),
    [currentActor.role]
  );

  const clientName = packet?.household.people.find((p) => p.role === "taxpayer" || p.role === "primary_taxpayer")?.name ?? "Okafor-Lindqvist";

  function handleExport() {
    const json = exportEventLog();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workpaper-events-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      await importEventLog(text);
    };
    input.click();
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__mark">MF</span>
          <div className="topbar__title">
            <strong>Miraflores Workpaper</strong>
            <span>{clientName} · 2025</span>
          </div>
        </div>

        <button className="cmdk-trigger" onClick={() => setPaletteOpen(true)}>
          <span>Search anything</span>
          <kbd>⌘K</kbd>
        </button>

        <div className="topbar__clock">
          <label>
            As of
            <input
              type="range"
              data-testid="asof-slider"
              min={0}
              max={100}
              step={0.2}
              value={pctForDate(asOf)}
              onChange={(e) => setAsOf(dateForPct(Number(e.target.value)))}
            />
          </label>
          <span className="topbar__clock-date">{fmtDate(asOf)}</span>
        </div>

        <div className="topbar__actions">
          <button onClick={() => void loadDemoWorkedFile()} title="Seed a demo season's worth of events">Load demo worked file</button>
          <button onClick={handleExport} title="Export the event log as JSON">Export</button>
          <button onClick={handleImportClick} title="Import an event log JSON file">Import</button>
          <button
            className="danger"
            title="Clear all recorded events (packet data is untouched)"
            onClick={() => {
              if (events.length === 0 || confirm(`Clear all ${events.length} recorded events? This cannot be undone.`)) void resetEventLog();
            }}
          >
            Reset
          </button>
        </div>

        <select
          className="role-switcher"
          value={currentActor.staffOrClientId}
          onChange={(e) => {
            const a = ACTORS.find((x) => x.staffOrClientId === e.target.value);
            if (a) {
              setActor(a);
              navigate("/");
            }
          }}
        >
          {ACTORS.map((a) => (
            <option key={a.staffOrClientId} value={a.staffOrClientId}>
              {a.name} — {roleLabel(a.role)}
            </option>
          ))}
        </select>
      </header>

      <div className="layout__body">
        <nav className="sidenav">
          {visibleGroups.map((g) => (
            <div key={g.title} className="sidenav__group">
              <div className="sidenav__group-title">{g.title}</div>
              {g.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) => `sidenav__item${isActive ? " sidenav__item--active" : ""}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <main className="content">
          <Outlet />
        </main>
      </div>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      <TraceDrawer />
    </div>
  );
}
