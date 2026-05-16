import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import { COA, COA_BY_CODE } from "../data/seed/coa";
import { JOURNAL_ENTRIES } from "../data/seed/journalEntries";
import { OPENING_BALANCES } from "../data/seed/openingBalances";
import AiChatDrawer from "./AiChatDrawer";
import SummaryDrawer from "./SummaryDrawer";
import { computeTbInsights, makeTbAiContext } from "./ai-trialbalance-context";
import "./modules.css";
import "./invoices-ledger.css";

// ── Source views ──────────────────────────────────────────────────────────
const TB_COA = COA.filter((n) => n.code).map((n) => ({
  code: n.code,
  name: n.name,
  type: n.type,
  normal_balance: n.normal_balance,
  parent: n.parent,
  is_active: n.is_active,
}));
const TB_OPENING = OPENING_BALANCES.reduce((m, r) => {
  const acct = COA_BY_CODE[r.account_code];
  if (!acct) return m;
  const debitNormal = acct.normal_balance === "debit";
  const oriented = debitNormal ? r.debit - r.credit : r.credit - r.debit;
  m[r.account_code] = (m[r.account_code] || 0) + oriented;
  return m;
}, {});
const PARENT_SET = new Set(TB_COA.filter((a) => a.parent).map((a) => a.parent));
const LEAF = TB_COA.filter((a) => !PARENT_SET.has(a.code));

const TYPE_LABELS = {
  asset: "Assets",
  contra_asset: "Contra Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  contra_revenue: "Contra Revenue",
  expense: "Expenses",
};
const TYPE_ORDER = ["asset", "contra_asset", "liability", "equity", "revenue", "contra_revenue", "expense"];
const TYPE_BADGE_CLS = {
  asset: "approved",
  contra_asset: "draft",
  liability: "rejected",
  equity: "review",
  revenue: "approved",
  contra_revenue: "draft",
  expense: "draft",
};

const SEVERITY_ICON = {
  critical: <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 002 1.71 2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  warn: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  info: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
};

