// Payment-status state — the second status axis, distinct from the journal/
// posting status (Draft→…→Posted). Payment status only applies once a bill is
// POSTED and tracks the payment lifecycle:
//
//   unpaid → requested (AP Staff) → approved (Finance Manager) → paid (Finance
//   Staff, executed off-system) → [reconciled — stubbed for now]
//
// Per the 2026-07-11 MoM: request off AP Aging → FM approval → bank owner pays.
// Prototype: local state, no backend. Reconciliation (bank-statement upload /
// auto-match) is a later pass; "paid" is the terminal state here.

import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { BILLS } from "../data/seed/bills";
import { TODAY } from "../lib/clock";

const PaymentsContext = createContext(null);

const TODAY_ISO = TODAY.toISOString().slice(0, 10);

// A posted, unpaid bill is payable. Seed a realistic spread across the lifecycle
// so every persona's Decision Queue has something to act on out of the box:
// a couple already approved (Finance Staff executes), several requested (FM
// approves), the rest unpaid (AP Staff requests).
function seedPayments() {
  const payable = BILLS
    .filter((b) => b.je_number && b.pay !== "paid")
    .map((b) => b.id)
    .sort();
  const m = {};
  payable.forEach((id, i) => {
    if (i < 3) {
      m[id] = { status: "approved", requestedBy: "Budi Santoso", requestedAt: TODAY_ISO, approvedBy: "Sari Dewanti", approvedAt: TODAY_ISO };
    } else if (i < 11) {
      m[id] = { status: "requested", requestedBy: "Budi Santoso", requestedAt: TODAY_ISO };
    }
    // rest: unpaid (absent from the map)
  });
  return m;
}

export function PaymentsProvider({ children }) {
  const [payments, setPayments] = useState(seedPayments);

  const requestPayment = useCallback((ids, by) => {
    setPayments((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = { status: "requested", requestedBy: by, requestedAt: TODAY_ISO };
      return next;
    });
  }, []);

  const approvePayment = useCallback((ids, by) => {
    setPayments((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        if (next[id]?.status === "requested") next[id] = { ...next[id], status: "approved", approvedBy: by, approvedAt: TODAY_ISO };
      }
      return next;
    });
  }, []);

  const markPaid = useCallback((ids, by) => {
    setPayments((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        if (next[id]?.status === "approved") next[id] = { ...next[id], status: "paid", paidBy: by, paidAt: TODAY_ISO };
      }
      return next;
    });
  }, []);

  // Send a requested payment back to AP (e.g. FM rejects) — clears the request.
  const returnPayment = useCallback((ids) => {
    setPayments((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    payments,
    statusOf: (id) => payments[id]?.status || "unpaid",
    detailOf: (id) => payments[id] || null,
    requestPayment,
    approvePayment,
    markPaid,
    returnPayment,
  }), [payments, requestPayment, approvePayment, markPaid, returnPayment]);

  return <PaymentsContext.Provider value={value}>{children}</PaymentsContext.Provider>;
}

export function usePayments() {
  const ctx = useContext(PaymentsContext);
  if (!ctx) {
    // Tolerate consumers rendered outside the provider (HMR/tests).
    return { payments: {}, statusOf: () => "unpaid", detailOf: () => null, requestPayment: () => {}, approvePayment: () => {}, markPaid: () => {}, returnPayment: () => {} };
  }
  return ctx;
}

// Display metadata for a payment status.
export const PAYMENT_STATUS_META = {
  unpaid:    { label: "Unpaid",    tone: "muted" },
  requested: { label: "Requested", tone: "review" },
  approved:  { label: "Approved",  tone: "action" },
  paid:      { label: "Paid",      tone: "success" },
  reconciled:{ label: "Reconciled", tone: "success" },
};
