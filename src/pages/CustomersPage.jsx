import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { INVOICES as invoices } from "../data/seed/invoices";
import { TODAY, daysSince } from "../lib/clock";
import { formatRupiah, formatDate, initials } from "../lib/format";
import { useCustomers } from "../state/CustomersContext";
import AiChatDrawer from "./AiChatDrawer";
import SummaryDrawer from "./SummaryDrawer";
import { computeCustomersInsights, makeCustomersAiContext } from "./ai-customers-context";
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
          <SparkleIcon /> Ringkasan
        </button>
        <button type="button" className={`lg-ai-cta-secondary${chatActive ? " active" : ""}`} onClick={onOpenChat}>
          {chatActive ? "Lanjutkan obrolan" : "Tanya Klay AI"} →
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

function CustomerRow({ r, isChecked, onCheck, onClick, onKebab, isSelected, isAlt }) {
  const stale = r.lastInv && daysSince(r.lastInv) >= 60 && r.active;
  const overLimit = r.creditLimit > 0 && r.ar > r.creditLimit;
  const dotTone = !r.active ? "muted" : (overLimit || r.arOverdue) ? "" : stale ? "warn" : (r.ar > 0 ? "" : "success");
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
          <div className="lg-cell-customer-addr">{r.contact}{r.email ? ` · ${r.email}` : ""}</div>
        </div>
      </div>
      <div>
        <span className={`type-badge ${r.type}`}>{r.type === "perusahaan" ? "Perusahaan" : "Individu"}</span>
      </div>
      <div className="lg-cell-date">{r.top}</div>
      <div style={{ fontSize: 11, color: stale ? "var(--color-warning-text)" : "var(--color-text-tertiary)", fontWeight: stale ? 600 : 400 }}>
        {r.lastInv ? (
          <>
            {formatDate(r.lastInv)}
            {stale && <div style={{ fontSize: 10, marginTop: 1 }}>{daysSince(r.lastInv)} hari lalu</div>}
          </>
        ) : (
          <span className="lg-cell-em-dash">—</span>
        )}
      </div>
      <div className="lg-cell-total" style={(r.arOverdue || overLimit) ? { color: "var(--color-danger-text)" } : undefined}>
        {r.ar > 0 ? (
          <>
            <span className="lg-cell-total-rp">Rp</span>{fmtRp(r.ar)}
          </>
        ) : (
          <span className="lg-cell-em-dash">—</span>
        )}
      </div>
      <div>
        <span className={`status-badge ${r.active ? "active" : "inactive"}`}>{r.active ? "Aktif" : "Non-aktif"}</span>
      </div>
      <div className="lg-cell-kebab" onClick={(e) => e.stopPropagation()}>
        <button className="lg-kebab" onClick={() => onKebab(r.id)}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
        </button>
      </div>
    </div>
  );
}

function RowMenu({ customer, onClose, onAction }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);
  return (
    <div className="row-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <div className="row-menu-item" onClick={() => onAction("edit", customer)}>
        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Edit
      </div>
      <div className="row-menu-item" onClick={() => onAction("newInvoice", customer)}>
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        Buat Invoice Baru
      </div>
      <div className="row-menu-item" onClick={() => onAction("reminder", customer)}>
        <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><polyline points="4 4 12 13 20 4"/></svg>
        Kirim Reminder
      </div>
      <div className="row-menu-sep" />
      {customer.active ? (
        <div className="row-menu-item" onClick={() => onAction("deactivate", customer)}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          Non-aktifkan
        </div>
      ) : (
        <div className="row-menu-item" onClick={() => onAction("activate", customer)}>
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          Aktifkan kembali
        </div>
      )}
      <div className="row-menu-item danger" onClick={() => onAction("archive", customer)}>
        <svg viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
        Arsipkan
      </div>
    </div>
  );
}

