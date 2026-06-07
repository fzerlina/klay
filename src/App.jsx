import { Navigate, Route, Routes } from "react-router-dom";
import Layout, { NoAccess } from "./layout/Layout";
import { CurrentUserProvider, useCurrentUser } from "./state/CurrentUserContext";
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
import UsersPage from "./pages/UsersPage";
import AccessPolicyPage from "./pages/AccessPolicyPage";
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

// Sends the current persona to the first page their role can reach.
function RoleLanding() {
  const { landingPath } = useCurrentUser();
  return <Navigate to={landingPath} replace />;
}

// Route guard for actions that need more than view access (e.g. creating a
// bill needs transact on AP). View-level personas can reach the list but get
// a permission panel if they deep-link into a create page.
function RequireLevel({ module, level, action, children }) {
  const { hasLevel, user } = useCurrentUser();
  if (hasLevel(module, level)) return children;
  return (
    <NoAccess
      moduleKey={module}
      title="No permission for this action"
      body={
        <>
          You're viewing as <strong>{user.name}</strong>, whose role can't {action}.
          Switch persona from the profile menu to continue.
        </>
      }
    />
  );
}

export default function App() {
  return (
    <CurrentUserProvider>
    <InvoicesProvider>
      <BillsProvider>
        <VendorsProvider>
          <CustomersProvider>
            <JournalEntriesProvider>
            <ClosePeriodProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<RoleLanding />} />
                <Route path="/general-ledger" element={<GeneralLedgerPage />} />
                <Route path="/journal-entry" element={<JournalEntryPage />} />
                <Route path="/chart-of-accounts" element={<ChartOfAccountsPage />} />
                <Route path="/dimensions" element={<DimensionsPage />} />
                <Route path="/bills" element={<BillsPage />} />
                <Route path="/bills/new" element={<RequireLevel module="ap" level="transact" action="create bills"><BillCreatePage /></RequireLevel>} />
                <Route path="/bills/:id" element={<BillDetailPage />} />
                <Route path="/ap-aging" element={<ApAgingPage />} />
                <Route path="/invoices" element={<InvoicesPage />} />
                <Route path="/invoices/new" element={<InvoiceCreatePage />} />
                <Route path="/vendors" element={<VendorsPage />} />
                <Route path="/vendors/new" element={<RequireLevel module="ap" level="transact" action="add vendors"><VendorCreatePage /></RequireLevel>} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/customers/new" element={<CustomerCreatePage />} />
                <Route path="/trial-balance" element={<TrialBalancePage />} />
                <Route path="/close" element={<CloseManagementPage />} />
                <Route path="/bank-reconciliation" element={<BankReconciliationPage />} />
                <Route path="/bank-accounts" element={<BankAccountsSettingsPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/access-policy" element={<AccessPolicyPage />} />
                <Route path="*" element={<RoleLanding />} />
              </Route>
            </Routes>
            </ClosePeriodProvider>
            </JournalEntriesProvider>
          </CustomersProvider>
        </VendorsProvider>
      </BillsProvider>
    </InvoicesProvider>
    </CurrentUserProvider>
  );
}
