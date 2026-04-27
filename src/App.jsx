import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./layout/Layout";
import { AppProvider } from "./context/AppContext";
import JournalEntryPage from "./pages/JournalEntryPage";
import ChartOfAccountsPage from "./pages/ChartOfAccountsPage";
import DimensionsPage from "./pages/DimensionsPage";
import BillsPage from "./pages/BillsPage";
import InvoicesPage from "./pages/InvoicesPage";
import VendorsPage from "./pages/VendorsPage";
import CustomersPage from "./pages/CustomersPage";

function ComingSoon({ title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "#999", fontSize: 15 }}>
      {title} — coming soon
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/journal-entry" replace />} />
          <Route path="/general-ledger" element={<ComingSoon title="General Ledger" />} />
          <Route path="/journal-entry" element={<JournalEntryPage />} />
          <Route path="/chart-of-accounts" element={<ChartOfAccountsPage />} />
          <Route path="/dimensions" element={<DimensionsPage />} />
          <Route path="/bills" element={<BillsPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/vendors" element={<VendorsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="*" element={<Navigate to="/journal-entry" replace />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}
