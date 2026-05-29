import { useState, useMemo, useEffect, useRef } from "react";
import { formatDate } from "../lib/format";
import {
  JOURNAL_ENTRIES as SEED_JOURNAL_ENTRIES,
  BILL_REFS,
  RECONCILIATION,
  ANOMALY_FLAGS,
  ANOMALIES,
} from "../data/seed/journalEntries";
import { useJournalEntries } from "../state/JournalEntriesContext";
import { INVOICES } from "../data/seed/invoices";
import AiChatDrawer from "./AiChatDrawer";
import SummaryDrawer from "./SummaryDrawer";
import { computeGlInsights, makeGlAiContext } from "./ai-gl-context";
import "./modules.css";
import "./invoices-ledger.css";

// Derive a GL display reference for invoices/bills referenced by a JE.
const INV_REFS = Object.fromEntries(INVOICES.map((inv) => [inv.id, inv.invNo]));

function getDisplayRef(je) {
  if (je.reference_type === "invoice" || je.reference_type === "invoice_payment") return INV_REFS[je.reference_id] || je.je_number;
  if (je.reference_type === "bill"    || je.reference_type === "bill_payment")    return BILL_REFS[je.reference_id] || je.je_number;
  return je.je_number;
}
function mapRefType(t) {
  if (t === "invoice" || t === "invoice_payment") return "inv";
  if (t === "bill"    || t === "bill_payment")    return "bill";
  return "je";
}

// Build a per-line GL row dforet with running balance.
function buildGLRows(JOURNAL_ENTRIES) {
  const sorted = [...JOURNAL_ENTRIES].sort((a, b) => a.je_date.localeCompare(b.je_date));
  const rows = [];
  let runBal = 500000000;
  sorted.forEach((je) => {
    const displayRef = getDisplayRef(je);
    const refType    = mapRefType(je.reference_type);
    je.lines.forEach((l, idx) => {
      const debit  = l.debit  > 0 ? l.debit  : 0;
      const credit = l.credit > 0 ? l.credit : 0;
      runBal += debit - credit;
      rows.push({
        id: je.je_number + "-L" + idx,
        jeId: je.je_number,
        firstLine: idx === 0,
        date: je.je_date,
        dateLabel: formatDate(je.je_date),
        ref: displayRef,
        refType,
        refId: je.reference_id,
        acct: l.account_code,
        acctName: l.account_name,
        desc: l.description || je.memo,
        debit,
        credit,
        balance: runBal,
        je,
      });
    });
  });
  return rows;
}

// ACCT_OPTIONS is derived from the static seed because (a) it powers a
// select dropdown that doesn't need to react to newly posted JEs, and (b)
// new bills only reuse existing account codes — there are no new accounts
// created at runtime in the demo. ALL_ROWS, by contrast, is reactive (see
// the component body) so newly posted JEs appear in the GL immediately.
const SEED_ROWS = buildGLRows(SEED_JOURNAL_ENTRIES);
const ACCT_OPTIONS = [...new Set(SEED_ROWS.map((r) => r.acct + "|" + r.acctName))]
  .sort()
  .map((a) => { const [code, name] = a.split("|"); return { code, name }; });

const REF_TYPE_LABEL = { je: "JE", inv: "INV", bill: "BILL" };
const REF_TYPE_BADGE = { je: "review", inv: "approved", bill: "draft" };

// Period strip — locked vs active vs future.
const PERIODS = [
  { lbl: "Okt 2024", v: "2024-10", state: "locked" },
  { lbl: "Nov 2024", v: "2024-11", state: "locked" },
  { lbl: "Des 2024", v: "2024-12", state: "locked" },
  { lbl: "Jan 2025", v: "2025-01", state: "active" },
  { lbl: "Feb 2025", v: "2025-02", state: "future" },
  { lbl: "Mar 2025", v: "2025-03", state: "future" },
  { lbl: "Apr 2025", v: "2025-04", state: "future" },
  { lbl: "Mei 2025", v: "2025-05", state: "future" },
];

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtRp(n) {
  if (n == null) return "—";
  return n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}
function fmtShort(n) {
  if (!n) return "0";
  if (n >= 1e9) return (n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " M";
  if (n >= 1e6) return (n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 0 }) + " jt";
  return n.toLocaleString("id-ID");
}

function SparkleIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 1.5l1.1 2.7L9.8 5l-2.7 0.8L6 8.5l-1.1-2.7L2.2 5l2.7-0.8L6 1.5z" />
      <path d="M10 8.5l0.4 1L11.5 10l-1.1 0.4L10 11.5l-0.4-1.1L8.5 10l1.1-0.5L10 8.5z" />
    </svg>
  );
}

