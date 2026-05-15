import { useState, useMemo, useEffect, useRef } from "react";
import { VENDORS as vendors } from "../data/seed/vendors";
import { BILLS as bills } from "../data/seed/bills";
import { TODAY, daysSince } from "../lib/clock";
import { formatRupiah, formatDate, initials } from "../lib/format";
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

const APPROVAL_LABEL = { approved: "Approved", review: "Review", draft: "Draft" };
const PAY_LABEL = { paid: "Lunas", unpaid: "Belum Bayar", overdue: "Jatuh Tempo" };
const GRN_LABEL = { matched: "Matched", pending: "Pending", mismatch: "Mismatch" };

function payBadgeClass(pay) {
  if (pay === "paid") return "badge-lunas";
  if (pay === "overdue") return "badge-overdue";
  return "badge-belumbayar";
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
  { key: "90+",    lbl: "Telat > 90 hari",    minDays: 90, maxDaysCap: 150, tone: "danger" },
  { key: "60-90",  lbl: "Telat 60 – 90 hari", minDays: 60, maxDaysCap: 90,  tone: "danger" },
  { key: "30-60",  lbl: "Telat 30 – 60 hari", minDays: 30, maxDaysCap: 60,  tone: "warn"   },
  { key: "0-30",   lbl: "Telat < 30 hari",    minDays:  0, maxDaysCap: 30,  tone: "warn"   },
];
function bucketOf(d) {
  if (d >= 90) return "90+";
  if (d >= 60) return "60-90";
  if (d >= 30) return "30-60";
  if (d >= 0)  return "0-30";
  return null;
}

const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function formatMonthLabel(yyyymm) {
  if (!yyyymm || yyyymm.length < 7) return "—";
  const [y, m] = yyyymm.split("-");
  return `${MONTHS_ID[parseInt(m, 10) - 1] || m} ${y}`;
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

function LedgerRow({ r, bucket, isChecked, onCheck, onClick, onKebab, isSelected, isAlt }) {
  const isOverdue = r.pay === "overdue" && r.daysOverdue > 0;
  const isLunas = r.pay === "paid";
  const isDraft = r.approval === "draft";
  const isReview = r.approval === "review";
  const dotTone =
    isOverdue ? (bucket?.tone === "warn" ? "warn" : "") :
    isLunas ? "success" :
    "muted";
  const pct = isOverdue && bucket
    ? Math.min(100, Math.max(8, ((r.daysOverdue - bucket.minDays) / ((bucket.maxDaysCap - bucket.minDays) || 30)) * 100))
    : 0;
  return (
    <div className={`lg-row${isSelected ? " selected" : ""}${isAlt ? " alt" : ""}`} onClick={onClick}>
      <div onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" className="lg-row-check" checked={isChecked} onChange={() => onCheck(r.id)} />
      </div>
      <div className="lg-cell-no">{r.no}</div>
      <div className="lg-cell-date">{r.tgl}</div>
      <div className="lg-cell-customer">
        <span className={`lg-cell-customer-dot${dotTone ? " " + dotTone : ""}`} />
        <div className="lg-cell-customer-body">
          <div className="lg-cell-customer-name">{r.co}</div>
          <div className="lg-cell-customer-addr">{r.addr}</div>
        </div>
      </div>
      <div className="lg-cell-days">
        {isOverdue ? (
          <>{r.daysOverdue}<span className="lg-cell-days-suffix">d</span></>
        ) : (
          <span className="lg-cell-em-dash">—</span>
        )}
      </div>
      <div className="lg-cell-due">{r.due}</div>
      <div>
        {isOverdue ? (
          <>
            <div className="lg-cell-aging-track">
              <div className={`lg-cell-aging-fill${bucket?.tone === "warn" ? " warn" : ""}`} style={{ width: pct + "%" }} />
            </div>
            <div className="lg-cell-aging-scale">{bucket.minDays} ←—— {bucket.maxDaysCap} hari</div>
          </>
        ) : isLunas ? (
          <span className="lg-cell-status-marker success"><span className="dot" />Lunas</span>
        ) : isReview ? (
          <span className="lg-cell-status-marker"><span className="dot" />Menunggu approval</span>
        ) : isDraft ? (
          <span className="lg-cell-status-marker"><span className="dot" />Draft</span>
        ) : (
          <span className="lg-cell-status-marker"><span className="dot" />Dalam term</span>
        )}
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
          Setujui
        </div>
      )}
      {canPay && (
        <div className="row-menu-item" onClick={() => onAction("pay", inv)}>
          <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          Catat Pembayaran
        </div>
      )}
      <div className="row-menu-item" onClick={() => onAction("duplicate", inv)}>
        <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        Duplikat
      </div>
      <div className="row-menu-sep" />
      <div className="row-menu-item danger" onClick={() => onAction("archive", inv)}>
        <svg viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
        Arsipkan
      </div>
    </div>
  );
}

