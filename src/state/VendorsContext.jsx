import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { VENDORS as SEED_VENDORS } from "../data/seed/vendors";

const VendorsContext = createContext(null);

function nextId(list) {
  const nums = list
    .map((v) => parseInt(String(v.id).replace(/[^0-9]/g, ""), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return "V" + String(max + 1).padStart(3, "0");
}

function nextCode(list) {
  const nums = list
    .map((v) => parseInt(String(v.code || "").replace(/[^0-9]/g, ""), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return "V-" + String(max + 1).padStart(3, "0");
}

export function VendorsProvider({ children }) {
  const [vendors, setVendors] = useState(() => SEED_VENDORS);

  const addVendor = useCallback((draft) => {
    const id = nextId(vendors);
    const code = draft.code?.trim() || nextCode(vendors);
    const record = {
      id,
      code,
      name: draft.name,
      initials: draft.initials || "",
      contact: draft.contact || "",
      phone: draft.phone || "",
      email: draft.email || "",
      address: draft.address || "",
      tax_id: draft.tax_id || "",
      payment_terms: draft.payment_terms || "NET 30",
      pkp: draft.pkp || "PKP",
      pph: draft.pph || "none",
      category: draft.category || "expense",
      type: draft.type || "company",
      status: "active",
      lastTx: null,
      notes: draft.notes || "",
      acct: draft.acct || "",
      defTax: draft.defTax || "",
      banks: draft.banks || [],
    };
    setVendors((prev) => [record, ...prev]);
    return record;
  }, [vendors]);

  const value = useMemo(() => ({ vendors, addVendor }), [vendors, addVendor]);
  return <VendorsContext.Provider value={value}>{children}</VendorsContext.Provider>;
}

export function useVendors() {
  const ctx = useContext(VendorsContext);
  if (!ctx) throw new Error("useVendors must be used inside <VendorsProvider>");
  return ctx;
}
