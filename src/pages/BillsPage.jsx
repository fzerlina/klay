import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { VENDORS as vendors } from "../data/seed/vendors";
import { TODAY, daysSince } from "../lib/clock";
import { formatRupiah, formatDateEn as formatDate } from "../lib/format";
import {
  DEMO_OVERRIDES,
  STATUS_LABEL,
  workflowStatus,
  statusCause,
  isApPeriodLocked,
  sourceChannelFor,
  urgencyScore,
} from "../lib/billStatus";
import { useBills } from "../state/BillsContext";
import AiChatDrawer, { SparkleIcon as DrawerSparkle } from "./AiChatDrawer";
import SummaryDrawer from "./SummaryDrawer";
import { computeBillsInsights, makeBillsAiContext } from "./ai-bills-context";
import "./modules.css";
import "./invoices-ledger.css";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtRp(n) {
  if (n == null) return "—";
  return n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

function toRow(b) {
  const v = vendors.find((x) => x.id === b.vendor);
  const dOver = daysSince(b.due);
  return {
    id: b.id,
    no: b.invNo === "—" || !b.invNo ? b.id : b.invNo,
    tgl: formatDate(b.date),
    co: b.vendorName,
    addr: v?.address || "",
    due: formatDate(b.due),
    daysOverdue: dOver,
    total: b.total,
    sisa: b.sisa,
    approval: b.approval,
    pay: b.pay,
    grn: b.grn,
    isAI: b.isAI,
    raw: b,
  };
}

const AGING_BUCKETS = [
  { key: "90+",    lbl: "Overdue > 90 days",    minDays: 90, maxDaysCap: 150, tone: "danger" },
  { key: "60-90",  lbl: "Overdue 60-90 days", minDays: 60, maxDaysCap: 90,  tone: "danger" },
  { key: "30-60",  lbl: "Overdue 30-60 days", minDays: 30, maxDaysCap: 60,  tone: "warn"   },
  { key: "0-30",   lbl: "Overdue < 30 days",    minDays:  0, maxDaysCap: 30,  tone: "warn"   },
];
function bucketOf(d) {
  if (d >= 90) return "90+";
  if (d >= 60) return "60-90";
  if (d >= 30) return "30-60";
  if (d >= 0)  return "0-30";
  return null;
}

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatMonthLabel(yyyymm) {
  if (!yyyymm || yyyymm.length < 7) return "—";
  const [y, m] = yyyymm.split("-");
  return `${MONTHS_EN[parseInt(m, 10) - 1] || m} ${y}`;
}

// ─── Components ─────────────────────────────────────────────────────────────

function SparkleIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 1.5l1.1 2.7L9.8 5l-2.7 0.8L6 8.5l-1.1-2.7L2.2 5l2.7-0.8L6 1.5z" />
      <path d="M10 8.5l0.4 1L11.5 10l-1.1 0.4L10 11.5l-0.4-1.1L8.5 10l1.1-0.5L10 8.5z" />
    </svg>
  );
}

function SourceChannelIcon({ channel }) {
  const titleByChannel = {
    email: "Ingested from email",
    upload: "Uploaded manually",
    recurring: "Recurring bill from template",
  };
  return (
    <span className={`bp-source-icon bp-source-${channel}`} title={titleByChannel[channel] || channel} aria-label={titleByChannel[channel] || channel}>
      {channel === "email" && (
        <svg viewBox="0 0 12 12" aria-hidden><rect x="1.5" y="2.5" width="9" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2"/><path d="M2 3.2l4 3 4-3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
      )}
      {channel === "upload" && (
        <svg viewBox="0 0 12 12" aria-hidden><path d="M6 8V2M3.5 4.5L6 2l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M2.5 9h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
      )}
      {channel === "recurring" && (
        <svg viewBox="0 0 12 12" aria-hidden><path d="M2 6a4 4 0 0 1 6.8-2.8M10 6a4 4 0 0 1-6.8 2.8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><polyline points="8.4 1.2 8.8 3.2 6.8 3.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><polyline points="3.6 10.8 3.2 8.8 5.2 8.8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
      )}
    </span>
  );
}

// Compute the floating-preview position from the mouse coordinates so the card
// hugs the cursor (right of it if room exists; flipped to the left otherwise).
function computeVendorTooltipStyle(t) {
  const TT_W = 280;
  const TT_H = 150;
  const OFFSET = 12;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  let left = t.x + OFFSET;
  if (left + TT_W > vw - 12) left = t.x - OFFSET - TT_W;
  if (left < 12) left = 12;
  let top = t.y + OFFSET;
  if (top + TT_H > vh - 12) top = t.y - OFFSET - TT_H;
  if (top < 60) top = 60;
  return { left: left + "px", top: top + "px" };
}

function computePreviewStyle(preview) {
  const PREVIEW_W = 170;
  const PREVIEW_H = 220;
  const OFFSET = 14;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  let left = preview.x + OFFSET;
  if (left + PREVIEW_W > vw - 12) left = preview.x - OFFSET - PREVIEW_W;
  if (left < 12) left = 12;
  let top = preview.y - 20;
  if (top + PREVIEW_H > vh - 12) top = vh - PREVIEW_H - 12;
  if (top < 60) top = 60;
  return { left: left + "px", top: top + "px" };
}

function BpAnomalyDot({ anomalies }) {
  if (!anomalies || anomalies.length === 0) {
    return <span className="bp-anom-dot empty" aria-hidden />;
  }
  const order = { high: 3, medium: 2, low: 1 };
  const top = anomalies.reduce((a, b) => (order[b.severity] > order[a.severity] ? b : a), anomalies[0]);
  const title = anomalies.length === 1
    ? top.description
    : anomalies.map((a) => `• ${a.description}`).join("\n");
  return <span className={`bp-anom-dot sev-${top.severity}`} title={title} aria-label={title} />;
}

function LedgerRow({ r, bucket, isChecked, onCheck, onClick, onKebab, isSelected, isAlt, onIdHover, onIdLeave, onVendorHover, onVendorLeave, showAgingBar }) {
  const isOverdue = r.pay === "overdue" && r.daysOverdue > 0;
  const isPaid = r.pay === "paid";
  const ws = workflowStatus(r.raw);
  const causeText = statusCause(r.raw);
  const statusLabel = STATUS_LABEL[ws] || ws;
  const pct = isOverdue && bucket
    ? Math.min(100, Math.max(8, ((r.daysOverdue - bucket.minDays) / ((bucket.maxDaysCap - bucket.minDays) || 30)) * 100))
    : 0;
  const statusToneClass =
    ws === "EXCEPTION" || ws === "RETURNED" ? "danger" :
    ws === "ON_HOLD" ? "warn" :
    ws === "PAID" ? "success" :
    ws === "APPROVED" ? "approved" :
    ws === "DRAFT" ? "muted" :
    "";
  return (
    <div
      className={`lg-row${isSelected ? " selected" : ""}${isAlt ? " alt" : ""}`}
      onClick={onClick}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" className="lg-row-check" checked={isChecked} onChange={() => onCheck(r.id)} />
      </div>
      <div className="lg-cell-no">
        <SourceChannelIcon channel={sourceChannelFor(r.raw)} />
        <span
          className="lg-cell-no-text bp-cell-no-trigger"
          onMouseEnter={(e) => onIdHover && onIdHover(r, e.clientX, e.clientY)}
          onMouseLeave={() => onIdLeave && onIdLeave()}
        >{r.no}</span>
      </div>
      <div className="lg-cell-date bp-cell-date">
        <div>{r.tgl}</div>
        {isOverdue && <div className="bp-cell-date-late">{r.daysOverdue}d late</div>}
      </div>
      <div className="lg-cell-customer">
        <span
          className="bp-cell-vendor-name"
          onMouseEnter={(e) => onVendorHover && onVendorHover(r.raw, e.clientX, e.clientY)}
          onMouseLeave={() => onVendorLeave && onVendorLeave()}
        >
          {r.co}
        </span>
      </div>
      <div className="lg-cell-due">{r.due}</div>
      <div className="bp-status-cell">
        <BpAnomalyDot anomalies={r.raw?.anomalies} />
        <div className="bp-status-cell-body">
          <div className={`bp-status-label${statusToneClass ? " " + statusToneClass : ""}`}>{statusLabel}</div>
          {causeText && <div className="bp-status-cause">{causeText}</div>}
          {showAgingBar && isOverdue && bucket && (
            <div className="bp-status-aging">
              <div className="lg-cell-aging-track">
                <div className={`lg-cell-aging-fill${bucket?.tone === "warn" ? " warn" : ""}`} style={{ width: pct + "%" }} />
              </div>
              <div className="lg-cell-aging-scale">{bucket.minDays} ←—— {bucket.maxDaysCap} days</div>
            </div>
          )}
        </div>
      </div>
      <div className="lg-cell-total">
        <span className="lg-cell-total-rp">Rp</span>{fmtRp(r.total)}
      </div>
      <div className="lg-cell-kebab" onClick={(e) => e.stopPropagation()}>
        <button className="lg-kebab" onClick={() => onKebab(r.id)}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
        </button>
      </div>
    </div>
  );
}

