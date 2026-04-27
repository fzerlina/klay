import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./layout/Layout";
import { AppProvider } from "./context/AppContext";
import BillsPage from "./pages/BillsPage";
import InvoicesPage from "./pages/InvoicesPage";
import VendorsPage from "./pages/VendorsPage";
import CustomersPage from "./pages/CustomersPage";

function PrototypePage({ title, src }) {
  return (
    <iframe
      title={title}
      src={src}
      style={{ flex: 1, width: "100%", minHeight: 0, border: 0, display: "block" }}
    />
  );
}

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/journal-entry" replace />} />
          <Route path="/general-ledger" element={<PrototypePage title="Klay General Ledger" src="/prototype/general-ledger.html" />} />
          <Route path="/journal-entry" element={<PrototypePage title="Klay Journal Entry" src="/prototype/journal-entry.html" />} />
          <Route path="/chart-of-accounts" element={<PrototypePage title="Klay Chart of Accounts" src="/prototype/chart-of-accounts.html" />} />
          <Route path="/dimensions" element={<PrototypePage title="Klay Dimensions" src="/prototype/dimensions.html" />} />
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