const rp = (v) => {
  if (v === 0 || v === null || v === undefined) return "—";
  const abs = Math.abs(v);
  return (v < 0 ? "(" : "") + "Rp " + abs.toLocaleString("id-ID") + (v < 0 ? ")" : "");
};
const rpZ = (v) => {
  if (v === undefined || v === null) return "—";
  const abs = Math.abs(v);
  return (v < 0 ? "(" : "") + "Rp " + abs.toLocaleString("id-ID") + (v < 0 ? ")" : "");
};
const fmtIdDate = (s) =>
  new Date(s + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

// ── TB compute ────────────────────────────────────────────────────────────
function computeTB(dateFrom, dateTo) {
  const acc = {};
  LEAF.forEach((a) => { acc[a.code] = { preDr: 0, preCr: 0, perDr: 0, perCr: 0, entries: [] }; });
  JOURNAL_ENTRIES.forEach((je) => {
    if (je.status !== "posted") return;
    je.lines.forEach((line) => {
      const a = acc[line.account_code];
      if (!a) return;
      const dr = line.debit || 0;
      const cr = line.credit || 0;
      if (je.je_date < dateFrom) {
        a.preDr += dr; a.preCr += cr;
      } else if (je.je_date >= dateFrom && je.je_date <= dateTo) {
        a.perDr += dr; a.perCr += cr;
        a.entries.push({
          je_ref: je.je_number,
          date: je.je_date,
          debit: dr,
          credit: cr,
          description: line.description,
          memo: je.memo,
          posted_by: je.posted_by,
          posted_date: je.posted_date,
        });
      }
    });
  });
  return LEAF.map((acct) => {
    const a = acc[acct.code];
    const ini = TB_OPENING[acct.code] || 0;
    const openBal = acct.normal_balance === "debit"
      ? ini + a.preDr - a.preCr
      : ini + a.preCr - a.preDr;
    const closeBal = acct.normal_balance === "debit"
      ? openBal + a.perDr - a.perCr
      : openBal + a.perCr - a.perDr;
    return {
      code: acct.code,
      name: acct.name,
      type: acct.type,
      normal_balance: acct.normal_balance,
      opening_balance: openBal,
      period_debit: a.perDr,
      period_credit: a.perCr,
      closing_balance: closeBal,
      entries: a.entries,
      has_activity: a.perDr > 0 || a.perCr > 0 || openBal !== 0 || closeBal !== 0,
    };
  });
}

function checkBalance(rows) {
  let dr = 0, cr = 0;
  rows.forEach((r) => {
    const cb = r.closing_balance;
    if (r.normal_balance === "debit") cb >= 0 ? (dr += cb) : (cr += Math.abs(cb));
    else                              cb >= 0 ? (cr += cb) : (dr += Math.abs(cb));
  });
  return { dr, cr, variance: Math.abs(dr - cr), balanced: Math.abs(dr - cr) < 1 };
}

function detectAnomalyes(tb) {
  const out = [];
  const byCode = {};
  tb.forEach((r) => { byCode[r.code] = r; });

  tb.filter((r) => r.type === "contra_asset").forEach((r) => {
    if (r.closing_balance < 0) {
      out.push({ severity: "critical", code: r.code, name: r.name, title: "Contra asset balance moved to the debit side — abnormal", desc: `${r.name} has closing balance ${rp(r.closing_balance)}, should have a credit balance for account contra asset. Possibly reversed journal entry.`, action: "Check JEs affecting this account." });
    }
  });
  const ar = byCode["1-2100"];
  const allowance = byCode["1-2200"];
  if (ar && allowance && ar.closing_balance > 0 && allowance.closing_balance === 0) {
    out.push({ severity: "critical", code: "1-2200", name: allowance.name, title: "Allowance pipayables doubtful not yet set up", desc: `${ar.name} has ${rp(ar.closing_balance)} while allowance is still zero.`, action: "Calculate and catat penallowance pipayables." });
  }
  const totalRev = ["4-1100", "4-1200", "4-1300", "4-1400", "4-1500"].reduce((s, c) => s + (byCode[c]?.closing_balance || 0), 0);
  if (ar && totalRev > 0 && ar.closing_balance > totalRev * 0.55) {
    out.push({ severity: "warn", code: "1-2100", name: ar.name, title: "Pitrade payables high relative to pendapatan", desc: `Pipayables ${rp(ar.closing_balance)} = ${Math.round(ar.closing_balance / totalRev * 100)}% from total pendapatan.`, action: "Review aging pipayables." });
  }
  const marketing = byCode["6-1200"];
  if (marketing && marketing.opening_balance === 0 && marketing.period_debit > 15000000) {
    out.push({ severity: "warn", code: "6-1200", name: marketing.name, title: "Spito beban iklan with no opening balance history", desc: `${marketing.name} recorded a debit ${rp(marketing.period_debit)} with opening balance zero.`, action: "Confirm authorization budget." });
  }
  const ap = byCode["2-1100"];
  if (ap && ap.closing_balance > 80000000) {
    out.push({ severity: "warn", code: "2-1100", name: ap.name, title: "Balance trade payables exceeds threshold", desc: `${ap.name} has ${rp(ap.closing_balance)} — exceeds internal threshold Rp 80 juta.`, action: "Review aging schedule payables." });
  }
  const proSvc = byCode["6-2700"];
  if (proSvc && proSvc.period_debit >= 25000000) {
    out.push({ severity: "warn", code: "6-2700", name: proSvc.name, title: "Possibly duplicate billing from consultant", desc: `${proSvc.entries.length} transactions consultant in period that same.`, action: "Match with contract and invoice fisik." });
  }
  const vatIn = byCode["1-5100"];
  if (vatIn && vatIn.closing_balance > 10000000) {
    out.push({ severity: "info", code: "1-5100", name: vatIn.name, title: "PPN masukan not yet credited", desc: `Input VAT (PPN) balance ${rp(vatIn.closing_balance)} is still held as aset.`, action: "Coordinate with tax team." });
  }
  tb.filter((r) => r.opening_balance !== 0 && r.closing_balance === 0 && r.has_activity && r.type === "liability").forEach((r) => {
    out.push({ severity: "info", code: r.code, name: r.name, title: "Liability fully settled in period", desc: `${r.name} settled until zero on this period.`, action: "Archive evidence settlement." });
  });
  return out;
}

// ── UI helpers ────────────────────────────────────────────────────────────

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

const SORT_LABELS = {
  "code-asc":     "Code A-Z",
  "code-desc":    "Code Z-A",
  "name-asc":     "Name A-Z",
  "close-desc":   "Closing balance ↓",
  "close-asc":    "Closing balance ↑",
  "debit-desc":   "Debit period ↓",
  "credit-desc":  "Credit period ↓",
};
const GROUP_LABELS = {
  "type":  "Account Type",
  "none":  "—",
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
    { k: "type", lbl: "Account Type (default)" },
    { k: "none", lbl: "Not grouped" },
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
  const reset = () => setDraft({ dateFrom: "2025-01-01", dateTo: "2025-04-30", hideZero: false });
  const apply = () => { onChange(draft); onClose(); };
  function pickShortcut(r) {
    if (r === "ytd")   update({ dateFrom: "2025-01-01", dateTo: "2025-04-30" });
    else if (r === "q1") update({ dateFrom: "2025-01-01", dateTo: "2025-03-31" });
    else if (r === "feb") update({ dateFrom: "2025-01-01", dateTo: "2025-02-28" });
    else if (r === "jan") update({ dateFrom: "2025-01-01", dateTo: "2025-01-31" });
  }
  return (
    <div className="lg-popover lg-filter-pop" ref={ref}>
      <div className="lg-filter-body">
        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Period quick</div>
          <div className="lg-toggle-row">
            <button className="lg-toggle" onClick={() => pickShortcut("jan")}>Jan 2025</button>
            <button className="lg-toggle" onClick={() => pickShortcut("feb")}>Feb 2025</button>
            <button className="lg-toggle" onClick={() => pickShortcut("q1")}>Q1 2025</button>
            <button className="lg-toggle" onClick={() => pickShortcut("ytd")}>YTD</button>
          </div>
        </div>
        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Range date custom</div>
          <div className="lg-filter-row2">
            <input type="date" className="lg-filter-input" value={draft.dateFrom} onChange={(e) => update({ dateFrom: e.target.value })} />
            <span style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>—</span>
            <input type="date" className="lg-filter-input" value={draft.dateTo} onChange={(e) => update({ dateTo: e.target.value })} />
          </div>
        </div>
        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Display</div>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--color-text-secondary)", cursor: "pointer" }}>
            <input type="checkbox" checked={draft.hideZero} onChange={(e) => update({ hideZero: e.target.checked })} style={{ accentColor: "var(--color-action)", cursor: "pointer" }} />
            Hide account without activity
          </label>
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

export default function TrialBalancePage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState({ kind: "tab", value: "all" });
  const [sortChoice, setSortChoice] = useState(null);
  const [groupChoice, setGroupChoice] = useState(null);
  const emptyFilters = { dateFrom: "2025-01-01", dateTo: "2025-04-30", hideZero: false };
  const [filterValues, setFilterValues] = useState(emptyFilters);

  const [drawerCode, setDrawerCode] = useState(null);
  const [drawerTab, setDrawerTab] = useState("detail");

  const [sortPopOpen, setSortPopOpen] = useState(false);
  const [groupPopOpen, setGroupPopOpen] = useState(false);
  const [filterPopOpen, setFilterPopOpen] = useState(false);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiSeedQuestion, setAiSeedQuestion] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());

  const [toast, setToast] = useState("");
  const toastTmr = useRef(null);
  function showToast(msg) {
    setToast(msg);
    if (toastTmr.current) clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToast(""), 1800);
  }

  const { dateFrom, dateTo } = filterValues;
  const ALL_TB = useMemo(() => computeTB(dateFrom, dateTo), [dateFrom, dateTo]);
  const balance = useMemo(() => checkBalance(ALL_TB), [ALL_TB]);
  const anomalyes = useMemo(() => detectAnomalyes(ALL_TB), [ALL_TB]);
  const anomalyesByCode = useMemo(() => {
    const m = {};
    anomalyes.forEach((a) => { (m[a.code] ||= []).push(a); });
    return m;
  }, [anomalyes]);

  const totalRev = useMemo(() => ALL_TB.filter((r) => r.type === "revenue").reduce((s, r) => s + r.closing_balance, 0), [ALL_TB]);
  const totalExp = useMemo(() => ALL_TB.filter((r) => r.type === "expense").reduce((s, r) => s + r.period_debit, 0), [ALL_TB]);
  const netIncome = totalRev - totalExp;
  const margin = totalRev > 0 ? Math.round((netIncome / totalRev) * 100) : 0;

  const periodLabel = fmtIdDate(dateTo);
  const critCount = anomalyes.filter((a) => a.severity === "critical").length;
  const warnCount = anomalyes.filter((a) => a.severity === "warn").length;

  const insights = useMemo(() => computeTbInsights({
    balance, anomalyes, netIncome, totalRev, totalExp, margin, period: periodLabel,
  }), [balance, anomalyes, netIncome, totalRev, totalExp, margin, periodLabel]);

  const aiContext = useMemo(() => makeTbAiContext({
    balance, anomalyes, netIncome, totalRev, totalExp, margin, period: periodLabel,
    accountCount: ALL_TB.length,
    topAssets: [...ALL_TB].filter((r) => r.type === "asset" && r.closing_balance > 0).sort((a, b) => b.closing_balance - a.closing_balance).slice(0, 5),
    topLiabilities: [...ALL_TB].filter((r) => r.type === "liability" && r.closing_balance > 0).sort((a, b) => b.closing_balance - a.closing_balance).slice(0, 5),
  }), [balance, anomalyes, netIncome, totalRev, totalExp, margin, periodLabel, ALL_TB]);

  function askAi(question) {
    setSummaryOpen(false);
    setAiSeedQuestion(question);
    setAiOpen(true);
  }

  // KPI strip — 4 cells
  const kpis = [
    { lbl: "Total Accounts",            card: null,        val: String(ALL_TB.filter((r) => r.has_activity).length), sub: `from ${ALL_TB.length} total`,   tone: "primary" },
    { lbl: "Net Income (est.)",  card: null,        val: rp(netIncome),                                       sub: netIncome >= 0 ? `Margin ${margin}%` : "Rugi this period",  tone: netIncome >= 0 ? "primary" : "danger" },
    { lbl: "Critical",                card: "critical",  val: String(critCount),                                  sub: critCount > 0 ? "needs action" : "safe",                  tone: "danger"  },
    { lbl: "Warning",            card: "warn",      val: String(warnCount),                                  sub: warnCount > 0 ? "needs review" : "safe",                  tone: "warn"    },
  ];

  // Spotlight cards (always 4)
  const SPOTLIGHTS = [
    { code: "1-1300", barColor: null },
    { code: "1-2100", barColor: null },
    { code: "2-1100", barColor: "var(--color-danger-text)" },
    { code: "3-1300", barColor: "var(--color-success-text)" },
  ];
  const spotByCode = useMemo(() => {
    const m = {};
    ALL_TB.forEach((r) => { m[r.code] = r; });
    return m;
  }, [ALL_TB]);
  const spotMax = Math.max(...SPOTLIGHTS.map((s) => Math.abs(spotByCode[s.code]?.closing_balance || 0)), 1);

  // Tabs by type chip
  const tabs = [
    { k: "all",        lbl: "All",       count: ALL_TB.length, types: TYPE_ORDER },
    { k: "asset",      lbl: "Assets",        count: ALL_TB.filter((r) => r.type === "asset" || r.type === "contra_asset").length, types: ["asset", "contra_asset"] },
    { k: "liability",  lbl: "Liabilities",  count: ALL_TB.filter((r) => r.type === "liability").length, types: ["liability"] },
    { k: "equity",     lbl: "Equity",     count: ALL_TB.filter((r) => r.type === "equity").length, types: ["equity"] },
    { k: "revenue",    lbl: "Revenue",  count: ALL_TB.filter((r) => r.type === "revenue" || r.type === "contra_revenue").length, types: ["revenue", "contra_revenue"] },
    { k: "expense",    lbl: "Expenses",       count: ALL_TB.filter((r) => r.type === "expense").length, types: ["expense"] },
  ];

  // Corpus
  const corpus = useMemo(() => {
    let list = ALL_TB;
    if (filter.kind === "tab" && filter.value !== "all") {
      const tab = tabs.find((t) => t.k === filter.value);
      const types = tab?.types || [];
      list = list.filter((r) => types.includes(r.type));
    } else if (filter.kind === "card") {
      if (filter.value === "critical") {
        const codes = new Set(anomalyes.filter((a) => a.severity === "critical").map((a) => a.code));
        list = list.filter((r) => codes.has(r.code));
      } else if (filter.value === "warn") {
        const codes = new Set(anomalyes.filter((a) => a.severity === "warn").map((a) => a.code));
        list = list.filter((r) => codes.has(r.code));
      }
    }
    return list;
  }, [filter, anomalyes]);

  const hasActiveFilters = useMemo(() => (
    filterValues.dateFrom !== emptyFilters.dateFrom ||
    filterValues.dateTo !== emptyFilters.dateTo ||
    filterValues.hideZero ||
    sortChoice !== null ||
    groupChoice !== null ||
    search.trim() !== ""
  ), [filterValues, sortChoice, groupChoice, search]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterValues.dateFrom !== emptyFilters.dateFrom || filterValues.dateTo !== emptyFilters.dateTo) n++;
    if (filterValues.hideZero) n++;
    return n;
  }, [filterValues]);

  const filteredRows = useMemo(() => {
    let list = corpus;
    if (filterValues.hideZero) list = list.filter((r) => r.has_activity);
    const q = search.toLowerCase().trim();
    if (q) list = list.filter((r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
    return list;
  }, [corpus, filterValues.hideZero, search]);

  const effectiveSort = sortChoice || "code-asc";
  const effectiveGroup = groupChoice || "type";

  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    switch (effectiveSort) {
      case "code-asc":    arr.sort((a, b) => a.code.localeCompare(b.code)); break;
      case "code-desc":   arr.sort((a, b) => b.code.localeCompare(a.code)); break;
      case "name-asc":    arr.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "close-desc":  arr.sort((a, b) => b.closing_balance - a.closing_balance); break;
      case "close-asc":   arr.sort((a, b) => a.closing_balance - b.closing_balance); break;
      case "debit-desc":  arr.sort((a, b) => b.period_debit - a.period_debit); break;
      case "credit-desc": arr.sort((a, b) => b.period_credit - a.period_credit); break;
      default: break;
    }
    return arr;
  }, [filteredRows, effectiveSort]);

  const groups = useMemo(() => {
    if (effectiveGroup === "none") return null;
    const map = new Map();
    TYPE_ORDER.forEach((t) => map.set(t, []));
    sortedRows.forEach((r) => { (map.get(r.type) || map.set(r.type, []).get(r.type)).push(r); });
    return Array.from(map.entries())
      .filter(([, rows]) => rows.length > 0)
      .map(([t, rows]) => ({
        key: t,
        label: TYPE_LABELS[t] || t,
        rows,
        sumDebit:  rows.reduce((s, r) => s + r.period_debit, 0),
        sumCredit: rows.reduce((s, r) => s + r.period_credit, 0),
        sumOpen:   rows.reduce((s, r) => s + r.opening_balance, 0),
        sumClose:  rows.reduce((s, r) => s + r.closing_balance, 0),
      }));
  }, [effectiveGroup, sortedRows]);

  function selectTab(t) { setFilter({ kind: "tab", value: t }); }
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

  function toggleGroup(key) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function exportCsv() {
    const headers = ["Code", "Name", "Type", "Opening Balance", "Debit", "Credit", "Closing Balance"];
    const esc = (v) => {
      const s = String(v == null ? "" : v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of sortedRows) {
      lines.push([r.code, r.name, r.type, r.opening_balance, r.period_debit, r.period_credit, r.closing_balance].map(esc).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `klay-trialbalance-${dateTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`${sortedRows.length} account exported to CSV`);
  }

  // Drawer data
  const drawerRow = drawerCode ? ALL_TB.find((r) => r.code === drawerCode) : null;
  const drawerAcct = drawerCode ? LEAF.find((a) => a.code === drawerCode) : null;
  const drawerAnom = drawerCode ? (anomalyesByCode[drawerCode] || []) : [];

  // Render a TB row
  function TbRow({ r, isAlt }) {
    const anom = anomalyesByCode[r.code] || [];
    const top = anom[0];
    const tint = anom.find((a) => a.severity === "critical") ? " anomaly-danger" : anom.find((a) => a.severity === "warn") ? " anomaly-warn" : "";
    return (
      <div className={`lg-row${isAlt ? " alt" : ""}${tint}${drawerCode === r.code ? " selected" : ""}`} onClick={() => { setDrawerCode(r.code); setDrawerTab("detail"); }}>
        <div className="lg-cell-no">{r.code}</div>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--color-text-primary)", fontWeight: 500 }}>{r.name}</span>
          <span className={`badge badge-${TYPE_BADGE_CLS[r.type]}`} style={{ fontSize: 9 }}>{TYPE_LABELS[r.type]}</span>
          {top && (
            <span className={`lg-anom-flag ${top.severity}`}>
              {SEVERITY_ICON[top.severity]}
              {anom.length > 1 ? `${anom.length} finding` : (top.severity === "critical" ? "Critical" : top.severity === "warn" ? "Warning" : "Info")}
            </span>
          )}
        </div>
        <div className="lg-cell-total" style={{ color: "var(--color-text-tertiary)" }}>{rp(r.opening_balance)}</div>
        <div className="lg-cell-total" style={{ color: r.period_debit ? "var(--color-action)" : undefined }}>{r.period_debit ? rp(r.period_debit) : <span className="lg-cell-em-dash">—</span>}</div>
        <div className="lg-cell-total" style={{ color: r.period_credit ? "var(--color-success-text)" : undefined }}>{r.period_credit ? rp(r.period_credit) : <span className="lg-cell-em-dash">—</span>}</div>
        <div className="lg-cell-total" style={{ color: r.closing_balance < 0 ? "var(--color-danger-text)" : "var(--color-text-primary)", fontWeight: 600 }}>{rpZ(r.closing_balance)}</div>
        <div className="lg-cell-kebab" onClick={(e) => e.stopPropagation()}>
          <button className="lg-kebab">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lg-page">
      <div className="lg-scroll-container">
        {/* ── Editorial header ──────────────────────────────────────── */}
        <div className="lg-head">
          <div className="lg-head-top">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="lg-title">Trial Balance</h1>
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
                Export TB
              </button>
            </div>
          </div>

          <div className="lg-kpi-strip">
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

        {/* ── Spotlight row + Table card (single wrap so spacing is single-source) ── */}
        <div className="lg-table-wrap">
          <div className="lg-spotlight-row">
            {SPOTLIGHTS.map((s) => {
              const row = spotByCode[s.code];
              const cb = row?.closing_balance ?? 0;
              const ob = row?.opening_balance ?? 0;
              let delta = { text: "none activity", cls: "" };
              if (ob !== 0) {
                const pct = ((cb - ob) / Math.abs(ob) * 100).toFixed(1);
                const dir = cb >= ob ? "up" : "dn";
                const sign = cb >= ob ? "+" : "";
                delta = { text: `${sign}${pct}% vs opening balance`, cls: dir };
              } else if (cb !== 0) {
                delta = { text: "baru this period", cls: "up" };
              }
              const widthPct = Math.round(Math.abs(cb) / spotMax * 100);
              return (
                <button type="button" key={s.code} className="lg-spot-card" onClick={() => { setDrawerCode(s.code); setDrawerTab("detail"); }}>
                  <div className="lg-spot-code">{s.code}</div>
                  <div className="lg-spot-name">{COA_BY_CODE[s.code]?.name || s.code}</div>
                  <div className="lg-spot-num">{rp(cb)}</div>
                  <div className={`lg-spot-delta ${delta.cls}`}>{delta.text}</div>
                  <div className="lg-spot-bar">
                    <div className="lg-spot-bar-fill" style={{ width: `${widthPct}%`, ...(s.barColor ? { background: s.barColor } : {}) }} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg-card lg-table-tb">
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
                <input placeholder="Search account code or name…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
              <div>Code</div>
              <div>Account Name</div>
              <div style={{ textAlign: "right" }}>Opening Balance</div>
              <div style={{ textAlign: "right" }}>Period Debit</div>
              <div style={{ textAlign: "right" }}>Period Credit</div>
              <div style={{ textAlign: "right" }}>Closing Balance</div>
              <div />
            </div>

            <div>
              {groups ? (
                groups.map((g) => {
                  const isCollapsed = collapsedGroups.has(g.key);
                  return (
                    <Fragment key={g.key}>
                      <div className="lg-group-head muted" onClick={() => toggleGroup(g.key)}>
                        <div className="lg-group-left">
                          <svg className={`lg-group-chevron${isCollapsed ? " closed" : ""}`} viewBox="0 0 9 9"><path d="M2 3l2.5 3L7 3"/></svg>
                          <span className="lg-group-lbl">{g.label}</span>
                          <span className="lg-group-count">{g.rows.length}</span>
                        </div>
                      </div>
                      {!isCollapsed && g.rows.map((r, i) => (
                        <TbRow key={r.code} r={r} isAlt={i % 2 === 1} />
                      ))}
                      {!isCollapsed && (
                        <div className="lg-row subtotal">
                          <div />
                          <div style={{ fontWeight: 700, color: "var(--color-text-secondary)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>
                            Subtotal {g.label}
                          </div>
                          <div className="lg-cell-total" style={{ color: "var(--color-text-tertiary)" }}>{g.sumOpen ? rp(g.sumOpen) : "—"}</div>
                          <div className="lg-cell-total" style={{ color: "var(--color-action)" }}>{g.sumDebit ? rp(g.sumDebit) : "—"}</div>
                          <div className="lg-cell-total" style={{ color: "var(--color-success-text)" }}>{g.sumCredit ? rp(g.sumCredit) : "—"}</div>
                          <div className="lg-cell-total" style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{rp(g.sumClose)}</div>
                          <div />
                        </div>
                      )}
                    </Fragment>
                  );
                })
              ) : (
                <>
                  {sortedRows.length === 0 && <div className="lg-empty">None account matching</div>}
                  {sortedRows.map((r, i) => <TbRow key={r.code} r={r} isAlt={i % 2 === 1} />)}
                </>
              )}
            </div>
          </div>
        </div>
      </div>{/* /lg-scroll-container */}

      {/* ── Sticky footer ──────────────────────────────────────────── */}
      <div className="lg-footer">
        <div className="lg-footer-left">
          <span><span className="lg-footer-num">{sortedRows.length}</span> account dishow</span>
          <span className="lg-footer-sep">·</span>
          <span>Total Debit <span className="lg-footer-num" style={{ color: "var(--color-action)" }}>{rp(balance.dr)}</span></span>
          <span className="lg-footer-sep">·</span>
          <span>Total Credit <span className="lg-footer-num" style={{ color: "var(--color-success-text)" }}>{rp(balance.cr)}</span></span>
          <span className="lg-footer-sep">·</span>
          <span style={{ color: balance.balanced ? "var(--color-success-text)" : "var(--color-danger-text)" }}>
            {balance.balanced ? "✓ Balanced" : `Variance ${rp(balance.variance)}`}
          </span>
        </div>
        <div className="lg-footer-right">
          <span className="lg-footer-lbl">Per</span>
          <span className="lg-footer-total" style={{ fontSize: 13 }}>{fmtIdDate(dateTo)}</span>
        </div>
      </div>

      {/* ── Side drawer (account detail) ─────────────────────────── */}
      {drawerRow && (
        <>
          <div className="drawer-overlay" onClick={() => setDrawerCode(null)} />
          <div className="drawer">
            <div className="drawer-head">
              <div className="drawer-av invoice" style={{ fontSize: 9 }}>{drawerRow.code.slice(0, 3)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="drawer-title">{drawerRow.name}</div>
                <div className="drawer-sub">
                  <span style={{ fontFamily: "var(--font-mono)" }}>{drawerRow.code}</span> ·{" "}
                  <span className={`badge badge-${TYPE_BADGE_CLS[drawerRow.type]}`}>{TYPE_LABELS[drawerRow.type]}</span>
                </div>
              </div>
              <button className="drawer-close" onClick={() => setDrawerCode(null)}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="drawer-tabs">
              {[["detail", "Detail"], ["transactions", "Transactions"], ["audit", "Audit Trail"], ["ai", "AI Insight"]].map(([t, label]) => (
                <div key={t} className={`drawer-tab${drawerTab === t ? " active" : ""}`} onClick={() => setDrawerTab(t)}>
                  {t === "ai" && <span style={{ marginRight: 4, color: "var(--color-action)" }}>✦</span>}
                  {label}
                  {t === "ai" && drawerAnom.length > 0 && (
                    <span style={{ marginLeft: 5, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 9999, background: "var(--color-danger-surface)", color: "var(--color-danger-text)" }}>
                      {drawerAnom.length}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="drawer-body">
              {drawerTab === "detail" && (
                <>
                  <div className="drawer-stat-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">Opening Balance</div>
                      <div className="drawer-stat-val" style={{ color: "var(--color-text-tertiary)" }}>{rp(drawerRow.opening_balance)}</div>
                    </div>
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">Closing Balance</div>
                      <div className={`drawer-stat-val${drawerRow.closing_balance < 0 ? " danger" : ""}`}>{rpZ(drawerRow.closing_balance)}</div>
                    </div>
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">Period Debit</div>
                      <div className="drawer-stat-val" style={{ color: "var(--color-action)" }}>{rp(drawerRow.period_debit)}</div>
                    </div>
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">Period Credit</div>
                      <div className="drawer-stat-val" style={{ color: "var(--color-success-text)" }}>{rp(drawerRow.period_credit)}</div>
                    </div>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-section-title">Information Account</div>
                    {[
                      ["Code", drawerRow.code],
                      ["Name", drawerRow.name],
                      ["Type", TYPE_LABELS[drawerRow.type]],
                      ["Normal Balance", drawerRow.normal_balance === "debit" ? "Debit" : "Credit"],
                      ["Status", drawerAcct?.is_active ? "Active" : "Inactive"],
                    ].map(([label, value]) => (
                      <div key={label} className="drawer-row">
                        <div className="drawer-label">{label}</div>
                        <div className="drawer-value">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-section-title">Period</div>
                    <div className="drawer-row">
                      <div className="drawer-label">Awal Period</div>
                      <div className="drawer-value">{fmtIdDate(dateFrom)}</div>
                    </div>
                    <div className="drawer-row">
                      <div className="drawer-label">As-of</div>
                      <div className="drawer-value">{fmtIdDate(dateTo)}</div>
                    </div>
                    <div className="drawer-row">
                      <div className="drawer-label">Jumlah Transactions</div>
                      <div className="drawer-value">{drawerRow.entries.length} JE</div>
                    </div>
                  </div>
                </>
              )}
              {drawerTab === "transactions" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Transactions Period · {drawerRow.entries.length} entri</div>
                  {drawerRow.entries.length === 0 ? (
                    <div style={{ color: "var(--color-text-tertiary)", fontSize: 12, padding: "12px 0" }}>Not yet there is transactions on this period.</div>
                  ) : drawerRow.entries.slice(0, 50).map((e, i) => (
                    <div key={i} style={{ background: "var(--color-surface-sunken)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-md)", padding: "10px 12px", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-action)" }}>{e.je_ref}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{e.memo}</div>
                          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>{fmtIdDate(e.date)}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          {e.debit > 0 && <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700 }}>Dr {rp(e.debit)}</div>}
                          {e.credit > 0 && <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--color-action)" }}>Cr {rp(e.credit)}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {drawerTab === "audit" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Audit Trail</div>
                  {drawerRow.entries.slice(0, 20).map((e, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < 19 ? "1px solid var(--color-surface-sunken)" : "none" }}>
                      <div style={{ width: 18, height: 18, borderRadius: 9, background: "var(--color-surface-sunken)", border: "1px solid var(--color-border-default)", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{e.je_ref} posted</div>
                        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{e.posted_by || "—"} · {e.posted_date ? fmtIdDate(e.posted_date) : "—"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {drawerTab === "ai" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">AI Insight</div>
                  {drawerAnom.length === 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, background: "var(--color-success-surface)", border: "1px solid var(--color-success-border)", borderRadius: "var(--radius-md)", fontSize: 12, color: "var(--color-success-text)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Account ini within normal range — none finding AI.
                    </div>
                  ) : drawerAnom.map((a, i) => (
                    <div key={i} style={{
                      padding: 12,
                      background: a.severity === "critical" ? "var(--color-danger-surface)" : a.severity === "warn" ? "var(--color-warning-surface)" : "var(--ai-surface)",
                      border: `1px solid ${a.severity === "critical" ? "var(--color-danger-border)" : a.severity === "warn" ? "var(--color-warning-border)" : "var(--ai-border)"}`,
                      borderRadius: "var(--radius-md)",
                      marginBottom: 8,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: a.severity === "critical" ? "var(--color-danger-text)" : a.severity === "warn" ? "var(--color-warning-text)" : "var(--color-action)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>
                        {SEVERITY_ICON[a.severity]}
                        {a.severity === "critical" ? "Critical" : a.severity === "warn" ? "Warning" : "Info"}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.55, marginBottom: 6 }}>{a.desc}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>Recommendation: {a.action}</div>
                    </div>
                  ))}
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
        contextLabel="Trial Balance"
      />

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
