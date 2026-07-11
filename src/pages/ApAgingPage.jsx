import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCurrentUser } from "../state/CurrentUserContext";
import { useVendors } from "../state/VendorsContext";
import { usePayments, PAYMENT_STATUS_META } from "../state/PaymentsContext";
import { useBills } from "../state/BillsContext";
import RelationshipTierControl from "../components/RelationshipTier";
import { TODAY, daysSince } from "../lib/clock";
import { formatRupiah, formatDateEn } from "../lib/format";
import { workflowStatus, DEMO_OVERRIDES, STATUS_LABEL } from "../lib/billStatus";
import {
  buildAgingLines,
  buildSnapshot,
  buildVendorPivot,
  isDecisionQueueRow,
  isAgingTableRow,
  decisionQueueSort,
  discountPillState,
  ageBucketOf,
  AGE_BUCKETS,
  RELATIONSHIP_LABEL,
  CONFIDENCE_THRESHOLD_PAYMENT_TERMS_MIN,
} from "../lib/apAging";
import "./modules.css";
import "./ap-aging.css";

// Age-bucket bar colours — green (current) → amber (1–90) → red (90+).
const AGE_COLOR = { current: "#2E7D44", b1_30: "#C99A2E", b31_60: "#B8770F", b61_90: "#A8620C", b91_120: "#A32D2D", b_gt120: "#8C2420" };

// The Decision Queue is role-scoped: each persona works the payment stage it
// owns. Copy + the bulk action per mode.
const QUEUE_MODE = {
  request: { title: "Bills to pay", sub: "Posted bills ready to pay — request payment per bill, or select several.", action: "Request payment", rowAction: "Request", emptyTitle: "Nothing to request", emptySub: "Every posted bill already has a payment request in flight." },
  approve: { title: "Payment requests to approve", sub: "AP Staff requested these payments — review and approve.", action: "Approve payment", rowAction: "Approve", emptyTitle: "No requests awaiting approval", emptySub: "Payment requests from AP Staff will appear here." },
  execute: { title: "Approved — ready to pay", sub: "Approved payments to execute, then mark as paid.", action: "Mark as paid", rowAction: "Mark paid", emptyTitle: "Nothing to pay right now", emptySub: "Approved payments ready to execute will appear here." },
  view:    { title: "Payments", sub: "Posted payables and their payment status.", action: null, rowAction: null, emptyTitle: "No posted payables", emptySub: "Posted bills awaiting payment will appear here." },
};

// ── Icons ──────────────────────────────────────────────────────────────────
const I = {
  check:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  shield:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
  download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  x:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  alert:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  question: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  bolt:     <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  chev:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="9 18 15 12 9 6"/></svg>,
};

// ── Why-stuck explanation (TP-05) ──────────────────────────────────────────
// PRD: one of three MVP explanations — (a) duration > entity avg + 3d,
// (b) any field < confidence threshold, (c) no active approvers.
// For the prototype, derive from DEMO_OVERRIDES + age in queue.
function whyStuckFor(line) {
  if (line.workflow_status === "RETURNED") {
    const ov = DEMO_OVERRIDES[line.id]?.returned;
    return { kind: "returned", title: "Returned by FM", body: ov?.reason || "Bill returned — AP Staff action needed." };
  }
  if (line.workflow_status !== "PENDING_REVIEW") return null;
  const inQueue = Math.max(0, daysSince(line.raw?.audit?.[0]?.date || line.invoiceDate));
  const flagged = DEMO_OVERRIDES[line.id]?.opened?.fieldsFlagged ?? 0;
  if (inQueue >= 5) {
    return { kind: "stale", title: "Stale in queue", body: `In review for ${inQueue} days — entity average is 2 days. Reviewer may be unavailable.` };
  }
  if (flagged > 0) {
    return { kind: "flagged", title: "Fields need attention", body: `${flagged} field${flagged === 1 ? "" : "s"} below confidence threshold — manual verification required.` };
  }
  return null;
}