function RowMenu({ inv, onClose, onAction }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);
  const canApprove = inv.approval === "review" || inv.approval === "draft";
  const canPay = inv.approval === "approved" && inv.pay !== "paid";
  return (
    <div className="row-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <div className="row-menu-item" onClick={() => onAction("edit", inv)}>
        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Edit
      </div>
      {canApprove && (
        <div className="row-menu-item" onClick={() => onAction("approve", inv)}>
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          Approve
        </div>
      )}
      {canPay && (
        <div className="row-menu-item" onClick={() => onAction("pay", inv)}>
          <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          Record Payment
        </div>
      )}
      <div className="row-menu-item" onClick={() => onAction("duplicate", inv)}>
        <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        Duplicate
      </div>
      <div className="row-menu-sep" />
      <div className="row-menu-item danger" onClick={() => onAction("archive", inv)}>
        <svg viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
        Archive
      </div>
    </div>
  );
}

const SORT_LABELS = {
  "urgency-desc":  "Urgency ↓",
  "days-late-desc": "Days Overdue ↓",
  "date-desc":    "Newest date ↓",
  "date-asc":     "Date oldest ↑",
  "total-desc":      "Total highest ↓",
  "total-asc":       "Total lowest ↑",
  "vendor-asc":      "Vendor A-Z",
  "vendor-desc":     "Vendor Z-A",
};

const GROUP_LABELS = {
  "none":   "—",
  "aging":  "Aging",
  "vendor": "Vendor",
  "bulan":  "Month",
  "status": "Payment Status",
};

function useClickOutside(ref, onClose) {
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [ref, onClose]);
}

function SortPopover({ value, onPick, onClose }) {
  const ref = useRef(null);
  useClickOutside(ref, onClose);
  return (
    <div className="lg-popover" ref={ref}>
      <div className="lg-popover-list">
        {Object.entries(SORT_LABELS).map(([k, lbl]) => (
          <button key={k} className={`lg-popover-item${value === k ? " selected" : ""}`} onClick={() => onPick(k)}>
            {lbl}
            {value === k && <svg className="lg-popover-check" viewBox="0 0 12 12"><polyline points="2 6 5 9 10 3"/></svg>}
          </button>
        ))}
      </div>
    </div>
  );
}

