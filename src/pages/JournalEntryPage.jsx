import { useState, useMemo, useEffect, useRef } from "react";
import { JOURNAL_ENTRIES } from "../data/seed/journalEntries";
import { TODAY } from "../lib/clock";
import { formatDate } from "../lib/format";
import AiChatDrawer from "./AiChatDrawer";
import SummaryDrawer from "./SummaryDrawer";
import { computeJournalInsights, makeJournalAiContext } from "./ai-journal-context";
import "./modules.css";
import "./invoices-ledger.css";

function fmtRp(n) {
  if (n == null) return "—";
  return n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

function lineSums(je) {
  let debit = 0, credit = 0;
  for (const l of je.lines) {
    debit += l.debit || 0;
    credit += l.credit || 0;
  }
  return { debit, credit };
}

const STATUS_LABEL = { posted: "Posted", draft: "Draft", pending: "Pending", void: "Void" };
const STATUS_BADGE_CLASS = { posted: "approved", draft: "draft", pending: "review", void: "rejected" };

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
          <SparkleIcon /> Summary
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

function JeRow({ r, isChecked, onCheck, onClick, onKebab, isSelected, isAlt }) {
  return (
    <div className={`lg-row${isSelected ? " selected" : ""}${isAlt ? " alt" : ""}`} onClick={onClick}>
      <div onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" className="lg-row-check" checked={isChecked} onChange={() => onCheck(r.je_number)} />
      </div>
      <div className="lg-cell-date">{formatDate(r.je_date)}</div>
      <div className="lg-cell-no">{r.je_number}</div>
      <div style={{ minWidth: 0, fontSize: 12, color: "var(--color-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {r.memo}
      </div>
      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "right", fontFamily: "var(--font-mono)" }}>
        {r.lines.length}
      </div>
      <div className="lg-cell-total">
        {r.debit > 0 ? <><span className="lg-cell-total-rp">Rp</span>{fmtRp(r.debit)}</> : <span className="lg-cell-em-dash">—</span>}
      </div>
      <div className="lg-cell-total">
        {r.credit > 0 ? <><span className="lg-cell-total-rp">Rp</span>{fmtRp(r.credit)}</> : <span className="lg-cell-em-dash">—</span>}
      </div>
      <div>
        <span className={`badge badge-${STATUS_BADGE_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
      </div>
      <div className="lg-cell-kebab" onClick={(e) => e.stopPropagation()}>
        <button className="lg-kebab" onClick={() => onKebab(r.je_number)}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
        </button>
      </div>
    </div>
  );
}

function RowMenu({ je, onClose, onAction }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);
  return (
    <div className="row-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <div className="row-menu-item" onClick={() => onAction("view", je)}>
        <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        View detail
      </div>
      {je.status === "draft" && (
        <div className="row-menu-item" onClick={() => onAction("post", je)}>
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          Post to GL
        </div>
      )}
      {je.status === "pending" && (
        <div className="row-menu-item" onClick={() => onAction("approve", je)}>
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          Approve
        </div>
      )}
      <div className="row-menu-item" onClick={() => onAction("edit", je)}>
        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Edit
      </div>
      <div className="row-menu-sep" />
      {je.status !== "void" && (
        <div className="row-menu-item danger" onClick={() => onAction("void", je)}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          Void journals
        </div>
      )}
    </div>
  );
}

const SORT_LABELS = {
  "date-desc":   "Newest date ↓",
  "date-asc":    "Date oldest ↑",
  "ref-asc":     "Reference A-Z",
  "ref-desc":    "Reference Z-A",
  "debit-desc":  "Debit highest ↓",
  "debit-asc":   "Debit lowest ↑",
  "lines-desc":  "Most lines ↓",
};
const GROUP_LABELS = {
  "none":   "—",
  "status": "Status",
  "month":  "Month",
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
    { k: "none",   lbl: "Not grouped" },
    { k: "status", lbl: "Status" },
    { k: "month",  lbl: "Month" },
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
  const toggleCreator = (c) => setDraft((d) => {
    const next = new Set(d.creators);
    next.has(c) ? next.delete(c) : next.add(c);
    return { ...d, creators: next };
  });
  const reset = () => setDraft({ creators: new Set(), minAmt: "", maxAmt: "", dateFrom: "", dateTo: "" });
  const apply = () => { onChange(draft); onClose(); };

  return (
    <div className="lg-popover lg-filter-pop" ref={ref}>
      <div className="lg-filter-body">
        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Dibuat oleh ({draft.creators.size > 0 ? `${draft.creators.size} selected` : "semua"})</div>
          <div className="lg-toggle-row">
            {["Sside Wijaya", "Rina Kusuma", "Budi Santoso", "Andi Prasetyo"].map((c) => (
              <button key={c} className={`lg-toggle${draft.creators.has(c) ? " on" : ""}`} onClick={() => toggleCreator(c)}>{c}</button>
            ))}
          </div>
        </div>
        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Range Debit (Rp)</div>
          <div className="lg-filter-row2">
            <input type="number" className="lg-filter-input" placeholder="Min" value={draft.minAmt} onChange={(e) => update({ minAmt: e.target.value })} />
            <span style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>—</span>
            <input type="number" className="lg-filter-input" placeholder="Max" value={draft.maxAmt} onChange={(e) => update({ maxAmt: e.target.value })} />
          </div>
        </div>
        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Period date</div>
          <div className="lg-filter-row2">
            <input type="date" className="lg-filter-input" value={draft.dateFrom} onChange={(e) => update({ dateFrom: e.target.value })} />
            <span style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>—</span>
            <input type="date" className="lg-filter-input" value={draft.dateTo} onChange={(e) => update({ dateTo: e.target.value })} />
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

export default function JournalEntryPage() {
  const allRows = useMemo(() => JOURNAL_ENTRIES.map((je) => {
    const { debit, credit } = lineSums(je);
    return { ...je, debit, credit };
  }), []);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState({ kind: "tab", value: "semua" });
  const [sortChoice, setSortChoice] = useState(null);
  const [groupChoice, setGroupChoice] = useState(null);
  const emptyFilters = { creators: new Set(), minAmt: "", maxAmt: "", dateFrom: "", dateTo: "" };
  const [filterValues, setFilterValues] = useState(emptyFilters);

  const [selectedId, setSelectedId] = useState(null);
  const [drawerTab, setDrawerTab] = useState("detail");
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
  function showToast(msg) {
    setToast(msg);
    if (toastTmr.current) clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToast(""), 1800);
  }

  const insights = useMemo(() => computeJournalInsights(JOURNAL_ENTRIES), []);
  const aiContext = useMemo(() => makeJournalAiContext(JOURNAL_ENTRIES), []);

  function askAi(question) {
    setSummaryOpen(false);
    setAiSeedQuestion(question);
    setAiOpen(true);
  }

  // ── KPIs ───────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c = { posted: 0, draft: 0, pending: 0, void: 0 };
    allRows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [allRows]);

  const kpis = [
    { lbl: "Total Journals",       card: "all",     val: String(allRows.length),  sub: `${counts.posted} posted`,    tone: "primary" },
    { lbl: "Draft",              card: "draft",   val: String(counts.draft),    sub: "not yet posted to GL",                tone: "warn"    },
    { lbl: "Pending Approval",   card: "pending", val: String(counts.pending),  sub: "awaiting decision",                 tone: "danger"  },
    { lbl: "Void",               card: "void",    val: String(counts.void),     sub: "dibatalkan",                         tone: "primary" },
  ];

  const tabCounts = useMemo(() => ({
    semua:   allRows.length,
    pending: counts.pending,
    draft:   counts.draft,
    posted:  counts.posted,
    void:    counts.void,
  }), [allRows, counts]);
  const tabs = [
    { k: "semua",   lbl: "All",   count: tabCounts.semua },
    { k: "pending", lbl: "Pending", count: tabCounts.pending },
    { k: "draft",   lbl: "Draft",   count: tabCounts.draft },
    { k: "posted",  lbl: "Posted",  count: tabCounts.posted },
    { k: "void",    lbl: "Void",    count: tabCounts.void },
  ];

  // ── Corpus ─────────────────────────────────────────────────────────────
  const corpus = useMemo(() => {
    let list = allRows;
    if (filter.kind === "tab" && filter.value !== "semua") list = list.filter((r) => r.status === filter.value);
    return list;
  }, [allRows, filter]);

  const hasActiveFilters = useMemo(() => (
    filterValues.creators.size > 0 ||
    filterValues.minAmt !== "" ||
    filterValues.maxAmt !== "" ||
    filterValues.dateFrom !== "" ||
    filterValues.dateTo !== "" ||
    sortChoice !== null ||
    groupChoice !== null
  ), [filterValues, sortChoice, groupChoice]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterValues.creators.size > 0) n++;
    if (filterValues.minAmt !== "" || filterValues.maxAmt !== "") n++;
    if (filterValues.dateFrom !== "" || filterValues.dateTo !== "") n++;
    return n;
  }, [filterValues]);

  // ── Apply filter + search ─────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let list = corpus;
    if (filterValues.creators.size > 0) list = list.filter((r) => filterValues.creators.has(r.created_by));
    const min = filterValues.minAmt === "" ? null : Number(filterValues.minAmt);
    const max = filterValues.maxAmt === "" ? null : Number(filterValues.maxAmt);
    if (min != null && !isNaN(min)) list = list.filter((r) => r.debit >= min);
    if (max != null && !isNaN(max)) list = list.filter((r) => r.debit <= max);
    if (filterValues.dateFrom) list = list.filter((r) => r.je_date >= filterValues.dateFrom);
    if (filterValues.dateTo) list = list.filter((r) => r.je_date <= filterValues.dateTo);
    const q = search.toLowerCase().trim();
    if (q) list = list.filter((r) =>
      r.je_number.toLowerCase().includes(q) ||
      r.memo.toLowerCase().includes(q),
    );
    return list;
  }, [corpus, filterValues, search]);

  // ── Sort + Group ───────────────────────────────────────────────────────
  const effectiveSort = sortChoice || "date-desc";
  const effectiveGroup = groupChoice || "none";

  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    switch (effectiveSort) {
      case "date-desc":  arr.sort((a, b) => (b.je_date || "").localeCompare(a.je_date || "")); break;
      case "date-asc":   arr.sort((a, b) => (a.je_date || "").localeCompare(b.je_date || "")); break;
      case "ref-asc":    arr.sort((a, b) => a.je_number.localeCompare(b.je_number)); break;
      case "ref-desc":   arr.sort((a, b) => b.je_number.localeCompare(a.je_number)); break;
      case "debit-desc": arr.sort((a, b) => b.debit - a.debit); break;
      case "debit-asc":  arr.sort((a, b) => a.debit - b.debit); break;
      case "lines-desc": arr.sort((a, b) => b.lines.length - a.lines.length); break;
      default: break;
    }
    return arr;
  }, [filteredRows, effectiveSort]);

  const groups = useMemo(() => {
    if (effectiveGroup === "none") return null;
    const keyFn = (r) => {
      if (effectiveGroup === "status") return STATUS_LABEL[r.status] || r.status;
      if (effectiveGroup === "month") {
        const [y, m] = r.je_date.split("-");
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
      kind: effectiveGroup,
    }));
  }, [effectiveGroup, sortedRows]);

  const selected = allRows.find((r) => r.je_number === selectedId);

  const pageDebit = filteredRows.reduce((s, r) => s + r.debit, 0);
  const pageCredit = filteredRows.reduce((s, r) => s + r.credit, 0);
  const selectedDebit = filteredRows.filter((r) => checked.has(r.je_number)).reduce((s, r) => s + r.debit, 0);

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
    if (c === null || c === "all") setFilter({ kind: "tab", value: "semua" });
    else                          setFilter({ kind: "tab", value: c });
    clearChecks();
  }
  const isTabActive  = (t) => filter.kind === "tab" && filter.value === t;
  const isCardActive = (c) => {
    if (c === "all") return filter.value === "semua";
    return filter.value === c;
  };

  function resetAll() {
    setSortChoice(null);
    setGroupChoice(null);
    setFilterValues(emptyFilters);
    setSearch("");
  }

  function exportCsv() {
    const headers = ["Journal No.", "Date", "Memo", "Status", "Lines", "Debit", "Credit", "Dibuat oleh"];
    const esc = (v) => {
      const s = String(v == null ? "" : v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of sortedRows) {
      lines.push([r.je_number, r.je_date, r.memo, r.status, r.lines.length, r.debit, r.credit, r.created_by].map(esc).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = `${TODAY.getFullYear()}${String(TODAY.getMonth() + 1).padStart(2, "0")}${String(TODAY.getDate()).padStart(2, "0")}`;
    a.download = `klay-journal-${filter.value}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`${sortedRows.length} journals exported to CSV`);
  }

  function onRowAction(action, je) {
    setMenuOpenFor(null);
    if (action === "view") setSelectedId(je.je_number);
    else if (action === "post") showToast(`${je.je_number} posted to GL`);
    else if (action === "approve") showToast(`${je.je_number} di-approve`);
    else if (action === "edit") showToast(`Edit ${je.je_number} (demo)`);
    else if (action === "void") showToast(`${je.je_number} voided`);
  }
  function onBulk(action) {
    const count = checked.size;
    if (action === "post") showToast(`${count} journals posted to GL`);
    else if (action === "approve") showToast(`${count} journals di-approve`);
    clearChecks();
  }

  return (
    <div className="lg-page">
      <div className="lg-scroll-container">
        {/* ── Editorial header ──────────────────────────────────────── */}
        <div className="lg-head">
          <div className="lg-head-top">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="lg-title">Journal Entry</h1>
              <AiSubtitle
                insights={insights}
                onOpenSummary={() => setSummaryOpen(true)}
                onOpenChat={() => setAiOpen(true)}
                chatActive={aiOpen}
                summaryActive={summaryOpen}
              />
            </div>
            <div className="lg-head-actions">
              <button className="lg-btn-brand" onClick={() => showToast("New Journal Entry — coming soon")}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Journal Entry
              </button>
            </div>
          </div>

          <div className="lg-kpi-strip">
            {kpis.map((k) => (
              <button
                type="button"
                className={`lg-kpi-cell${isCardActive(k.card) ? " active" : ""}`}
                key={k.lbl}
                onClick={() => selectCard(isCardActive(k.card) ? null : k.card)}
                aria-pressed={isCardActive(k.card)}
              >
                <div className="lg-kpi-lbl">{k.lbl}</div>
                <div className={`lg-kpi-val${k.tone === "danger" ? " danger" : k.tone === "warn" ? " warn" : ""}`}>{k.val}</div>
                <div className="lg-kpi-sub">{k.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Table card ─────────────────────────────────────────────── */}
        <div className="lg-table-wrap">
          <div className="lg-card lg-table-je">
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
                <input placeholder="Search journal number or memo…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
              <div><input type="checkbox" className="lg-row-check" disabled /></div>
              <div>Date</div>
              <div>Reference</div>
              <div>Description</div>
              <div style={{ textAlign: "right" }}>Lines</div>
              <div style={{ textAlign: "right" }}>Debit (Rp)</div>
              <div style={{ textAlign: "right" }}>Credit (Rp)</div>
              <div>Status</div>
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
                      {!isCollapsed && g.rows.map((r, i) => (
                        <div key={r.je_number} style={{ position: "relative" }}>
                          <JeRow
                            r={r}
                            isChecked={checked.has(r.je_number)}
                            onCheck={toggleRow}
                            onClick={() => { setSelectedId(r.je_number); setDrawerTab("detail"); }}
                            onKebab={(id) => setMenuOpenFor(menuOpenFor === id ? null : id)}
                            isSelected={selectedId === r.je_number}
                            isAlt={i % 2 === 1}
                          />
                          {menuOpenFor === r.je_number && (
                            <div style={{ position: "absolute", right: 32, top: 32, zIndex: 5 }}>
                              <RowMenu je={r} onClose={() => setMenuOpenFor(null)} onAction={onRowAction} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })
              ) : (
                <>
                  {sortedRows.length === 0 && <div className="lg-empty">None journals matching</div>}
                  {sortedRows.map((r, i) => (
                    <div key={r.je_number} style={{ position: "relative" }}>
                      <JeRow
                        r={r}
                        isChecked={checked.has(r.je_number)}
                        onCheck={toggleRow}
                        onClick={() => { setSelectedId(r.je_number); setDrawerTab("detail"); }}
                        onKebab={(id) => setMenuOpenFor(menuOpenFor === id ? null : id)}
                        isSelected={selectedId === r.je_number}
                        isAlt={i % 2 === 1}
                      />
                      {menuOpenFor === r.je_number && (
                        <div style={{ position: "absolute", right: 32, top: 32, zIndex: 5 }}>
                          <RowMenu je={r} onClose={() => setMenuOpenFor(null)} onAction={onRowAction} />
                        </div>
                      )}
                    </div>
                  ))}
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
              <button className="lg-footer-bulk-btn" onClick={() => onBulk("post")}>Post to GL</button>
              <button className="lg-footer-bulk-btn" onClick={() => onBulk("approve")}>Approve</button>
              <button className="lg-footer-clear" onClick={clearChecks}>Clear selection</button>
            </>
          ) : (
            <>
              <span className="lg-footer-sep">·</span>
              <span>Showing <span className="lg-footer-num">{filteredRows.length}</span> journals</span>
              <span className="lg-footer-sep">·</span>
              <span style={{ color: Math.abs(pageDebit - pageCredit) < 1 ? "var(--color-success-text)" : "var(--color-danger-text)" }}>
                {Math.abs(pageDebit - pageCredit) < 1 ? "✓ Balanced" : `Variance Rp ${fmtRp(Math.abs(pageDebit - pageCredit))}`}
              </span>
            </>
          )}
        </div>
        <div className="lg-footer-right">
          <span className="lg-footer-lbl">{checked.size > 0 ? "Debit selected" : "Debit page"}</span>
          <span className="lg-footer-total">Rp {fmtRp(checked.size > 0 ? selectedDebit : pageDebit)}</span>
        </div>
      </div>

      {/* ── Side drawer (JE detail) ─────────────────────────────── */}
      {selected && (
        <>
          <div className="drawer-overlay" onClick={() => setSelectedId(null)} />
          <div className="drawer">
            <div className="drawer-head">
              <div className="drawer-av invoice">JE</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="drawer-title">{selected.je_number}</div>
                <div className="drawer-sub">
                  {formatDate(selected.je_date)} ·{" "}
                  <span className={`badge badge-${STATUS_BADGE_CLASS[selected.status]}`}>{STATUS_LABEL[selected.status]}</span>
                </div>
              </div>
              <button className="drawer-close" onClick={() => setSelectedId(null)}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="drawer-tabs">
              {[["detail", "Detail"], ["lines", "Lines Journal"], ["audit", "Audit"], ["ai", "AI Insight"]].map(([t, label]) => (
                <div key={t} className={`drawer-tab${drawerTab === t ? " active" : ""}`} onClick={() => setDrawerTab(t)}>
                  {t === "ai" && <span style={{ marginRight: 4, color: "var(--color-action)" }}>✦</span>}
                  {label}
                </div>
              ))}
            </div>
            <div className="drawer-body">
              {drawerTab === "detail" && (
                <>
                  <div className="drawer-stat-row">
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">Total Debit</div>
                      <div className="drawer-stat-val">Rp {fmtRp(selected.debit)}</div>
                    </div>
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">Total Credit</div>
                      <div className="drawer-stat-val">Rp {fmtRp(selected.credit)}</div>
                    </div>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-section-title">Journal Information</div>
                    {[
                      ["Journal No.", selected.je_number],
                      ["Date", formatDate(selected.je_date)],
                      ["Description", selected.memo],
                      ["Type Reference", selected.reference_type || "—"],
                      ["Dibuat oleh", selected.created_by],
                      ["Date Dibuat", formatDate(selected.created_date)],
                      ["Posted oleh", selected.posted_by || "—"],
                      ["Date Posted", selected.posted_date ? formatDate(selected.posted_date) : "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="drawer-row">
                        <div className="drawer-label">{label}</div>
                        <div className="drawer-value">{value}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {drawerTab === "lines" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Lines Journal · {selected.lines.length} rows</div>
                  {selected.lines.map((l, i) => (
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
                    <div className="drawer-value">{selected.created_by} · {formatDate(selected.created_date)}</div>
                  </div>
                  {selected.posted_by && (
                    <div className="drawer-row">
                      <div className="drawer-label">Posted</div>
                      <div className="drawer-value">{selected.posted_by} · {formatDate(selected.posted_date)}</div>
                    </div>
                  )}
                  <div className="drawer-row">
                    <div className="drawer-label">Status sekarang</div>
                    <div className="drawer-value">
                      <span className={`badge badge-${STATUS_BADGE_CLASS[selected.status]}`}>{STATUS_LABEL[selected.status]}</span>
                    </div>
                  </div>
                </div>
              )}
              {drawerTab === "ai" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">AI Insight</div>
                  <div style={{ padding: 12, background: "var(--ai-surface)", border: "1px solid var(--ai-border)", borderRadius: "var(--radius-md)", marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-action)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>✦ AI Classification</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
                      {selected.lines.length} rows di-tag automatic berdasarkan deskripsi & pattern historical. Akurasi average <strong>96%</strong>, model v2.1.
                    </div>
                  </div>
                  {selected.status === "draft" && (
                    <div style={{ padding: 12, background: "var(--color-warning-surface)", border: "1px solid var(--color-warning-border)", borderRadius: "var(--radius-md)", marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-warning-text)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>Recommendation</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
                        Draft ini siap posted — semua rows balanced and account already terklasificashi.
                      </div>
                    </div>
                  )}
                  {selected.status === "pending" && (
                    <div style={{ padding: 12, background: "var(--color-warning-surface)", border: "1px solid var(--color-warning-border)", borderRadius: "var(--radius-md)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-warning-text)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>Awaiting Approval</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
                        Already awaiting {Math.max(1, Math.floor((new Date("2025-04-23") - new Date(selected.created_date)) / 86400000))} days. Perteambangkan eskalasi to whichger.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="drawer-footer">
              <button className="drawer-btn ghost">
                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </button>
              {selected.status === "draft" && (
                <button className="drawer-btn primary">
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  Post to GL
                </button>
              )}
              {selected.status === "pending" && (
                <button className="drawer-btn primary">
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  Approve
                </button>
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
        contextLabel="Journal Entry"
      />

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