const SORT_LABELS = {
  "name-asc":     "Nama A-Z",
  "name-desc":    "Nama Z-A",
  "ar-desc":      "AR Balance tertinggi ↓",
  "ar-asc":       "AR Balance terendah ↑",
  "limit-desc":   "Credit Limit tertinggi ↓",
  "limit-asc":    "Credit Limit terendah ↑",
  "lastinv-desc": "Invoice terbaru ↓",
  "lastinv-asc":  "Invoice terlama ↑",
  "code-asc":     "Kode A-Z",
};
const GROUP_LABELS = {
  "none":   "—",
  "type":   "Tipe",
  "status": "Status",
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
    { k: "none",   lbl: "Tidak dikelompokkan" },
    { k: "type",   lbl: "Tipe (Perusahaan / Individu)" },
    { k: "status", lbl: "Status" },
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
  const toggleType = (t) => setDraft((d) => {
    const next = new Set(d.types);
    next.has(t) ? next.delete(t) : next.add(t);
    return { ...d, types: next };
  });
  const toggleTerm = (t) => setDraft((d) => {
    const next = new Set(d.terms);
    next.has(t) ? next.delete(t) : next.add(t);
    return { ...d, terms: next };
  });

  const reset = () => setDraft({ types: new Set(), terms: new Set(), minAr: "", maxAr: "" });
  const apply = () => { onChange(draft); onClose(); };

  const types = [["perusahaan", "Perusahaan"], ["individu", "Individu"]];
  const allTerms = ["COD", "NET 7", "NET 14", "NET 15", "NET 21", "NET 30", "NET 45", "NET 60"];

  return (
    <div className="lg-popover lg-filter-pop" ref={ref}>
      <div className="lg-filter-body">
        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Tipe ({draft.types.size > 0 ? `${draft.types.size} dipilih` : "semua"})</div>
          <div className="lg-toggle-row">
            {types.map(([v, lbl]) => (
              <button key={v} className={`lg-toggle${draft.types.has(v) ? " on" : ""}`} onClick={() => toggleType(v)}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Payment Terms ({draft.terms.size > 0 ? `${draft.terms.size} dipilih` : "semua"})</div>
          <div className="lg-toggle-row">
            {allTerms.map((t) => (
              <button key={t} className={`lg-toggle${draft.terms.has(t) ? " on" : ""}`} onClick={() => toggleTerm(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Rentang AR Balance (Rp)</div>
          <div className="lg-filter-row2">
            <input type="number" className="lg-filter-input" placeholder="Min" value={draft.minAr} onChange={(e) => update({ minAr: e.target.value })} />
            <span style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>—</span>
            <input type="number" className="lg-filter-input" placeholder="Max" value={draft.maxAr} onChange={(e) => update({ maxAr: e.target.value })} />
          </div>
        </div>
      </div>
      <div className="lg-filter-foot">
        <button className="lg-filter-reset" onClick={reset}>Reset</button>
        <button className="lg-filter-apply" onClick={apply}>Terapkan filter</button>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const navigate = useNavigate();
  const { customers } = useCustomers();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState({ kind: "tab", value: "semua" });
  const [sortChoice, setSortChoice] = useState(null);
  const [groupChoice, setGroupChoice] = useState(null);
  const emptyFilters = { types: new Set(), terms: new Set(), minAr: "", maxAr: "" };
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

  const insights = useMemo(() => computeCustomersInsights(customers), [customers]);
  const aiContext = useMemo(() => makeCustomersAiContext(customers), [customers]);

  function askAi(question) {
    setSummaryOpen(false);
    setAiSeedQuestion(question);
    setAiOpen(true);
  }

  // ── KPIs ───────────────────────────────────────────────────────────────
  const totalAr = customers.reduce((s, c) => s + (c.ar || 0), 0);
  const arCusts = customers.filter((c) => (c.ar || 0) > 0);
  const overdueCusts = customers.filter((c) => c.arOverdue && c.active);
  const inactiveCusts = customers.filter((c) => !c.active);
  const activeCount = customers.filter((c) => c.active).length;

  const kpis = [
    { lbl: "Total Customer",   card: "all",      val: String(customers.length),      sub: `${activeCount} aktif`,           tone: "primary" },
    { lbl: "Outstanding AR",   card: "ar",       val: "Rp " + fmtRp(totalAr),        sub: `${arCusts.length} customer`,     tone: "danger"  },
    { lbl: "Jatuh Tempo",      card: "overdue",  val: String(overdueCusts.length),   sub: "ada invoice telat",              tone: "danger"  },
    { lbl: "Non-aktif",        card: "inactive", val: String(inactiveCusts.length),  sub: "perlu di-review",                tone: "primary" },
  ];

  // ── Tab counts ─────────────────────────────────────────────────────────
  const tabCounts = useMemo(() => ({
    semua:    customers.length,
    aktif:    activeCount,
    ar:       arCusts.length,
    overdue:  overdueCusts.length,
    inactive: inactiveCusts.length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  const tabs = [
    { k: "semua",    lbl: "Semua",       count: tabCounts.semua },
    { k: "aktif",    lbl: "Aktif",       count: tabCounts.aktif },
    { k: "ar",       lbl: "Punya AR",    count: tabCounts.ar },
    { k: "overdue",  lbl: "Jatuh Tempo", count: tabCounts.overdue },
    { k: "inactive", lbl: "Non-aktif",   count: tabCounts.inactive },
  ];

  // ── Corpus ─────────────────────────────────────────────────────────────
  const corpus = useMemo(() => {
    let list = customers;
    if (filter.kind === "tab") {
      if (filter.value === "aktif")        list = list.filter((c) => c.active);
      else if (filter.value === "ar")      list = list.filter((c) => (c.ar || 0) > 0);
      else if (filter.value === "overdue") list = list.filter((c) => c.arOverdue && c.active);
      else if (filter.value === "inactive")list = list.filter((c) => !c.active);
    }
    return list;
  }, [filter]);

  const hasActiveFilters = useMemo(() => (
    filterValues.types.size > 0 ||
    filterValues.terms.size > 0 ||
    filterValues.minAr !== "" ||
    filterValues.maxAr !== "" ||
    sortChoice !== null ||
    groupChoice !== null
  ), [filterValues, sortChoice, groupChoice]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterValues.types.size > 0) n++;
    if (filterValues.terms.size > 0) n++;
    if (filterValues.minAr !== "" || filterValues.maxAr !== "") n++;
    return n;
  }, [filterValues]);

  // ── Apply filter values + search ───────────────────────────────────────
  const filteredRows = useMemo(() => {
    let list = corpus;
    if (filterValues.types.size > 0) list = list.filter((c) => filterValues.types.has(c.type));
    if (filterValues.terms.size > 0) list = list.filter((c) => filterValues.terms.has(c.top));
    const min = filterValues.minAr === "" ? null : Number(filterValues.minAr);
    const max = filterValues.maxAr === "" ? null : Number(filterValues.maxAr);
    if (min != null && !isNaN(min)) list = list.filter((c) => (c.ar || 0) >= min);
    if (max != null && !isNaN(max)) list = list.filter((c) => (c.ar || 0) <= max);

    const q = search.toLowerCase().trim();
    if (q) list = list.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.contacts?.[0]?.name && c.contacts[0].name.toLowerCase().includes(q)),
    );
    return list.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      contact: c.contacts?.[0]?.name || "—",
      email: c.contacts?.[0]?.email || "",
      address: c.address,
      type: c.type,
      active: c.active,
      top: c.top,
      lastInv: c.lastInv,
      ar: c.ar || 0,
      arOverdue: c.arOverdue,
      creditLimit: c.creditLimit || 0,
      raw: c,
    }));
  }, [corpus, filterValues, search]);

  // ── Sort + Group ───────────────────────────────────────────────────────
  const effectiveSort = sortChoice || "name-asc";
  const effectiveGroup = groupChoice || "none";

  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    switch (effectiveSort) {
      case "name-asc":     arr.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "name-desc":    arr.sort((a, b) => b.name.localeCompare(a.name)); break;
      case "ar-desc":      arr.sort((a, b) => b.ar - a.ar); break;
      case "ar-asc":       arr.sort((a, b) => a.ar - b.ar); break;
      case "limit-desc":   arr.sort((a, b) => b.creditLimit - a.creditLimit); break;
      case "limit-asc":    arr.sort((a, b) => a.creditLimit - b.creditLimit); break;
      case "lastinv-desc": arr.sort((a, b) => (b.lastInv || "").localeCompare(a.lastInv || "")); break;
      case "lastinv-asc":  arr.sort((a, b) => (a.lastInv || "").localeCompare(b.lastInv || "")); break;
      case "code-asc":     arr.sort((a, b) => a.code.localeCompare(b.code)); break;
      default: break;
    }
    return arr;
  }, [filteredRows, effectiveSort]);

  const groups = useMemo(() => {
    if (effectiveGroup === "none") return null;
    const keyFn = (r) => {
      if (effectiveGroup === "type") return r.type === "perusahaan" ? "Perusahaan" : "Individu";
      if (effectiveGroup === "status") return r.active ? "Aktif" : "Non-aktif";
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
      sum: rows.reduce((s, r) => s + r.ar, 0),
      tone: "muted",
      kind: effectiveGroup,
    }));
  }, [effectiveGroup, sortedRows]);

  const selected = customers.find((c) => c.id === selectedId);
  const custInvoices = selected ? (invoices || []).filter((inv) => inv.customer === selected.id) : [];

  const pageTotal = filteredRows.reduce((s, r) => s + r.ar, 0);
  const selectedTotal = filteredRows.filter((r) => checked.has(r.id)).reduce((s, r) => s + r.ar, 0);

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
    else if (c === "ar")           setFilter({ kind: "tab", value: "ar" });
    else if (c === "overdue")      setFilter({ kind: "tab", value: "overdue" });
    else if (c === "inactive")     setFilter({ kind: "tab", value: "inactive" });
    clearChecks();
  }
  const isTabActive  = (t) => filter.kind === "tab" && filter.value === t;
  const isCardActive = (c) => {
    if (c === "all") return filter.value === "semua";
    if (c === "ar") return filter.value === "ar";
    if (c === "overdue") return filter.value === "overdue";
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
    const headers = ["Kode", "Nama", "Tipe", "PIC", "Email", "Alamat", "NPWP", "Terms", "Credit Limit", "AR Balance", "Status", "Last Invoice"];
    const esc = (v) => {
      const s = String(v == null ? "" : v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of sortedRows) {
      lines.push([r.code, r.name, r.type, r.contact, r.email, r.address, r.raw.npwp || "", r.top, r.creditLimit, r.ar, r.active ? "active" : "inactive", r.lastInv || ""].map(esc).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = `${TODAY.getFullYear()}${String(TODAY.getMonth() + 1).padStart(2, "0")}${String(TODAY.getDate()).padStart(2, "0")}`;
    a.download = `klay-customers-${filter.value}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`${sortedRows.length} customer diekspor ke CSV`);
  }

  function onRowAction(action, c) {
    setMenuOpenFor(null);
    if (action === "edit") showToast(`Edit ${c.name} (demo)`);
    else if (action === "newInvoice") showToast(`Buat Invoice baru untuk ${c.name}`);
    else if (action === "reminder") showToast(`Reminder dikirim ke ${c.name}`);
    else if (action === "activate") showToast(`${c.name} diaktifkan kembali`);
    else if (action === "deactivate") showToast(`${c.name} di-nonaktifkan`);
    else if (action === "archive") showToast(`${c.name} diarsipkan`);
  }
  function onBulk(action) {
    const count = checked.size;
    if (action === "reminder") showToast(`Reminder dikirim ke ${count} customer`);
    else if (action === "archive") showToast(`${count} customer diarsipkan`);
    clearChecks();
  }

  return (
    <div className="lg-page">
      <div className="lg-scroll-container">
        {/* ── Editorial header ──────────────────────────────────────── */}
        <div className="lg-head">
          <div className="lg-head-top">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="lg-title">Customers</h1>
              <AiSubtitle
                insights={insights}
                onOpenSummary={() => setSummaryOpen(true)}
                onOpenChat={() => setAiOpen(true)}
                chatActive={aiOpen}
                summaryActive={summaryOpen}
              />
            </div>
            <div className="lg-head-actions">
              <button className="lg-btn-brand" onClick={() => navigate("/customers/new")}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Tambah Customer
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
          <div className="lg-card lg-table-customer">
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
                <input placeholder="Cari nama, kode, atau PIC customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                    <span className="meta-lbl">Urut:</span>
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
                  Ekspor CSV
                </button>
                {hasActiveFilters && <button className="lg-reset-all" onClick={resetAll}>Reset semua</button>}
              </div>
            </div>

            <div className="lg-col-header">
              <div><input type="checkbox" className="lg-row-check" disabled /></div>
              <div>Kode</div>
              <div>Customer</div>
              <div>Tipe</div>
              <div>Terms</div>
              <div>Invoice Terakhir</div>
              <div style={{ textAlign: "right" }}>AR Balance</div>
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
                          <CustomerRow
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
                              <RowMenu customer={r.raw} onClose={() => setMenuOpenFor(null)} onAction={onRowAction} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })
              ) : (
                <>
                  {sortedRows.length === 0 && <div className="lg-empty">Tidak ada customer yang cocok</div>}
                  {sortedRows.map((r, i) => (
                    <div key={r.id} style={{ position: "relative" }}>
                      <CustomerRow
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
                          <RowMenu customer={r.raw} onClose={() => setMenuOpenFor(null)} onAction={onRowAction} />
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
          <span><span className="lg-footer-num">{checked.size}</span> dipilih</span>
          {checked.size > 0 ? (
            <>
              <button className="lg-footer-bulk-btn" onClick={() => onBulk("reminder")}>Kirim Reminder</button>
              <button className="lg-footer-bulk-btn" onClick={() => onBulk("archive")}>Arsipkan</button>
              <button className="lg-footer-clear" onClick={clearChecks}>Batal pilih</button>
            </>
          ) : (
            <>
              <span className="lg-footer-sep">·</span>
              <span>Menampilkan <span className="lg-footer-num">{filteredRows.length}</span> customer</span>
            </>
          )}
        </div>
        <div className="lg-footer-right">
          <span className="lg-footer-lbl">{checked.size > 0 ? "Outstanding terpilih" : "Outstanding halaman"}</span>
          <span className="lg-footer-total">Rp {fmtRp(checked.size > 0 ? selectedTotal : pageTotal)}</span>
        </div>
      </div>

      {/* ── Side drawer (customer detail) ─────────────────────────── */}
      {selected && (
        <>
          <div className="drawer-overlay" onClick={() => setSelectedId(null)} />
          <div className="drawer">
            <div className="drawer-head">
              <div className={`drawer-av ${selected.type}`}>{initials(selected.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="drawer-title">{selected.name}</div>
                <div className="drawer-sub" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {selected.code}
                  <span className={`type-badge ${selected.type}`}>{selected.type === "perusahaan" ? "Perusahaan" : "Individu"}</span>
                </div>
              </div>
              <button className="drawer-close" onClick={() => setSelectedId(null)}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="drawer-tabs">
              {[["detail", "Detail"], ["contacts", "Kontak"], ["invoices", "Invoice"]].map(([t, label]) => (
                <div key={t} className={`drawer-tab${drawerTab === t ? " active" : ""}`} onClick={() => setDrawerTab(t)}>{label}</div>
              ))}
            </div>
            <div className="drawer-body">
              {drawerTab === "detail" && (
                <>
                  <div className="drawer-stat-row">
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">AR Aktif</div>
                      <div className={`drawer-stat-val${selected.arOverdue ? " danger" : ""}`}>{formatRupiah(selected.ar)}</div>
                    </div>
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">Total Invoice</div>
                      <div className="drawer-stat-val">{selected.totalInv}</div>
                    </div>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-section-title">Informasi Customer</div>
                    {[
                      ["Nama Legal", selected.legalName || selected.name],
                      ["Kode", selected.code],
                      ["NPWP", selected.npwp || "—"],
                      ["Alamat", selected.address],
                      ["Terms", selected.top],
                      ["Credit Limit", selected.creditLimit > 0 ? formatRupiah(selected.creditLimit) : "—"],
                      ["Invoice Terakhir", selected.lastInv ? formatDate(selected.lastInv) : "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="drawer-row">
                        <div className="drawer-label">{label}</div>
                        <div className="drawer-value">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-section-title">Pengaturan Invoice</div>
                    {[
                      ["Mode Invoice", selected.invMode === "auto" ? "Otomatis" : "Manual"],
                      ["Channel Kirim", selected.invCh?.length > 0 ? selected.invCh.join(", ") : "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="drawer-row">
                        <div className="drawer-label">{label}</div>
                        <div className="drawer-value">{value}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {drawerTab === "contacts" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Kontak</div>
                  {selected.contacts.map((ct, i) => (
                    <div key={i} style={{ background: "var(--color-surface-sunken)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-md)", padding: "12px 14px", marginBottom: 8 }}>
                      {ct.primary && <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-action)", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>PIC Utama</div>}
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{ct.name}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 6 }}>{ct.title}</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{ct.phone}</div>
                      {ct.email && <div style={{ fontSize: 12, color: "var(--color-action)" }}>{ct.email}</div>}
                    </div>
                  ))}
                </div>
              )}
              {drawerTab === "invoices" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Invoice</div>
                  {custInvoices.length === 0
                    ? <div style={{ color: "var(--color-text-tertiary)", fontSize: 12, padding: "12px 0" }}>Belum ada invoice.</div>
                    : custInvoices.map((inv) => (
                      <div key={inv.id} style={{ background: "var(--color-surface-sunken)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-md)", padding: "10px 12px", marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-action)" }}>{inv.invNo}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{inv.items?.[0]?.desc}</div>
                            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>Jatuh tempo: {inv.due}</div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700 }}>{formatRupiah(inv.total)}</div>
                            <span className={`badge badge-${inv.payStatus}`} style={{ marginTop: 4, display: "inline-flex" }}>
                              {inv.payStatus === "lunas" ? "Lunas" : inv.payStatus === "overdue" ? "Jatuh Tempo" : inv.payStatus === "belumbayar" ? "Belum Bayar" : inv.payStatus}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  }
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
                Buat Invoice
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
        contextLabel="Customers"
      />

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