function AiSubtitle({ insights, onOpenSummary, onOpenChat, chatActive, summaryActive }) {
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

  return (
    <div className={`lg-ai-subtitle${summaryActive || chatActive ? " active" : ""}`}>
      <p className={`lg-ai-text${fading ? " fading" : ""}`}>
        <span className="lg-ai-sparkle"><SparkleIcon /></span>
        {current?.node}
      </p>
      <div className="lg-ai-ctas">
        <button type="button" className={`lg-ai-cta-primary${summaryActive ? " active" : ""}`} onClick={onOpenSummary}>
          <SparkleIcon /> Summary & Closing
        </button>
        <button type="button" className={`lg-ai-cta-secondary${chatActive ? " active" : ""}`} onClick={onOpenChat}>
          {chatActive ? "Continue chat" : "Ask Klay AI"} →
        </button>
        {insights.length > 1 && (
          <div className="lg-ai-dots" aria-hidden>
            {insights.map((_, i) => <span key={i} className={`lg-ai-dot${i === idx ? " on" : ""}`} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function GlRow({ r, anomaly, isAlt, isSelected, onClick }) {
  const reconKey = RECONCILIATION[r.jeId];
  const reconMatched = reconKey === "matched";
  return (
    <div
      className={`lg-row${isAlt ? " alt" : ""}${isSelected ? " selected" : ""}${anomaly ? (anomaly.type === "warn" ? " anomaly-warn" : " anomaly-danger") : ""}${r.firstLine ? " je-first" : ""}`}
      onClick={onClick}
    >
      <div className="lg-cell-date">{r.firstLine ? r.dateLabel : ""}</div>
      <div className="lg-cell-no">{r.firstLine ? r.ref : ""}</div>
      <div>
        {r.firstLine ? (
          <span className={`badge badge-${REF_TYPE_BADGE[r.refType]}`} style={{ fontSize: 9 }}>
            {REF_TYPE_LABEL[r.refType]}
          </span>
        ) : null}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-action)", fontWeight: 600 }}>
          {r.acct}
        </div>
        <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {r.acctName}
        </div>
        {r.desc && r.desc !== r.acctName && (
          <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {r.desc}
          </div>
        )}
      </div>
      <div className="lg-cell-total">
        {r.debit > 0 ? <><span className="lg-cell-total-rp">Rp</span>{fmtRp(r.debit)}</> : <span className="lg-cell-em-dash">—</span>}
      </div>
      <div className="lg-cell-total">
        {r.credit > 0 ? <><span className="lg-cell-total-rp">Rp</span>{fmtRp(r.credit)}</> : <span className="lg-cell-em-dash">—</span>}
      </div>
      <div className="lg-cell-total" style={{ color: "var(--color-text-primary)" }}>
        <span className="lg-cell-total-rp">Rp</span>{fmtRp(r.balance)}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>
        {r.firstLine ? (
          reconMatched ? (
            <span style={{ color: "var(--color-success-text)", display: "inline-flex", alignItems: "center", gap: 3 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              Matched
            </span>
          ) : (
            <span style={{ color: "var(--color-text-tertiary)" }}>—</span>
          )
        ) : null}
      </div>
      <div className="lg-cell-kebab" onClick={(e) => e.stopPropagation()}>
        {r.firstLine && (
          <button className="lg-kebab">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}

const SORT_LABELS = {
  "date-asc":    "Date oldest ↑",
  "date-desc":   "Newest date ↓",
  "ref-asc":     "Reference A-Z",
  "debit-desc":  "Debit highest ↓",
  "credit-desc": "Credit highest ↓",
  "balance-desc":"Balance highest ↓",
};
const GROUP_LABELS = {
  "none":  "—",
  "type":  "Type Reference",
  "acct":  "Account",
  "month": "Month",
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

function GroupPopover({ value, onPick, onClose }) {
  const ref = useRef(null);
  useClickOutside(ref, onClose);
  const items = [
    { k: "none",  lbl: "Not grouped" },
    { k: "type",  lbl: "Type Reference (JE/INV/BILL)" },
    { k: "acct",  lbl: "Account" },
    { k: "month", lbl: "Month" },
  ];
  return (
    <div className="lg-popover" ref={ref}>
      <div className="lg-popover-list">
        {items.map((it) => (
          <button key={it.k} className={`lg-popover-item${value === it.k ? " selected" : ""}`} onClick={() => onPick(it.k)}>
            {it.lbl}
            {value === it.k && <svg className="lg-popover-check" viewBox="0 0 12 12"><polyline points="2 6 5 9 10 3"/></svg>}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterPopover({ values, onChange, onClose }) {
  const ref = useRef(null);
  useClickOutside(ref, onClose);
  const [draft, setDraft] = useState(values);
  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const reset = () => setDraft({ acct: "", dateFrom: "", dateTo: "", recon: "all" });
  const apply = () => { onChange(draft); onClose(); };
  return (
    <div className="lg-popover lg-filter-pop" ref={ref}>
      <div className="lg-filter-body">
        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Account</div>
          <select className="lg-filter-input" value={draft.acct} onChange={(e) => update({ acct: e.target.value })} style={{ cursor: "pointer" }}>
            <option value="">All account</option>
            {ACCT_OPTIONS.map((a) => (
              <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
            ))}
          </select>
        </div>
        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Period date</div>
          <div className="lg-filter-row2">
            <input type="date" className="lg-filter-input" value={draft.dateFrom} onChange={(e) => update({ dateFrom: e.target.value })} />
            <span style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>—</span>
            <input type="date" className="lg-filter-input" value={draft.dateTo} onChange={(e) => update({ dateTo: e.target.value })} />
          </div>
        </div>
        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Status Reconciliation</div>
          <div className="lg-toggle-row">
            {[["all", "All"], ["matched", "Matched"], ["unmatched", "Unmatched"]].map(([v, lbl]) => (
              <button key={v} className={`lg-toggle${draft.recon === v ? " on" : ""}`} onClick={() => update({ recon: v })}>{lbl}</button>
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

// ── Page ──────────────────────────────────────────────────────────────────

export default function GeneralLedgerPage() {
  const [period, setPeriod] = useState("2025-01");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState({ kind: "tab", value: "all" });
  const [sortChoice, setSortChoice] = useState(null);
  const [groupChoice, setGroupChoice] = useState(null);
  const emptyFilters = { acct: "", dateFrom: "", dateTo: "", recon: "all" };
  const [filterValues, setFilterValues] = useState(emptyFilters);

  const [selectedJeId, setSelectedJeId] = useState(null);
  const [drawerTab, setDrawerTab] = useState("detail");

  const [sortPopOpen, setSortPopOpen] = useState(false);
  const [groupPopOpen, setGroupPopOpen] = useState(false);
  const [filterPopOpen, setFilterPopOpen] = useState(false);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiSeedQuestion, setAiSeedQuestion] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [dismissedAnoms, setDismissedAnoms] = useState(() => new Set());

  const [toast, setToast] = useState("");
  const toastTmr = useRef(null);
  function showToast(msg) {
    setToast(msg);
    if (toastTmr.current) clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToast(""), 1800);
  }

  // JEs from the context — reactive, so newly-posted bills appear here
  // immediately after the Approve action on Bill Detail.
  const { entries: JOURNAL_ENTRIES } = useJournalEntries();
  const ALL_ROWS = useMemo(() => buildGLRows(JOURNAL_ENTRIES), [JOURNAL_ENTRIES]);

  // Stats for current dforet
  const stats = useMemo(() => {
    const postedCount  = JOURNAL_ENTRIES.filter((j) => j.status === "posted").length;
    const pendingCount = JOURNAL_ENTRIES.filter((j) => j.status === "pending").length;
    const draftCount   = JOURNAL_ENTRIES.filter((j) => j.status === "draft").length;
    const matchedCount = Object.keys(RECONCILIATION).length;
    const unmatchedCount = Math.max(0, postedCount - matchedCount);
    const anomalyCount = Object.keys(ANOMALY_FLAGS).length;
    const totalDebit  = ALL_ROWS.reduce((s, r) => s + r.debit, 0);
    const totalCredit = ALL_ROWS.reduce((s, r) => s + r.credit, 0);
    return { postedCount, pendingCount, draftCount, matchedCount, unmatchedCount, anomalyCount, totalDebit, totalCredit };
  }, [JOURNAL_ENTRIES, ALL_ROWS]);

  // Days to close — relative to a demo TODAY
  const daysToClose = useMemo(() => {
    const demoToday = new Date("2025-04-23T00:00:00");
    const [y, m] = period.split("-").map(Number);
    const monthEnd = new Date(y, m, 0);
    return Math.max(0, Math.ceil((monthEnd - demoToday) / 86400000));
  }, [period]);

  const periodLabel = PERIODS.find((p) => p.v === period)?.lbl || period;

  const insights = useMemo(() => computeGlInsights({
    ...stats,
    daysToClose,
    period: periodLabel,
  }), [stats, daysToClose, periodLabel]);

  const aiContext = useMemo(() => makeGlAiContext({
    ...stats,
    daysToClose,
    period: periodLabel,
    anomalyes: Object.keys(ANOMALY_FLAGS).map((k) => JOURNAL_ENTRIES.find((j) => j.je_number === k)).filter(Boolean),
    pendingEntries: JOURNAL_ENTRIES.filter((j) => j.status === "pending"),
    unmatchedEntries: JOURNAL_ENTRIES.filter((j) => j.status === "posted" && !RECONCILIATION[j.je_number]),
  }), [stats, daysToClose, periodLabel, JOURNAL_ENTRIES]);

  function askAi(question) {
    setSummaryOpen(false);
    setAiSeedQuestion(question);
    setAiOpen(true);
  }

  // KPI cards (5 cells)
  const runningBalance = useMemo(() => ALL_ROWS.length > 0 ? ALL_ROWS[ALL_ROWS.length - 1].balance : 500000000, []);
  const kpis = [
    { lbl: "Running Balance", card: null,        val: "Rp " + fmtShort(runningBalance), sub: `${periodLabel}`,             tone: "primary" },
    { lbl: "JE Pending",      card: "pending",   val: String(stats.pendingCount),         sub: "awaiting approval",        tone: "warn"    },
    { lbl: "Anomaly",         card: "anomaly",   val: String(stats.anomalyCount),         sub: "needs review",             tone: "danger"  },
    { lbl: "Unmatched",       card: "unmatched", val: String(stats.unmatchedCount),       sub: "to transactions bank",        tone: "danger"  },
    { lbl: "Auto Recon AI",   card: "matched",   val: String(stats.matchedCount),         sub: "matched by AI",            tone: "primary" },
  ];

  const tabs = [
    { k: "all",  lbl: "All",         count: ALL_ROWS.length },
    { k: "je",   lbl: "Journal Entry",  count: ALL_ROWS.filter((r) => r.refType === "je").length },
    { k: "inv",  lbl: "Invoice",       count: ALL_ROWS.filter((r) => r.refType === "inv").length },
    { k: "bill", lbl: "Bill",          count: ALL_ROWS.filter((r) => r.refType === "bill").length },
  ];

  // Corpus from tab + KPI card
  const corpus = useMemo(() => {
    let list = ALL_ROWS;
    if (filter.kind === "tab") {
      if (filter.value === "je")   list = list.filter((r) => r.refType === "je");
      if (filter.value === "inv")  list = list.filter((r) => r.refType === "inv");
      if (filter.value === "bill") list = list.filter((r) => r.refType === "bill");
    } else if (filter.kind === "card") {
      if (filter.value === "pending")   list = list.filter((r) => r.je.status === "pending");
      if (filter.value === "anomaly")   list = list.filter((r) => ANOMALY_FLAGS[r.jeId]);
      if (filter.value === "unmatched") list = list.filter((r) => r.je.status === "posted" && !RECONCILIATION[r.jeId]);
      if (filter.value === "matched")   list = list.filter((r) => RECONCILIATION[r.jeId] === "matched");
    }
    return list;
  }, [filter]);

  const hasActiveFilters = useMemo(() => (
    filterValues.acct !== "" ||
    filterValues.dateFrom !== "" ||
    filterValues.dateTo !== "" ||
    filterValues.recon !== "all" ||
    sortChoice !== null ||
    groupChoice !== null
  ), [filterValues, sortChoice, groupChoice]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterValues.acct) n++;
    if (filterValues.dateFrom !== "" || filterValues.dateTo !== "") n++;
    if (filterValues.recon !== "all") n++;
    return n;
  }, [filterValues]);

  // Apply filter + search
  const filteredRows = useMemo(() => {
    let list = corpus;
    if (filterValues.acct) list = list.filter((r) => r.acct === filterValues.acct);
    if (filterValues.dateFrom) list = list.filter((r) => r.date >= filterValues.dateFrom);
    if (filterValues.dateTo)   list = list.filter((r) => r.date <= filterValues.dateTo);
    if (filterValues.recon === "matched")   list = list.filter((r) => RECONCILIATION[r.jeId] === "matched");
    if (filterValues.recon === "unmatched") list = list.filter((r) => !RECONCILIATION[r.jeId]);
    const q = search.toLowerCase().trim();
    if (q) list = list.filter((r) =>
      (r.ref + " " + r.acct + " " + r.acctName + " " + r.desc).toLowerCase().includes(q)
    );
    return list;
  }, [corpus, filterValues, search]);

  // Sort
  const effectiveSort = sortChoice || "date-asc";
  const effectiveGroup = groupChoice || "none";

  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    switch (effectiveSort) {
      case "date-asc":     arr.sort((a, b) => (a.date || "").localeCompare(b.date || "")); break;
      case "date-desc":    arr.sort((a, b) => (b.date || "").localeCompare(a.date || "")); break;
      case "ref-asc":      arr.sort((a, b) => a.ref.localeCompare(b.ref)); break;
      case "debit-desc":   arr.sort((a, b) => b.debit - a.debit); break;
      case "credit-desc":  arr.sort((a, b) => b.credit - a.credit); break;
      case "balance-desc": arr.sort((a, b) => b.balance - a.balance); break;
      default: break;
    }
    // Recompute running balance for the visible ordering
    let bal = 500000000;
    arr.forEach((r) => { bal += (r.debit || 0) - (r.credit || 0); r.balance = bal; });
    return arr;
  }, [filteredRows, effectiveSort]);

  const groups = useMemo(() => {
    if (effectiveGroup === "none") return null;
    const keyFn = (r) => {
      if (effectiveGroup === "type") return { je: "Journal Entry", inv: "Invoice", bill: "Bill" }[r.refType] || r.refType;
      if (effectiveGroup === "acct") return `${r.acct} · ${r.acctName}`;
      if (effectiveGroup === "month") {
        const [y, m] = r.date.split("-");
        const names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        return `${names[parseInt(m, 10) - 1]} ${y}`;
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
      label: k,
      rows,
      sum: rows.reduce((s, r) => s + r.debit, 0),
    }));
  }, [effectiveGroup, sortedRows]);

  const selectedJe = selectedJeId ? JOURNAL_ENTRIES.find((j) => j.je_number === selectedJeId) : null;

  const pageDebit = filteredRows.reduce((s, r) => s + r.debit, 0);
  const pageCredit = filteredRows.reduce((s, r) => s + r.credit, 0);

  function selectTab(t)  { setFilter({ kind: "tab",  value: t }); }
  function selectCard(c) {
    if (!c) { setFilter({ kind: "tab", value: "all" }); return; }
    setFilter({ kind: "card", value: c });
  }
  const isTabActive  = (t) => filter.kind === "tab" && filter.value === t;
  const isCardActive = (c) => filter.kind === "card" && filter.value === c;

  function resetAll() {
    setSortChoice(null);
    setGroupChoice(null);
    setFilterValues(emptyFilters);
    setSearch("");
    setFilter({ kind: "tab", value: "all" });
  }

  function exportCsv() {
    const headers = ["Date", "Reference", "Type", "Account", "Account Name", "Description", "Debit", "Credit", "Balance"];
    const esc = (v) => {
      const s = String(v == null ? "" : v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of sortedRows) {
      lines.push([r.dateLabel, r.ref, REF_TYPE_LABEL[r.refType], r.acct, r.acctName, r.desc, r.debit, r.credit, r.balance].map(esc).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `klay-gl-${period}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`${sortedRows.length} rows exported to CSV`);
  }

  function toggleGroup(key) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function pickPeriod(p) {
    if (p.state === "locked" || p.state === "future") {
      showToast(p.state === "locked" ? `${p.lbl} already dikunci` : `${p.lbl} not started`);
      return;
    }
    setPeriod(p.v);
  }

  return (
    <div className="lg-page">
      <div className="lg-scroll-container">
        {/* ── Editorial header ──────────────────────────────────────── */}
        <div className="lg-head">
          <div className="lg-head-top">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="lg-title">General Ledger</h1>
              <AiSubtitle
                insights={insights}
                onOpenSummary={() => setSummaryOpen(true)}
                onOpenChat={() => setAiOpen(true)}
                chatActive={aiOpen}
                summaryActive={summaryOpen}
              />
            </div>
            <div className="lg-head-actions">
              <button className="lg-btn-brand" onClick={exportCsv}>
                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export GL
              </button>
            </div>
          </div>

          <div className="lg-kpi-strip kpi-5">
            {kpis.map((k) => (
              <button
                type="button"
                className={`lg-kpi-cell${k.card && isCardActive(k.card) ? " active" : ""}`}
                key={k.lbl}
                onClick={() => k.card && selectCard(isCardActive(k.card) ? null : k.card)}
                aria-pressed={k.card ? isCardActive(k.card) : false}
                style={!k.card ? { cursor: "default" } : undefined}
              >
                <div className="lg-kpi-lbl">{k.lbl}</div>
                <div className={`lg-kpi-val${k.tone === "danger" ? " danger" : k.tone === "warn" ? " warn" : ""}`}>{k.val}</div>
                <div className="lg-kpi-sub">{k.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Period tabs + table card share one wrap so spacing is single-source ── */}
        <div className="lg-table-wrap">
          <div className="lg-period-tabs">
            <div className="lg-pt-arr"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></div>
            {PERIODS.map((p) => (
              <div
                key={p.v}
                className={`lg-pt-tab ${p.state}${period === p.v ? " active" : ""}`}
                onClick={() => pickPeriod(p)}
                title={p.state === "locked" ? "Period terkunci" : p.state === "future" ? "Period not started" : ""}
              >
                {p.state === "locked" && (
                  <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                )}
                {p.lbl}
              </div>
            ))}
            <div className="lg-pt-arr"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></div>
          </div>
          <div className="lg-card lg-table-gl">
            <div className="lg-pills-row">
              {tabs.map((t) => (
                <button key={t.k} className={`lg-pill${isTabActive(t.k) ? " active" : ""}`} onClick={() => selectTab(t.k)}>
                  {t.lbl}
                  <span className="lg-pill-count">{t.count}</span>
                </button>
              ))}
            </div>

            <div className="lg-filter-row">
              <div className="lg-search">
                <svg viewBox="0 0 14 14"><circle cx="6" cy="6" r="3.5"/><path d="M9 9l3 3" strokeLinecap="round"/></svg>
                <input placeholder="Search reference, account, or description…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="lg-filter-meta">
                <div className="lg-meta-btn-wrap">
                  <button className={`lg-meta-btn${activeFilterCount > 0 ? " active" : ""}`} onClick={() => { setFilterPopOpen(!filterPopOpen); setSortPopOpen(false); setGroupPopOpen(false); }}>
                    <svg viewBox="0 0 12 12"><path d="M2 3h8M3 6h6M4 9h4" strokeLinecap="round"/></svg>
                    Filter
                    {activeFilterCount > 0 && <span className="lg-filter-badge">{activeFilterCount}</span>}
                  </button>
                  {filterPopOpen && <FilterPopover values={filterValues} onChange={setFilterValues} onClose={() => setFilterPopOpen(false)} />}
                </div>
                <div className="lg-meta-btn-wrap">
                  <button className="lg-meta-btn" onClick={() => { setSortPopOpen(!sortPopOpen); setFilterPopOpen(false); setGroupPopOpen(false); }}>
                    <span className="meta-lbl">Sort:</span>
                    <span className="meta-val">{SORT_LABELS[effectiveSort]}</span>
                  </button>
                  {sortPopOpen && <SortPopover value={effectiveSort} onPick={(v) => { setSortChoice(v); setSortPopOpen(false); }} onClose={() => setSortPopOpen(false)} />}
                </div>
                <div className="lg-meta-btn-wrap">
                  <button className="lg-meta-btn" onClick={() => { setGroupPopOpen(!groupPopOpen); setSortPopOpen(false); setFilterPopOpen(false); }}>
                    <span className="meta-lbl">Group:</span>
                    <span className="meta-val">{GROUP_LABELS[effectiveGroup]}</span>
                  </button>
                  {groupPopOpen && <GroupPopover value={effectiveGroup} onPick={(v) => { setGroupChoice(v); setGroupPopOpen(false); }} onClose={() => setGroupPopOpen(false)} />}
                </div>
                <button className="lg-filter-export" onClick={exportCsv}>
                  <svg viewBox="0 0 12 12"><path d="M6 2v6M3 6l3 3 3-3M2 10.5h8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Export CSV
                </button>
                {hasActiveFilters && <button className="lg-reset-all" onClick={resetAll}>Reset all</button>}
              </div>
            </div>

            <div className="lg-col-header">
              <div>Date</div>
              <div>Reference</div>
              <div>Type</div>
              <div>Account</div>
              <div style={{ textAlign: "right" }}>Debit (Rp)</div>
              <div style={{ textAlign: "right" }}>Credit (Rp)</div>
              <div style={{ textAlign: "right" }}>Balance (Rp)</div>
              <div>Recon</div>
              <div />
            </div>

            <div>
              {groups ? (
                groups.map((g) => {
                  const isCollapsed = collapsedGroups.has(g.key);
                  return (
                    <div key={g.key}>
                      <div className="lg-group-head muted" onClick={() => toggleGroup(g.key)}>
                        <div className="lg-group-left">
                          <svg className={`lg-group-chevron${isCollapsed ? " closed" : ""}`} viewBox="0 0 9 9"><path d="M2 3l2.5 3L7 3"/></svg>
                          <span className="lg-group-lbl">{g.label}</span>
                          <span className="lg-group-count">{g.rows.length}</span>
                        </div>
                        {g.sum > 0 && (
                          <div className="lg-group-subtotal">
                            <span className="lg-group-subtotal-lbl">Debit</span>
                            Rp {fmtRp(g.sum)}
                          </div>
                        )}
                      </div>
                      {!isCollapsed && g.rows.map((r, i) => {
                        const anomaly = ANOMALY_FLAGS[r.jeId] && !dismissedAnoms.has(r.jeId) ? ANOMALIES[r.jeId] : null;
                        return (
                          <GlRow
                            key={r.id}
                            r={r}
                            anomaly={anomaly}
                            isAlt={i % 2 === 1}
                            isSelected={selectedJeId === r.jeId}
                            onClick={() => { setSelectedJeId(r.jeId); setDrawerTab("detail"); }}
                          />
                        );
                      })}
                    </div>
                  );
                })
              ) : (
                <>
                  {sortedRows.length === 0 && <div className="lg-empty">None rows matching</div>}
                  {sortedRows.map((r, i) => {
                    const anomaly = ANOMALY_FLAGS[r.jeId] && !dismissedAnoms.has(r.jeId) ? ANOMALIES[r.jeId] : null;
                    return (
                      <GlRow
                        key={r.id}
                        r={r}
                        anomaly={anomaly}
                        isAlt={i % 2 === 1}
                        isSelected={selectedJeId === r.jeId}
                        onClick={() => { setSelectedJeId(r.jeId); setDrawerTab("detail"); }}
                      />
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
          <span>Showing <span className="lg-footer-num">{filteredRows.length}</span> rows</span>
          <span className="lg-footer-sep">·</span>
          <span>Debit <span className="lg-footer-num">Rp {fmtRp(pageDebit)}</span></span>
          <span className="lg-footer-sep">·</span>
          <span>Credit <span className="lg-footer-num">Rp {fmtRp(pageCredit)}</span></span>
          <span className="lg-footer-sep">·</span>
          <span style={{ color: Math.abs(pageDebit - pageCredit) < 1 ? "var(--color-success-text)" : "var(--color-danger-text)" }}>
            {Math.abs(pageDebit - pageCredit) < 1 ? "✓ Balanced" : `Variance Rp ${fmtRp(Math.abs(pageDebit - pageCredit))}`}
          </span>
        </div>
        <div className="lg-footer-right">
          <span className="lg-footer-lbl">Closing balance</span>
          <span className="lg-footer-total">Rp {fmtRp(sortedRows.length > 0 ? sortedRows[sortedRows.length - 1].balance : runningBalance)}</span>
        </div>
      </div>

      {/* ── Side drawer (JE detail) ─────────────────────────────── */}
      {selectedJe && (
        <>
          <div className="drawer-overlay" onClick={() => setSelectedJeId(null)} />
          <div className="drawer">
            <div className="drawer-head">
              <div className="drawer-av invoice">JE</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="drawer-title">{selectedJe.je_number}</div>
                <div className="drawer-sub">{formatDate(selectedJe.je_date)} · {selectedJe.memo}</div>
              </div>
              <button className="drawer-close" onClick={() => setSelectedJeId(null)}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="drawer-tabs">
              {[["detail", "Detail"], ["lines", "Lines Journal"], ["audit", "Audit"], ["ai", "AI Insight"]].map(([t, label]) => (
                <div key={t} className={`drawer-tab${drawerTab === t ? " active" : ""}`} onClick={() => setDrawerTab(t)}>
                  {t === "ai" && <span style={{ marginRight: 4, color: "var(--color-action)" }}>✦</span>}
                  {label}
                  {t === "ai" && ANOMALY_FLAGS[selectedJe.je_number] && (
                    <span style={{ marginLeft: 5, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 9999, background: "var(--color-warning-surface)", color: "var(--color-warning-text)" }}>1</span>
                  )}
                </div>
              ))}
            </div>
            <div className="drawer-body">
              {drawerTab === "detail" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Information JE</div>
                  {[
                    ["Journal No.", selectedJe.je_number],
                    ["Date", formatDate(selectedJe.je_date)],
                    ["Status", selectedJe.status],
                    ["Type Reference", selectedJe.reference_type || "—"],
                    ["Dibuat oleh", selectedJe.created_by],
                    ["Posted oleh", selectedJe.posted_by || "—"],
                    ["Reconciliation", RECONCILIATION[selectedJe.je_number] === "matched" ? "✓ Matched" : "Belum"],
                  ].map(([label, value]) => (
                    <div key={label} className="drawer-row">
                      <div className="drawer-label">{label}</div>
                      <div className="drawer-value">{value}</div>
                    </div>
                  ))}
                  {ANOMALY_FLAGS[selectedJe.je_number] && (
                    <div style={{ marginTop: 10, padding: 10, background: "var(--color-warning-surface)", border: "1px solid var(--color-warning-border)", borderRadius: "var(--radius-md)", fontSize: 11, color: "var(--color-warning-text)" }}>
                      <strong>⚠ Anomaly detected</strong>
                      {ANOMALIES[selectedJe.je_number]?.detail && (
                        <div style={{ marginTop: 4, color: "var(--color-text-secondary)" }}>{ANOMALIES[selectedJe.je_number].detail}</div>
                      )}
                      <button
                        onClick={() => setDismissedAnoms((s) => new Set([...s, selectedJe.je_number]))}
                        style={{ marginTop: 8, fontSize: 11, padding: "4px 10px", background: "transparent", border: "1px solid var(--color-warning-border)", borderRadius: 4, color: "var(--color-warning-text)", cursor: "pointer" }}
                      >
                        Mark as valid
                      </button>
                    </div>
                  )}
                </div>
              )}
              {drawerTab === "lines" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Lines Journal · {selectedJe.lines.length} rows</div>
                  {selectedJe.lines.map((l, i) => (
                    <div key={i} style={{ background: "var(--color-surface-sunken)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-md)", padding: "10px 12px", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-action)" }}>{l.account_code}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{l.account_name}</div>
                          {l.description && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>{l.description}</div>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          {l.debit > 0 && <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700 }}>Dr {fmtRp(l.debit)}</div>}
                          {l.credit > 0 && <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--color-action)" }}>Cr {fmtRp(l.credit)}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {drawerTab === "audit" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Audit Trail</div>
                  <div className="drawer-row">
                    <div className="drawer-label">Dibuat</div>
                    <div className="drawer-value">{selectedJe.created_by} · {formatDate(selectedJe.created_date)}</div>
                  </div>
                  {selectedJe.posted_by && (
                    <div className="drawer-row">
                      <div className="drawer-label">Posted</div>
                      <div className="drawer-value">{selectedJe.posted_by} · {formatDate(selectedJe.posted_date)}</div>
                    </div>
                  )}
                  <div className="drawer-row">
                    <div className="drawer-label">Status</div>
                    <div className="drawer-value">{selectedJe.status}</div>
                  </div>
                </div>
              )}
              {drawerTab === "ai" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">AI Insight</div>
                  {ANOMALY_FLAGS[selectedJe.je_number] ? (
                    <div style={{ padding: 12, background: "var(--color-warning-surface)", border: "1px solid var(--color-warning-border)", borderRadius: "var(--radius-md)", marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-warning-text)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>⚠ Anomaly</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>Pasangan account tidak biasa for JE jenis ini</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
                        {ANOMALIES[selectedJe.je_number]?.detail || "Klay AI flagged this entry because payroll accrual pattern is up 16.9% vs average last 3 months."}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, background: "var(--color-success-surface)", border: "1px solid var(--color-success-border)", borderRadius: "var(--radius-md)", fontSize: 12, color: "var(--color-success-text)", marginBottom: 10 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      JE ini in pattern normal — none finding AI.
                    </div>
                  )}
                  <div style={{ padding: 12, background: "var(--ai-surface)", border: "1px solid var(--ai-border)", borderRadius: "var(--radius-md)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-action)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>✦ AI Classification</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
                      {selectedJe.lines.length} rows di-tag automatic with account that as of berdasarkan deskripsi.
                      Confidence: <strong>96%</strong>. Model v2.1.
                      {RECONCILIATION[selectedJe.je_number] === "matched" && (
                        <> Reconciliation bank automatic ✓ matched.</>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Klay AI drawers ────────────────────────────────────────── */}
      <div
        className={`ai-backdrop${aiOpen || summaryOpen ? " open" : ""}`}
        onClick={() => { setAiOpen(false); setSummaryOpen(false); }}
        aria-hidden={!(aiOpen || summaryOpen)}
      />
      <SummaryDrawer open={summaryOpen} insights={insights} onClose={() => setSummaryOpen(false)} onAsk={askAi} />
      <AiChatDrawer
        open={aiOpen}
        onClose={() => { setAiOpen(false); setAiSeedQuestion(null); }}
        initialQuestion={aiSeedQuestion}
        onConsumedInitialQuestion={() => setAiSeedQuestion(null)}
        context={aiContext}
        contextLabel="General Ledger"
      />

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
