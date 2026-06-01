import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./layout/Layout";
import JournalEntryPage from "./pages/JournalEntryPage";
import ChartOfAccountsPage from "./pages/ChartOfAccountsPage";
import DimensionsPage from "./pages/DimensionsPage";
import BillsPage from "./pages/BillsPage";
import BillCreatePage from "./pages/BillCreatePage";
import BillDetailPage from "./pages/BillDetailPage";
import ApAgingPage from "./pages/ApAgingPage";
import InvoicesPage from "./pages/InvoicesPage";
import InvoiceCreatePage from "./pages/InvoiceCreatePage";
import VendorsPage from "./pages/VendorsPage";
import VendorCreatePage from "./pages/VendorCreatePage";
import CustomersPage from "./pages/CustomersPage";
import CustomerCreatePage from "./pages/CustomerCreatePage";
import GeneralLedgerPage from "./pages/GeneralLedgerPage";
import TrialBalancePage from "./pages/TrialBalancePage";
import CloseManagementPage from "./pages/CloseManagementPage";
import BankReconciliationPage from "./pages/BankReconciliationPage";
import BankAccountsSettingsPage from "./pages/BankAccountsSettingsPage";
import { InvoicesProvider } from "./state/InvoicesContext";
import { BillsProvider } from "./state/BillsContext";
import { VendorsProvider } from "./state/VendorsContext";
import { CustomersProvider } from "./state/CustomersContext";
import { JournalEntriesProvider } from "./state/JournalEntriesContext";
import { ClosePeriodProvider } from "./state/ClosePeriodContext";

function ComingSoon({ title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "#999", fontSize: 15 }}>
      {title} — coming soon
    </div>
  );
}

export default function App() {
  return (
    <InvoicesProvider>
      <BillsProvider>
        <VendorsProvider>
          <CustomersProvider>
            <JournalEntriesProvider>
            <ClosePeriodProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/journal-entry" replace />} />
                <Route path="/general-ledger" element={<GeneralLedgerPage />} />
                <Route path="/journal-entry" element={<JournalEntryPage />} />
                <Route path="/chart-of-accounts" element={<ChartOfAccountsPage />} />
                <Route path="/dimensions" element={<DimensionsPage />} />
                <Route path="/bills" element={<BillsPage />} />
                <Route path="/bills/new" element={<BillCreatePage />} />
                <Route path="/bills/:id" element={<BillDetailPage />} />
                <Route path="/ap-aging" element={<ApAgingPage />} />
                <Route path="/invoices" element={<InvoicesPage />} />
                <Route path="/invoices/new" element={<InvoiceCreatePage />} />
                <Route path="/vendors" element={<VendorsPage />} />
                <Route path="/vendors/new" element={<VendorCreatePage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/customers/new" element={<CustomerCreatePage />} />
                <Route path="/trial-balance" element={<TrialBalancePage />} />
                <Route path="/close" element={<CloseManagementPage />} />
                <Route path="/bank-reconciliation" element={<BankReconciliationPage />} />
                <Route path="/bank-accounts" element={<BankAccountsSettingsPage />} />
                <Route path="*" element={<Navigate to="/journal-entry" replace />} />
              </Route>
            </Routes>
            </ClosePeriodProvider>
            </JournalEntriesProvider>
          </CustomersProvider>
        </VendorsProvider>
      </BillsProvider>
    </InvoicesProvider>
  );
}
