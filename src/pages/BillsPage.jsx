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
  billPeriod,
  sourceChannelFor,
  urgencyScore,
} from "../lib/billStatus";
import { useBills } from "../state/BillsContext";
import { useClosePeriod } from "../state/ClosePeriodContext";
import { useCurrentUser } from "../state/CurrentUserContext";
import AiChatDrawer, { SparkleIcon as DrawerSparkle } from "./AiChatDrawer";
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
  // Currency contract: `b.total`/`b.sisa`/`b.dpp`/`b.ppn`/`b.pph23` are ALWAYS
  // stored in IDR (the entity's functional currency / canonical books).
  // For foreign-currency bills, `original_currency` + `original_total` carry
  // the source-currency view that the vendor invoiced in — used only by the
  // "Original" column on the Bills List for cross-checking against the
  // vendor's source-currency document.
  const originalCur = b.original_currency || "IDR";
  return {
    id: b.id,
    no: b.invNo === "—" || !b.invNo ? b.id : b.invNo,
    tgl: formatDate(b.date),
    co: b.vendorName,
    addr: v?.address || "",
    due: formatDate(b.due),
    daysOverdue: dOver,
    total: b.total,                                                          // IDR
    original: originalCur !== "IDR" && b.original_total != null
      ? { code: originalCur, amount: b.original_total }
      : null,
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

function LedgerRow({ r, bucket, isChecked, onCheck, onClick, onKebab, isSelected, isAlt, onIdHover, onIdLeave, onVendorHover, onVendorLeave, showAgingBar, showKebab = true, periodLocked = false }) {
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
      <div className="lg-cell-due bp-cell-date">
        <div>{r.due}</div>
        {isOverdue && <div className="bp-cell-date-late">{r.daysOverdue}d late</div>}
      </div>
      <div className="bp-status-cell">
        <BpAnomalyDot anomalies={r.raw?.anomalies} />
        <div className="bp-status-cell-body">
          <div className={`bp-status-label${statusToneClass ? " " + statusToneClass : ""}`}>{statusLabel}</div>
          {periodLocked && (
            <div className="bp-period-lock-badge" title="This bill's accounting period is closed — reassign it to the current open period before it can be posted.">
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="2.5" y="5.5" width="7" height="5" rx="0.8"/><path d="M4.2 5.5V3.8a1.8 1.8 0 0 1 3.6 0v1.7"/></svg>
              Period locked
            </div>
          )}
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
      <div className="lg-cell-original">
        {r.original ? (
          <>
            <span className="lg-cell-orig-code">{r.original.code}</span>
            <span className="lg-cell-orig-amt">{fmtRp(r.original.amount)}</span>
          </>
        ) : (
          <span className="lg-cell-orig-empty">—</span>
        )}
      </div>
      <div className="lg-cell-total">
        <span className="lg-cell-total-rp">Rp</span>{fmtRp(r.total)}
      </div>
      <div className="lg-cell-kebab" onClick={(e) => e.stopPropagation()}>
        {showKebab && (
          <button className="lg-kebab" onClick={() => onKebab(r.id)}>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}

function RowMenu({ inv, onClose, onAction, canTransact = true, canApprove = true }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);
  // State allows the action AND the role is permitted to perform it.
  // Payment initiation lives on AP Aging, not here — Bills ends at Posted.
  const showApprove = (inv.approval === "review" || inv.approval === "draft") && canApprove;
  return (
    <div className="row-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      {canTransact && (
        <div className="row-menu-item" onClick={() => onAction("edit", inv)}>
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </div>
      )}
      {showApprove && (
        <div className="row-menu-item" onClick={() => onAction("approve", inv)}>
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          Approve
        </div>
      )}
      {canTransact && (
        <div className="row-menu-item" onClick={() => onAction("duplicate", inv)}>
          <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          Duplicate
        </div>
      )}
      {canTransact && <div className="row-menu-sep" />}
      {canTransact && (
        <div className="row-menu-item danger" onClick={() => onAction("archive", inv)}>
          <svg viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
          Archive
        </div>
      )}
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
  const { hasLevel } = useCurrentUser();
  const canCreate = hasLevel("ap", "transact");
  const canApprove = hasLevel("ap", "approve+post");
  const { bills } = useBills();
  const { closedThrough } = useClosePeriod();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState({ kind: "tab", value: "semua" });
  const [anomalyFilter, setAnomalyFilter] = useState(false);
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

  // "Your Tasks" rail is role-scoped: FM/Admin see the supervisory queue,
  // AP Staff see their prep queue, View Only sees read-only analytics.
  const insightsRole = canApprove ? "operator" : canCreate ? "preparer" : "viewer";
  const insights = useMemo(() => computeBillsInsights(bills, closedThrough, insightsRole), [bills, closedThrough, insightsRole]);
  const aiContext = useMemo(() => makeBillsAiContext(bills), [bills]);

  // ── New Bills summary stats (for SUMMARY + Perlu Dibayar / Pending Review / Draft / AP Outstanding cards)
  // Period-locked bills are excluded from "Due for Payment" per PRD — they can't be posted in their current state.
  const billStats = useMemo(() => {
    const verifiedReady = bills.filter((b) => workflowStatus(b) === "APPROVED" && !isApPeriodLocked(billPeriod(b), closedThrough));
    const verifiedReadySum = verifiedReady.reduce((s, b) => s + b.total, 0);
    const perluDibayar = bills.filter((b) => b.approval === "approved" && b.pay !== "paid" && !isApPeriodLocked(billPeriod(b), closedThrough));
    const perluDibayarSum = perluDibayar.reduce((s, b) => s + b.sisa, 0);
    const reviewList = bills.filter((b) => workflowStatus(b) === "PENDING_REVIEW");
    const reviewSum = reviewList.reduce((s, b) => s + b.total, 0);
    const returnedList = bills.filter((b) => workflowStatus(b) === "RETURNED");
    const returnedSum = returnedList.reduce((s, b) => s + b.total, 0);
    const draftList = bills.filter((b) => b.approval === "draft");
    const draftSum = draftList.reduce((s, b) => s + b.total, 0);
    // AP Outstanding — SME feedback: drafts aren't real obligations to vendors,
    // so they shouldn't be counted in the headline number. Split into the
    // amount we actually owe (submitted bills, unpaid) and a separate drafts
    // sub-line shown beneath.
    const outstandingActive = bills
      .filter((b) => b.pay !== "paid" && b.approval !== "draft")
      .reduce((s, b) => s + b.sisa, 0);
    const outstandingDraft = bills
      .filter((b) => b.approval === "draft")
      .reduce((s, b) => s + (b.sisa ?? b.total ?? 0), 0);
    const outstandingDraftCount = bills.filter((b) => b.approval === "draft").length;
    return {
      verifiedReadyCount: verifiedReady.length,
      verifiedReadySum,
      perluDibayarCount: perluDibayar.length,
      perluDibayarSum,
      reviewCount: reviewList.length,
      reviewSum,
      returnedCount: returnedList.length,
      returnedSum,
      draftCount: draftList.length,
      draftSum,
      outstandingActive,
      outstandingDraft,
      outstandingDraftCount,
    };
  }, [bills, closedThrough]);

  // ── AP Outstanding breakdown ────────────────────────────────────────────
  // Partitions the outstanding set (unpaid, non-draft) into four MUTUALLY
  // EXCLUSIVE buckets that sum exactly to the headline balance. Period-locked
  // takes precedence over the due-date timeline: a locked bill can't be paid
  // until it's reassigned, so it sits in `locked` even when its due date has
  // passed — that's what keeps the four numbers reconciling to the total.
  const apo = useMemo(() => {
    const todayKey = TODAY.toISOString().slice(0, 10);
    const in7 = new Date(TODAY); in7.setDate(TODAY.getDate() + 7);
    const in7Key = in7.toISOString().slice(0, 10);
    const mk = () => ({ count: 0, sum: 0 });
    const b = { notYetDue: mk(), due7: mk(), overdue: mk(), locked: mk() };
    for (const bill of bills) {
      if (bill.pay === "paid" || bill.approval === "draft") continue;
      const amt = bill.sisa ?? bill.total ?? 0;
      // Only UN-POSTED bills need reassignment. A posted bill in a now-closed
      // period was posted when the period was open — it ages by due date, it
      // doesn't reassign. (Matches the per-row "Period locked" badge gate.)
      if (!bill.je_number && isApPeriodLocked(billPeriod(bill), closedThrough)) { b.locked.count++; b.locked.sum += amt; continue; }
      const due = bill.due || "";
      if (due && due < todayKey)       { b.overdue.count++;   b.overdue.sum += amt; }
      else if (due && due <= in7Key)   { b.due7.count++;      b.due7.sum += amt; }
      else                             { b.notYetDue.count++; b.notYetDue.sum += amt; }
    }
    const total = b.notYetDue.sum + b.due7.sum + b.overdue.sum + b.locked.sum;
    return { ...b, total };
  }, [bills, closedThrough]);

  // Analytical insights for the Insights panel — vendor concentration + largest
  // exposure. Action items live in the task band, not here.
  const insightItems = useMemo(() => insights.filter((it) => ["vendorConcentration", "largest"].includes(it.id)), [insights]);

  // Close is a pure STATUS gate: a current-period bill blocks close until it
  // reaches "posted" (approved + paid). Exceptions/anomalies don't form their
  // own gate — they just keep a bill short of posted (the post step enforces a
  // clean bill). So the blockers surface through the existing pipeline boxes
  // (awaiting approval → ready to post); the counter is their sum.
  const closeBlocking = useMemo(() => {
    const inApr = (b) => b.date && b.date.startsWith(monthPfx);
    // Only UN-POSTED bills block the close — once posted they're in the GL.
    const review = bills.filter((b) => inApr(b) && workflowStatus(b) === "PENDING_REVIEW").length;
    const ready = bills.filter((b) => inApr(b) && workflowStatus(b) === "APPROVED").length;
    return { review, ready, total: review + ready };
  }, [bills, monthPfx]);

  const todayLabel = useMemo(() => formatDate(TODAY.toISOString().slice(0, 10)), []);
  const monthLabel = useMemo(() => formatMonthLabel(monthPfx), [monthPfx]);

  function askAi(question) {
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
      posted:     byStatus("POSTED"),
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
    { k: "posted",     lbl: "Posted",     count: tabCounts.posted },
    { k: "draft",      lbl: "Draft",      count: tabCounts.draft },
    { k: "exception",  lbl: "Exceptions", count: tabCounts.exception },
  ];

  // ── Corpus ─────────────────────────────────────────────────────────────
  const corpus = useMemo(() => {
    const todayKey = TODAY.toISOString().slice(0, 10);
    const in7 = new Date(TODAY); in7.setDate(TODAY.getDate() + 7);
    const in7Key = in7.toISOString().slice(0, 10);
    let list = bills;
    if (filter.kind === "tab") {
      if (filter.value === "approved")       list = list.filter((b) => workflowStatus(b) === "APPROVED");
      else if (filter.value === "posted")    list = list.filter((b) => workflowStatus(b) === "POSTED");
      else if (filter.value === "review")    list = list.filter((b) => ["PENDING_REVIEW", "RETURNED"].includes(workflowStatus(b)));
      else if (filter.value === "draft")     list = list.filter((b) => workflowStatus(b) === "DRAFT");
      else if (filter.value === "jatuhtempo")list = list.filter((b) => b.pay === "overdue" && workflowStatus(b) !== "EXCEPTION");
      else if (filter.value === "lunas")     list = list.filter((b) => workflowStatus(b) === "PAID");
      else if (filter.value === "exception") list = list.filter((b) => workflowStatus(b) === "EXCEPTION");
    } else if (filter.kind === "card") {
      if (filter.value === "total")              list = list.filter((b) => b.pay !== "paid");
      else if (filter.value === "overdueMonth")  list = list.filter((b) => b.pay === "overdue" && b.due && b.due.startsWith(monthPfx));
      else if (filter.value === "thisMonth")     list = list.filter((b) => b.date && b.date.startsWith(monthPfx));
      else if (filter.value === "readyToPost")   list = list.filter((b) => workflowStatus(b) === "APPROVED" && !isApPeriodLocked(billPeriod(b), closedThrough));
      else if (filter.value === "perluDibayar")  list = list.filter((b) => b.approval === "approved" && b.pay !== "paid");
      else if (filter.value === "dueIn7")        list = list.filter((b) => b.pay !== "paid" && b.approval === "approved" && b.due && b.due > todayKey && b.due <= in7Key);
      // AP Outstanding card filter — exclude drafts so it matches the KPI's
      // headline number (drafts aren't real obligations yet). The Draft tab
      // is the place to see drafts.
      else if (filter.value === "allUnpaid")     list = list.filter((b) => b.pay !== "paid" && b.approval !== "draft");
      else if (filter.value === "apClose")       list = list.filter((b) => b.date && b.date.startsWith(monthPfx) && (b.approval !== "approved" || b.pay !== "paid"));
      // Close gate (status): current-period bills not yet posted — in review or approved-unpaid. Matches the CLOSE counter.
      else if (filter.value === "closeBlocking")  list = list.filter((b) => b.date && b.date.startsWith(monthPfx) && (b.approval === "review" || (b.approval === "approved" && b.pay === "unpaid")));
      else if (filter.value === "periodLocked")  list = list.filter((b) => !b.je_number && isApPeriodLocked(billPeriod(b), closedThrough) && (b.approval === "review" || (b.approval === "approved" && b.pay !== "paid")));
      // Reassign bucket — UN-POSTED bills in a closed period (posted bills age by due date, they don't reassign).
      else if (filter.value === "apoLocked")     list = list.filter((b) => !b.je_number && b.pay !== "paid" && b.approval !== "draft" && isApPeriodLocked(billPeriod(b), closedThrough));
      else if (filter.value === "apoOverdue")    list = list.filter((b) => b.pay !== "paid" && b.approval !== "draft" && !isApPeriodLocked(billPeriod(b), closedThrough) && b.due && b.due < todayKey);
      else if (filter.value === "apoDue7")       list = list.filter((b) => b.pay !== "paid" && b.approval !== "draft" && !isApPeriodLocked(billPeriod(b), closedThrough) && b.due && b.due >= todayKey && b.due <= in7Key);
      else if (filter.value === "apoNotYetDue")  list = list.filter((b) => b.pay !== "paid" && b.approval !== "draft" && !isApPeriodLocked(billPeriod(b), closedThrough) && (!b.due || b.due > in7Key));
    }
    return list;
  }, [filter, monthPfx, bills, closedThrough]);

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
  // Footer subtotal split — SME feedback. When viewing the "All" tab AND
  // there are drafts in the current filtered set, show the headline number
  // as just the submitted bills and surface drafts as a "(+ Rp X draft
  // belum submitted)" suffix. Prevents misreading at closing time.
  const isAllTab = filter.kind === "tab" && filter.value === "semua";
  const draftRows = isAllTab ? filteredRows.filter((r) => r.approval === "draft") : [];
  const pageTotalDraft = draftRows.reduce((s, r) => s + r.total, 0);
  const pageTotalNonDraft = pageTotal - pageTotalDraft;
  const showDraftSplit = isAllTab && draftRows.length > 0 && checked.size === 0;
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
      case "returned":
        setFilter({ kind: "tab", value: "review" });
        setSearch("");
        break;
      case "exceptions":
        setFilter({ kind: "tab", value: "exception" });
        setSearch("");
        break;
      case "drafts":
        setFilter({ kind: "tab", value: "draft" });
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
              <button
                type="button"
                className={`bp-close-pill${isCardActive("closeBlocking") ? " active" : ""}`}
                onClick={() => selectCard("closeBlocking")}
                title={`AP Close — ${monthLabel} · ${closeBlocking.total} bill${closeBlocking.total === 1 ? "" : "s"} blocking. Click to filter the list.`}
              >
                <span className="bp-close-pill-dot" />
                <span className="bp-close-pill-lbl">CLOSE · {monthLabel.toUpperCase()}</span>
                {closeBlocking.total > 0 && (
                  <span className="bp-close-pill-badge">{closeBlocking.total} blocking</span>
                )}
              </button>
              <button
                className="lg-btn-brand"
                disabled={!canCreate}
                title={canCreate ? undefined : "Your role can't create bills"}
                onClick={() => canCreate && navigate("/bills/new")}
              >
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create Bill
              </button>
            </div>
          </div>

          <div className="bp-cc">
            {/* ── Your tasks — actionable boxes ─────────────────────────── */}
            <div className="bp-cc-band-head">
              <span className="bp-cc-eyebrow"><SparkleIcon size={12} /> Your Tasks</span>
              <span className="bp-cc-asof">as of {todayLabel}</span>
            </div>
            <div className="bp-cc-taskband">
              {canApprove && billStats.reviewCount > 0 && (
                <button type="button" className="bp-t2" onClick={() => selectTab("review")}>
                  <span className="bp-t2-lbl">Awaiting approval</span>
                  <span className="bp-t2-amt">{formatRupiah(billStats.reviewSum)}</span>
                  <span className="bp-t2-sub">{billStats.reviewCount} bill{billStats.reviewCount === 1 ? "" : "s"}</span>
                  {closeBlocking.review > 0 && <span className="bp-t2-tag">{closeBlocking.review} blocking close</span>}
                  <span className="bp-t2-cta">Review →</span>
                </button>
              )}
              {(canApprove || canCreate) && billStats.returnedCount > 0 && (
                <button type="button" className="bp-t2" onClick={() => selectTab("review")}>
                  <span className="bp-t2-lbl">Returned — needs rework</span>
                  <span className="bp-t2-amt">{formatRupiah(billStats.returnedSum)}</span>
                  <span className="bp-t2-sub">{billStats.returnedCount} bill{billStats.returnedCount === 1 ? "" : "s"}</span>
                  <span className="bp-t2-cta">Fix →</span>
                </button>
              )}
              {canApprove && billStats.verifiedReadyCount > 0 && (
                <button type="button" className="bp-t2" onClick={() => selectCard("readyToPost")}>
                  <span className="bp-t2-lbl">Ready to post</span>
                  <span className="bp-t2-amt">{formatRupiah(billStats.verifiedReadySum)}</span>
                  <span className="bp-t2-sub">{billStats.verifiedReadyCount} bill{billStats.verifiedReadyCount === 1 ? "" : "s"}</span>
                  {closeBlocking.ready > 0 && <span className="bp-t2-tag">{closeBlocking.ready} blocking close</span>}
                  <span className="bp-t2-cta">Post →</span>
                </button>
              )}
              {!canApprove && canCreate && billStats.draftCount > 0 && (
                <button type="button" className="bp-t2" onClick={() => selectTab("draft")}>
                  <span className="bp-t2-lbl">Submit drafts</span>
                  <span className="bp-t2-amt">{formatRupiah(billStats.draftSum)}</span>
                  <span className="bp-t2-sub">{billStats.draftCount} draft{billStats.draftCount === 1 ? "" : "s"}</span>
                  <span className="bp-t2-cta">Submit →</span>
                </button>
              )}
              {apo.locked.count > 0 && (
                <button type="button" className="bp-t2" onClick={() => selectCard("apoLocked")}>
                  <span className="bp-t2-lbl">Reassign to period</span>
                  <span className="bp-t2-amt">{formatRupiah(apo.locked.sum)}</span>
                  <span className="bp-t2-sub">{apo.locked.count} bill{apo.locked.count === 1 ? "" : "s"}</span>
                  <span className="bp-t2-tag sep">other periods</span>
                  <span className="bp-t2-cta">Reassign →</span>
                </button>
              )}
            </div>

            {/* AP Outstanding aging breakdown, Overdue/Paid views and the
                overdue-payables Insights moved to AP Aging — the Bills page
                focuses on getting bills to Posted; payment lives in AP Aging. */}
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
              <div>Invoice Date</div>
              <div>Vendor</div>
              <div>Due Date</div>
              <div>Status</div>
              <div style={{ textAlign: "right" }}>Original</div>
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
                              showKebab={canCreate}
                              periodLocked={isApPeriodLocked(billPeriod(r.raw), closedThrough) && ["PENDING_REVIEW", "RETURNED", "APPROVED"].includes(workflowStatus(r.raw))}
                            />
                            {menuOpenFor === r.id && (
                              <div style={{ position: "absolute", right: 32, top: 32, zIndex: 5 }}>
                                <RowMenu inv={r.raw} onClose={() => setMenuOpenFor(null)} onAction={onRowAction} canTransact={canCreate} canApprove={canApprove} />
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
                          showKebab={canCreate}
                          periodLocked={isApPeriodLocked(billPeriod(r.raw), closedThrough) && ["PENDING_REVIEW", "RETURNED", "APPROVED"].includes(workflowStatus(r.raw))}
                        />
                        {menuOpenFor === r.id && (
                          <div style={{ position: "absolute", right: 32, top: 32, zIndex: 5 }}>
                            <RowMenu inv={r.raw} onClose={() => setMenuOpenFor(null)} onAction={onRowAction} canTransact={canCreate} canApprove={canApprove} />
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
              {canApprove && <button className="lg-footer-bulk-btn" onClick={() => onBulk("approve")}>Approve</button>}
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
          <span className="lg-footer-total">
            Rp {fmtRp(checked.size > 0 ? selectedTotal : (showDraftSplit ? pageTotalNonDraft : pageTotal))}
            {showDraftSplit && (
              <span className="lg-footer-draft-split">
                {" "}(+ Rp {fmtRp(pageTotalDraft)} in {draftRows.length} draft{draftRows.length === 1 ? "" : "s"})
              </span>
            )}
          </span>
        </div>
      </div>

      {/* ── Klay AI drawers ────────────────────────────────────────── */}
      <div
        className={`ai-backdrop${aiOpen ? " open" : ""}`}
        onClick={() => setAiOpen(false)}
        aria-hidden={!aiOpen}
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