// ── Recon badge text ───────────────────────────────────────────────────────
function reconBadgeContent(recon) {
  if (recon.status === "ok") {
    return {
      cls: "ok",
      icon: I.shield,
      text: `Verified ${recon.verified_hours_ago}h ago · AP and Accrued Liabilities both match GL`,
      delta: `Delta: Rp 0 / Rp 0`,
    };
  }
  if (recon.status === "mismatch") {
    return {
      cls: "mismatch",
      icon: I.alert,
      text: "Discrepancy detected",
      delta: `AP Rp ${Math.abs(recon.gate_3a_delta).toLocaleString("id-ID")} · Accrued Rp ${Math.abs(recon.gate_3b_delta).toLocaleString("id-ID")}`,
    };
  }
  return { cls: "unavailable", icon: I.alert, text: "Verification unavailable", delta: "" };
}

// ── Discount pill (TP-03) ──────────────────────────────────────────────────
const DISCOUNT_TONE_EXPLAIN = {
  ok:       "Early-payment discount available — plenty of time. Pay before the window closes to capture the savings.",
  warn:     "Early-payment discount window closing soon (3–5 days). Move this up the payment queue.",
  danger:   "Early-payment discount expires today or tomorrow. Last chance to capture savings.",
  captured: "Discount already captured on this bill.",
  muted:    "Discount window has expired — no longer capturable.",
};
function DiscountPill({ line }) {
  const pill = discountPillState(line);
  if (!pill) {
    // Sub-threshold OR no discount terms — render dash so columns align
    return <span style={{ color: "var(--color-text-tertiary)", fontSize: 11 }} title="No early-payment discount terms on file for this vendor (or system confidence in extracted terms is below 70%).">—</span>;
  }
  const title = `${line.discount_pct}% / ${line.discount_days} days · expires ${formatDateEn(line.discount_expires_at)}\n\n${DISCOUNT_TONE_EXPLAIN[pill.tone]}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
      <span className={`apa-disc-pill ${pill.tone}`} title={title}>
        {pill.tone === "captured" && I.check}
        {pill.text}
      </span>
      {pill.tone !== "captured" && pill.tone !== "muted" && (
        <span className="apa-disc-amt">Save Rp {line.discount_amount_idr.toLocaleString("id-ID")}</span>
      )}
    </div>
  );
}


// ── Status pill — workflow_status with hover explanation (incl. TP-05) ────
// Hover surfaces (a) what the status means, and (b) the TP-05 "why is this
// stuck?" explanation when the row qualifies as stuck (in queue >5d, flagged
// fields below confidence threshold, or RETURNED with a reason).
function StatusCell({ line }) {
  if (line.is_accrual) {
    const reversal = line.raw?.accrual_reversal_date;
    return (
      <div className="apa-status">
        <span
          className="apa-status-pill accrual"
          title={`Accrual posted by Klay AI. Auto-reverses ${formatDateEn(reversal)}. If the actual invoice arrives before then, it'll be matched and the reversal cancelled.`}
        >
          Accrual
        </span>
      </div>
    );
  }
  const ws = line.workflow_status;
  const cls =
    ws === "DRAFT"          ? "draft" :
    ws === "PENDING_REVIEW" ? "review" :
    ws === "RETURNED"       ? "returned" :
    ws === "APPROVED"       ? "approved" :
    ws === "POSTED" || ws === "PAID" ? "posted" :
    "exception";
  const label =
    ws === "PENDING_REVIEW" ? "Review" :
    ws === "RETURNED"       ? "Returned" :
    ws === "APPROVED"       ? "Approved" :
    ws === "DRAFT"          ? "Draft" :
    ws === "POSTED"         ? "Posted" :
    ws === "PAID"           ? "Paid" :
    ws;

  // TP-05 — fold the stuck explanation into the status hover
  const stuck = whyStuckFor(line);
  const baseExplain =
    ws === "PENDING_REVIEW" ? "In review with the Finance Manager." :
    ws === "RETURNED"       ? "Returned by the FM — AP Staff needs to correct and resubmit." :
    ws === "APPROVED"       ? "Approved by the FM — ready for payment scheduling." :
    ws === "DRAFT"          ? "Drafted but not yet submitted for review." :
    ws === "POSTED"         ? "Posted to the GL." :
    ws === "PAID"           ? "Paid in full." :
    "";
  const title = stuck
    ? `${baseExplain} ${stuck.title} — ${stuck.body}`
    : baseExplain;

  return (
    <div className="apa-status">
      <span className={`apa-status-pill ${cls}${stuck ? " stuck" : ""}`} title={title}>{label}</span>
    </div>
  );
}

