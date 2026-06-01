// AP close declaration state — the canonical lock-through period for AP.
// Cascades to: Bills List (period-locked badge + filter chip), Bill Detail
// (Post button disabled + Reassign affordance), Sidebar (Close period label).
//
// PRD: ap_close_declarations is the event log; fiscal_periods.is_locked is the
// canonical lock state per Subledger Memo Rule 7. In this prototype, the
// context holds the equivalent of fiscal_periods.is_locked — a single
// "closedThrough" YYYY-MM string. Periods ≤ closedThrough are locked.
//
// On Declare Close: closedThrough advances to the just-closed period.
// On Reopen: closedThrough rolls back one month. Reason captured in history.

import { createContext, useContext, useMemo, useState } from "react";
import { AP_CLOSED_THROUGH } from "../lib/billStatus";
import { CLOSE_HISTORY } from "../data/seed/accrualCandidates";

const ClosePeriodContext = createContext(null);

function nextMonth(yyyymm) {
  const [y, m] = yyyymm.split("-").map((n) => parseInt(n, 10));
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function prevMonth(yyyymm) {
  const [y, m] = yyyymm.split("-").map((n) => parseInt(n, 10));
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function ClosePeriodProvider({ children }) {
  // Baseline from billStatus.js (Jan + Feb 2025 already closed). Subsequent
  // declarations advance the lock-through; reopens roll it back.
  const [closedThrough, setClosedThrough] = useState(AP_CLOSED_THROUGH);
  const [history, setHistory] = useState(() => [...CLOSE_HISTORY]);

  const value = useMemo(() => ({
    closedThrough,
    isLocked: (yyyyMmDd) => {
      if (!yyyyMmDd) return false;
      return yyyyMmDd.slice(0, 7) <= closedThrough;
    },
    declareClose: ({ period, periodLabel, declaredBy = "Sarah Wijaya", declaredByRole = "Finance Manager", gateSnapshot }) => {
      // Advance the lock-through.
      setClosedThrough(period);
      setHistory((prev) => [
        {
          period,
          period_label: periodLabel,
          declared_at: new Date().toISOString(),
          declared_by: declaredBy,
          declared_by_role: declaredByRole,
          days_after_period_end: 0,
          gate_snapshot: gateSnapshot,
        },
        ...prev,
      ]);
    },
    reopen: ({ period, reason, reasonNote, reopenedBy = "Sarah Wijaya" }) => {
      // Roll back to one month before the reopened period.
      setClosedThrough(prevMonth(period));
      setHistory((prev) => prev.map((h) =>
        h.period === period
          ? { ...h, reopened_at: new Date().toISOString(), reopen_reason: reason, reopen_reason_note: reasonNote, reopened_by: reopenedBy }
          : h,
      ));
    },
    history,
    // Helper for callers that need to know the next closable period.
    nextOpenPeriod: nextMonth(closedThrough),
  }), [closedThrough, history]);

  return <ClosePeriodContext.Provider value={value}>{children}</ClosePeriodContext.Provider>;
}

export function useClosePeriod() {
  const ctx = useContext(ClosePeriodContext);
  if (!ctx) {
    // Tolerate consumers that may render outside the provider during HMR or
    // tests — return a static fallback derived from the baseline.
    return {
      closedThrough: AP_CLOSED_THROUGH,
      isLocked: (yyyyMmDd) => yyyyMmDd && yyyyMmDd.slice(0, 7) <= AP_CLOSED_THROUGH,
      declareClose: () => {},
      reopen: () => {},
      history: CLOSE_HISTORY,
      nextOpenPeriod: nextMonth(AP_CLOSED_THROUGH),
    };
  }
  return ctx;
}
