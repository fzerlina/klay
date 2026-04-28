import { createContext, useContext, useState } from "react";
import { VENDORS } from "../data/seed/vendors";
import { CUSTOMERS } from "../data/seed/customers";
import { BILLS } from "../data/seed/bills";
import { INVOICES } from "../data/seed/invoices";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [vendors, setVendors] = useState(VENDORS);
  const [customers, setCustomers] = useState(CUSTOMERS);
  const [bills, setBills] = useState(BILLS);
  const [invoices, setInvoices] = useState(INVOICES);

  return (
    <AppContext.Provider value={{ vendors, setVendors, customers, setCustomers, bills, setBills, invoices, setInvoices }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