// ── Due + Age combined cell ───────────────────────────────────────────────
// Per PRD: AP Aging is the payment-prep workspace, so the surfaced fact is
// "when is this due" + the urgency framing on top. One column, not two.
function DueCell({ line }) {
  if (line.is_accrual) {
    return (
      <div>
        <div className="apa-due-date" style={{ color: "var(--color-text-tertiary)" }}>—</div>
        <div className="apa-age-sub">Accrual</div>
      </div>
    );
  }
  const d = line.daysOverdue;
  const cls = d > 0 ? "overdue" : d > -3 ? "due-soon" : "";
  const sub = d > 0 ? `${d}d late` : d === 0 ? "Due today" : `In ${-d}d`;
  return (
    <div>
      <div className="apa-due-date">{formatDateEn(line.dueDate)}</div>
      <div className={`apa-age-sub ${cls}`}>{sub}</div>
    </div>
  );
}

// Payment-status pill — the payment lifecycle stage (unpaid → requested →
// approved → paid), the axis AP Aging works on now that every row is Posted.
function PaymentPill({ status }) {
  const meta = PAYMENT_STATUS_META[status] || PAYMENT_STATUS_META.unpaid;
  return <span className={`apa-pay-pill tone-${meta.tone}`}>{meta.label}</span>;
}

// ── Decision Queue row ────────────────────────────────────────────────────
function DecisionQueueRow({ line, paymentStatus, actionLabel, onAction, selected, onToggleSelect, onClick, canSelect = true }) {
  return (
    <div
      className={`apa-dq-row${selected ? " selected" : ""}`}
      onClick={onClick}
    >
      {canSelect ? (
        <span
          className={`apa-checkbox${selected ? " checked" : ""}`}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(line.id); }}
          role="checkbox"
          aria-checked={selected}
        >
          {selected && I.check}
        </span>
      ) : (
        <span aria-hidden />
      )}

      <div className="apa-vendor-cell">
        <div className="apa-vendor-name">
          {line.vendorName}
          <RelationshipTierControl vendorId={line.vendorId} editable={false} />
        </div>
      </div>

      <div className="apa-inv-cell">
        <span className="apa-inv-no">{line.invNo}</span>
        <span className="apa-inv-date">{formatDateEn(line.invoiceDate)}</span>
      </div>

      <div className="apa-money" title={formatRupiah(line.remaining)}>{formatRupiah(line.remaining)}</div>

      <DiscountPill line={line} />

      <DueCell line={line} />

      <PaymentPill status={paymentStatus} />

      <div className="apa-money" style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{line.net_days}d net</div>

      {actionLabel && canSelect ? (
        <button className="apa-row-action" onClick={(e) => { e.stopPropagation(); onAction(line.id); }}>{actionLabel}</button>
      ) : (
        <span aria-hidden />
      )}
    </div>
  );
}

// Colour a bucket amount by how overdue it is — keyed to Hadi's 30/60 check
// (past 60 = red). Only the one populated cell per invoice row gets tinted.
function bucketSev(key) {
  if (key === "b1_30" || key === "b31_60") return "amt-warn";
  if (key === "b61_90" || key === "b91_120" || key === "b_gt120") return "amt-danger";
  return "";
}

// Small "due / overdue" meta under each invoice number, so the exact age is
// legible alongside the bucket column it lands in.
function invAgingMeta(inv) {
  if (inv.is_accrual) return "Awaiting invoice";
  const d = inv.daysOverdue;
  const due = `Due ${formatDateEn(inv.dueDate)}`;
  if (d > 0) return `${due} · ${d}d overdue`;
  if (d === 0) return `${due} · due today`;
  return `${due} · in ${Math.abs(d)}d`;
}

