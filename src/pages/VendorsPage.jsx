import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BILLS as bills } from "../data/seed/bills";
import { useVendors } from "../state/VendorsContext";
import { CAT_LABELS, PPH_LABELS, ACCT_LABELS, DEFTAX_LABELS } from "../data/labels";
import { TODAY, daysSince } from "../lib/clock";
import { formatRupiah, formatDate, initials } from "../lib/format";
import AiChatDrawer from "./AiChatDrawer";
import SummaryDrawer from "./SummaryDrawer";
import { computeVendorsInsights, makeVendorsAiContext } from "./ai-vendors-context";
import "./modules.css";
import "./invoices-ledger.css";

function fmtRp(n) {
  if (n == null) return "—";
  return n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
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

function VendorRow({ r, isChecked, onCheck, onClick, onKebab, isSelected, isAlt }) {
  const stale = daysSince(r.lastTx) > 60 && r.status === "active";
  const dotTone = r.status === "inactive" ? "muted" : stale ? "warn" : (r.apBalance > 0 ? "" : "success");
  return (
    <div className={`lg-row${isSelected ? " selected" : ""}${isAlt ? " alt" : ""}`} onClick={onClick}>
      <div onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" className="lg-row-check" checked={isChecked} onChange={() => onCheck(r.id)} />
      </div>
      <div className="lg-cell-no">{r.code}</div>
      <div className="lg-cell-customer">
        <span className={`lg-cell-customer-dot${dotTone ? " " + dotTone : ""}`} />
        <div className="lg-cell-customer-body">
          <div className="lg-cell-customer-name">{r.name}</div>
          <div className="lg-cell-customer-addr">{r.contact} · {r.email}</div>
        </div>
      </div>
      <div>
        <span className={`cat-badge ${r.category}`}>{CAT_LABELS[r.category] || r.category}</span>
      </div>
      <div className="lg-cell-date">{r.payment_terms}</div>
      <div style={{ fontSize: 11, color: stale ? "var(--color-warning-text)" : "var(--color-text-tertiary)", fontWeight: stale ? 600 : 400 }}>
        {r.lastTx ? (
          <>
            {formatDate(r.lastTx)}
            {stale && <div style={{ fontSize: 10, marginTop: 1 }}>{daysSince(r.lastTx)} days ago</div>}
          </>
        ) : (
          <span className="lg-cell-em-dash">—</span>
        )}
      </div>
      <div className="lg-cell-total">
        {r.apBalance > 0 ? (
          <>
            <span className="lg-cell-total-rp">Rp</span>{fmtRp(r.apBalance)}
          </>
        ) : (
          <span className="lg-cell-em-dash">—</span>
        )}
      </div>
      <div>
        <span className={`status-badge ${r.status}`}>{r.status === "active" ? "Active" : "Inactive"}</span>
      </div>
      <div className="lg-cell-kebab" onClick={(e) => e.stopPropagation()}>
        <button className="lg-kebab" onClick={() => onKebab(r.id)}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
        </button>
      </div>
    </div>
  );
}

function RowMenu({ vendor, onClose, onAction }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);
  return (
    <div className="row-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <div className="row-menu-item" onClick={() => onAction("edit", vendor)}>
        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Edit
      </div>
      <div className="row-menu-item" onClick={() => onAction("newBill", vendor)}>
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        New Bill
      </div>
      <div className="row-menu-item" onClick={() => onAction("duplicate", vendor)}>
        <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        Duplicate
      </div>
      <div className="row-menu-sep" />
      {vendor.status === "active" ? (
        <div className="row-menu-item" onClick={() => onAction("deactivate", vendor)}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          Deactivate
        </div>
      ) : (
        <div className="row-menu-item" onClick={() => onAction("activate", vendor)}>
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          Reactivate
        </div>
      )}
      <div className="row-menu-item danger" onClick={() => onAction("archive", vendor)}>
        <svg viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
        Archive
      </div>
    </div>
  );
}

