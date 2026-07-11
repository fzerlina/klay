import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { VENDORS as SEED_VENDORS } from "../data/seed/vendors";
import { seedTierFor, seedTierNoteFor } from "../data/seed/vendorTiers";

const VendorsContext = createContext(null);

// Layer the vendor-master relationship tier onto each seed record so it lives
// on the vendor (single source of truth), not in AP Aging.
function withTier(v) {
  return {
    ...v,
    relationship_tier: v.relationship_tier || seedTierFor(v.id),
    relationship_tier_note: v.relationship_tier_note || seedTierNoteFor(v.id),
    relationship_tier_set_by: v.relationship_tier_set_by || null,
    relationship_tier_set_at: v.relationship_tier_set_at || null,
  };
}

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
  const [vendors, setVendors] = useState(() => SEED_VENDORS.map(withTier));

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
      relationship_tier: draft.relationship_tier || "standard",
      relationship_tier_note: draft.relationship_tier_note || "",
      relationship_tier_set_by: null,
      relationship_tier_set_at: null,
    };
    setVendors((prev) => [record, ...prev]);
    return record;
  }, [vendors]);

  // Set a vendor's relationship tier (PRD TP-02) — writes to the vendor record
  // so every surface that reads the vendor reflects it. Note is required.
  const setVendorTier = useCallback((id, tier, note, byName) => {
    setVendors((prev) => prev.map((v) => (
      v.id === id
        ? { ...v, relationship_tier: tier, relationship_tier_note: (note || "").slice(0, 200), relationship_tier_set_by: byName || null, relationship_tier_set_at: new Date().toISOString() }
        : v
    )));
  }, []);

  const vendorById = useCallback((id) => vendors.find((v) => v.id === id) || null, [vendors]);
  const tierOf = useCallback((id) => vendors.find((v) => v.id === id)?.relationship_tier || "standard", [vendors]);

  const value = useMemo(() => ({ vendors, addVendor, setVendorTier, vendorById, tierOf }), [vendors, addVendor, setVendorTier, vendorById, tierOf]);
  return <VendorsContext.Provider value={value}>{children}</VendorsContext.Provider>;
}

export function useVendors() {
  const ctx = useContext(VendorsContext);
  if (!ctx) throw new Error("useVendors must be used inside <VendorsProvider>");
  return ctx;
}
