import { createContext, useContext, useState } from "react";
import { VENDORS_DATA, CUSTOMERS_DATA, BILLS_DATA, INVOICES_DATA } from "../data/moduleData";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [vendors, setVendors] = useState(VENDORS_DATA);
  const [customers, setCustomers] = useState(CUSTOMERS_DATA);
  const [bills, setBills] = useState(BILLS_DATA);
  const [invoices, setInvoices] = useState(INVOICES_DATA);

  return (
    <AppContext.Provider value={{ vendors, setVendors, customers, setCustomers, bills, setBills, invoices, setInvoices }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