const SORT_LABELS = {
  "name-asc":     "Name A-Z",
  "name-desc":    "Name Z-A",
  "ap-desc":      "AP Balance highest ↓",
  "ap-asc":       "AP Balance lowest ↑",
  "lasttx-desc":  "Transactions newest ↓",
  "lasttx-asc":   "Transactions oldest ↑",
  "code-asc":     "Code A-Z",
};
const GROUP_LABELS = {
  "none":     "—",
  "category": "Category",
  "status":   "Status",
  "type":     "Type",
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
    { k: "none",     lbl: "Not grouped" },
    { k: "category", lbl: "Category" },
    { k: "status",   lbl: "Status" },
    { k: "type",     lbl: "Type (Company / Cooperative / Individualal)" },
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
  const toggleCat = (c) => setDraft((d) => {
    const next = new Set(d.categories);
    next.has(c) ? next.delete(c) : next.add(c);
    return { ...d, categories: next };
  });
  const toggleTerm = (t) => setDraft((d) => {
    const next = new Set(d.terms);
    next.has(t) ? next.delete(t) : next.add(t);
    return { ...d, terms: next };
  });

  const reset = () => setDraft({ categories: new Set(), terms: new Set(), minAp: "", maxAp: "" });
  const apply = () => { onChange(draft); onClose(); };

  const categories = ["inventory", "service", "expense", "cooperative", "individual"];
  const allTerms = ["NET 7", "NET 15", "NET 30", "NET 45", "NET 60"];

  return (
    <div className="lg-popover lg-filter-pop" ref={ref}>
      <div className="lg-filter-body">
        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Category ({draft.categories.size > 0 ? `${draft.categories.size} selected` : "semua"})</div>
          <div className="lg-toggle-row">
            {categories.map((c) => (
              <button key={c} className={`lg-toggle${draft.categories.has(c) ? " on" : ""}`} onClick={() => toggleCat(c)}>
                {CAT_LABELS[c] || c}
              </button>
            ))}
          </div>
        </div>

        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Payment Terms ({draft.terms.size > 0 ? `${draft.terms.size} selected` : "semua"})</div>
          <div className="lg-toggle-row">
            {allTerms.map((t) => (
              <button key={t} className={`lg-toggle${draft.terms.has(t) ? " on" : ""}`} onClick={() => toggleTerm(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Range AP Balance (Rp)</div>
          <div className="lg-filter-row2">
            <input type="number" className="lg-filter-input" placeholder="Min" value={draft.minAp} onChange={(e) => update({ minAp: e.target.value })} />
            <span style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>—</span>
            <input type="number" className="lg-filter-input" placeholder="Max" value={draft.maxAp} onChange={(e) => update({ maxAp: e.target.value })} />
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

// ─── Page ───────────────────────────────────────────────────────────────────

export default function VendorsPage() {
  const navigate = useNavigate();
  const { vendors } = useVendors();
  // AP balance as of vendor (derived from bills)
  const apBalance = useMemo(() => {
    const m = {};
    for (const b of bills) {
      if (b.pay === "paid") continue;
      m[b.vendor] = (m[b.vendor] || 0) + b.sisa;
    }
    return m;
  }, []);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState({ kind: "tab", value: "semua" });
  const [sortChoice, setSortChoice] = useState(null);
  const [groupChoice, setGroupChoice] = useState(null);
  const emptyFilters = { categories: new Set(), terms: new Set(), minAp: "", maxAp: "" };
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

  const insights = useMemo(() => computeVendorsInsights(vendors), [vendors]);
  const aiContext = useMemo(() => makeVendorsAiContext(vendors), [vendors]);

  function askAi(question) {
    setSummaryOpen(false);
    setAiSeedQuestion(question);
    setAiOpen(true);
  }

  // ── KPIs ───────────────────────────────────────────────────────────────
  const totalAp = Object.values(apBalance).reduce((s, n) => s + n, 0);
  const apVendors = vendors.filter((v) => (apBalance[v.id] || 0) > 0);
  const staleVendors = vendors.filter((v) => v.status === "active" && daysSince(v.lastTx) > 60);
  const inactiveVendors = vendors.filter((v) => v.status === "inactive");
  const activeCount = vendors.filter((v) => v.status === "active").length;

  const kpis = [
    { lbl: "Total Vendors",     card: "all",      val: String(vendors.length),     sub: `${activeCount} active`,             tone: "primary" },
    { lbl: "Outstanding AP",   card: "ap",       val: "Rp " + fmtRp(totalAp),     sub: `${apVendors.length} vendor`,       tone: "danger"  },
    { lbl: "Stale 60+ Days",   card: "stale",    val: String(staleVendors.length), sub: "none transactions",             tone: "warn"    },
    { lbl: "Inactive",        card: "inactive", val: String(inactiveVendors.length), sub: "needs review",              tone: "primary" },
  ];

  // ── Tab counts ─────────────────────────────────────────────────────────
  const tabCounts = useMemo(() => ({
    semua:    vendors.length,
    active:    activeCount,
    ap:       apVendors.length,
    stale:    staleVendors.length,
    inactive: inactiveVendors.length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  const tabs = [
    { k: "semua",    lbl: "All",          count: tabCounts.semua },
    { k: "active",    lbl: "Active",          count: tabCounts.active },
    { k: "ap",       lbl: "With AP",       count: tabCounts.ap },
    { k: "stale",    lbl: "Stale 60+",      count: tabCounts.stale },
    { k: "inactive", lbl: "Inactive",      count: tabCounts.inactive },
  ];

  // ── Corpus ─────────────────────────────────────────────────────────────
  const corpus = useMemo(() => {
    let list = vendors;
    if (filter.kind === "tab") {
      if (filter.value === "active")        list = list.filter((v) => v.status === "active");
      else if (filter.value === "ap")      list = list.filter((v) => (apBalance[v.id] || 0) > 0);
      else if (filter.value === "stale")   list = list.filter((v) => v.status === "active" && daysSince(v.lastTx) > 60);
      else if (filter.value === "inactive")list = list.filter((v) => v.status === "inactive");
    } else if (filter.kind === "card") {
      if (filter.value === "ap")           list = list.filter((v) => (apBalance[v.id] || 0) > 0);
      else if (filter.value === "stale")   list = list.filter((v) => v.status === "active" && daysSince(v.lastTx) > 60);
      else if (filter.value === "inactive")list = list.filter((v) => v.status === "inactive");
    }
    return list;
  }, [filter, apBalance]);

  const hasActiveFilters = useMemo(() => (
    filterValues.categories.size > 0 ||
    filterValues.terms.size > 0 ||
    filterValues.minAp !== "" ||
    filterValues.maxAp !== "" ||
    sortChoice !== null ||
    groupChoice !== null
  ), [filterValues, sortChoice, groupChoice]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterValues.categories.size > 0) n++;
    if (filterValues.terms.size > 0) n++;
    if (filterValues.minAp !== "" || filterValues.maxAp !== "") n++;
    return n;
  }, [filterValues]);

  // ── Apply filter values + search ───────────────────────────────────────
  const filteredRows = useMemo(() => {
    let list = corpus;
    if (filterValues.categories.size > 0) list = list.filter((v) => filterValues.categories.has(v.category));
    if (filterValues.terms.size > 0) list = list.filter((v) => filterValues.terms.has(v.payment_terms));
    const min = filterValues.minAp === "" ? null : Number(filterValues.minAp);
    const max = filterValues.maxAp === "" ? null : Number(filterValues.maxAp);
    if (min != null && !isNaN(min)) list = list.filter((v) => (apBalance[v.id] || 0) >= min);
    if (max != null && !isNaN(max)) list = list.filter((v) => (apBalance[v.id] || 0) <= max);

    const q = search.toLowerCase().trim();
    if (q) list = list.filter((v) =>
      v.name.toLowerCase().includes(q) ||
      v.code.toLowerCase().includes(q) ||
      (v.contact && v.contact.toLowerCase().includes(q)),
    );
    return list.map((v) => ({
      id: v.id,
      code: v.code,
      name: v.name,
      contact: v.contact,
      email: v.email,
      address: v.address,
      category: v.category,
      type: v.type,
      status: v.status,
      payment_terms: v.payment_terms,
      lastTx: v.lastTx,
      apBalance: apBalance[v.id] || 0,
      raw: v,
    }));
  }, [corpus, filterValues, search, apBalance]);

  // ── Sort + Group ───────────────────────────────────────────────────────
  const effectiveSort = sortChoice || "name-asc";
  const effectiveGroup = groupChoice || "none";

  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    switch (effectiveSort) {
      case "name-asc":    arr.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "name-desc":   arr.sort((a, b) => b.name.localeCompare(a.name)); break;
      case "ap-desc":     arr.sort((a, b) => b.apBalance - a.apBalance); break;
      case "ap-asc":      arr.sort((a, b) => a.apBalance - b.apBalance); break;
      case "lasttx-desc": arr.sort((a, b) => (b.lastTx || "").localeCompare(a.lastTx || "")); break;
      case "lasttx-asc":  arr.sort((a, b) => (a.lastTx || "").localeCompare(b.lastTx || "")); break;
      case "code-asc":    arr.sort((a, b) => a.code.localeCompare(b.code)); break;
      default: break;
    }
    return arr;
  }, [filteredRows, effectiveSort]);

  const groups = useMemo(() => {
    if (effectiveGroup === "none") return null;
    const keyFn = (r) => {
      if (effectiveGroup === "category") return CAT_LABELS[r.category] || r.category;
      if (effectiveGroup === "status") return r.status === "active" ? "Active" : "Inactive";
      if (effectiveGroup === "type") return r.type === "company" ? "Company" : r.type === "cooperative" ? "Cooperative" : "Individualal";
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
      sum: rows.reduce((s, r) => s + r.apBalance, 0),
      tone: "muted",
      kind: effectiveGroup,
    }));
  }, [effectiveGroup, sortedRows]);

  const selected = vendors.find((v) => v.id === selectedId);

  const pageTotal = filteredRows.reduce((s, r) => s + r.apBalance, 0);
  const selectedTotal = filteredRows.filter((r) => checked.has(r.id)).reduce((s, r) => s + r.apBalance, 0);

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
    else if (c === "ap")           setFilter({ kind: "tab", value: "ap" });
    else if (c === "stale")        setFilter({ kind: "tab", value: "stale" });
    else if (c === "inactive")     setFilter({ kind: "tab", value: "inactive" });
    clearChecks();
  }
  const isTabActive  = (t) => filter.kind === "tab" && filter.value === t;
  const isCardActive = (c) => {
    if (c === "all") return filter.value === "semua";
    if (c === "ap") return filter.value === "ap";
    if (c === "stale") return filter.value === "stale";
    if (c === "inactive") return filter.value === "inactive";
    return false;
  };

  function resetAll() {
    setSortChoice(null);
    setGroupChoice(null);
    setFilterValues(emptyFilters);
    setSearch("");
  }

  function exportCsv() {
    const headers = ["Code", "Name", "Category", "Type", "PIC", "Email", "Telepon", "Address", "NPWP", "Terms", "Status", "Last Transaction", "AP Balance"];
    const esc = (v) => {
      const s = String(v == null ? "" : v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of sortedRows) {
      lines.push([r.code, r.name, CAT_LABELS[r.category] || r.category, r.type, r.contact, r.email, r.raw.phone, r.address, r.raw.tax_id || "", r.payment_terms, r.status, r.lastTx, r.apBalance].map(esc).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = `${TODAY.getFullYear()}${String(TODAY.getMonth() + 1).padStart(2, "0")}${String(TODAY.getDate()).padStart(2, "0")}`;
    a.download = `klay-vendors-${filter.value}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`${sortedRows.length} vendor exported to CSV`);
  }

  function onRowAction(action, v) {
    setMenuOpenFor(null);
    if (action === "edit") showToast(`Edit ${v.name} (demo)`);
    else if (action === "newBill") showToast(`Create Bill baru for ${v.name}`);
    else if (action === "duplicate") showToast(`Duplicate ${v.name}`);
    else if (action === "activate") showToast(`${v.name} diactivekan kembali`);
    else if (action === "deactivate") showToast(`${v.name} di-nonactivekan`);
    else if (action === "archive") showToast(`${v.name} diarsipkan`);
  }
  function onBulk(action) {
    const count = checked.size;
    if (action === "archive") showToast(`${count} vendor diarsipkan`);
    clearChecks();
  }

  return (
    <div className="lg-page">
      <div className="lg-scroll-container">
        {/* ── Editorial header ──────────────────────────────────────── */}
        <div className="lg-head">
          <div className="lg-head-top">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="lg-title">Vendors</h1>
              <AiSubtitle
                insights={insights}
                onOpenSummary={() => setSummaryOpen(true)}
                onOpenChat={() => setAiOpen(true)}
                chatActive={aiOpen}
                summaryActive={summaryOpen}
              />
            </div>
            <div className="lg-head-actions">
              <button className="lg-btn-brand" onClick={() => navigate("/vendors/new")}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Vendor
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
          <div className="lg-card lg-table-vendor">
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
                <input placeholder="Search vendor name, code, or contact…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
              <div>Code</div>
              <div>Vendor</div>
              <div>Category</div>
              <div>Terms</div>
              <div>Transactions Last</div>
              <div style={{ textAlign: "right" }}>AP Balance</div>
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
                            <span className="lg-group-subtotal-lbl">Outstanding</span>
                            Rp {fmtRp(g.sum)}
                          </div>
                        )}
                      </div>
                      {!isCollapsed && g.rows.map((r, i) => (
                        <div key={r.id} style={{ position: "relative" }}>
                          <VendorRow
                            r={r}
                            isChecked={checked.has(r.id)}
                            onCheck={toggleRow}
                            onClick={() => { setSelectedId(r.id); setDrawerTab("detail"); }}
                            onKebab={(id) => setMenuOpenFor(menuOpenFor === id ? null : id)}
                            isSelected={selectedId === r.id}
                            isAlt={i % 2 === 1}
                          />
                          {menuOpenFor === r.id && (
                            <div style={{ position: "absolute", right: 32, top: 32, zIndex: 5 }}>
                              <RowMenu vendor={r.raw} onClose={() => setMenuOpenFor(null)} onAction={onRowAction} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })
              ) : (
                <>
                  {sortedRows.length === 0 && <div className="lg-empty">None vendor matching</div>}
                  {sortedRows.map((r, i) => (
                    <div key={r.id} style={{ position: "relative" }}>
                      <VendorRow
                        r={r}
                        isChecked={checked.has(r.id)}
                        onCheck={toggleRow}
                        onClick={() => { setSelectedId(r.id); setDrawerTab("detail"); }}
                        onKebab={(id) => setMenuOpenFor(menuOpenFor === id ? null : id)}
                        isSelected={selectedId === r.id}
                        isAlt={i % 2 === 1}
                      />
                      {menuOpenFor === r.id && (
                        <div style={{ position: "absolute", right: 32, top: 32, zIndex: 5 }}>
                          <RowMenu vendor={r.raw} onClose={() => setMenuOpenFor(null)} onAction={onRowAction} />
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
              <button className="lg-footer-bulk-btn" onClick={() => onBulk("archive")}>Archive</button>
              <button className="lg-footer-clear" onClick={clearChecks}>Clear selection</button>
            </>
          ) : (
            <>
              <span className="lg-footer-sep">·</span>
              <span>Showing <span className="lg-footer-num">{filteredRows.length}</span> vendors</span>
            </>
          )}
        </div>
        <div className="lg-footer-right">
          <span className="lg-footer-lbl">{checked.size > 0 ? "Outstanding (selected)" : "Outstanding (page)"}</span>
          <span className="lg-footer-total">Rp {fmtRp(checked.size > 0 ? selectedTotal : pageTotal)}</span>
        </div>
      </div>

      {/* ── Side drawer (vendor detail) ───────────────────────────── */}
      {selected && (
        <>
          <div className="drawer-overlay" onClick={() => setSelectedId(null)} />
          <div className="drawer">
            <div className="drawer-head">
              <div className={`drawer-av ${selected.category}`}>{selected.initials || initials(selected.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="drawer-title">{selected.name}</div>
                <div className="drawer-sub">{selected.code} · <span className={`cat-badge ${selected.category}`}>{CAT_LABELS[selected.category]}</span></div>
              </div>
              <button className="drawer-close" onClick={() => setSelectedId(null)}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="drawer-tabs">
              {["detail", "bank", "bills", "ai"].map((t) => (
                <div key={t} className={`drawer-tab${drawerTab === t ? " active" : ""}`} onClick={() => setDrawerTab(t)}>
                  {t === "ai" && <span style={{ marginRight: 4, color: "var(--color-action)" }}>✦</span>}
                  {t === "detail" ? "Detail" : t === "bank" ? "Bank" : t === "bills" ? "Bill History" : "AI Insight"}
                </div>
              ))}
            </div>
            <div className="drawer-body">
              {drawerTab === "detail" && (
                <>
                  <div className="drawer-stat-row">
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">AP Balance</div>
                      <div className={`drawer-stat-val${(apBalance[selected.id] || 0) > 0 ? " danger" : ""}`}>{formatRupiah(apBalance[selected.id] || 0)}</div>
                    </div>
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">Terms</div>
                      <div className="drawer-stat-val" style={{ fontSize: 13 }}>{selected.payment_terms}</div>
                    </div>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-section-title">Vendor Information</div>
                    {[
                      ["Legal Name", selected.name],
                      ["Code", selected.code],
                      ["Type", selected.type],
                      ["PIC / Contact", selected.contact],
                      ["Telepon", selected.phone],
                      ["Email", selected.email],
                      ["Address", selected.address],
                      ["NPWP", selected.tax_id || "—"],
                      ["Status PKP", selected.pkp],
                    ].map(([label, value]) => (
                      <div key={label} className="drawer-row">
                        <div className="drawer-label">{label}</div>
                        <div className="drawer-value">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-section-title">Accounttansi & Tax</div>
                    {[
                      ["Account Default", ACCT_LABELS[selected.acct] || selected.acct],
                      ["Tax Default", DEFTAX_LABELS[selected.defTax] || selected.defTax],
                      ["PPh Pemotongan", PPH_LABELS[selected.pph] || selected.pph],
                    ].map(([label, value]) => (
                      <div key={label} className="drawer-row">
                        <div className="drawer-label">{label}</div>
                        <div className="drawer-value">{value}</div>
                      </div>
                    ))}
                  </div>
                  {selected.notes && (
                    <div className="drawer-section">
                      <div className="drawer-section-title">Notes</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.6, padding: "6px 0" }}>{selected.notes}</div>
                    </div>
                  )}
                </>
              )}
              {drawerTab === "bank" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Bank Account</div>
                  {selected.banks.map((bank, i) => (
                    <div key={i} style={{ background: "var(--color-surface-sunken)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-md)", padding: "12px 14px", marginBottom: 8 }}>
                      {bank.isDefault && <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-action)", marginBottom: 6, letterSpacing: ".06em", textTransform: "uppercase" }}>Default</div>}
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>{bank.name} — {bank.branch}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: ".05em" }}>{bank.acc}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 4 }}>a/n {bank.holder}</div>
                    </div>
                  ))}
                </div>
              )}
              {drawerTab === "bills" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Transaction History</div>
                  <div className="drawer-row">
                    <div className="drawer-label">Last</div>
                    <div className="drawer-value">{selected.lastTx || "—"}</div>
                  </div>
                  <div className="drawer-row">
                    <div className="drawer-label">AP Saat Ini</div>
                    <div className="drawer-value mono">{formatRupiah(apBalance[selected.id] || 0)}</div>
                  </div>
                </div>
              )}
              {drawerTab === "ai" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">AI Insight</div>
                  <div style={{ padding: 12, background: "var(--ai-surface)", border: "1px solid var(--ai-border)", borderRadius: "var(--radius-md)", marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-action)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>✦ Vendor Profile</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
                      Klay AI mevalue vendor ini as <strong>{selected.status === "active" ? "active & reliable" : "needs review"}</strong> berdasarkan pattern payment historical and compliance pajak.
                    </div>
                  </div>
                  {(apBalance[selected.id] || 0) > 50000000 && (
                    <div style={{ padding: 12, background: "var(--color-warning-surface)", border: "1px solid var(--color-warning-border)", borderRadius: "var(--radius-md)", marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-warning-text)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>High AP Concentration</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
                        AP balance to vendor ini <strong>{formatRupiah(apBalance[selected.id] || 0)}</strong> — perteambangkan diversificashi supplier for mengurangi konsentrasi risiko.
                      </div>
                    </div>
                  )}
                  <div style={{ padding: 12, background: "var(--color-surface-sunken)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-md)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>Recommendation</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
                      Default account: <strong>{ACCT_LABELS[selected.acct] || selected.acct}</strong>. Tax default: <strong>{DEFTAX_LABELS[selected.defTax] || "—"}</strong>. Setting ini akan automatic dipakai saat Create Bill from vendor ini.
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="drawer-footer">
              <button className="drawer-btn ghost">
                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </button>
              <button className="drawer-btn primary">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                New Bill
              </button>
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
        contextLabel="Vendors"
      />

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