function GroupPopover({ value, canAging, onPick, onClose }) {
  const ref = useRef(null);
  useClickOutside(ref, onClose);
  const items = [
    { k: "none",   lbl: "Not grouped" },
    { k: "aging",  lbl: "Aging", disabled: !canAging },
    { k: "vendor", lbl: "Vendor" },
    { k: "bulan",  lbl: "Month (Bill Date)" },
    { k: "status", lbl: "Payment Status" },
  ];
  return (
    <div className="lg-popover" ref={ref}>
      <div className="lg-popover-list">
        {items.map((it) => (
          <button key={it.k} className={`lg-popover-item${value === it.k ? " selected" : ""}`} disabled={it.disabled} onClick={() => !it.disabled && onPick(it.k)}>
            {it.lbl}
            {value === it.k && <svg className="lg-popover-check" viewBox="0 0 12 12"><polyline points="2 6 5 9 10 3"/></svg>}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterPopover({ values, onChange, vendors: vendorList, anomalyOnly, onAnomalyToggle, anomalyCount, onClose }) {
  const ref = useRef(null);
  useClickOutside(ref, onClose);
  const [draft, setDraft] = useState(values);
  const [vendorSearch, setVendorSearch] = useState("");
  const [draftAnomaly, setDraftAnomaly] = useState(!!anomalyOnly);

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const toggleVendor = (id) => setDraft((d) => {
    const next = new Set(d.vendors);
    next.has(id) ? next.delete(id) : next.add(id);
    return { ...d, vendors: next };
  });
  const filteredV = vendorList.filter((v) => !vendorSearch || v.name.toLowerCase().includes(vendorSearch.toLowerCase()));
  const reset = () => { setDraft({ vendors: new Set(), minAmount: "", maxAmount: "", dateFrom: "", dateTo: "", dateField: "date", grn: "all" }); setDraftAnomaly(false); };
  const apply = () => { onChange(draft); onAnomalyToggle(draftAnomaly); onClose(); };

  return (
    <div className="lg-popover lg-filter-pop" ref={ref}>
      <div className="lg-filter-body">
        <div className="lg-filter-fld">
          <label className="bp-filter-anom-row">
            <input type="checkbox" checked={draftAnomaly} onChange={(e) => setDraftAnomaly(e.target.checked)} />
            <span className="bp-filter-anom-text">Only show bills with anomalies</span>
            {anomalyCount > 0 && <span className="bp-filter-anom-count">{anomalyCount}</span>}
          </label>
        </div>
        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Vendor ({draft.vendors.size > 0 ? `${draft.vendors.size} selected` : "all"})</div>
          <div className="lg-cust-multi">
            <div className="lg-cust-search">
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="5" cy="5" r="3"/><path d="M7.5 7.5l3 3"/></svg>
              <input value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)} placeholder="Search vendor…" />
            </div>
            <div className="lg-cust-list">
              {filteredV.length === 0 && <div className="lg-cust-empty">No vendors match</div>}
              {filteredV.map((v) => (
                <label key={v.id} className="lg-cust-item">
                  <input type="checkbox" checked={draft.vendors.has(v.id)} onChange={() => toggleVendor(v.id)} />
                  <span className="lg-cust-item-name">{v.name}</span>
                  <span className="lg-cust-item-count">{v.count}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Amount range (Rp)</div>
          <div className="lg-filter-row2">
            <input type="number" className="lg-filter-input" placeholder="Min" value={draft.minAmount} onChange={(e) => update({ minAmount: e.target.value })} />
            <span style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>—</span>
            <input type="number" className="lg-filter-input" placeholder="Max" value={draft.maxAmount} onChange={(e) => update({ maxAmount: e.target.value })} />
          </div>
        </div>

        <div className="lg-filter-fld">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="lg-filter-fld-lbl">Date range</div>
            <div className="lg-segmented">
              <button className={`lg-seg${draft.dateField === "date" ? " on" : ""}`} onClick={() => update({ dateField: "date" })}>Bill Date</button>
              <button className={`lg-seg${draft.dateField === "due" ? " on" : ""}`} onClick={() => update({ dateField: "due" })}>Due Date</button>
            </div>
          </div>
          <div className="lg-filter-row2">
            <input type="date" className="lg-filter-input" value={draft.dateFrom} onChange={(e) => update({ dateFrom: e.target.value })} />
            <span style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>—</span>
            <input type="date" className="lg-filter-input" value={draft.dateTo} onChange={(e) => update({ dateTo: e.target.value })} />
          </div>
        </div>

        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">GRN Status</div>
          <div className="lg-toggle-row">
            {[["all", "All"], ["matched", "Matched"], ["pending", "Pending"], ["mismatch", "Mismatch"]].map(([k, lbl]) => (
              <button key={k} className={`lg-toggle${draft.grn === k ? " on" : ""}`} onClick={() => update({ grn: k })}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="lg-filter-foot">
        <button className="lg-filter-reset" onClick={reset}>Reset</button>
        <button className="lg-filter-apply" onClick={apply}>Apply filter</button>
      </div>
    </div>
  );
}

function BillsSummaryCard({ insights, onOpenSummary, onAskAboutInsight, summaryActive }) {
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);
  useEffect(() => {
    if (insights.length <= 1) return;
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIdx((i) => (i + 1) % insights.length);
        setFading(false);
      }, 220);
    }, 7000);
    return () => clearInterval(id);
  }, [insights.length]);
  useEffect(() => { if (idx >= insights.length) setIdx(0); }, [insights.length, idx]);

  const current = insights[idx] || insights[0];
  const todayLbl = formatDate(TODAY.toISOString().slice(0, 10));
  const actionLabel = current?.cta || "Ask Klay AI";

  return (
    <div className="bp-kpi-card bp-kpi-summary">
      <div className="bp-kpi-summary-top">
        <div className="bp-kpi-summary-eyebrow">
          <SparkleIcon size={12} /> YOUR TASKS
        </div>
        <button
          type="button"
          className={`bp-kpi-summary-seeall${summaryActive ? " active" : ""}`}
          onClick={onOpenSummary}
        >
          See all
        </button>
      </div>
      <div className={`bp-kpi-summary-body${fading ? " fading" : ""}`}>
        {current?.node}
      </div>
      <div className="bp-kpi-summary-asof">as of {todayLbl}</div>
      <div className="bp-kpi-summary-foot">
        <span className="bp-kpi-summary-dots" aria-hidden>
          {insights.length > 1 && insights.map((_, i) => (
            <span key={i} className={`bp-kpi-summary-dot${i === idx ? " on" : ""}`} />
          ))}
        </span>
        <button
          type="button"
          className="bp-kpi-cta bp-kpi-cta-action"
          onClick={() => onAskAboutInsight(current)}
        >
          {actionLabel} →
        </button>
      </div>
    </div>
  );
}

function BillsAiSearchPanel({ search, rows }) {
  const q = (search || "").trim();
  if (!q) return null;
  if (rows.length < 1 || rows.length > 10) return null;

  const vendorSet = new Set(rows.map((r) => r.co));
  const singleVendor = vendorSet.size === 1 ? rows[0].co : null;

  let oldestDue = null;
  for (const r of rows) {
    const d = r.raw?.due;
    if (!d) continue;
    if (!oldestDue || d < oldestDue) oldestDue = d;
  }

  const counts = { review: 0, paid: 0, draft: 0, approved: 0 };
  for (const r of rows) {
    if (r.pay === "paid") counts.paid += 1;
    else if (r.approval === "review") counts.review += 1;
    else if (r.approval === "draft") counts.draft += 1;
    else counts.approved += 1;
  }
  const workflowParts = [];
  if (counts.review) workflowParts.push(`${counts.review} in review`);
  if (counts.approved) workflowParts.push(`${counts.approved} approved`);
  if (counts.draft) workflowParts.push(`${counts.draft} draft`);
  if (counts.paid) workflowParts.push(`${counts.paid} paid`);
  const workflowSummary = workflowParts.join(", ");

  const stuck = rows.find((r) => r.pay === "overdue" || (r.approval === "review" && r.raw?.pay !== "paid"));
  let scriptLine = null;
  if (stuck) {
    if (stuck.approval === "review") {
      scriptLine = `For vendor: 'Invoice is being reviewed by the Finance Manager, opened ${stuck.daysOverdue > 0 ? `${stuck.daysOverdue} days ago` : "recently"} — likely paid in Thursday's batch payment.'`;
    } else if (stuck.daysOverdue > 0) {
      scriptLine = `For vendor: 'Bill ${stuck.no} is ${stuck.daysOverdue} days overdue — being processed for this Thursday's batch payment.'`;
    }
  }

  return (
    <div className="bp-ai-panel">
      {singleVendor && <div className="bp-ai-panel-vendor">{singleVendor}</div>}
      <div className="bp-ai-panel-body">
        {rows.length} {rows.length === 1 ? "bill matches" : "bills match"}
        {oldestDue ? ` · oldest due ${formatDate(oldestDue)}` : ""}
        {workflowSummary ? ` · ${workflowSummary}` : ""}
      </div>
      {scriptLine && (
        <div className="bp-ai-panel-script">
          <svg viewBox="0 0 12 12" aria-hidden><path d="M2 3h8v5H6.5L4 10.5V8H2z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
          <span>{scriptLine}</span>
        </div>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function BillsPage() {
  const navigate = useNavigate();
  const { bills } = useBills();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState({ kind: "tab", value: "semua" });
  const [anomalyFilter, setAnomalyFilter] = useState(false);
  const [closePopoverOpen, setClosePopoverOpen] = useState(false);
  const closePopoverRef = useRef(null);
  useEffect(() => {
    if (!closePopoverOpen) return;
    const onDoc = (e) => { if (closePopoverRef.current && !closePopoverRef.current.contains(e.target)) setClosePopoverOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [closePopoverOpen]);
  const [sortChoice, setSortChoice] = useState(null);
  const [groupChoice, setGroupChoice] = useState(null);
  const emptyFilters = { vendors: new Set(), minAmount: "", maxAmount: "", dateFrom: "", dateTo: "", dateField: "date", grn: "all" };
  const [filterValues, setFilterValues] = useState(emptyFilters);

  const [checked, setChecked] = useState(() => new Set());
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());

  const [sortPopOpen, setSortPopOpen] = useState(false);
  const [groupPopOpen, setGroupPopOpen] = useState(false);
  const [filterPopOpen, setFilterPopOpen] = useState(false);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiSeedQuestion, setAiSeedQuestion] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const [toast, setToast] = useState("");
  const toastTmr = useRef(null);

  // Row-hover preview card — fires only over the Bill ID cell. After dismiss
  // is requested (mouse leaves the cell or the preview) we wait briefly so the
  // user can move the cursor onto the preview without it vanishing.
  const [hoverPreview, setHoverPreview] = useState(null); // { row, x, y }
  const showTmr = useRef(null);
  const dismissTmr = useRef(null);
  function onIdHover(row, x, y) {
    if (dismissTmr.current) { clearTimeout(dismissTmr.current); dismissTmr.current = null; }
    if (showTmr.current) clearTimeout(showTmr.current);
    showTmr.current = setTimeout(() => setHoverPreview({ row, x, y }), 300);
  }
  function onIdLeave() {
    if (showTmr.current) { clearTimeout(showTmr.current); showTmr.current = null; }
    if (dismissTmr.current) clearTimeout(dismissTmr.current);
    dismissTmr.current = setTimeout(() => setHoverPreview(null), 180);
  }
  function onPreviewEnter() {
    if (showTmr.current) clearTimeout(showTmr.current);
    if (dismissTmr.current) { clearTimeout(dismissTmr.current); dismissTmr.current = null; }
  }
  function onPreviewLeave() {
    if (dismissTmr.current) clearTimeout(dismissTmr.current);
    dismissTmr.current = setTimeout(() => setHoverPreview(null), 120);
  }

  // Vendor-hover tooltip — name + address + contact + phone + email
  const [vendorHover, setVendorHover] = useState(null); // { vendor, x, y }
  const vendorShowTmr = useRef(null);
  const vendorDismissTmr = useRef(null);
  function onVendorHover(billRaw, x, y) {
    const vendorRec = vendors.find((v) => v.id === billRaw.vendor) || { name: billRaw.vendorName };
    if (vendorDismissTmr.current) clearTimeout(vendorDismissTmr.current);
    if (vendorShowTmr.current) clearTimeout(vendorShowTmr.current);
    vendorShowTmr.current = setTimeout(() => setVendorHover({ vendor: vendorRec, x, y }), 250);
  }
  function onVendorLeave() {
    if (vendorShowTmr.current) clearTimeout(vendorShowTmr.current);
    if (vendorDismissTmr.current) clearTimeout(vendorDismissTmr.current);
    vendorDismissTmr.current = setTimeout(() => setVendorHover(null), 150);
  }
  function showToast(msg) {
    setToast(msg);
    if (toastTmr.current) clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToast(""), 1800);
  }

  const monthPfx = useMemo(() => `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, "0")}`, []);

  // ── KPIs ───────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const active = bills.filter((b) => b.pay !== "paid");
    const totalAP = active.reduce((s, b) => s + b.sisa, 0);
    const overdue = bills.filter((b) => b.pay === "overdue");
    const overdueThisMonth = overdue.filter((b) => b.due && b.due.startsWith(monthPfx));
    const thisMonth = bills.filter((b) => b.date && b.date.startsWith(monthPfx));
    return [
      { lbl: "Total AP",        card: "total",        val: "Rp " + fmtRp(totalAP),                                       sub: active.length + " bill active",                                       tone: "primary" },
      { lbl: "Overdue",           card: "overdue",      val: "Rp " + fmtRp(overdue.reduce((s, b) => s + b.sisa, 0)),       sub: overdue.length + " bill late",                                       tone: "danger"  },
      { lbl: "Overdue Month Ini", card: "overdueMonth", val: String(overdueThisMonth.length),                              sub: "Rp " + fmtRp(overdueThisMonth.reduce((s, b) => s + b.sisa, 0)),      tone: "warn"    },
      { lbl: "Created This Month",      card: "thisMonth",    val: "Rp " + fmtRp(thisMonth.reduce((s, b) => s + b.total, 0)),    sub: thisMonth.length + " new bill",                                      tone: "primary" },
    ];
  }, [monthPfx]);

  const insights = useMemo(() => computeBillsInsights(bills), [bills]);
  const aiContext = useMemo(() => makeBillsAiContext(bills), [bills]);

  // ── New Bills summary stats (for SUMMARY + Perlu Dibayar / Pending Review / Draft / AP Outstanding cards)
  // Period-locked bills are excluded from "Due for Payment" per PRD — they can't be posted in their current state.
  const billStats = useMemo(() => {
    const verifiedReady = bills.filter((b) => b.approval === "approved" && b.pay === "unpaid" && !isApPeriodLocked(b.date));
    const verifiedReadySum = verifiedReady.reduce((s, b) => s + b.total, 0);
    const perluDibayar = bills.filter((b) => b.approval === "approved" && b.pay !== "paid" && !isApPeriodLocked(b.date));
    const perluDibayarSum = perluDibayar.reduce((s, b) => s + b.sisa, 0);
    const reviewList = bills.filter((b) => b.approval === "review");
    const reviewSum = reviewList.reduce((s, b) => s + b.total, 0);
    const draftList = bills.filter((b) => b.approval === "draft");
    const draftSum = draftList.reduce((s, b) => s + b.total, 0);
    const outstanding = bills.filter((b) => b.pay !== "paid").reduce((s, b) => s + b.sisa, 0);
    return {
      verifiedReadyCount: verifiedReady.length,
      verifiedReadySum,
      perluDibayarCount: perluDibayar.length,
      perluDibayarSum,
      reviewCount: reviewList.length,
      reviewSum,
      draftCount: draftList.length,
      draftSum,
      outstanding,
    };
  }, [bills]);

  const todayLabel = useMemo(() => formatDate(TODAY.toISOString().slice(0, 10)), []);
  const monthLabel = useMemo(() => formatMonthLabel(monthPfx), [monthPfx]);

  // Bills in the current AP period that still block close (not yet paid+approved).
  const apClosePending = useMemo(() => (
    bills.filter((b) => b.date && b.date.startsWith(monthPfx) && (b.approval !== "approved" || b.pay !== "paid")).length
  ), [bills, monthPfx]);

  // Number of distinct blocker categories that have non-zero items (drives the CLOSE pill badge).
  const exceptionCount = useMemo(() => bills.filter((b) => workflowStatus(b) === "EXCEPTION").length, [bills]);
  const closeBlockerCount = (exceptionCount > 0 ? 1 : 0) + (apClosePending > 0 ? 1 : 0);

  function askAi(question) {
    setSummaryOpen(false);
    setAiSeedQuestion(question);
    setAiOpen(true);
  }

  // ── Tab counts ─────────────────────────────────────────────────────────
  const tabCounts = useMemo(() => {
    const byStatus = (s) => bills.filter((b) => workflowStatus(b) === s).length;
    return {
      semua:      bills.length,
      // Review tab includes PENDING_REVIEW + RETURNED (per PRD; pinned section disambiguates)
      review:     byStatus("PENDING_REVIEW") + byStatus("RETURNED"),
      approved:   byStatus("APPROVED"),
      draft:      byStatus("DRAFT"),
      jatuhtempo: bills.filter((b) => b.pay === "overdue" && workflowStatus(b) !== "EXCEPTION").length,
      lunas:      byStatus("PAID"),
      exception:  byStatus("EXCEPTION"),
    };
  }, [bills]);

  const tabs = [
    { k: "semua",      lbl: "All",        count: tabCounts.semua },
    { k: "review",     lbl: "Review",     count: tabCounts.review },
    { k: "approved",   lbl: "Approved",   count: tabCounts.approved },
    { k: "draft",      lbl: "Draft",      count: tabCounts.draft },
    { k: "jatuhtempo", lbl: "Overdue",    count: tabCounts.jatuhtempo },
    { k: "lunas",      lbl: "Paid",       count: tabCounts.lunas },
    { k: "exception",  lbl: "Exceptions", count: tabCounts.exception },
  ];

  // ── Corpus ─────────────────────────────────────────────────────────────
  const corpus = useMemo(() => {
    let list = bills;
    if (filter.kind === "tab") {
      if (filter.value === "approved")       list = list.filter((b) => workflowStatus(b) === "APPROVED");
      else if (filter.value === "review")    list = list.filter((b) => ["PENDING_REVIEW", "RETURNED"].includes(workflowStatus(b)));
      else if (filter.value === "draft")     list = list.filter((b) => workflowStatus(b) === "DRAFT");
      else if (filter.value === "jatuhtempo")list = list.filter((b) => b.pay === "overdue" && workflowStatus(b) !== "EXCEPTION");
      else if (filter.value === "lunas")     list = list.filter((b) => workflowStatus(b) === "PAID");
      else if (filter.value === "exception") list = list.filter((b) => workflowStatus(b) === "EXCEPTION");
    } else if (filter.kind === "card") {
      if (filter.value === "total")              list = list.filter((b) => b.pay !== "paid");
      else if (filter.value === "overdueMonth")  list = list.filter((b) => b.pay === "overdue" && b.due && b.due.startsWith(monthPfx));
      else if (filter.value === "thisMonth")     list = list.filter((b) => b.date && b.date.startsWith(monthPfx));
      else if (filter.value === "readyToPost")   list = list.filter((b) => b.approval === "approved" && b.pay === "unpaid");
      else if (filter.value === "perluDibayar")  list = list.filter((b) => b.approval === "approved" && b.pay !== "paid");
      else if (filter.value === "dueIn7") {
        const todayKey = TODAY.toISOString().slice(0, 10);
        const in7 = new Date(TODAY);
        in7.setDate(TODAY.getDate() + 7);
        const in7Key = in7.toISOString().slice(0, 10);
        list = list.filter((b) => b.pay !== "paid" && b.approval === "approved" && b.due && b.due > todayKey && b.due <= in7Key);
      }
      else if (filter.value === "allUnpaid")     list = list.filter((b) => b.pay !== "paid");
      else if (filter.value === "apClose")       list = list.filter((b) => b.date && b.date.startsWith(monthPfx) && (b.approval !== "approved" || b.pay !== "paid"));
      else if (filter.value === "periodLocked")  list = list.filter((b) => isApPeriodLocked(b.date) && (b.approval === "review" || (b.approval === "approved" && b.pay !== "paid")));
    }
    return list;
  }, [filter, monthPfx, bills]);

  const vendorsInCorpus = useMemo(() => {
    const counts = new Map();
    for (const b of corpus) {
      const v = vendors.find((x) => x.id === b.vendor);
      if (!v) continue;
      const prev = counts.get(v.id) || { id: v.id, name: v.name, count: 0 };
      prev.count += 1;
      counts.set(v.id, prev);
    }
    return Array.from(counts.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [corpus]);

  const hasActiveFilters = useMemo(() => (
    filterValues.vendors.size > 0 ||
    filterValues.minAmount !== "" ||
    filterValues.maxAmount !== "" ||
    filterValues.dateFrom !== "" ||
    filterValues.dateTo !== "" ||
    filterValues.grn !== "all" ||
    sortChoice !== null ||
    groupChoice !== null
  ), [filterValues, sortChoice, groupChoice]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterValues.vendors.size > 0) n++;
    if (filterValues.minAmount !== "" || filterValues.maxAmount !== "") n++;
    if (filterValues.dateFrom !== "" || filterValues.dateTo !== "") n++;
    if (filterValues.grn !== "all") n++;
    return n;
  }, [filterValues]);

  // ── Apply filter values + text search ──────────────────────────────────
  const filteredRows = useMemo(() => {
    let list = corpus;
    if (filterValues.vendors.size > 0) list = list.filter((b) => filterValues.vendors.has(b.vendor));
    const min = filterValues.minAmount === "" ? null : Number(filterValues.minAmount);
    const max = filterValues.maxAmount === "" ? null : Number(filterValues.maxAmount);
    if (min != null && !isNaN(min)) list = list.filter((b) => b.total >= min);
    if (max != null && !isNaN(max)) list = list.filter((b) => b.total <= max);
    if (filterValues.dateFrom) list = list.filter((b) => (b[filterValues.dateField] || "") >= filterValues.dateFrom);
    if (filterValues.dateTo)   list = list.filter((b) => (b[filterValues.dateField] || "") <= filterValues.dateTo);
    if (filterValues.grn !== "all") list = list.filter((b) => b.grn === filterValues.grn);
    if (anomalyFilter) list = list.filter((b) => Array.isArray(b.anomalies) && b.anomalies.length > 0);

    const q = search.toLowerCase().trim();
    if (q) list = list.filter((b) =>
      b.id.toLowerCase().includes(q) ||
      (b.invNo && b.invNo.toLowerCase().includes(q)) ||
      b.vendorName.toLowerCase().includes(q) ||
      (b.poNo && b.poNo.toLowerCase().includes(q)),
    );
    return list.map(toRow);
  }, [corpus, filterValues, search, anomalyFilter]);

  const anomalyCountInCorpus = useMemo(
    () => corpus.filter((b) => Array.isArray(b.anomalies) && b.anomalies.length > 0).length,
    [corpus],
  );


  // ── Sort + Group ───────────────────────────────────────────────────────
  const onJatuhTempo = filter.kind === "tab" && filter.value === "jatuhtempo";
  const onPaid      = filter.kind === "tab" && filter.value === "lunas";
  const onDraft      = filter.kind === "tab" && filter.value === "draft";

  const effectiveSort  = sortChoice  || (onJatuhTempo ? "days-late-desc" : "urgency-desc");
  const effectiveGroup = groupChoice || (onJatuhTempo ? "aging" : "none");

  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    switch (effectiveSort) {
      case "urgency-desc": arr.sort((a, b) => urgencyScore(b.raw) - urgencyScore(a.raw)); break;
      case "days-late-desc": arr.sort((a, b) => b.daysOverdue - a.daysOverdue); break;
      case "date-desc":    arr.sort((a, b) => (b.raw.date || "").localeCompare(a.raw.date || "")); break;
      case "date-asc":     arr.sort((a, b) => (a.raw.date || "").localeCompare(b.raw.date || "")); break;
      case "total-desc":      arr.sort((a, b) => b.total - a.total); break;
      case "total-asc":       arr.sort((a, b) => a.total - b.total); break;
      case "vendor-asc":      arr.sort((a, b) => a.co.localeCompare(b.co)); break;
      case "vendor-desc":     arr.sort((a, b) => b.co.localeCompare(a.co)); break;
      default: break;
    }
    return arr;
  }, [filteredRows, effectiveSort]);

  const groups = useMemo(() => {
    if (effectiveGroup === "none") return null;
    if (effectiveGroup === "aging") {
      const byBucket = new Map();
      for (const b of AGING_BUCKETS) byBucket.set(b.key, []);
      for (const r of sortedRows) {
        const k = bucketOf(r.daysOverdue);
        if (k) byBucket.get(k).push(r);
      }
      return AGING_BUCKETS.map((b) => {
        const rows = byBucket.get(b.key);
        return { ...b, key: b.key, label: b.lbl, rows, sum: rows.reduce((s, r) => s + r.total, 0), kind: "aging" };
      }).filter((g) => g.rows.length > 0);
    }
    const keyFn = (r) => {
      if (effectiveGroup === "vendor") return r.co;
      if (effectiveGroup === "bulan") return (r.raw.date || "").slice(0, 7);
      if (effectiveGroup === "status") {
        if (r.pay === "paid") return "Paid";
        if (r.pay === "overdue") return "Overdue";
        if (r.approval === "draft") return "Draft";
        if (r.approval === "review") return "Review";
        return "Unpaid";
      }
      return "—";
    };
    const map = new Map();
    for (const r of sortedRows) {
      const k = keyFn(r);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    }
    return Array.from(map.entries()).map(([k, rows]) => ({
      key: k,
      label: effectiveGroup === "bulan" ? formatMonthLabel(k) : k,
      rows,
      sum: rows.reduce((s, r) => s + r.total, 0),
      tone: "muted",
      kind: effectiveGroup,
    }));
  }, [effectiveGroup, sortedRows]);

  const pageTotal = filteredRows.reduce((s, r) => s + r.total, 0);
  const selectedTotal = filteredRows.filter((r) => checked.has(r.id)).reduce((s, r) => s + r.total, 0);

  // ── Handlers ───────────────────────────────────────────────────────────
  function toggleRow(id) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleGroup(key) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  function clearChecks() { setChecked(new Set()); }
  function selectTab(t) { setFilter({ kind: "tab", value: t }); clearChecks(); }
  function selectCard(c) {
    if (c === null) setFilter({ kind: "tab", value: "semua" });
    else if (c === "overdue") setFilter({ kind: "tab", value: "jatuhtempo" });
    else setFilter({ kind: "card", value: c });
    clearChecks();
  }
  const isTabActive  = (t) => filter.kind === "tab"  && filter.value === t;
  const isCardActive = (c) => c === "overdue" ? filter.value === "jatuhtempo" : (filter.kind === "card" && filter.value === c);

  // ── Filter dispatchers for the rotating SUMMARY card CTA + the per-card CTAs ──
  function handleSummaryAction(insight) {
    if (!insight) return;
    clearChecks();
    setAnomalyFilter(false);
    switch (insight.id) {
      case "readyToPost":
        setFilter({ kind: "card", value: "readyToPost" });
        setSearch("");
        break;
      case "periodLocked":
        setFilter({ kind: "card", value: "periodLocked" });
        setSearch("");
        break;
      case "vendorConcentration":
      case "avgDpd":
        setFilter({ kind: "tab", value: "jatuhtempo" });
        setSearch("");
        break;
      case "cashflowOut":
        setFilter({ kind: "card", value: "dueIn7" });
        setSearch("");
        break;
      case "inReview":
        setFilter({ kind: "tab", value: "review" });
        setSearch("");
        break;
      case "largest":
        setFilter({ kind: "tab", value: "semua" });
        setSearch(insight.bill?.invNo && insight.bill.invNo !== "—" ? insight.bill.invNo : (insight.bill?.id || ""));
        break;
      case "empty":
      default:
        setFilter({ kind: "tab", value: "semua" });
        setSearch("");
        break;
    }
  }

  function resetAll() {
    setSortChoice(null);
    setGroupChoice(null);
    setFilterValues(emptyFilters);
    setSearch("");
  }

  function exportCsv() {
    const headers = ["Bill", "Vendor Invoice No.", "Date", "Vendor", "Address", "Overdue", "Days Overdue", "Total", "Approval", "Status Bayar"];
    const esc = (v) => {
      const s = String(v == null ? "" : v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of sortedRows) {
      lines.push([r.id, r.raw.invNo || "", r.tgl, r.co, r.addr, r.due, r.daysOverdue, r.total, r.approval, r.pay].map(esc).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = `${TODAY.getFullYear()}${String(TODAY.getMonth() + 1).padStart(2, "0")}${String(TODAY.getDate()).padStart(2, "0")}`;
    a.download = `klay-bills-${filter.value}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`${sortedRows.length} bill exported to CSV`);
  }

  function onRowAction(action, b) {
    setMenuOpenFor(null);
    if (action === "edit") showToast(`Edit ${b.id} (demo)`);
    else if (action === "approve") showToast(`${b.id} approved`);
    else if (action === "pay") showToast(`Recorded payment for ${b.id}`);
    else if (action === "duplicate") showToast(`Duplicated ${b.id}`);
    else if (action === "archive") showToast(`${b.id} archived`);
  }
  function onBulk(action) {
    const count = checked.size;
    if (action === "approve") showToast(`${count} bill${count === 1 ? "" : "s"} approved`);
    clearChecks();
  }

  return (
    <div className="lg-page">
      <div className="lg-scroll-container">
        {/* ── Editorial header ──────────────────────────────────────── */}
        <div className="lg-head">
          <div className="lg-head-top">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="lg-title">Bills</h1>
            </div>
            <div className="lg-head-actions">
              <div className="bp-close-wrap" ref={closePopoverRef}>
                <button
                  type="button"
                  className={`bp-close-pill${closePopoverOpen ? " open" : ""}`}
                  onClick={() => setClosePopoverOpen((o) => !o)}
                  aria-haspopup="true"
                  aria-expanded={closePopoverOpen}
                  title={`AP Close health — ${monthLabel} · ${closeBlockerCount} blocker${closeBlockerCount === 1 ? "" : "s"}`}
                >
                  <span className="bp-close-pill-dot" />
                  <span className="bp-close-pill-lbl">CLOSE · {monthLabel.toUpperCase()}</span>
                  {closeBlockerCount > 0 && (
                    <span className="bp-close-pill-badge">{closeBlockerCount} blocker{closeBlockerCount === 1 ? "" : "s"}</span>
                  )}
                  <svg viewBox="0 0 9 9" className="bp-close-pill-chev" aria-hidden><path d="M2 3.5l2.5 3L7 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                {closePopoverOpen && (
                  <div className="bp-close-popover" role="menu">
                    <div className="bp-close-popover-head">
                      <span className="bp-close-popover-dot" />
                      <div>
                        <div className="bp-close-popover-title">Close blockers · {monthLabel}</div>
                        <div className="bp-close-popover-sub">Items keeping this period open</div>
                      </div>
                    </div>
                    <div className="bp-close-popover-list">
                      <button
                        type="button"
                        className="bp-close-blocker"
                        onClick={() => { selectTab("exception"); setClosePopoverOpen(false); }}
                      >
                        <div className="bp-close-blocker-text">
                          <div className="bp-close-blocker-lbl">Exception bills unresolved</div>
                          <div className="bp-close-blocker-sub">{tabCounts.exception} bill{tabCounts.exception === 1 ? "" : "s"} need manual fix</div>
                        </div>
                        <span className="bp-close-blocker-cta">View →</span>
                      </button>
                      <button
                        type="button"
                        className="bp-close-blocker"
                        onClick={() => { selectCard("apClose"); setClosePopoverOpen(false); }}
                      >
                        <div className="bp-close-blocker-text">
                          <div className="bp-close-blocker-lbl">Bills in current period not posted</div>
                          <div className="bp-close-blocker-sub">{apClosePending} bill{apClosePending === 1 ? "" : "s"} still in review / awaiting approval</div>
                        </div>
                        <span className="bp-close-blocker-cta">View →</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button className="lg-btn-brand" onClick={() => navigate("/bills/new")}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create Bill
              </button>
            </div>
          </div>

          <div className="bp-kpi-wrap">
            <div className="bp-kpi-row">
              <BillsSummaryCard
                insights={insights}
                onOpenSummary={() => setSummaryOpen(true)}
                onAskAboutInsight={handleSummaryAction}
                summaryActive={summaryOpen}
              />

              <div className="bp-kpi-card">
                <div className="bp-kpi-lbl">Due for Payment</div>
                <div className="bp-kpi-val">{billStats.perluDibayarCount} · {formatRupiah(billStats.perluDibayarSum)}</div>
                <div className="bp-kpi-sub">Make payment now</div>
                <button type="button" className="bp-kpi-cta" onClick={() => selectCard("perluDibayar")}>View →</button>
              </div>

              <div className="bp-kpi-card">
                <div className="bp-kpi-lbl">Pending Review</div>
                <div className="bp-kpi-val">{billStats.reviewCount} · {formatRupiah(billStats.reviewSum)}</div>
                <div className="bp-kpi-sub">Review and approve</div>
                <button type="button" className="bp-kpi-cta" onClick={() => selectTab("review")}>View →</button>
              </div>

              <div className="bp-kpi-card">
                <div className="bp-kpi-lbl">Draft</div>
                <div className="bp-kpi-val">{billStats.draftCount} · {formatRupiah(billStats.draftSum)}</div>
                <div className="bp-kpi-sub">Submit for review</div>
                <button type="button" className="bp-kpi-cta" onClick={() => selectTab("draft")}>View →</button>
              </div>

              <div className="bp-kpi-card">
                <div className="bp-kpi-lbl">AP Outstanding</div>
                <div className="bp-kpi-val">{formatRupiah(billStats.outstanding)}</div>
                <div className="bp-kpi-sub">Plan upcoming payments</div>
                <button type="button" className="bp-kpi-cta" onClick={() => selectCard("allUnpaid")}>View →</button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Table card ─────────────────────────────────────────────── */}
        <div className="lg-table-wrap">
          <div className="lg-card bp-card">
            <div className="bp-tabs-row">
              {tabs.map((t) => (
                <button
                  key={t.k}
                  className={`bp-tab${isTabActive(t.k) ? " active" : ""}`}
                  onClick={() => selectTab(t.k)}
                >
                  {t.lbl}
                  <span className={`bp-tab-count${t.k === "jatuhtempo" && t.count > 0 ? " overdue" : ""}`}>{t.count}</span>
                </button>
              ))}
            </div>

            <div className="lg-filter-row">
              <div className="bp-ai-search">
                <span className="bp-ai-search-icon" aria-hidden><SparkleIcon size={13} /></span>
                <input
                  className="bp-ai-search-input"
                  placeholder="Search bill ID, vendor, invoice no., or ask Klay…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span className="bp-ai-search-hint" aria-hidden>⌘K</span>
              </div>
              <div className="lg-filter-meta">
                <div className="lg-meta-btn-wrap">
                  <button className={`lg-meta-btn${activeFilterCount + (anomalyFilter ? 1 : 0) > 0 ? " active" : ""}`} onClick={() => { setFilterPopOpen(!filterPopOpen); setSortPopOpen(false); setGroupPopOpen(false); }}>
                    <svg viewBox="0 0 12 12"><path d="M2 3h8M3 6h6M4 9h4" strokeLinecap="round"/></svg>
                    Filter
                    {activeFilterCount + (anomalyFilter ? 1 : 0) > 0 && <span className="lg-filter-badge">{activeFilterCount + (anomalyFilter ? 1 : 0)}</span>}
                  </button>
                  {filterPopOpen && (
                    <FilterPopover
                      values={filterValues}
                      onChange={setFilterValues}
                      vendors={vendorsInCorpus}
                      anomalyOnly={anomalyFilter}
                      onAnomalyToggle={setAnomalyFilter}
                      anomalyCount={anomalyCountInCorpus}
                      onClose={() => setFilterPopOpen(false)}
                    />
                  )}
                </div>
                <div className="lg-meta-btn-wrap">
                  <button className="lg-meta-btn" onClick={() => { setSortPopOpen(!sortPopOpen); setFilterPopOpen(false); setGroupPopOpen(false); }}>
                    <span className="meta-lbl">Sort:</span>
                    <span className="meta-val">{SORT_LABELS[effectiveSort]}</span>
                  </button>
                  {effectiveSort === "urgency-desc" && (
                    <span
                      className="bp-meta-hint"
                      title="Bills that need your attention today are shown first — based on overdue status, days until due, time in queue, anomalies, and review state."
                      aria-label="How urgency sort works"
                    >?</span>
                  )}
                  {sortPopOpen && (
                    <SortPopover value={effectiveSort} onPick={(v) => { setSortChoice(v); setSortPopOpen(false); }} onClose={() => setSortPopOpen(false)} />
                  )}
                </div>
                <div className="lg-meta-btn-wrap">
                  <button className="lg-meta-btn" onClick={() => { setGroupPopOpen(!groupPopOpen); setSortPopOpen(false); setFilterPopOpen(false); }}>
                    <span className="meta-lbl">Group:</span>
                    <span className="meta-val">{GROUP_LABELS[effectiveGroup]}</span>
                  </button>
                  {groupPopOpen && (
                    <GroupPopover value={effectiveGroup} canAging={!onPaid && !onDraft} onPick={(v) => { setGroupChoice(v); setGroupPopOpen(false); }} onClose={() => setGroupPopOpen(false)} />
                  )}
                </div>
                {hasActiveFilters && <button className="lg-reset-all" onClick={resetAll}>Reset all</button>}
              </div>
            </div>

            <BillsAiSearchPanel search={search} rows={filteredRows} />

            <div className="lg-col-header bp-col-header">
              <div><input type="checkbox" className="lg-row-check" disabled /></div>
              <div>Bill / Invoice</div>
              <div>Date</div>
              <div>Vendor</div>
              <div>Due Date</div>
              <div>Status</div>
              <div style={{ textAlign: "right" }}>Total · IDR</div>
              <div />
            </div>

            {effectiveSort === "urgency-desc" && (
              <div className="bp-sort-hint">
                <svg viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.2"/><path d="M6 3.5v2.5M6 8.2v.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                <span>
                  Sorted by priority — <strong>blocked items</strong> first, then bills <strong>needing your review</strong>, then <strong>aging items</strong>, then the payment pipeline.
                </span>
              </div>
            )}

            <div>
              {groups ? (
                groups.map((g) => {
                  const isCollapsed = collapsedGroups.has(g.key);
                  const isAging = g.kind === "aging";
                  return (
                    <div key={g.key}>
                      <div className={`lg-group-head${!isAging ? " muted" : ""}`} onClick={() => toggleGroup(g.key)}>
                        <div className="lg-group-left">
                          <svg className={`lg-group-chevron${isCollapsed ? " closed" : ""}`} viewBox="0 0 9 9"><path d="M2 3l2.5 3L7 3"/></svg>
                          <span className={`lg-group-lbl${isAging ? (g.tone === "danger" ? " danger" : " warn") : ""}`}>{g.label}</span>
                          <span className={`lg-group-count${isAging ? (g.tone === "danger" ? " danger" : " warn") : ""}`}>{g.rows.length}</span>
                        </div>
                        <div className="lg-group-subtotal">
                          <span className="lg-group-subtotal-lbl">Subtotal</span>
                          Rp {fmtRp(g.sum)}
                        </div>
                      </div>
                      {!isCollapsed && g.rows.map((r, i) => {
                        const isOverdue = r.pay === "overdue" && r.daysOverdue > 0;
                        const rowBucket = isAging ? g : (
                          isOverdue ? {
                            minDays: r.daysOverdue >= 90 ? 90 : r.daysOverdue >= 60 ? 60 : r.daysOverdue >= 30 ? 30 : 0,
                            maxDaysCap: r.daysOverdue >= 90 ? 150 : r.daysOverdue >= 60 ? 90 : r.daysOverdue >= 30 ? 60 : 30,
                            tone: r.daysOverdue >= 60 ? "danger" : "warn",
                          } : null
                        );
                        return (
                          <div key={r.id} style={{ position: "relative" }}>
                            <LedgerRow
                              r={r}
                              bucket={rowBucket}
                              isChecked={checked.has(r.id)}
                              onCheck={toggleRow}
                              onClick={() => navigate(`/bills/${r.id}`)}
                              onKebab={(id) => setMenuOpenFor(menuOpenFor === id ? null : id)}
                              isAlt={i % 2 === 1}
                              onIdHover={onIdHover}
                              onIdLeave={onIdLeave}
                              onVendorHover={onVendorHover}
                              onVendorLeave={onVendorLeave}
                              showAgingBar={onJatuhTempo}
                            />
                            {menuOpenFor === r.id && (
                              <div style={{ position: "absolute", right: 32, top: 32, zIndex: 5 }}>
                                <RowMenu inv={r.raw} onClose={() => setMenuOpenFor(null)} onAction={onRowAction} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              ) : (
                <>
                  {sortedRows.length === 0 && <div className="lg-empty">No bills match</div>}
                  {sortedRows.map((r, i) => {
                    const isOverdue = r.pay === "overdue" && r.daysOverdue > 0;
                    const bucket = isOverdue ? {
                      minDays: r.daysOverdue >= 90 ? 90 : r.daysOverdue >= 60 ? 60 : r.daysOverdue >= 30 ? 30 : 0,
                      maxDaysCap: r.daysOverdue >= 90 ? 150 : r.daysOverdue >= 60 ? 90 : r.daysOverdue >= 30 ? 60 : 30,
                      tone: r.daysOverdue >= 60 ? "danger" : "warn",
                    } : null;
                    return (
                      <div key={r.id} style={{ position: "relative" }}>
                        <LedgerRow
                          r={r}
                          bucket={bucket}
                          isChecked={checked.has(r.id)}
                          onCheck={toggleRow}
                          onClick={() => navigate(`/bills/${r.id}`)}
                          onKebab={(id) => setMenuOpenFor(menuOpenFor === id ? null : id)}
                          isAlt={i % 2 === 1}
                          onIdHover={onIdHover}
                          onIdLeave={onIdLeave}
                          onVendorHover={onVendorHover}
                          onVendorLeave={onVendorLeave}
                          showAgingBar={onJatuhTempo}
                        />
                        {menuOpenFor === r.id && (
                          <div style={{ position: "absolute", right: 32, top: 32, zIndex: 5 }}>
                            <RowMenu inv={r.raw} onClose={() => setMenuOpenFor(null)} onAction={onRowAction} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      </div>{/* /lg-scroll-container */}

      {/* ── Sticky footer ──────────────────────────────────────────── */}
      <div className="lg-footer">
        <div className="lg-footer-left">
          <span><span className="lg-footer-num">{checked.size}</span> selected</span>
          {checked.size > 0 ? (
            <>
              <button className="lg-footer-bulk-btn" onClick={() => onBulk("approve")}>Approve</button>
              <button className="lg-footer-clear" onClick={clearChecks}>Clear selection</button>
            </>
          ) : (
            <>
              <span className="lg-footer-sep">·</span>
              <span>Showing <span className="lg-footer-num">{filteredRows.length}</span> bills</span>
            </>
          )}
        </div>
        <div className="lg-footer-right">
          <button className="lg-footer-export" onClick={exportCsv} title="Export the rows shown above to CSV">
            <svg viewBox="0 0 12 12"><path d="M6 2v6M3 6l3 3 3-3M2 10.5h8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Export {checked.size > 0 ? `${checked.size} selected` : `${filteredRows.length} visible`}
          </button>
          <span className="lg-footer-sep">·</span>
          <span className="lg-footer-lbl">{checked.size > 0 ? "Subtotal selected" : "Subtotal page"}</span>
          <span className="lg-footer-total">Rp {fmtRp(checked.size > 0 ? selectedTotal : pageTotal)}</span>
        </div>
      </div>

      {/* ── Klay AI drawers ────────────────────────────────────────── */}
      <div
        className={`ai-backdrop${aiOpen || summaryOpen ? " open" : ""}`}
        onClick={() => { setAiOpen(false); setSummaryOpen(false); }}
        aria-hidden={!(aiOpen || summaryOpen)}
      />
      <SummaryDrawer
        open={summaryOpen}
        insights={insights}
        onClose={() => setSummaryOpen(false)}
        mode="tasks"
        title="Your Tasks"
        ctaLabel="View"
        contextLabel="Bills"
        onPick={(insight) => { handleSummaryAction(insight); setSummaryOpen(false); }}
      />
      <AiChatDrawer
        open={aiOpen}
        onClose={() => { setAiOpen(false); setAiSeedQuestion(null); }}
        initialQuestion={aiSeedQuestion}
        onConsumedInitialQuestion={() => setAiSeedQuestion(null)}
        context={aiContext}
        contextLabel="Bills"
      />

      {hoverPreview && (
        <div
          className="bp-row-preview"
          style={computePreviewStyle(hoverPreview)}
          onMouseEnter={onPreviewEnter}
          onMouseLeave={onPreviewLeave}
        >
          <div className="bp-row-preview-thumb" aria-hidden>
            <svg viewBox="0 0 120 150" preserveAspectRatio="xMidYMid meet">
              <rect x="6" y="6" width="108" height="138" rx="3" fill="#fff" stroke="#D8CFC2" strokeWidth="1"/>
              <rect x="14" y="14" width="60" height="6" rx="1" fill="#3F2E1A"/>
              <rect x="14" y="24" width="48" height="3" rx="1" fill="#C8BFB2"/>
              <rect x="82" y="14" width="24" height="14" rx="1" fill="none" stroke="#D8CFC2"/>
              <rect x="14" y="42" width="92" height="2" fill="#E8DFD2"/>
              <rect x="14" y="50" width="70" height="3" rx="1" fill="#C8BFB2"/>
              <rect x="14" y="58" width="62" height="3" rx="1" fill="#C8BFB2"/>
              <rect x="14" y="66" width="76" height="3" rx="1" fill="#C8BFB2"/>
              <rect x="14" y="74" width="54" height="3" rx="1" fill="#C8BFB2"/>
              <rect x="14" y="82" width="68" height="3" rx="1" fill="#C8BFB2"/>
              <rect x="14" y="98" width="92" height="2" fill="#E8DFD2"/>
              <rect x="62" y="110" width="44" height="5" rx="1" fill="#3F2E1A"/>
              <rect x="62" y="120" width="44" height="5" rx="1" fill="#BA5A0E"/>
              <rect x="14" y="134" width="36" height="3" rx="1" fill="#C8BFB2"/>
            </svg>
          </div>
          <button
            type="button"
            className="bp-row-preview-cta"
            onClick={() => { showToast(`Opening source document for ${hoverPreview.row.id} (demo)`); setHoverPreview(null); }}
          >
            Open document →
          </button>
        </div>
      )}

      {vendorHover && (
        <div
          className="bp-vendor-tooltip"
          style={computeVendorTooltipStyle(vendorHover)}
          onMouseEnter={() => { if (vendorDismissTmr.current) clearTimeout(vendorDismissTmr.current); }}
          onMouseLeave={onVendorLeave}
        >
          <div className="bp-vendor-tooltip-name">{vendorHover.vendor.name}</div>
          {vendorHover.vendor.address && (
            <div className="bp-vendor-tooltip-row"><span className="bp-vendor-tooltip-lbl">Address</span>{vendorHover.vendor.address}</div>
          )}
          {vendorHover.vendor.contact && (
            <div className="bp-vendor-tooltip-row"><span className="bp-vendor-tooltip-lbl">Contact</span>{vendorHover.vendor.contact}</div>
          )}
          {vendorHover.vendor.phone && (
            <div className="bp-vendor-tooltip-row"><span className="bp-vendor-tooltip-lbl">Phone</span><span className="bp-vendor-tooltip-mono">{vendorHover.vendor.phone}</span></div>
          )}
          {vendorHover.vendor.email && (
            <div className="bp-vendor-tooltip-row"><span className="bp-vendor-tooltip-lbl">Email</span><span className="bp-vendor-tooltip-mono">{vendorHover.vendor.email}</span></div>
          )}
        </div>
      )}

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
