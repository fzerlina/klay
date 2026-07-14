import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { VENDORS as SEED_VENDORS } from "../data/seed/vendors";
import { seedTierFor, seedTierNoteFor } from "../data/seed/vendorTiers";
import { seedStatusFor, seedHealthFor } from "../data/seed/vendorHealth";
import { TODAY } from "../lib/clock";

const VendorsContext = createContext(null);

// Layer vendor-master attributes that live outside the auto-generated seed
// (relationship tier, lifecycle status, health signal) onto each record so the
// vendor stays the single source of truth.
function withDerived(v) {
  return {
    ...v,
    status: seedStatusFor(v.id, v.status),
    health: v.health || seedHealthFor(v.id),
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
  const [vendors, setVendors] = useState(() => SEED_VENDORS.map(withDerived));

  const addVendor = useCallback((draft) => {
    const id = nextId(vendors);
    const code = draft.code?.trim() || nextCode(vendors);
    const record = {
      id,
      code,
      name: draft.name,
      legal_name: draft.legal_name || "",
      initials: draft.initials || "",
      contact: draft.contact || "",
      contact_role: draft.contact_role || "",
      phone: draft.phone || "",
      email: draft.email || "",
      address: draft.address || "",
      tax_id: draft.tax_id || "",
      payment_terms: draft.payment_terms || "NET 30",
      currency: draft.currency || "IDR",
      pkp: draft.pkp || "UNKNOWN",
      pph: draft.pph || "none",
      category: draft.category || "expense",
      type: draft.type || "company",
      // Manual creation (Flow B) always lands as DRAFT_PENDING — a Finance
      // Manager confirms tax + bank and activates it (SoD: creator ≠ activator).
      status: "pending",
      health: "healthy",
      source: draft.source || "MANUAL",
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

  // In-session change log — vendorId → [{ts, actor, action, detail}], newest
  // first. Stands in for the PRD's append-only vendor_change_log.
  const [changeLog, setChangeLog] = useState({});
  const logEvent = useCallback((id, action, detail, actor) => {
    setChangeLog((prev) => ({
      ...prev,
      [id]: [{ ts: TODAY.toISOString(), actor: actor || "—", action, detail: detail || "" }, ...(prev[id] || [])],
    }));
  }, []);

  // Move a vendor through its lifecycle: pending → active (approve), active →
  // inactive (deactivate) or blocked (block), blocked/inactive → active.
  const setVendorStatus = useCallback((id, status, meta = {}) => {
    setVendors((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)));
    logEvent(id, meta.event || "Status change", `→ ${status}${meta.reason ? ` · ${meta.reason}` : ""}`, meta.actor);
  }, [logEvent]);

  // Manually set/override a vendor's health signal (healthy | review | flagged).
  const setVendorHealth = useCallback((id, health, meta = {}) => {
    setVendors((prev) => prev.map((v) => (v.id === id ? { ...v, health } : v)));
    logEvent(id, "Health set", `→ ${health}${meta.reason ? ` · ${meta.reason}` : ""}`, meta.actor);
  }, [logEvent]);

  // Add a bank account (Tier 3 — vendor.manage_bank). New account becomes the
  // default when it's the first, or when explicitly flagged default.
  const addVendorBank = useCallback((id, bank, meta = {}) => {
    setVendors((prev) => prev.map((v) => {
      if (v.id !== id) return v;
      const existing = v.banks || [];
      const makeDefault = existing.length === 0 || bank.isDefault;
      const cleaned = makeDefault ? existing.map((b) => ({ ...b, isDefault: false })) : existing;
      return { ...v, banks: [...cleaned, { ...bank, isDefault: makeDefault }] };
    }));
    const last4 = (bank.acc || "").replace(/\D/g, "").slice(-4);
    logEvent(id, "Bank account added", `${bank.name}${last4 ? ` ••••${last4}` : ""}`, meta.actor);
  }, [logEvent]);

  const vendorById = useCallback((id) => vendors.find((v) => v.id === id) || null, [vendors]);
  const tierOf = useCallback((id) => vendors.find((v) => v.id === id)?.relationship_tier || "standard", [vendors]);

  const value = useMemo(
    () => ({ vendors, addVendor, setVendorTier, setVendorStatus, setVendorHealth, addVendorBank, changeLog, vendorById, tierOf }),
    [vendors, addVendor, setVendorTier, setVendorStatus, setVendorHealth, addVendorBank, changeLog, vendorById, tierOf],
  );
  return <VendorsContext.Provider value={value}>{children}</VendorsContext.Provider>;
}

export function useVendors() {
  const ctx = useContext(VendorsContext);
  if (!ctx) throw new Error("useVendors must be used inside <VendorsProvider>");
  return ctx;
}
