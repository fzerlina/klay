// Pure helpers shared between BillsPage (list) and BillDetailPage (detail).
// Extracted from BillsPage.jsx so both surfaces use the same workflow state
// machine, period-lock check, source-channel rule, and urgency score.
//
// In production these would map to columns on `ap_invoices` (workflow_status,
// returned_reason, on_hold, hold_reason, exception_reason) plus a per-bill
// review-state object (fields_flagged, days_in_queue, etc) — see the
// Bill Details Page PRD (Coda: KLAY/Bill-Details-Page).

import { daysSince } from "./clock";
import { formatDateEn } from "./format";

// Demo-only overrides — adds states that aren't expressible from the
// two-dimensional (approval × pay) seed: RETURNED, ON_HOLD, EXCEPTION, plus
// a per-bill `opened` review-state for the PENDING_REVIEW cause sentence.
export const DEMO_OVERRIDES = {
  BILL005: { state: "RETURNED", returned: { by: "FM", reason: "PO doesn't match invoice qty — verify with vendor" } },
  BILL022: { state: "RETURNED", returned: { by: "FM", reason: "Needs L2 approval for amount > Rp 100M" } },
  BILL010: { state: "ON_HOLD",  onHold:   { reason: "awaiting credit note", since: "2025-04-15" } },
  BILL011: { state: "ON_HOLD",  onHold:   { reason: "vendor dispute on shipping cost", since: "2025-04-10" } },
  BILL028: { state: "EXCEPTION", exception: { reason: "OCR confidence below threshold — manual review required" } },
  BILL034: { state: "EXCEPTION", exception: { reason: "Duplicate detected — similar to BILL001" } },
  // Tag a couple of PENDING_REVIEW bills as "already opened" so the cause
  // sentence shows that branch (vs "not yet opened · Nd in queue").
  BILL008: { opened: { daysAgo: 2, fieldsFlagged: 3 } },
  BILL012: { opened: { daysAgo: 1, fieldsFlagged: 0 } },
};

export const STATUS_LABEL = {
  DRAFT:          "Draft",
  PENDING_REVIEW: "Pending Review",
  RETURNED:       "Returned",
  ON_HOLD:        "On Hold",
  APPROVED:       "Approved",
  POSTED:         "Posted",
  PAID:           "Paid",
  EXCEPTION:      "Exception",
};

// Period-locking helper — TRUE if a bill's accounting period falls within a
// closed AP period. Demo logic: every period ≤ closedThrough is closed.
// In production: `is_ap_period_locked(entity_id, bill.period)`, consulting
// `fiscal_periods.is_locked` as the canonical lock state per Subledger Memo
// Rule 7. The static AP_CLOSED_THROUGH is the baseline at app load; the
// ClosePeriodContext advances it as the FM declares new periods closed.
// Callers that need the dynamic value should pass `closedThrough` from
// `useClosePeriod()`; legacy callers fall back to the baseline constant.
export const AP_CLOSED_THROUGH = "2025-02";
export function isApPeriodLocked(billDate, closedThrough = AP_CLOSED_THROUGH) {
  if (!billDate) return false;
  return billDate.slice(0, 7) <= closedThrough;
}

// The accounting period a bill posts into — the field the period-lock check
// consults. Per the Bills List / Bill Detail PRDs this is SEPARATE from the
// vendor's invoice_date (b.date): it defaults to the invoice month but can be
// reassigned to an open period (e.g. when an invoice arrives after its period
// closed) WITHOUT rewriting the historical document date. Returns YYYY-MM.
// Falls back to invoice_date for seed bills that predate the field.
export function billPeriod(b) {
  if (b?.period) return b.period.slice(0, 7);
  return b?.date ? b.date.slice(0, 7) : "";
}

// Single workflow_status derived from the existing (approval × pay) seed plus
// the DEMO_OVERRIDES table. Bills List + Bill Detail both render from this.
export function workflowStatus(b) {
  const ov = DEMO_OVERRIDES[b.id];
  if (ov?.state) return ov.state;
  if (b.approval === "draft") return "DRAFT";
  if (b.approval === "review") return "PENDING_REVIEW";
  if (b.approval === "approved" && b.pay === "paid") return "PAID";
  // Approved but not yet committed to the GL = "ready to post". Once the FM
  // posts (a je_number is stamped) it advances to POSTED. These are distinct
  // FM actions: Approve clears review, Post writes the journal entry.
  if (b.approval === "approved" && b.je_number) return "POSTED";
  if (b.approval === "approved") return "APPROVED";
  return "PENDING_REVIEW";
}

