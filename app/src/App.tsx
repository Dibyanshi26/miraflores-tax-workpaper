import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useStore } from "./store/useStore";
import { Layout } from "./components/Layout";
import { Home } from "./views/Home";
import { ReturnSummary } from "./views/ReturnSummary";
import { AreaPage } from "./views/AreaPage";
import { Documents } from "./views/Documents";
import { DocumentViewer } from "./views/DocumentViewer";
import { SalesDetail } from "./views/SalesDetail";
import { Depreciation } from "./views/Depreciation";
import { BooksToTax } from "./views/BooksToTax";
import { StateSplit } from "./views/StateSplit";
import { Reconciliations } from "./views/Reconciliations";
import { Checks } from "./views/Checks";
import { Changes } from "./views/Changes";
import { WhatIfs } from "./views/WhatIfs";
import { Review } from "./views/Review";
import { ClientPortal } from "./views/ClientPortal";
import { Filing } from "./views/Filing";
import { Carryforward } from "./views/Carryforward";
import { FirmAdmin } from "./views/FirmAdmin";

function App() {
  const { init, loading, error, packet } = useStore();

  useEffect(() => {
    void init();
  }, [init]);

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", fontFamily: "var(--font-ui)", color: "var(--ink-soft)" }}>
        Loading the packet…
      </div>
    );
  }
  if (error || !packet) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", fontFamily: "var(--font-ui)", color: "var(--status-blocking)" }}>
        Failed to load packet.json: {error}
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/return-summary" element={<ReturnSummary />} />
          <Route path="/area/:areaKey" element={<AreaPage />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/documents/:docId" element={<DocumentViewer />} />
          <Route path="/sales" element={<SalesDetail />} />
          <Route path="/depreciation" element={<Depreciation />} />
          <Route path="/depreciation/:assetId" element={<Depreciation />} />
          <Route path="/books-to-tax" element={<BooksToTax />} />
          <Route path="/state-split" element={<StateSplit />} />
          <Route path="/reconciliations" element={<Reconciliations />} />
          <Route path="/checks" element={<Checks />} />
          <Route path="/changes" element={<Changes />} />
          <Route path="/what-ifs" element={<WhatIfs />} />
          <Route path="/review" element={<Review />} />
          <Route path="/client-portal" element={<ClientPortal />} />
          <Route path="/filing" element={<Filing />} />
          <Route path="/carryforward" element={<Carryforward />} />
          <Route path="/firm-admin" element={<FirmAdmin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
