import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TODAY, daysSince } from "../lib/clock";
import { formatRupiah, formatDateEn } from "../lib/format";
import { workflowStatus, DEMO_OVERRIDES } from "../lib/billStatus";
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
import "./ap-aging.css";

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

// ── Relationship pill (TP-02) ──────────────────────────────────────────────
const RELATIONSHIP_TOOLTIP = {
  strategic: "Strategic vendor — relationship-sensitive. Late payment risks tightening terms, losing discounts, or pricing increases at renewal. Prioritize on-time payment.",
  at_risk:   "At-Risk vendor — documented history of disputes, slow responses, or payment issues. Use as a signal when sequencing payments.",
};
function RelationshipPill({ tier }) {
  if (tier === "standard") return null;
  return (
    <span className={`apa-rel-pill ${tier}`} title={RELATIONSHIP_TOOLTIP[tier]}>
      {tier === "strategic" ? "Strategic" : "At-Risk"}
    </span>
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

// ── Decision Queue row ────────────────────────────────────────────────────
function DecisionQueueRow({ line, selected, onToggleSelect, onClick }) {
  const isReturned = line.workflow_status === "RETURNED";
  return (
    <div
      className={`apa-dq-row${isReturned ? " returned" : ""}${selected ? " selected" : ""}`}
      onClick={onClick}
    >
      <span
        className={`apa-checkbox${selected ? " checked" : ""}`}
        onClick={(e) => { e.stopPropagation(); onToggleSelect(line.id); }}
        role="checkbox"
        aria-checked={selected}
      >
        {selected && I.check}
      </span>

      <div className="apa-vendor-cell">
        <div className="apa-vendor-name">
          {line.vendorName}
          <RelationshipPill tier={line.relationship_tier} />
        </div>
      </div>

      <div className="apa-inv-cell">
        <span className="apa-inv-no">{line.invNo}</span>
        <span className="apa-inv-date">{formatDateEn(line.invoiceDate)}</span>
      </div>

      <div className="apa-money" title={formatRupiah(line.remaining)}>{formatRupiah(line.remaining)}</div>

      <DiscountPill line={line} />

      <DueCell line={line} />

      <StatusCell line={line} />

      <div className="apa-money" style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{line.net_days}d net</div>
    </div>
  );
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
            <RelationshipPill tier={row.relationship_tier} />
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
              <div>
                {inv.invNo}
                {inv.is_accrual && <span className="apa-inv-accrual">ACCRUAL</span>}
              </div>
              <div>{formatDateEn(inv.invoiceDate)}</div>
              <div>{inv.is_accrual ? "—" : formatDateEn(inv.dueDate)}</div>
              <div>{inv.is_accrual ? "current" : (AGE_BUCKETS.find((b) => b.key === inv.ageBucket)?.lbl)}</div>
              <div>{inv.is_accrual ? "—" : inv.daysOverdue > 0 ? `${inv.daysOverdue}d late` : "—"}</div>
              <div>{inv.workflow_status}</div>
              <div className="apa-at-inv-amt">{formatRupiah(inv.remaining)}</div>
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

// ── Page ───────────────────────────────────────────────────────────────────
export default function ApAgingPage() {
  const navigate = useNavigate();
  const [view, setView] = useState("queue");   // "queue" | "table"
  const [selected, setSelected] = useState(new Set());
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [expandedVendor, setExpandedVendor] = useState(null);
  const [cardFilter, setCardFilter] = useState(null);  // null | "discounts" | "due7d" | "accruals"

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

  // Build all lines + snapshot once per render (memoized for perf)
  const allLines = useMemo(() => buildAgingLines(TODAY), []);
  const snapshot = useMemo(() => buildSnapshot(allLines), [allLines]);

  // Decision Queue rows — filtered + sorted, then narrowed by an active KPI filter
  const dqRows = useMemo(() => {
    let rows = allLines.filter(isDecisionQueueRow).sort(decisionQueueSort);
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
    }
    return rows;
  }, [allLines, cardFilter]);

  // Aging Table — vendor pivot
  const pivot = useMemo(() => {
    return buildVendorPivot(allLines.filter(isAgingTableRow));
  }, [allLines]);

  // RETURNED pinned section
  const returnedRows = dqRows.filter((r) => r.workflow_status === "RETURNED");
  const activeRows = dqRows.filter((r) => r.workflow_status !== "RETURNED");

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

  // Banner — show when ≥1 invoice expires in <48h and not dismissed
  const urgentDiscounts = dqRows.filter((r) => {
    const p = discountPillState(r);
    return p?.tone === "danger";
  });
  const showBanner = !bannerDismissed && urgentDiscounts.length > 0;

  const recon = reconBadgeContent(snapshot.reconciliation);

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
      {/* ── Header (Bills-List canonical structure) ──────────────────── */}
      <div className="lg-head">
        <div className="lg-head-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="lg-title">AP Aging</h1>
            <div className={`apa-recon-badge ${recon.cls}`} title="GL reconciliation — Gate 3a (AP Control) and Gate 3b (Accrued Liabilities)">
              {recon.icon}
              <span>{recon.text}</span>
              {recon.delta && <span className="apa-recon-delta">· {recon.delta}</span>}
            </div>
          </div>
          <div className="lg-head-actions">
            <button className="lg-btn-ghost" disabled title="Coming in PR2">
              {I.download}
              Export
            </button>
            <button className="lg-btn-brand" onClick={() => navigate("/bills/new")}>
              {I.bolt}
              Create Payment
            </button>
          </div>
        </div>

        {/* KPI strip — divided cells, no rounded boxes, matches Bills List.
            3 of 5 cards have a "View →" CTA that filters the table:
            - Discounts Expiring 7d → narrow Decision Queue to capturable discounts
            - Due in Next 7d → narrow Decision Queue to bills coming due
            - Accrued Liabilities → switch to Aging Table view (accruals don't appear in DQ)
            AP Outstanding is the default view (no CTA needed); DPO is an aggregate
            stat (not row-filterable). */}
        <div className="bp-kpi-wrap">
          <div className="bp-kpi-row">
            <div className="bp-kpi-card">
              <div className="bp-kpi-lbl">AP Outstanding</div>
              <div className="bp-kpi-val">{formatRupiah(snapshot.apOutstanding)}</div>
              <div className="bp-kpi-sub">Across {allLines.filter((l) => !l.is_accrual && l.workflow_status !== "DRAFT" && l.remaining > 0).length} bills</div>
            </div>
            <div className={`bp-kpi-card${cardFilter === "accruals" ? " active" : ""}`}>
              <div className="bp-kpi-lbl">Accrued Liabilities</div>
              <div className="bp-kpi-val">{formatRupiah(snapshot.accruedLiabilities)}</div>
              <div className="bp-kpi-sub">{allLines.filter((l) => l.is_accrual).length} accruals · Auto-reverse 1 May</div>
              <button type="button" className="bp-kpi-cta" onClick={() => selectCard("accruals")}>
                {cardFilter === "accruals" ? "Clear filter ✕" : "View in Aging Table →"}
              </button>
            </div>
            <div className="bp-kpi-card">
              <div className="bp-kpi-lbl">DPO This Month</div>
              <div className="bp-kpi-val">{snapshot.dpoDays} days</div>
              <div className="bp-kpi-sub">Days payables outstanding</div>
            </div>
            <div className={`bp-kpi-card${cardFilter === "discounts" ? " active" : ""}`}>
              <div className="bp-kpi-lbl">Discounts Expiring 7d</div>
              <div className={`bp-kpi-val${snapshot.discountsThisWeekIdr > 0 ? " warn" : ""}`}>{formatRupiah(snapshot.discountsThisWeekIdr)}</div>
              <div className="bp-kpi-sub">{urgentDiscounts.length > 0 ? `${urgentDiscounts.length} expire in <48h` : "No urgent discounts"}</div>
              <button type="button" className="bp-kpi-cta" onClick={() => selectCard("discounts")} disabled={snapshot.discountsThisWeekIdr === 0}>
                {cardFilter === "discounts" ? "Clear filter ✕" : "View bills →"}
              </button>
            </div>
            <div className={`bp-kpi-card${cardFilter === "due7d" ? " active" : ""}`}>
              <div className="bp-kpi-lbl">Due in Next 7d</div>
              <div className="bp-kpi-val">{formatRupiah(snapshot.dueIn7Days)}</div>
              <div className="bp-kpi-sub">Approved bills coming due</div>
              <button type="button" className="bp-kpi-cta" onClick={() => selectCard("due7d")} disabled={snapshot.dueIn7Days === 0}>
                {cardFilter === "due7d" ? "Clear filter ✕" : "View bills →"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Discount-expiring banner (between head and table) ────────── */}
      {showBanner && (
        <div className="apa-discount-banner">
          <span className="apa-banner-icon">{I.alert}</span>
          <div className="apa-discount-banner-body">
            <strong>{urgentDiscounts.length} discount{urgentDiscounts.length === 1 ? "" : "s"} expire in &lt; 48 hours.</strong>
            {" "}Total savings at risk: <strong>{formatRupiah(urgentDiscounts.reduce((s, r) => s + r.discount_amount_idr, 0))}</strong>.
            {" "}Surfaced in the Decision Queue below.
          </div>
          <button className="apa-discount-banner-dismiss" onClick={() => setBannerDismissed(true)} title="Dismiss">
            {I.x}
          </button>
        </div>
      )}

      {/* ── Table card (toggle + sort + table, all inside one card) ── */}
      <div className="lg-table-wrap">
        <div className="lg-card bp-card">
          <div className="bp-tabs-row">
            <button className={`bp-tab${view === "queue" ? " active" : ""}`} onClick={() => setView("queue")}>
              Decision Queue
              <span className="bp-tab-count">{dqRows.length}</span>
            </button>
            <button className={`bp-tab${view === "table" ? " active" : ""}`} onClick={() => setView("table")}>
              Aging Table
              <span className="bp-tab-count">{pivot.length}</span>
            </button>
          </div>

          <div className="lg-filter-row">
            <div className="apa-sort-label">
              {view === "queue" ? (
                <>Sorted by <strong>urgency</strong>
                  <span className="apa-info" title="Discount-expiring &gt; deep overdue &gt; shallow overdue &gt; current. Discount windows have a hard calendar deadline; missing one captures less cash.">?</span>
                </>
              ) : (
                <>Vendor pivot · <strong>6 buckets</strong> + accrual column</>
              )}
            </div>
            {cardFilter && (
              <div className="apa-active-filter">
                <span className="apa-active-filter-dot" />
                Filtered: <strong>{
                  cardFilter === "discounts" ? "Discounts expiring this week" :
                  cardFilter === "due7d"     ? "Due in next 7 days" :
                  cardFilter === "accruals"  ? "Accrued liabilities only" :
                  ""
                }</strong>
                <button type="button" className="apa-active-filter-clear" onClick={() => setCardFilter(null)}>Clear</button>
              </div>
            )}
          </div>

          {view === "queue" ? (
            <>
              {returnedRows.length > 0 && (
                <>
                  <div className="apa-pinned">
                    {I.alert}
                    <span>{returnedRows.length} bill{returnedRows.length === 1 ? "" : "s"} returned to you — review the comments and resubmit.</span>
                    <span className="apa-pinned-count">{returnedRows.length}</span>
                  </div>
                  <div className="apa-dq-header">
                    <div></div>
                    <div>Vendor</div>
                    <div>Invoice</div>
                    <div style={{ textAlign: "right" }}>Balance</div>
                    <div>Discount</div>
                    <div>Due</div>
                    <div>Status</div>
                    <div>Terms</div>
                  </div>
                  {returnedRows.map((line) => (
                    <DecisionQueueRow
                      key={line.id}
                      line={line}
                      selected={selected.has(line.id)}
                      onToggleSelect={toggleSelect}
                      onClick={() => navigate(`/bills/${line.id}`)}
                    />
                  ))}
                </>
              )}

              {activeRows.length > 0 ? (
                <>
                  {returnedRows.length === 0 && (
                    <div className="apa-dq-header">
                      <div></div>
                      <div>Vendor</div>
                      <div>Invoice</div>
                      <div style={{ textAlign: "right" }}>Balance</div>
                      <div>Discount</div>
                      <div>Due</div>
                      <div>Status</div>
                      <div>Terms</div>
                      <div></div>
                    </div>
                  )}
                  {activeRows.map((line) => (
                    <DecisionQueueRow
                      key={line.id}
                      line={line}
                      selected={selected.has(line.id)}
                      onToggleSelect={toggleSelect}
                      onClick={() => navigate(`/bills/${line.id}`)}
                    />
                  ))}
                </>
              ) : returnedRows.length === 0 ? (
                <EmptyState
                  title="Decision Queue is clear"
                  sub="Nothing needs your attention today. Discounts, overdue bills, and pending review will appear here as they arrive."
                />
              ) : null}
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
              <EmptyState
                title="No outstanding balances"
                sub="All bills are settled. Snapshot is current as of the timestamp above."
              />
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

      {/* ── Multi-select action bar ─────────────────────────────────── */}
      {selected.size > 0 && (
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
            <button className="apa-action-bar-btn primary">
              {I.bolt}
              Create Payment Request
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
