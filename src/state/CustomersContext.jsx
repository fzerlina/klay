import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { CUSTOMERS as SEED_CUSTOMERS } from "../data/seed/customers";

const CustomersContext = createContext(null);

function nextId(list) {
  const nums = list
    .map((c) => parseInt(String(c.id).replace(/[^0-9]/g, ""), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return "C" + String(max + 1).padStart(3, "0");
}

function nextCode(list) {
  const nums = list
    .map((c) => parseInt(String(c.code || "").replace(/[^0-9]/g, ""), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return "C-" + String(max + 1).padStart(3, "0");
}

export function CustomersProvider({ children }) {
  const [customers, setCustomers] = useState(() => SEED_CUSTOMERS);

  const addCustomer = useCallback((draft) => {
    const id = nextId(customers);
    const code = draft.code?.trim() || nextCode(customers);
    const record = {
      id,
      code,
      type: draft.type,
      name: draft.name,
      legalName: draft.legalName || "",
      npwp: draft.npwp || "",
      top: draft.top || "NET 30",
      creditLimit: draft.creditLimit || 0,
      currency: draft.currency || "IDR",
      contacts: draft.contacts || [],
      address: draft.address || "",
      invMode: draft.invMode || "manual",
      invCh: draft.invCh || [],
      invSch: draft.invSch || "",
      reminder: draft.reminder || "",
      notes: draft.notes || "",
      ar: 0,
      arOverdue: false,
      lastInv: null,
      totalInv: 0,
      active: true,
    };
    setCustomers((prev) => [record, ...prev]);
    return record;
  }, [customers]);

  const value = useMemo(() => ({ customers, addCustomer }), [customers, addCustomer]);
  return <CustomersContext.Provider value={value}>{children}</CustomersContext.Provider>;
}

export function useCustomers() {
  const ctx = useContext(CustomersContext);
  if (!ctx) throw new Error("useCustomers must be used inside <CustomersProvider>");
  return ctx;
}