// ── Aging Table vendor row ─────────────────────────────────────────────────
function AgingTableVendorRow({ row, expanded, onToggle, accrualHighlight }) {
  const buckets = row.buckets;
  const renderBucket = (key) => {
    const v = buckets[key];
    if (v === 0) return <div className="apa-at-cell-zero">—</div>;
    return <div>{formatRupiah(v)}</div>;
  };
  const isDimmed = accrualHighlight && row.accrual === 0;
  return (
    <>
      <div className={`apa-at-vendor${expanded ? " expanded" : ""}${isDimmed ? " dimmed" : ""}${accrualHighlight && row.accrual > 0 ? " accrual-active" : ""}`} onClick={onToggle}>
        <div className="apa-vendor-cell">
          <span className="apa-at-chevron">{I.chev}</span>
          <div className="apa-vendor-name">
            {row.vendorName}
            <RelationshipTierControl vendorId={row.vendorId} />
            <span className="apa-vendor-count">{row.invoices.length} bill{row.invoices.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        {renderBucket("current")}
        {renderBucket("b1_30")}
        {renderBucket("b31_60")}
        {renderBucket("b61_90")}
        {renderBucket("b91_120")}
        {renderBucket("b_gt120")}
        <div className={row.accrual > 0 ? "apa-at-cell-accrual" : "apa-at-cell-zero"}>
          {row.accrual > 0 ? formatRupiah(row.accrual) : "—"}
        </div>
        <div className="apa-at-cell-strong">{formatRupiah(row.total)}</div>
      </div>
      {expanded && (
        <div className="apa-at-expand">
          {row.invoices.map((inv) => (
            <div key={inv.id} className="apa-at-inv">
              <div className="apa-at-inv-label">
                <span className="apa-at-inv-top">
                  <span className="apa-at-inv-no">{inv.invNo}</span>
                  {inv.is_accrual && <span className="apa-inv-accrual">ACCRUAL</span>}
                </span>
                <span className="apa-at-inv-meta">{invAgingMeta(inv)}</span>
              </div>
              {AGE_BUCKETS.map((b) => {
                const hit = !inv.is_accrual && inv.ageBucket === b.key;
                return (
                  <div key={b.key} className={hit ? bucketSev(b.key) : "apa-at-cell-zero"}>
                    {hit ? formatRupiah(inv.remaining) : "—"}
                  </div>
                );
              })}
              <div className={inv.is_accrual ? "apa-at-cell-accrual" : "apa-at-cell-zero"}>
                {inv.is_accrual ? formatRupiah(inv.remaining) : "—"}
              </div>
              <div className="apa-at-cell-strong">{formatRupiah(inv.remaining)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState({ title, sub, icon }) {
  return (
    <div className="apa-empty">
      {icon || I.shield}
      <div className="apa-empty-title">{title}</div>
      <div className="apa-empty-sub">{sub}</div>
    </div>
  );
}

// ── Table filter popover ────────────────────────────────────────────────────
// Multi-select chips grouped by dimension. Dimensions shown adapt to the active
// view: the Decision Queue can filter by Status / Discount (per-bill signals);
// the Aging Table by Accrual (vendor-aggregated). Relationship + Aging apply to
// both. Toggling is live — no Apply step.
const STATUS_FILTER_OPTS = [
  ["PENDING_REVIEW", "Pending Review"],
  ["APPROVED", "Ready to post"],
  ["POSTED", "Posted"],
  ["RETURNED", "Returned"],
];
function ApAgingFilterPopover({ view, filters, onToggle, onClear, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  const Chip = ({ dim, val, label }) => (
    <button
      type="button"
      className={`apa-fchip${filters[dim].has(val) ? " active" : ""}`}
      onClick={() => onToggle(dim, val)}
    >
      {label}
    </button>
  );

  return (
    <div className="lg-popover lg-filter-pop apa-filter-pop" ref={ref}>
      <div className="lg-filter-body">
        {view === "queue" && (
          <div className="lg-filter-fld">
            <div className="lg-filter-fld-lbl">Status</div>
            <div className="apa-fchips">
              {STATUS_FILTER_OPTS.map(([v, l]) => <Chip key={v} dim="status" val={v} label={l} />)}
            </div>
          </div>
        )}
        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Relationship</div>
          <div className="apa-fchips">
            {Object.entries(RELATIONSHIP_LABEL).map(([v, l]) => <Chip key={v} dim="tier" val={v} label={l} />)}
          </div>
        </div>
        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Aging bucket</div>
          <div className="apa-fchips">
            {AGE_BUCKETS.map((b) => <Chip key={b.key} dim="bucket" val={b.key} label={b.lbl} />)}
          </div>
        </div>
        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Other</div>
          <div className="apa-fchips">
            {view === "queue"
              ? <Chip dim="special" val="discount" label="Has early-pay discount" />
              : <Chip dim="special" val="accrual" label="Has accrual" />}
          </div>
        </div>
      </div>
      <div className="apa-filter-foot">
        <button type="button" className="lg-filter-reset" onClick={onClear}>Clear all</button>
        <button type="button" className="lg-filter-apply" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function ApAgingPage() {
  const navigate = useNavigate();
  // AP Aging is a read surface (PRD). The only write-initiating affordances are
  // the payment-request controls — gated to transact+ (AP Staff, FM, Admin).
  // View Only sees the full analytical surface but not these controls.
  const { hasLevel, hasCapability, user } = useCurrentUser();
  const { bills, updateBill } = useBills();
  const { statusOf, requestPayment, approvePayment, markPaid } = usePayments();
  // Role-scoped payment queue: each role works the stage it owns, keyed off the
  // explicit payment capabilities (see roles.js → visible in User access
  // settings). FM approves, AP Staff requests, Finance Staff executes.
  const payMode = hasCapability("payment.approve") ? "approve"
    : hasCapability("payment.request") ? "request"
    : hasCapability("payment.execute") ? "execute"
    : "view";
  const canActOnQueue = payMode !== "view";
  const { tierOf } = useVendors(); // live vendor-master tier (reflects edits)
  const [view, setView] = useState("queue");   // "queue" | "table"
  const [selected, setSelected] = useState(new Set());
  const [expandedVendor, setExpandedVendor] = useState(null);
  const [cardFilter, setCardFilter] = useState(null);  // null | "discounts" | "due7d" | "accruals"
  const [tableSearch, setTableSearch] = useState("");  // Aging Table vendor/invoice search

  // Explicit table filters (separate from KPI-card quick filters). Multi-select
  // within a dimension = OR; across dimensions = AND. Dimensions shown depend on
  // the active view (queue vs table).
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ status: new Set(), tier: new Set(), bucket: new Set(), special: new Set() });
  const filterCount = filters.status.size + filters.tier.size + filters.bucket.size + filters.special.size;
  const toggleFilter = (dim, val) => setFilters((f) => {
    const next = new Set(f[dim]);
    next.has(val) ? next.delete(val) : next.add(val);
    return { ...f, [dim]: next };
  });
  const clearFilters = () => setFilters({ status: new Set(), tier: new Set(), bucket: new Set(), special: new Set() });

  // Selecting a KPI card filters the table. Re-selecting the same card clears.
  // Accruals filter additionally switches the view to Aging Table since accruals
  // are excluded from the Decision Queue entirely.
  const selectCard = (key) => {
    if (cardFilter === key) {
      setCardFilter(null);
      return;
    }
    setCardFilter(key);
    if (key === "accruals") setView("table");
    else setView("queue");
  };

  // Deep-link focus from the Home task hub: /ap-aging?card=discounts.
  const [focusParams, setFocusParams] = useSearchParams();
  useEffect(() => {
    const card = focusParams.get("card");
    if (!card) return;
    selectCard(card);
    setFocusParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build all lines + snapshot from the LIVE bills, so a settled payment
  // (pay=paid, sisa=0) drops the bill out of the aging surfaces immediately.
  const allLines = useMemo(() => buildAgingLines(TODAY, bills), [bills]);
  const snapshot = useMemo(() => buildSnapshot(allLines), [allLines]);

  // Decision Queue rows — filtered + sorted, then narrowed by an active KPI filter
  const dqRows = useMemo(() => {
    let rows = allLines.filter(isDecisionQueueRow).sort(decisionQueueSort);
    // Role-scoped payment stage: show only the bills this persona acts on.
    rows = rows.filter((l) => {
      const ps = statusOf(l.id);
      if (payMode === "request") return ps === "unpaid";
      if (payMode === "approve") return ps === "requested";
      if (payMode === "execute") return ps === "approved";
      return true; // view — everything
    });
    if (cardFilter === "discounts") {
      rows = rows.filter((l) => {
        const p = discountPillState(l);
        return p && p.tone !== "muted" && p.tone !== "captured" && l.days_to_discount != null && l.days_to_discount <= 7;
      });
    } else if (cardFilter === "due7d") {
      rows = rows.filter((l) => {
        const dueDays = -daysSince(l.dueDate);  // positive = future
        return dueDays >= 0 && dueDays <= 7;
      });
    } else if (cardFilter === "overdue") {
      rows = rows.filter((l) => l.daysOverdue > 0);
    } else if (cardFilter === "returned") {
      rows = rows.filter((l) => l.workflow_status === "RETURNED");
    } else if (cardFilter && cardFilter.startsWith("age:")) {
      const bk = cardFilter.slice(4);
      rows = rows.filter((l) => l.ageBucket === bk);
    }
    // Explicit filters
    if (filters.status.size) rows = rows.filter((l) => filters.status.has(l.workflow_status));
    if (filters.tier.size)   rows = rows.filter((l) => filters.tier.has(tierOf(l.vendorId)));
    if (filters.bucket.size) rows = rows.filter((l) => filters.bucket.has(l.ageBucket));
    if (filters.special.has("discount")) rows = rows.filter((l) => l.has_terms);
    return rows;
  }, [allLines, cardFilter, filters, tierOf, payMode, statusOf]);

  // Aging Table — vendor pivot
  const pivot = useMemo(() => {
    let rows = buildVendorPivot(allLines.filter(isAgingTableRow));
    if (filters.tier.size)   rows = rows.filter((r) => filters.tier.has(tierOf(r.vendorId)));
    if (filters.bucket.size) rows = rows.filter((r) => [...filters.bucket].some((bk) => (r.buckets[bk] || 0) > 0));
    if (filters.special.has("accrual")) rows = rows.filter((r) => r.accrual > 0);
    const q = tableSearch.trim().toLowerCase();
    if (q) rows = rows.filter((r) =>
      r.vendorName.toLowerCase().includes(q) ||
      (r.invoices || []).some((inv) => (inv.invNo || "").toLowerCase().includes(q)),
    );
    return rows;
  }, [allLines, filters, tableSearch, tierOf]);

  // Run the role's payment action on a set of bill ids.
  const runPaymentAction = (ids) => {
    if (!ids.length) return;
    if (payMode === "request") requestPayment(ids, user?.name || "AP Staff");
    else if (payMode === "approve") approvePayment(ids, user?.name || "Finance Manager");
    else if (payMode === "execute") {
      markPaid(ids, user?.name || "Finance Staff");
      // Executing the transfer settles the bill in the ledger.
      for (const id of ids) {
        updateBill(id, { pay: "paid", sisa: 0 }, { type: "paid", action: "Payment executed & marked paid", by: user?.name || "Finance Staff", date: TODAY.toISOString().slice(0, 10), time: "" });
      }
    }
  };
  const runQueueAction = () => { runPaymentAction([...selected]); setSelected(new Set()); };
  const runRowAction = (id) => runPaymentAction([id]);

  // Selection helpers
  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());
  const selectedTotal = useMemo(() => {
    let sum = 0;
    for (const r of dqRows) if (selected.has(r.id)) sum += r.remaining;
    return sum;
  }, [selected, dqRows]);
  const selectedDiscount = useMemo(() => {
    let sum = 0;
    for (const r of dqRows) {
      if (!selected.has(r.id)) continue;
      const pill = discountPillState(r);
      if (pill && pill.tone !== "muted" && pill.tone !== "captured" && r.discount_amount_idr) {
        sum += r.discount_amount_idr;
      }
    }
    return sum;
  }, [selected, dqRows]);


  // Grand totals for Aging Table footer
  const grandTotals = useMemo(() => {
    const t = { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b91_120: 0, b_gt120: 0, accrual: 0, total: 0 };
    for (const v of pivot) {
      for (const k of Object.keys(v.buckets)) t[k] += v.buckets[k];
      t.accrual += v.accrual;
      t.total += v.total;
    }
    return t;
  }, [pivot]);

  return (
    <div className="lg-page apa-page">
      <div className="lg-scroll-container">
      {/* ── Header (Bills-List canonical structure) ──────────────────── */}
      <div className="lg-head">
        <div className="lg-head-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="lg-title">AP Aging</h1>
          </div>
          <div className="lg-head-actions">
            <button className="lg-btn-ghost" disabled title="Coming in PR2">
              {I.download}
              Export
            </button>
          </div>
        </div>

        {/* ── Main tabs — the two ways to work AP aging ────────────────── */}
        <div className="apa-tabs">
          <button type="button" className={`apa-tab${view === "queue" ? " on" : ""}`} onClick={() => setView("queue")}>
            Decision Queue
          </button>
          <button type="button" className={`apa-tab${view === "table" ? " on" : ""}`} onClick={() => setView("table")}>
            Aging Table
          </button>
        </div>

        {/* ── AP Outstanding · by age (Decision Queue view). Your Tasks moved to
             /dashboard; the overdue/discount Insights moved to /insights. ── */}
        {view === "queue" && (
        <div className="bp-cc">
          <div className="bp-cc-apo bp-cc-apo-solo">
              <div className="bp-cc-apo-head">
                <div className="bp-cc-sec-lbl">AP Outstanding · by age</div>
                <div className="bp-cc-apo-total">{formatRupiah(snapshot.apOutstanding)}</div>
              </div>
              <div className="bp-cc-bar">
                {AGE_BUCKETS.map((b) => (
                  <span key={b.key} style={{ flexGrow: snapshot.bucketTotals[b.key] || 0, minWidth: snapshot.bucketTotals[b.key] > 0 ? 4 : 0, background: AGE_COLOR[b.key] }} title={b.lbl} />
                ))}
              </div>
              <div className="apa-age-grid">
                {AGE_BUCKETS.map((b) => (
                  <button key={b.key} type="button" className={`apa-age${cardFilter === "age:" + b.key ? " active" : ""}`} onClick={() => selectCard("age:" + b.key)}>
                    <span className="apa-age-top"><i style={{ background: AGE_COLOR[b.key] }} />{b.lbl}</span>
                    <span className="apa-age-amt">{formatRupiah(snapshot.bucketTotals[b.key])}</span>
                  </button>
                ))}
              </div>
              <div className="apa-cc-foot">
                <span>Cash due this week <b>{formatRupiah(snapshot.dueIn7Days)}</b></span>
                <span>DPO <b>{snapshot.dpoDays}d</b></span>
                <span>Accrued <b>{formatRupiah(snapshot.accruedLiabilities)}</b></span>
              </div>
          </div>
        </div>
        )}
      </div>

      {/* ── Table card (toggle + sort + table, all inside one card) ── */}
      <div className="lg-table-wrap">
        <div className="lg-card bp-card">
          <div className="lg-filter-row">
            {view === "queue" && (
              <div className="apa-sort-label">
                Sorted by <strong>urgency</strong>
                <span className="apa-info" title="Discount-expiring &gt; deep overdue &gt; shallow overdue &gt; current. Discount windows have a hard calendar deadline; missing one captures less cash.">?</span>
              </div>
            )}
            {view === "table" && (
              <div className="apa-search">
                <svg viewBox="0 0 16 16" aria-hidden><circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" /></svg>
                <input
                  className="apa-search-input"
                  placeholder="Search vendor or invoice…"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                />
                {tableSearch && (
                  <button type="button" className="apa-search-clear" onClick={() => setTableSearch("")} aria-label="Clear search">×</button>
                )}
              </div>
            )}
            {cardFilter && (
              <div className="apa-active-filter">
                <span className="apa-active-filter-dot" />
                Filtered: <strong>{
                  cardFilter === "discounts" ? "Discounts expiring this week" :
                  cardFilter === "due7d"     ? "Due in next 7 days" :
                  cardFilter === "accruals"  ? "Accrued liabilities only" :
                  cardFilter === "overdue"   ? "Overdue bills" :
                  cardFilter?.startsWith("age:") ? `${AGE_BUCKETS.find((b) => b.key === cardFilter.slice(4))?.lbl} days overdue` :
                  ""
                }</strong>
                <button type="button" className="apa-active-filter-clear" onClick={() => setCardFilter(null)}>Clear</button>
              </div>
            )}
            <div className="lg-filter-meta">
              {filterCount > 0 && (
                <button type="button" className="lg-filter-reset" onClick={clearFilters}>Clear filters</button>
              )}
              <div className="lg-meta-btn-wrap">
                <button type="button" className={`lg-meta-btn${filterCount > 0 ? " active" : ""}`} onClick={() => setFilterOpen((o) => !o)}>
                  <svg viewBox="0 0 12 12"><path d="M1 2.5h10l-4 4.5V11L5 9.5V7L1 2.5z" /></svg>
                  Filter
                  {filterCount > 0 && <span className="lg-filter-badge">{filterCount}</span>}
                </button>
                {filterOpen && (
                  <ApAgingFilterPopover
                    view={view}
                    filters={filters}
                    onToggle={toggleFilter}
                    onClear={clearFilters}
                    onClose={() => setFilterOpen(false)}
                  />
                )}
              </div>
            </div>
          </div>

          {view === "queue" ? (
            <>
              <div className="apa-queue-mode">
                <span className="apa-queue-mode-title">{QUEUE_MODE[payMode].title}</span>
                <span className="apa-queue-mode-sub">{QUEUE_MODE[payMode].sub}</span>
              </div>
              {dqRows.length > 0 ? (
                <>
                  <div className="apa-dq-header">
                    <div></div>
                    <div>Vendor</div>
                    <div>Invoice</div>
                    <div style={{ textAlign: "right" }}>Balance</div>
                    <div>Discount</div>
                    <div>Due</div>
                    <div>Payment</div>
                    <div>Terms</div>
                    <div></div>
                  </div>
                  {dqRows.map((line) => (
                    <DecisionQueueRow
                      key={line.id}
                      line={line}
                      paymentStatus={statusOf(line.id)}
                      actionLabel={QUEUE_MODE[payMode].rowAction}
                      onAction={runRowAction}
                      selected={selected.has(line.id)}
                      onToggleSelect={toggleSelect}
                      onClick={() => navigate(`/bills/${line.id}`)}
                      canSelect={canActOnQueue}
                    />
                  ))}
                </>
              ) : (
                <EmptyState
                  title={QUEUE_MODE[payMode].emptyTitle}
                  sub={QUEUE_MODE[payMode].emptySub}
                />
              )}
            </>
          ) : (
            // ── Aging Table view ───────────────────────────────────────
            <>
            <div className="apa-at-header">
              <div>Vendor</div>
              <div>Current</div>
              <div>1–30</div>
              <div>31–60</div>
              <div>61–90</div>
              <div>91–120</div>
              <div>&gt;120</div>
              <div>Accrual</div>
              <div>Total</div>
            </div>

            {pivot.length === 0 ? (
              tableSearch.trim() ? (
                <EmptyState
                  title="No vendors match"
                  sub={`Nothing matches "${tableSearch.trim()}". Try a different vendor name or invoice number.`}
                />
              ) : (
                <EmptyState
                  title="No outstanding balances"
                  sub="All bills are settled. Snapshot is current as of the timestamp above."
                />
              )
            ) : (
              <>
                {pivot.map((row) => (
                  <AgingTableVendorRow
                    key={row.vendorId}
                    row={row}
                    expanded={expandedVendor === row.vendorId}
                    onToggle={() => setExpandedVendor(expandedVendor === row.vendorId ? null : row.vendorId)}
                    accrualHighlight={cardFilter === "accruals"}
                  />
                ))}
                <div className="apa-at-grand">
                  <div>Grand Total</div>
                  <div>{formatRupiah(grandTotals.current)}</div>
                  <div>{formatRupiah(grandTotals.b1_30)}</div>
                  <div>{formatRupiah(grandTotals.b31_60)}</div>
                  <div>{formatRupiah(grandTotals.b61_90)}</div>
                  <div>{formatRupiah(grandTotals.b91_120)}</div>
                  <div>{formatRupiah(grandTotals.b_gt120)}</div>
                  <div style={{ color: grandTotals.accrual > 0 ? "var(--color-action)" : "var(--color-text-tertiary)" }}>
                    {grandTotals.accrual > 0 ? formatRupiah(grandTotals.accrual) : "—"}
                  </div>
                  <div>{formatRupiah(grandTotals.total)}</div>
                </div>
              </>
            )}
            </>
          )}
        </div>
      </div>
      </div>{/* /lg-scroll-container */}

      {/* ── Multi-select action bar ─────────────────────────────────── */}
      {canActOnQueue && QUEUE_MODE[payMode].action && selected.size > 0 && (
        <div className="apa-action-bar">
          <div className="apa-action-bar-info">
            <span className="apa-action-bar-count">{selected.size} selected</span>
            <span className="apa-action-bar-total">Total <strong>{formatRupiah(selectedTotal)}</strong></span>
            {selectedDiscount > 0 && (
              <span className="apa-action-bar-total" style={{ color: "rgba(255, 200, 100, 0.95)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 13, height: 13, flexShrink: 0 }}>
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                Captures <strong>{formatRupiah(selectedDiscount)}</strong> in discounts
              </span>
            )}
          </div>
          <div className="apa-action-bar-actions">
            <button className="apa-action-bar-btn" onClick={clearSelection}>Clear</button>
            <button className="apa-action-bar-btn primary" onClick={runQueueAction}>
              {I.bolt}
              {QUEUE_MODE[payMode].action}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