const SORT_LABELS = {
  "hari-telat-desc": "Hari Telat ↓",
  "tanggal-desc":    "Tanggal terbaru ↓",
  "tanggal-asc":     "Tanggal terlama ↑",
  "total-desc":      "Total tertinggi ↓",
  "total-asc":       "Total terendah ↑",
  "vendor-asc":      "Vendor A-Z",
  "vendor-desc":     "Vendor Z-A",
};
const GROUP_LABELS = {
  "none":   "—",
  "aging":  "Aging",
  "vendor": "Vendor",
  "bulan":  "Bulan",
  "status": "Status Bayar",
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
    { k: "none",   lbl: "Tidak dikelompokkan" },
    { k: "aging",  lbl: "Aging", disabled: !canAging },
    { k: "vendor", lbl: "Vendor" },
    { k: "bulan",  lbl: "Bulan (Tanggal Bill)" },
    { k: "status", lbl: "Status Bayar" },
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

function FilterPopover({ values, onChange, vendors: vendorList, onClose }) {
  const ref = useRef(null);
  useClickOutside(ref, onClose);
  const [draft, setDraft] = useState(values);
  const [vendorSearch, setVendorSearch] = useState("");

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const toggleVendor = (id) => setDraft((d) => {
    const next = new Set(d.vendors);
    next.has(id) ? next.delete(id) : next.add(id);
    return { ...d, vendors: next };
  });
  const filteredV = vendorList.filter((v) => !vendorSearch || v.name.toLowerCase().includes(vendorSearch.toLowerCase()));
  const reset = () => setDraft({ vendors: new Set(), minAmount: "", maxAmount: "", dateFrom: "", dateTo: "", dateField: "date", grn: "all" });
  const apply = () => { onChange(draft); onClose(); };

  return (
    <div className="lg-popover lg-filter-pop" ref={ref}>
      <div className="lg-filter-body">
        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Vendor ({draft.vendors.size > 0 ? `${draft.vendors.size} dipilih` : "semua"})</div>
          <div className="lg-cust-multi">
            <div className="lg-cust-search">
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="5" cy="5" r="3"/><path d="M7.5 7.5l3 3"/></svg>
              <input value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)} placeholder="Cari vendor…" />
            </div>
            <div className="lg-cust-list">
              {filteredV.length === 0 && <div className="lg-cust-empty">Tidak ada vendor cocok</div>}
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
          <div className="lg-filter-fld-lbl">Rentang Nominal (Rp)</div>
          <div className="lg-filter-row2">
            <input type="number" className="lg-filter-input" placeholder="Min" value={draft.minAmount} onChange={(e) => update({ minAmount: e.target.value })} />
            <span style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>—</span>
            <input type="number" className="lg-filter-input" placeholder="Max" value={draft.maxAmount} onChange={(e) => update({ maxAmount: e.target.value })} />
          </div>
        </div>

        <div className="lg-filter-fld">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="lg-filter-fld-lbl">Rentang Tanggal</div>
            <div className="lg-segmented">
              <button className={`lg-seg${draft.dateField === "date" ? " on" : ""}`} onClick={() => update({ dateField: "date" })}>Tanggal Bill</button>
              <button className={`lg-seg${draft.dateField === "due" ? " on" : ""}`} onClick={() => update({ dateField: "due" })}>Jatuh Tempo</button>
            </div>
          </div>
          <div className="lg-filter-row2">
            <input type="date" className="lg-filter-input" value={draft.dateFrom} onChange={(e) => update({ dateFrom: e.target.value })} />
            <span style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>—</span>
            <input type="date" className="lg-filter-input" value={draft.dateTo} onChange={(e) => update({ dateTo: e.target.value })} />
          </div>
        </div>

        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Status GRN</div>
          <div className="lg-toggle-row">
            {[["all", "Semua"], ["matched", "Matched"], ["pending", "Pending"], ["mismatch", "Mismatch"]].map(([k, lbl]) => (
              <button key={k} className={`lg-toggle${draft.grn === k ? " on" : ""}`} onClick={() => update({ grn: k })}>{lbl}</button>
            ))}
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

export default function BillsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState({ kind: "tab", value: "jatuhtempo" });
  const [sortChoice, setSortChoice] = useState(null);
  const [groupChoice, setGroupChoice] = useState(null);
  const emptyFilters = { vendors: new Set(), minAmount: "", maxAmount: "", dateFrom: "", dateTo: "", dateField: "date", grn: "all" };
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

  const monthPfx = useMemo(() => `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, "0")}`, []);

  // ── KPIs ───────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const active = bills.filter((b) => b.pay !== "paid");
    const totalAP = active.reduce((s, b) => s + b.sisa, 0);
    const overdue = bills.filter((b) => b.pay === "overdue");
    const overdueThisMonth = overdue.filter((b) => b.due && b.due.startsWith(monthPfx));
    const thisMonth = bills.filter((b) => b.date && b.date.startsWith(monthPfx));
    return [
      { lbl: "Total Utang AP",        card: "total",        val: "Rp " + fmtRp(totalAP),                                       sub: active.length + " bill aktif",                                       tone: "primary" },
      { lbl: "Jatuh Tempo",           card: "overdue",      val: "Rp " + fmtRp(overdue.reduce((s, b) => s + b.sisa, 0)),       sub: overdue.length + " bill telat",                                       tone: "danger"  },
      { lbl: "Jatuh Tempo Bulan Ini", card: "overdueMonth", val: String(overdueThisMonth.length),                              sub: "Rp " + fmtRp(overdueThisMonth.reduce((s, b) => s + b.sisa, 0)),      tone: "warn"    },
      { lbl: "Dibuat Bulan Ini",      card: "thisMonth",    val: "Rp " + fmtRp(thisMonth.reduce((s, b) => s + b.total, 0)),    sub: thisMonth.length + " bill baru",                                      tone: "primary" },
    ];
  }, [monthPfx]);

  const insights = useMemo(() => computeBillsInsights(bills), []);
  const aiContext = useMemo(() => makeBillsAiContext(bills), []);

  function askAi(question) {
    setSummaryOpen(false);
    setAiSeedQuestion(question);
    setAiOpen(true);
  }

  // ── Tab counts ─────────────────────────────────────────────────────────
  const tabCounts = useMemo(() => ({
    semua:      bills.length,
    approved:   bills.filter((b) => b.approval === "approved").length,
    review:     bills.filter((b) => b.approval === "review").length,
    draft:      bills.filter((b) => b.approval === "draft").length,
    jatuhtempo: bills.filter((b) => b.pay === "overdue").length,
    lunas:      bills.filter((b) => b.pay === "paid").length,
  }), []);

  const tabs = [
    { k: "semua",      lbl: "Semua",       count: tabCounts.semua },
    { k: "approved",   lbl: "Approved",    count: tabCounts.approved },
    { k: "review",     lbl: "Review",      count: tabCounts.review },
    { k: "draft",      lbl: "Draft",       count: tabCounts.draft },
    { k: "jatuhtempo", lbl: "Jatuh Tempo", count: tabCounts.jatuhtempo },
    { k: "lunas",      lbl: "Lunas",       count: tabCounts.lunas },
  ];

  // ── Corpus ─────────────────────────────────────────────────────────────
  const corpus = useMemo(() => {
    let list = bills;
    if (filter.kind === "tab") {
      if (filter.value === "approved")       list = list.filter((b) => b.approval === "approved");
      else if (filter.value === "review")    list = list.filter((b) => b.approval === "review");
      else if (filter.value === "draft")     list = list.filter((b) => b.approval === "draft");
      else if (filter.value === "jatuhtempo")list = list.filter((b) => b.pay === "overdue");
      else if (filter.value === "lunas")     list = list.filter((b) => b.pay === "paid");
    } else if (filter.kind === "card") {
      if (filter.value === "total")              list = list.filter((b) => b.pay !== "paid");
      else if (filter.value === "overdueMonth")  list = list.filter((b) => b.pay === "overdue" && b.due && b.due.startsWith(monthPfx));
      else if (filter.value === "thisMonth")     list = list.filter((b) => b.date && b.date.startsWith(monthPfx));
    }
    return list;
  }, [filter, monthPfx]);

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

    const q = search.toLowerCase().trim();
    if (q) list = list.filter((b) =>
      b.id.toLowerCase().includes(q) ||
      (b.invNo && b.invNo.toLowerCase().includes(q)) ||
      b.vendorName.toLowerCase().includes(q) ||
      (b.poNo && b.poNo.toLowerCase().includes(q)),
    );
    return list.map(toRow);
  }, [corpus, filterValues, search]);

  // ── Sort + Group ───────────────────────────────────────────────────────
  const onJatuhTempo = filter.kind === "tab" && filter.value === "jatuhtempo";
  const onLunas      = filter.kind === "tab" && filter.value === "lunas";
  const onDraft      = filter.kind === "tab" && filter.value === "draft";

  const effectiveSort  = sortChoice  || (onJatuhTempo ? "hari-telat-desc" : "tanggal-desc");
  const effectiveGroup = groupChoice || (onJatuhTempo ? "aging" : "none");

  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    switch (effectiveSort) {
      case "hari-telat-desc": arr.sort((a, b) => b.daysOverdue - a.daysOverdue); break;
      case "tanggal-desc":    arr.sort((a, b) => (b.raw.date || "").localeCompare(a.raw.date || "")); break;
      case "tanggal-asc":     arr.sort((a, b) => (a.raw.date || "").localeCompare(b.raw.date || "")); break;
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
        if (r.pay === "paid") return "Lunas";
        if (r.pay === "overdue") return "Jatuh Tempo";
        if (r.approval === "draft") return "Draft";
        if (r.approval === "review") return "Review";
        return "Belum Bayar";
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

  const selected = bills.find((b) => b.id === selectedId);
  const selectedVendor = selected ? vendors.find((v) => v.id === selected.vendor) : null;

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

  function resetAll() {
    setSortChoice(null);
    setGroupChoice(null);
    setFilterValues(emptyFilters);
    setSearch("");
  }

  function exportCsv() {
    const headers = ["Bill", "No. Invoice Vendor", "Tanggal", "Vendor", "Alamat", "Jatuh Tempo", "Hari Telat", "Total", "Approval", "Status Bayar"];
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
    showToast(`${sortedRows.length} bill diekspor ke CSV`);
  }

  function onRowAction(action, b) {
    setMenuOpenFor(null);
    if (action === "edit") showToast(`Edit ${b.id} (demo)`);
    else if (action === "approve") showToast(`${b.id} disetujui`);
    else if (action === "pay") showToast(`Catat pembayaran untuk ${b.id}`);
    else if (action === "duplicate") showToast(`Duplikat ${b.id}`);
    else if (action === "archive") showToast(`${b.id} diarsipkan`);
  }
  function onBulk(action) {
    const count = checked.size;
    if (action === "approve") showToast(`${count} bill disetujui`);
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
              <AiSubtitle
                insights={insights}
                onOpenSummary={() => setSummaryOpen(true)}
                onOpenChat={() => setAiOpen(true)}
                chatActive={aiOpen}
                summaryActive={summaryOpen}
              />
            </div>
            <div className="lg-head-actions">
              <button className="lg-btn-brand" onClick={() => showToast("Buat Bill — coming soon")}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Buat Bill
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
          <div className="lg-card">
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
                <input placeholder="Cari ID bill, vendor, no. invoice…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="lg-filter-meta">
                <div className="lg-meta-btn-wrap">
                  <button className={`lg-meta-btn${activeFilterCount > 0 ? " active" : ""}`} onClick={() => { setFilterPopOpen(!filterPopOpen); setSortPopOpen(false); setGroupPopOpen(false); }}>
                    <svg viewBox="0 0 12 12"><path d="M2 3h8M3 6h6M4 9h4" strokeLinecap="round"/></svg>
                    Filter
                    {activeFilterCount > 0 && <span className="lg-filter-badge">{activeFilterCount}</span>}
                  </button>
                  {filterPopOpen && (
                    <FilterPopover values={filterValues} onChange={setFilterValues} vendors={vendorsInCorpus} onClose={() => setFilterPopOpen(false)} />
                  )}
                </div>
                <div className="lg-meta-btn-wrap">
                  <button className="lg-meta-btn" onClick={() => { setSortPopOpen(!sortPopOpen); setFilterPopOpen(false); setGroupPopOpen(false); }}>
                    <span className="meta-lbl">Urut:</span>
                    <span className="meta-val">{SORT_LABELS[effectiveSort]}</span>
                  </button>
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
                    <GroupPopover value={effectiveGroup} canAging={!onLunas && !onDraft} onPick={(v) => { setGroupChoice(v); setGroupPopOpen(false); }} onClose={() => setGroupPopOpen(false)} />
                  )}
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
              <div>Bill / Invoice</div>
              <div>Tanggal</div>
              <div>Vendor</div>
              <div style={{ textAlign: "right" }}>Hari Telat</div>
              <div style={{ paddingLeft: 12 }}>Jatuh Tempo</div>
              <div>Aging</div>
              <div style={{ textAlign: "right" }}>Total · IDR</div>
              <div />
            </div>

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
                              onClick={() => { setSelectedId(r.id); setDrawerTab("detail"); }}
                              onKebab={(id) => setMenuOpenFor(menuOpenFor === id ? null : id)}
                              isSelected={selectedId === r.id}
                              isAlt={i % 2 === 1}
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
                  {sortedRows.length === 0 && <div className="lg-empty">Tidak ada bill yang cocok</div>}
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
                          onClick={() => { setSelectedId(r.id); setDrawerTab("detail"); }}
                          onKebab={(id) => setMenuOpenFor(menuOpenFor === id ? null : id)}
                          isSelected={selectedId === r.id}
                          isAlt={i % 2 === 1}
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
          <span><span className="lg-footer-num">{checked.size}</span> dipilih</span>
          {checked.size > 0 ? (
            <>
              <button className="lg-footer-bulk-btn" onClick={() => onBulk("approve")}>Setujui</button>
              <button className="lg-footer-clear" onClick={clearChecks}>Batal pilih</button>
            </>
          ) : (
            <>
              <span className="lg-footer-sep">·</span>
              <span>Menampilkan <span className="lg-footer-num">{filteredRows.length}</span> bill</span>
            </>
          )}
        </div>
        <div className="lg-footer-right">
          <span className="lg-footer-lbl">{checked.size > 0 ? "Subtotal terpilih" : "Subtotal halaman"}</span>
          <span className="lg-footer-total">Rp {fmtRp(checked.size > 0 ? selectedTotal : pageTotal)}</span>
        </div>
      </div>

      {/* ── Side drawer (bill detail) ──────────────────────────────── */}
      {selected && (
        <>
          <div className="drawer-overlay" onClick={() => setSelectedId(null)} />
          <div className="drawer">
            <div className="drawer-head">
              <div className="drawer-av bill">{selected.initials || initials(selected.vendorName)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="drawer-title">{selected.vendorName}</div>
                <div className="drawer-sub">{selected.id}</div>
              </div>
              <button className="drawer-close" onClick={() => setSelectedId(null)}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="drawer-tabs">
              {[["detail", "Detail"], ["items", "Items"], ["audit", "Audit"]].map(([t, label]) => (
                <div key={t} className={`drawer-tab${drawerTab === t ? " active" : ""}`} onClick={() => setDrawerTab(t)}>{label}</div>
              ))}
            </div>
            <div className="drawer-body">
              {drawerTab === "detail" && (
                <>
                  <div className="drawer-stat-row">
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">Total</div>
                      <div className="drawer-stat-val">{formatRupiah(selected.total)}</div>
                    </div>
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">Sisa Bayar</div>
                      <div className={`drawer-stat-val${selected.sisa > 0 ? " danger" : " success"}`}>{selected.sisa > 0 ? formatRupiah(selected.sisa) : "Lunas"}</div>
                    </div>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-section-title">Informasi Bill</div>
                    {[
                      ["Bill ID", selected.id],
                      ["No. Invoice Vendor", selected.invNo],
                      ["No. PO", selected.poNo],
                      ["Tanggal", formatDate(selected.date)],
                      ["Jatuh Tempo", formatDate(selected.due)],
                      ["GRN", GRN_LABEL[selected.grn]],
                      ["Status Approval", APPROVAL_LABEL[selected.approval]],
                      ["Status Bayar", PAY_LABEL[selected.pay]],
                    ].map(([label, value]) => (
                      <div key={label} className="drawer-row">
                        <div className="drawer-label">{label}</div>
                        <div className="drawer-value">{value}</div>
                      </div>
                    ))}
                    {selected.keterangan && (
                      <div className="drawer-row">
                        <div className="drawer-label">Keterangan</div>
                        <div className="drawer-value">{selected.keterangan}</div>
                      </div>
                    )}
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-section-title">Pajak</div>
                    {[
                      ["DPP", formatRupiah(selected.dpp)],
                      ["PPN (11%)", formatRupiah(selected.ppn)],
                      ["PPh 23", selected.pph23 > 0 ? formatRupiah(selected.pph23) : "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="drawer-row">
                        <div className="drawer-label">{label}</div>
                        <div className="drawer-value mono">{value}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {drawerTab === "items" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Line Items</div>
                  <table className="items-table">
                    <thead><tr><th>Deskripsi</th><th className="r">Qty</th><th className="r">Harga</th><th className="r">Subtotal</th></tr></thead>
                    <tbody>
                      {selected.items.map((item, i) => (
                        <tr key={i}>
                          <td>
                            <div>{item.desc}</div>
                            <div style={{ fontSize: 10, color: "var(--color-action)", fontFamily: "var(--font-mono)" }}>{item.acct} · {item.acctName}</div>
                          </td>
                          <td className="r">{item.qty.toLocaleString("id-ID")}</td>
                          <td className="r">{formatRupiah(item.price)}</td>
                          <td className="r">{formatRupiah(item.subtotal)}</td>
                        </tr>
                      ))}
                      <tr className="items-total-row"><td colSpan={3}>Total</td><td className="r">{formatRupiah(selected.total)}</td></tr>
                    </tbody>
                  </table>
                </div>
              )}
              {drawerTab === "audit" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Riwayat Audit</div>
                  <div className="audit-list">
                    {selected.audit.map((a, i) => (
                      <div key={i} className="audit-item">
                        <div className={`audit-dot ${a.type}`} />
                        <div>
                          <div className="audit-action">{a.action}</div>
                          <div className="audit-by">{a.by} · {formatDate(a.date)} {a.time}</div>
                        </div>
                      </div>
                    ))}
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
        contextLabel="Bills"
      />

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