// Short cause sentence shown under the status pill on the list row and under
// the status stepper on the detail page. Captures "why is this bill here
// right now" — opened/not-opened for review, return reason, hold reason,
// payment scheduled, days late, etc.
export function statusCause(b) {
  const ov = DEMO_OVERRIDES[b.id] || {};
  const ws = workflowStatus(b);
  const dpd = daysSince(b.due);
  switch (ws) {
    case "DRAFT":
      return "not yet submitted";
    case "PENDING_REVIEW": {
      if (ov.opened) {
        const { daysAgo, fieldsFlagged } = ov.opened;
        return fieldsFlagged > 0
          ? `opened ${daysAgo}d ago · ${fieldsFlagged} field${fieldsFlagged === 1 ? "" : "s"} flagged`
          : `opened ${daysAgo}d ago · no fields flagged`;
      }
      const inQueue = Math.max(1, daysSince(b.audit?.[0]?.date || b.date));
      return `not yet opened · ${inQueue}d in queue`;
    }
    case "RETURNED":
      return `FM: ${(ov.returned?.reason || "needs fix").slice(0, 60)}`;
    case "ON_HOLD": {
      const sinceDays = ov.onHold?.since ? Math.max(0, daysSince(ov.onHold.since)) : 0;
      return `${ov.onHold?.reason || "awaiting info"} · ${sinceDays}d`;
    }
    case "APPROVED":
      return "ready to post";
    case "POSTED":
      return dpd > 0 ? `posted · overdue ${dpd}d` : "posted · awaiting payment";
    case "PAID": {
      const paidAudit = (b.audit || []).find((a) => a.type === "paid") || (b.audit || [])[(b.audit?.length || 1) - 1];
      return paidAudit?.date ? formatDateEn(paidAudit.date) : "settled";
    }
    case "EXCEPTION":
      return ov.exception?.reason || "system error";
    default:
      return "";
  }
}

// Source channel — derived from existing bill fields for demo. In production
// this would come from a `source_channel` field on ap_invoices.
const RECURRING_ACCTS = new Set(["6-2400", "6-2600", "6-2300"]); // Utilities, SaaS, Rent
export function sourceChannelFor(b) {
  if (b.isAI) return "email"; // AI-OCR drafts are ingested from email/WA streams
  // Recurring vendor heuristic: same vendor appears multiple times across months
  // with similar amounts. For the demo, flag utility/subscription CoA accts.
  if (b.items && b.items.some((it) => RECURRING_ACCTS.has(it.acct))) {
    if (b.approval !== "draft") return "recurring";
  }
  return "upload";
}

// Urgency score — drives the list's default sort. Heaviest weight on states
// that gate FM action (EXCEPTION, RETURNED), then age in PENDING_REVIEW with
// flagged fields, then due-date pressure, then anomalies, then GRN mismatch.
// In production this would be a pre-computed `urgency_score` column with
// IA-tunable weights from `system_config.urgency_weights`.
export function urgencyScore(b) {
  let s = 0;
  const ws = workflowStatus(b);
  const dpd = daysSince(b.due);
  const ov = DEMO_OVERRIDES[b.id] || {};

  // 1) Workflow state — heaviest weight on states that gate FM action
  switch (ws) {
    case "EXCEPTION":      s += 150; break; // system blocked, FM must unstick
    case "RETURNED":       s += 120; break; // bounced; needs FM follow-through
    case "ON_HOLD":        s += 40;  break; // paused, may need a nudge
    case "PENDING_REVIEW": s += 60;  break;
    case "APPROVED":       s += 25;  break; // off the FM's plate already
    case "DRAFT":          s += 15;  break;
    case "PAID":           s += 0;   break;
  }

  // 2) PENDING_REVIEW age + opened-with-flags signal
  if (ws === "PENDING_REVIEW") {
    const inQueue = Math.max(0, daysSince(b.audit?.[0]?.date || b.date));
    if (inQueue >= 5) s += 40;
    else if (inQueue >= 3) s += 20;
    else if (inQueue >= 1) s += 8;
    const flagged = ov.opened?.fieldsFlagged || 0;
    s += flagged * 12;
  }

  // 3) Due-date pressure — applied to all non-terminal states
  if (ws !== "PAID" && ws !== "DRAFT") {
    if (dpd > 0)      s += Math.min(50, Math.round(dpd / 2)); // overdue (halved & capped)
    else if (dpd > -3) s += 25; // due in next 3 days
    else if (dpd > -7) s += 10; // due this week
  }

  // 4) Anomaly signal — informational but worth ranking on
  for (const a of (b.anomalies || [])) {
    if (a.severity === "high")        s += 20;
    else if (a.severity === "medium") s += 10;
    else                              s += 3;
  }

  // 5) GRN mismatch — a quiet "needs a look" signal
  if (b.grn === "mismatch") s += 8;

  return s;
}
