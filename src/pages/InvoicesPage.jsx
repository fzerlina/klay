import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CUSTOMERS as customers } from "../data/seed/customers";
import { useInvoices } from "../state/InvoicesContext";
import { TODAY, daysSince } from "../lib/clock";
import { formatRupiah, formatDate, initials } from "../lib/format";
import AiChatDrawer from "./AiChatDrawer";
import SummaryDrawer from "./SummaryDrawer";
import "./modules.css";
import "./invoice-create.css";
import "./invoices-ledger.css";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtRp(n) {
  if (n == null) return "—";
  return n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

function fmtRpShort(n) {
  if (n == null) return "—";
  if (n >= 1e9) return "Rp " + (n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " M";
  if (n >= 1e6) return "Rp " + (n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " jt";
  return "Rp " + n.toLocaleString("id-ID");
}

const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function formatMonthLabel(yyyymm) {
  if (!yyyymm || yyyymm.length < 7) return "—";
  const [y, m] = yyyymm.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${MONTHS_ID[idx] || m} ${y}`;
}

// First two meaningful words (skipping legal prefixes) for "3 customer (X, Y, Z)" copy
function shortName(name) {
  if (!name) return "—";
  const tokens = name.split(/\s+/).filter((t) => t && !/^(PT|CV|UD|Toko|Koperasi)$/i.test(t));
  return tokens.slice(0, 2).join(" ");
}

const APPROVAL_LABEL = { terkirim: "Terkirim", draft: "Draft" };
const PAY_LABEL = { lunas: "Lunas", overdue: "Jatuh Tempo", belumbayar: "Belum Bayar" };

function payBadgeClass(payStatus) {
  if (payStatus === "lunas") return "badge-lunas";
  if (payStatus === "overdue") return "badge-overdue";
  return "badge-belumbayar";
}

// Map our internal invoice + customer master into the ledger row shape
function toRow(inv) {
  const cust = customers.find((c) => c.id === inv.customer);
  const dOver = daysSince(inv.due); // positive = telat; negative = belum jatuh tempo
  return {
    id: inv.id,
    no: inv.invNo === "—" ? "(Draft)" : inv.invNo,
    tgl: formatDate(inv.date),
    co: inv.customerName,
    addr: cust?.address || "",
    due: formatDate(inv.due),
    daysOverdue: dOver,
    total: inv.total,
    approval: inv.approval,
    payStatus: inv.payStatus,
    isAI: inv.isAI,
    raw: inv,
  };
}

// ─── AI insights — multiple rotating summaries ──────────────────────────────
// Stand-in for a server-rendered AI summary endpoint. Each insight has
//   - id      (stable key for React)
//   - node    (rendered JSX shown in the AiSubtitle)
//   - question (seed text used when user clicks through to chat)

function computeInsights(invoices, todayDate) {
  const overdue = invoices.filter((i) => i.payStatus === "overdue");
  const totalOverdue = overdue.reduce((s, i) => s + i.total, 0);

  // Top customers by overdue concentration
  const byCustomer = new Map();
  for (const inv of overdue) {
    const prev = byCustomer.get(inv.customer) || { name: inv.customerName, amount: 0, count: 0 };
    prev.amount += inv.total;
    prev.count += 1;
    byCustomer.set(inv.customer, prev);
  }
  const top3 = Array.from(byCustomer.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);
  const top3Sum = top3.reduce((s, c) => s + c.amount, 0);
  const top3Pct = totalOverdue ? Math.round((top3Sum / totalOverdue) * 100) : 0;

  // Cashflow next 7 days — unpaid invoices due in the next week
  const todayKey = todayDate.toISOString().slice(0, 10);
  const in7 = new Date(todayDate);
  in7.setDate(todayDate.getDate() + 7);
  const in7Key = in7.toISOString().slice(0, 10);
  const upcoming = invoices.filter(
    (i) => i.payStatus !== "lunas" && i.due && i.due > todayKey && i.due <= in7Key,
  );
  const upcomingTotal = upcoming.reduce((s, i) => s + i.total, 0);

  // Average days past due
  const avgDpd = overdue.length
    ? Math.round(overdue.reduce((s, i) => s + Math.max(0, daysSince(i.due)), 0) / overdue.length)
    : 0;

  // Overdue invoices that became overdue this month (due date in current month)
  const monthPfx = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}`;
  const overdueThisMonth = invoices.filter(
    (i) => i.payStatus === "overdue" && i.due && i.due.startsWith(monthPfx),
  );
  const overdueThisMonthTotal = overdueThisMonth.reduce((s, i) => s + i.total, 0);

  // Single largest overdue invoice
  const largest = overdue.reduce((m, i) => (i.total > (m?.total || 0) ? i : m), null);

  const insights = [];

  if (top3.length > 0 && totalOverdue > 0) {
    insights.push({
      id: "concentration",
      node: (
        <>
          <strong className="lg-ai-strong">{top3.length} customer</strong>{" "}
          ({top3.map((c, i) => (
            <span key={c.name}>{i > 0 ? ", " : ""}{shortName(c.name)}</span>
          ))}) menyumbang{" "}
          <strong className="lg-ai-strong">{top3Pct}%</strong> dari{" "}
          <span className="lg-ai-danger">{fmtRpShort(totalOverdue)}</span> piutang telat.
        </>
      ),
      question: "Customer mana yang paling sering telat?",
    });
  }

  if (upcoming.length > 0) {
    insights.push({
      id: "cashflow",
      node: (
        <>
          <strong className="lg-ai-strong">{upcoming.length} invoice</strong> senilai{" "}
          <strong className="lg-ai-strong">{fmtRpShort(upcomingTotal)}</strong> akan jatuh tempo dalam{" "}
          <strong className="lg-ai-strong">7 hari</strong> ke depan.
        </>
      ),
      question: "Bagaimana proyeksi cashflow 7 hari ke depan?",
    });
  }

  if (overdue.length > 0 && avgDpd > 0) {
    insights.push({
      id: "avgDpd",
      node: (
        <>
          Rata-rata <strong className="lg-ai-strong">{avgDpd} hari telat</strong> untuk{" "}
          <strong className="lg-ai-strong">{overdue.length} invoice</strong> yang sudah jatuh tempo.
        </>
      ),
      question: "Berapa rata-rata hari telat customer kami?",
    });
  }

  if (overdueThisMonth.length > 0) {
    insights.push({
      id: "monthOverdue",
      node: (
        <>
          <strong className="lg-ai-strong">{overdueThisMonth.length} invoice</strong> baru jatuh tempo bulan ini,{" "}
          total <span className="lg-ai-danger">{fmtRpShort(overdueThisMonthTotal)}</span>.
        </>
      ),
      question: "Invoice apa saja yang baru jatuh tempo bulan ini?",
    });
  }

  if (largest && largest.total > 0) {
    insights.push({
      id: "largest",
      node: (
        <>
          Invoice telat terbesar:{" "}
          <span className="lg-ai-danger">{fmtRpShort(largest.total)}</span> dari{" "}
          <strong className="lg-ai-strong">{shortName(largest.customerName)}</strong>{" "}
          ({Math.max(0, daysSince(largest.due))} hari telat).
        </>
      ),
      question: `Detail invoice ${largest.invNo} dari ${shortName(largest.customerName)}`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "empty",
      node: <>Belum ada piutang telat hari ini. Semua invoice aktif masih dalam term.</>,
      question: "Apa yang harus saya monitor minggu ini?",
    });
  }

  return insights;
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

  // Auto-rotate insights every 7s with a subtle fade transition
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

  // Reset when insight count changes (data shifted)
  useEffect(() => {
    if (idx >= insights.length) setIdx(0);
  }, [insights.length, idx]);

  const current = insights[idx] || insights[0];

  return (
    <div className={`lg-ai-subtitle${summaryActive || chatActive ? " active" : ""}`}>
      <p className={`lg-ai-text${fading ? " fading" : ""}`}>
        <span className="lg-ai-sparkle"><SparkleIcon /></span>
        {current?.node}
      </p>
      <div className="lg-ai-ctas">
        <button
          type="button"
          className={`lg-ai-cta-primary${summaryActive ? " active" : ""}`}
          onClick={onOpenSummary}
        >
          <SparkleIcon /> Ringkasan
        </button>
        <button
          type="button"
          className={`lg-ai-cta-secondary${chatActive ? " active" : ""}`}
          onClick={onOpenChat}
        >
          {chatActive ? "Lanjutkan obrolan" : "Tanya Klay AI"} →
        </button>
        {insights.length > 1 && (
          <div className="lg-ai-dots" aria-hidden>
            {insights.map((_, i) => (
              <span key={i} className={`lg-ai-dot${i === idx ? " on" : ""}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const AGING_BUCKETS = [
  { key: "90+",    lbl: "Telat > 90 hari",    minDays: 90, maxDaysCap: 150, tone: "danger" },
  { key: "60-90",  lbl: "Telat 60 – 90 hari", minDays: 60, maxDaysCap: 90,  tone: "danger" },
  { key: "30-60",  lbl: "Telat 30 – 60 hari", minDays: 30, maxDaysCap: 60,  tone: "warn"   },
  { key: "0-30",   lbl: "Telat < 30 hari",    minDays:  0, maxDaysCap: 30,  tone: "warn"   },
];

function bucketOf(daysOverdue) {
  if (daysOverdue >= 90) return "90+";
  if (daysOverdue >= 60) return "60-90";
  if (daysOverdue >= 30) return "30-60";
  if (daysOverdue >= 0)  return "0-30";
  return null;
}

function LedgerRow({ r, bucket, isChecked, onCheck, onClick, onKebab, isSelected, isAlt }) {
  // Aging mini-bar applies only to overdue rows
  const isOverdue = r.payStatus === "overdue" && r.daysOverdue > 0;
  const isLunas = r.payStatus === "lunas";
  const isDraft = r.approval === "draft";

  // Customer-attention dot color reflects payment state
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
              <div
                className={`lg-cell-aging-fill${bucket?.tone === "warn" ? " warn" : ""}`}
                style={{ width: pct + "%" }}
              />
            </div>
            <div className="lg-cell-aging-scale">
              {bucket.minDays} ←—— {bucket.maxDaysCap} hari
            </div>
          </>
        ) : isLunas ? (
          <span className="lg-cell-status-marker success"><span className="dot" />Lunas</span>
        ) : isDraft ? (
          <span className="lg-cell-status-marker"><span className="dot" />Belum dikirim</span>
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
  const canPay = inv.approval === "terkirim" && inv.payStatus !== "lunas";
  return (
    <div className="row-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <div className="row-menu-item" onClick={() => onAction("edit", inv)}>
        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Edit
      </div>
      {canPay && (
        <div className="row-menu-item" onClick={() => onAction("payment", inv)}>
          <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          Catat Pembayaran
        </div>
      )}
      <div className="row-menu-item" onClick={() => onAction("recurring", inv)}>
        <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
        Buat Berulang
      </div>
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

const AISvg = () => (
  <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg>
);

// ── Sort + Group popovers ─────────────────────────────────────────────────

const SORT_LABELS = {
  "hari-telat-desc": "Hari Telat ↓",
  "tanggal-desc":    "Tanggal terbaru ↓",
  "tanggal-asc":     "Tanggal terlama ↑",
  "total-desc":      "Total tertinggi ↓",
  "total-asc":       "Total terendah ↑",
  "customer-asc":    "Customer A-Z",
  "customer-desc":   "Customer Z-A",
};

const GROUP_LABELS = {
  "none":     "—",
  "aging":    "Aging",
  "customer": "Customer",
  "bulan":    "Bulan",
  "status":   "Status Bayar",
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
          <button
            key={k}
            className={`lg-popover-item${value === k ? " selected" : ""}`}
            onClick={() => onPick(k)}
          >
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
    { k: "none",     lbl: "Tidak dikelompokkan" },
    { k: "aging",    lbl: "Aging", disabled: !canAging },
    { k: "customer", lbl: "Customer" },
    { k: "bulan",    lbl: "Bulan (Tanggal Invoice)" },
    { k: "status",   lbl: "Status Bayar" },
  ];
  return (
    <div className="lg-popover" ref={ref}>
      <div className="lg-popover-list">
        {items.map((it) => (
          <button
            key={it.k}
            className={`lg-popover-item${value === it.k ? " selected" : ""}`}
            disabled={it.disabled}
            onClick={() => !it.disabled && onPick(it.k)}
          >
            {it.lbl}
            {value === it.k && <svg className="lg-popover-check" viewBox="0 0 12 12"><polyline points="2 6 5 9 10 3"/></svg>}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterPopover({ values, onChange, customers: custList, onClose }) {
  const ref = useRef(null);
  useClickOutside(ref, onClose);
  const [draft, setDraft] = useState(values);
  const [custSearch, setCustSearch] = useState("");

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const toggleCust = (id) => {
    setDraft((d) => {
      const next = new Set(d.customers);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ...d, customers: next };
    });
  };

  const filteredCusts = custList.filter((c) =>
    !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase()),
  );

  const reset = () => {
    setDraft({
      customers: new Set(),
      minAmount: "",
      maxAmount: "",
      dateFrom: "",
      dateTo: "",
      dateField: "date",
      source: "all",
    });
  };
  const apply = () => { onChange(draft); onClose(); };

  return (
    <div className="lg-popover lg-filter-pop" ref={ref}>
      <div className="lg-filter-body">
        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Customer ({draft.customers.size > 0 ? `${draft.customers.size} dipilih` : "semua"})</div>
          <div className="lg-cust-multi">
            <div className="lg-cust-search">
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="5" cy="5" r="3"/><path d="M7.5 7.5l3 3"/></svg>
              <input
                value={custSearch}
                onChange={(e) => setCustSearch(e.target.value)}
                placeholder="Cari customer…"
              />
            </div>
            <div className="lg-cust-list">
              {filteredCusts.length === 0 && (
                <div className="lg-cust-empty">Tidak ada customer cocok</div>
              )}
              {filteredCusts.map((c) => (
                <label key={c.id} className="lg-cust-item">
                  <input type="checkbox" checked={draft.customers.has(c.id)} onChange={() => toggleCust(c.id)} />
                  <span className="lg-cust-item-name">{c.name}</span>
                  <span className="lg-cust-item-count">{c.count}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Rentang Nominal (Rp)</div>
          <div className="lg-filter-row2">
            <input
              type="number"
              className="lg-filter-input"
              placeholder="Min"
              value={draft.minAmount}
              onChange={(e) => update({ minAmount: e.target.value })}
            />
            <span style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>—</span>
            <input
              type="number"
              className="lg-filter-input"
              placeholder="Max"
              value={draft.maxAmount}
              onChange={(e) => update({ maxAmount: e.target.value })}
            />
          </div>
        </div>

        <div className="lg-filter-fld">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="lg-filter-fld-lbl">Rentang Tanggal</div>
            <div className="lg-segmented">
              <button
                className={`lg-seg${draft.dateField === "date" ? " on" : ""}`}
                onClick={() => update({ dateField: "date" })}
              >
                Tanggal Invoice
              </button>
              <button
                className={`lg-seg${draft.dateField === "due" ? " on" : ""}`}
                onClick={() => update({ dateField: "due" })}
              >
                Jatuh Tempo
              </button>
            </div>
          </div>
          <div className="lg-filter-row2">
            <input
              type="date"
              className="lg-filter-input"
              value={draft.dateFrom}
              onChange={(e) => update({ dateFrom: e.target.value })}
            />
            <span style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>—</span>
            <input
              type="date"
              className="lg-filter-input"
              value={draft.dateTo}
              onChange={(e) => update({ dateTo: e.target.value })}
            />
          </div>
        </div>

        <div className="lg-filter-fld">
          <div className="lg-filter-fld-lbl">Sumber</div>
          <div className="lg-toggle-row">
            {[["all", "Semua"], ["ai", "AI"], ["manual", "Manual"]].map(([k, lbl]) => (
              <button
                key={k}
                className={`lg-toggle${draft.source === k ? " on" : ""}`}
                onClick={() => update({ source: k })}
              >
                {lbl}
              </button>
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

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { invoices, sendInvoice } = useInvoices();

  const [search, setSearch] = useState("");
  // Unified filter — either driven by a tab or by a KPI card.
  // kind='tab' | 'card'; value is the key for that kind.
  const [filter, setFilter] = useState({ kind: "tab", value: "jatuhtempo" });
  // Sort + group choices override per-tab defaults when non-null
  const [sortChoice, setSortChoice]   = useState(null);
  const [groupChoice, setGroupChoice] = useState(null);
  // Advanced filter (applied additively on top of pill/card)
  const emptyFilters = {
    customers: new Set(),
    minAmount: "",
    maxAmount: "",
    dateFrom: "",
    dateTo: "",
    dateField: "date", // 'date' | 'due'
    source: "all",     // 'all' | 'ai' | 'manual'
  };
  const [filterValues, setFilterValues] = useState(emptyFilters);
  // Popover open flags
  const [sortPopOpen, setSortPopOpen]     = useState(false);
  const [groupPopOpen, setGroupPopOpen]   = useState(false);
  const [filterPopOpen, setFilterPopOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [drawerTab, setDrawerTab] = useState("detail");
  const [checked, setChecked] = useState(() => new Set());
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [toast, setToast] = useState("");
  const toastTmr = useRef(null);

  const [choiceOpen, setChoiceOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSeedQuestion, setAiSeedQuestion] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const [sendOpen, setSendOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [sendCC, setSendCC] = useState("");
  const [sendMsg, setSendMsg] = useState("Terlampir invoice kami, mohon ditindaklanjuti.");
  const [sendSuccess, setSendSuccess] = useState(false);

  function showToast(msg) {
    setToast(msg);
    if (toastTmr.current) clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToast(""), 1800);
  }

  // ── Tab counts (derived from full invoices list, before filters) ────────
  const tabCounts = useMemo(() => ({
    semua:      invoices.length,
    terkirim:   invoices.filter(i => i.approval === "terkirim").length,
    draft:      invoices.filter(i => i.approval === "draft").length,
    jatuhtempo: invoices.filter(i => i.payStatus === "overdue").length,
    lunas:      invoices.filter(i => i.payStatus === "lunas").length,
  }), [invoices]);

  const monthPfx = useMemo(() => `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, "0")}`, []);

  // ── KPI strip ───────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalPiutang     = invoices.filter(i => i.payStatus !== "lunas").reduce((s, i) => s + i.total, 0);
    const overdue          = invoices.filter(i => i.payStatus === "overdue");
    const overdueThisMonth = invoices.filter(i => i.payStatus === "overdue" && i.due && i.due.startsWith(monthPfx));
    const thisMonth        = invoices.filter(i => i.date && i.date.startsWith(monthPfx));
    return [
      { lbl: "Total Piutang",         card: "total",          val: "Rp " + fmtRp(totalPiutang),                                       sub: invoices.filter(i => i.payStatus !== "lunas").length + " invoice aktif", tone: "primary" },
      { lbl: "Jatuh Tempo",           card: "overdue",        val: "Rp " + fmtRp(overdue.reduce((s, i) => s + i.total, 0)),           sub: overdue.length + " invoice telat",                                       tone: "danger"  },
      { lbl: "Jatuh Tempo Bulan Ini", card: "overdueMonth",   val: String(overdueThisMonth.length),                                   sub: "Rp " + fmtRp(overdueThisMonth.reduce((s, i) => s + i.total, 0)),         tone: "warn"    },
      { lbl: "Dibuat Bulan Ini",      card: "thisMonth",      val: "Rp " + fmtRp(thisMonth.reduce((s, i) => s + i.total, 0)),         sub: thisMonth.length + " invoice baru",                                      tone: "primary" },
    ];
  }, [invoices, monthPfx]);

  const insights = useMemo(() => computeInsights(invoices, TODAY), [invoices]);

  function askAi(question) {
    setSummaryOpen(false);
    setAiSeedQuestion(question);
    setAiOpen(true);
  }

  // ── Step 1: corpus (pill / card filter only) ────────────────────────────
  const corpus = useMemo(() => {
    let list = invoices;
    if (filter.kind === "tab") {
      if (filter.value === "terkirim")        list = list.filter(i => i.approval === "terkirim");
      else if (filter.value === "draft")      list = list.filter(i => i.approval === "draft");
      else if (filter.value === "jatuhtempo") list = list.filter(i => i.payStatus === "overdue");
      else if (filter.value === "lunas")      list = list.filter(i => i.payStatus === "lunas");
    } else if (filter.kind === "card") {
      if (filter.value === "total")             list = list.filter(i => i.payStatus !== "lunas");
      else if (filter.value === "overdueMonth") list = list.filter(i => i.payStatus === "overdue" && i.due && i.due.startsWith(monthPfx));
      else if (filter.value === "thisMonth")    list = list.filter(i => i.date && i.date.startsWith(monthPfx));
    }
    return list;
  }, [invoices, filter, monthPfx]);

  // ── Customers present in the current corpus (for Filter popover list) ───
  const customersInCorpus = useMemo(() => {
    const counts = new Map();
    for (const inv of corpus) {
      const c = customers.find((x) => x.id === inv.customer);
      if (!c) continue;
      const prev = counts.get(c.id) || { id: c.id, name: c.name, count: 0 };
      prev.count += 1;
      counts.set(c.id, prev);
    }
    return Array.from(counts.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [corpus]);

  // ── Has-any-filter flag for the "Reset semua" affordance ────────────────
  const hasActiveFilters = useMemo(() => {
    return (
      filterValues.customers.size > 0 ||
      filterValues.minAmount !== "" ||
      filterValues.maxAmount !== "" ||
      filterValues.dateFrom !== "" ||
      filterValues.dateTo !== "" ||
      filterValues.source !== "all" ||
      sortChoice !== null ||
      groupChoice !== null
    );
  }, [filterValues, sortChoice, groupChoice]);

  // Number of advanced-filter dimensions active (for badge on Filter button)
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterValues.customers.size > 0) n++;
    if (filterValues.minAmount !== "" || filterValues.maxAmount !== "") n++;
    if (filterValues.dateFrom !== "" || filterValues.dateTo !== "") n++;
    if (filterValues.source !== "all") n++;
    return n;
  }, [filterValues]);

  // ── Step 2: apply advanced filter + text search to the corpus ───────────
  const filteredRows = useMemo(() => {
    let list = corpus;

    // Customer multi-select
    if (filterValues.customers.size > 0) {
      list = list.filter(i => filterValues.customers.has(i.customer));
    }
    // Amount range
    const min = filterValues.minAmount === "" ? null : Number(filterValues.minAmount);
    const max = filterValues.maxAmount === "" ? null : Number(filterValues.maxAmount);
    if (min != null && !isNaN(min)) list = list.filter(i => i.total >= min);
    if (max != null && !isNaN(max)) list = list.filter(i => i.total <= max);
    // Date range (applied to either invoice date or due date)
    if (filterValues.dateFrom) list = list.filter(i => (i[filterValues.dateField] || "") >= filterValues.dateFrom);
    if (filterValues.dateTo)   list = list.filter(i => (i[filterValues.dateField] || "") <= filterValues.dateTo);
    // Source
    if (filterValues.source === "ai")     list = list.filter(i => i.isAI === true);
    if (filterValues.source === "manual") list = list.filter(i => !i.isAI);

    // Text search
    const q = search.toLowerCase().trim();
    if (q) list = list.filter(i =>
      i.invNo.toLowerCase().includes(q) ||
      i.customerName.toLowerCase().includes(q) ||
      (i.custPO && i.custPO.toLowerCase().includes(q)),
    );

    return list.map(toRow);
  }, [corpus, filterValues, search]);

  // ── Sort + Group derivation ─────────────────────────────────────────────
  const onJatuhTempo = filter.kind === "tab" && filter.value === "jatuhtempo";
  const onLunas      = filter.kind === "tab" && filter.value === "lunas";
  const onDraft      = filter.kind === "tab" && filter.value === "draft";

  const defaultSort  = onJatuhTempo ? "hari-telat-desc" : "tanggal-desc";
  const effectiveSort = sortChoice || defaultSort;

  const defaultGroup = onJatuhTempo ? "aging" : "none";
  const effectiveGroup = groupChoice || defaultGroup;

  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    switch (effectiveSort) {
      case "hari-telat-desc": arr.sort((a, b) => b.daysOverdue - a.daysOverdue); break;
      case "tanggal-desc":    arr.sort((a, b) => (b.raw.date || "").localeCompare(a.raw.date || "")); break;
      case "tanggal-asc":     arr.sort((a, b) => (a.raw.date || "").localeCompare(b.raw.date || "")); break;
      case "total-desc":      arr.sort((a, b) => b.total - a.total); break;
      case "total-asc":       arr.sort((a, b) => a.total - b.total); break;
      case "customer-asc":    arr.sort((a, b) => a.co.localeCompare(b.co)); break;
      case "customer-desc":   arr.sort((a, b) => b.co.localeCompare(a.co)); break;
      default: break;
    }
    return arr;
  }, [filteredRows, effectiveSort]);

  // Aging group computation moved into a memo over sortedRows
  const showAgingGroups = effectiveGroup === "aging";

  function selectTab(t) { setFilter({ kind: "tab", value: t }); clearChecks(); }
  function selectCard(c) {
    if (c === null) setFilter({ kind: "tab", value: "semua" });
    // 'overdue' card is just a shortcut to the jatuhtempo tab so they share UI state
    else if (c === "overdue") setFilter({ kind: "tab", value: "jatuhtempo" });
    else setFilter({ kind: "card", value: c });
    clearChecks();
  }
  const isTabActive  = (t) => filter.kind === "tab"  && filter.value === t;
  const isCardActive = (c) => {
    if (c === "overdue") return filter.value === "jatuhtempo";
    return filter.kind === "card" && filter.value === c;
  };

  const groups = useMemo(() => {
    if (effectiveGroup === "none") return null;

    if (effectiveGroup === "aging") {
      const byBucket = new Map();
      for (const b of AGING_BUCKETS) byBucket.set(b.key, []);
      for (const r of sortedRows) {
        const key = bucketOf(r.daysOverdue);
        if (key) byBucket.get(key).push(r);
      }
      return AGING_BUCKETS.map((b) => {
        const rows = byBucket.get(b.key);
        return { ...b, key: b.key, label: b.lbl, rows, sum: rows.reduce((s, r) => s + r.total, 0), kind: "aging" };
      }).filter((g) => g.rows.length > 0);
    }

    // Generic grouping by a key function
    const keyFn = (r) => {
      if (effectiveGroup === "customer") return r.co;
      if (effectiveGroup === "bulan") return (r.raw.date || "").slice(0, 7); // YYYY-MM
      if (effectiveGroup === "status") {
        if (r.payStatus === "lunas") return "Lunas";
        if (r.payStatus === "overdue") return "Jatuh Tempo";
        if (r.approval === "draft") return "Draft";
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

  // ── Selected rows summary ───────────────────────────────────────────────
  const selected = invoices.find((i) => i.id === selectedId);
  const selectedCustomer = selected ? customers.find((c) => c.id === selected.customer) : null;

  const pageTotal = filteredRows.reduce((s, r) => s + r.total, 0);
  const selectedTotal = filteredRows.filter((r) => checked.has(r.id)).reduce((s, r) => s + r.total, 0);

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

  function resetAll() {
    setSortChoice(null);
    setGroupChoice(null);
    setFilterValues(emptyFilters);
    setSearch("");
  }

  function exportCsv() {
    const headers = ["Invoice", "Tanggal", "Customer", "Alamat", "Jatuh Tempo", "Hari Telat", "Total", "Status Invoice", "Status Bayar"];
    const escapeCell = (v) => {
      const s = String(v == null ? "" : v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of sortedRows) {
      lines.push([
        r.no, r.tgl, r.co, r.addr, r.due, r.daysOverdue, r.total, r.approval, r.payStatus,
      ].map(escapeCell).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = `${TODAY.getFullYear()}${String(TODAY.getMonth() + 1).padStart(2, "0")}${String(TODAY.getDate()).padStart(2, "0")}`;
    a.download = `klay-invoices-${filter.value}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`${sortedRows.length} invoice diekspor ke CSV`);
  }

  function onRowAction(action, inv) {
    setMenuOpenFor(null);
    if (action === "edit") showToast(`Edit ${inv.id} (demo)`);
    else if (action === "payment") showToast(`Catat pembayaran untuk ${inv.id}`);
    else if (action === "recurring") showToast(`Buat invoice berulang dari ${inv.id}`);
    else if (action === "duplicate") showToast(`Duplikat ${inv.id}`);
    else if (action === "archive") showToast(`${inv.id} diarsipkan`);
  }

  function onBulk(action) {
    const count = checked.size;
    if (action === "remind") showToast(`Reminder dikirim ke ${count} customer`);
    else if (action === "lunas") showToast(`${count} invoice ditandai Lunas`);
    else if (action === "archive") showToast(`${count} invoice diarsipkan`);
    clearChecks();
  }

  function openSendForSelected() {
    if (!selected) return;
    setSendEmail(selected.custEmail || "");
    setSendCC("");
    setSendMsg("Terlampir invoice kami, mohon ditindaklanjuti.");
    setSendSuccess(false);
    setSendOpen(true);
  }
  function confirmSend() {
    if (!selected) return;
    sendInvoice(selected.id, { channel: "email" });
    setSendSuccess(true);
    setTimeout(() => { setSendOpen(false); setSelectedId(null); }, 1300);
  }

  const tabs = [
    { k: "semua",      lbl: "Semua",       count: tabCounts.semua },
    { k: "terkirim",   lbl: "Terkirim",    count: tabCounts.terkirim },
    { k: "draft",      lbl: "Draft",       count: tabCounts.draft },
    { k: "jatuhtempo", lbl: "Jatuh Tempo", count: tabCounts.jatuhtempo },
    { k: "lunas",      lbl: "Lunas",       count: tabCounts.lunas },
  ];

  return (
    <div className="lg-page">
    <div className="lg-scroll-container">
      {/* ── Editorial header ─────────────────────────────────────────── */}
      <div className="lg-head">
        <div className="lg-head-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="lg-title">Invoices</h1>
            <AiSubtitle
              insights={insights}
              onOpenSummary={() => setSummaryOpen(true)}
              onOpenChat={() => setAiOpen(true)}
              chatActive={aiOpen}
              summaryActive={summaryOpen}
            />
          </div>
          <div className="lg-head-actions">
            <button className="lg-btn-brand" onClick={() => setChoiceOpen(true)}>
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Buat invoice
            </button>
          </div>
        </div>

        {/* KPI strip — 4 cells, hairline-divided, clickable */}
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

      {/* ── Table card ──────────────────────────────────────────────── */}
      <div className="lg-table-wrap">
        <div className="lg-card">

          {/* Pills row */}
          <div className="lg-pills-row">
            {tabs.map((t) => (
              <button
                key={t.k}
                className={`lg-pill${isTabActive(t.k) ? " active" : ""}`}
                onClick={() => selectTab(t.k)}
              >
                {t.lbl}
                <span className="lg-pill-count">{t.count}</span>
              </button>
            ))}
          </div>

          {/* Search + Filter / Sort row */}
          <div className="lg-filter-row">
            <div className="lg-search">
              <svg viewBox="0 0 14 14"><circle cx="6" cy="6" r="3.5"/><path d="M9 9l3 3" strokeLinecap="round"/></svg>
              <input
                placeholder="Cari nomor invoice, customer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="lg-filter-meta">
              <div className="lg-meta-btn-wrap">
                <button
                  className={`lg-meta-btn${activeFilterCount > 0 ? " active" : ""}`}
                  onClick={() => { setFilterPopOpen(!filterPopOpen); setSortPopOpen(false); setGroupPopOpen(false); }}
                >
                  <svg viewBox="0 0 12 12"><path d="M2 3h8M3 6h6M4 9h4" strokeLinecap="round"/></svg>
                  Filter
                  {activeFilterCount > 0 && <span className="lg-filter-badge">{activeFilterCount}</span>}
                </button>
                {filterPopOpen && (
                  <FilterPopover
                    values={filterValues}
                    onChange={setFilterValues}
                    customers={customersInCorpus}
                    onClose={() => setFilterPopOpen(false)}
                  />
                )}
              </div>
              <div className="lg-meta-btn-wrap">
                <button
                  className="lg-meta-btn"
                  onClick={() => { setSortPopOpen(!sortPopOpen); setFilterPopOpen(false); setGroupPopOpen(false); }}
                >
                  <span className="meta-lbl">Urut:</span>
                  <span className="meta-val">{SORT_LABELS[effectiveSort]}</span>
                </button>
                {sortPopOpen && (
                  <SortPopover
                    value={effectiveSort}
                    onPick={(v) => { setSortChoice(v); setSortPopOpen(false); }}
                    onClose={() => setSortPopOpen(false)}
                  />
                )}
              </div>
              <div className="lg-meta-btn-wrap">
                <button
                  className="lg-meta-btn"
                  onClick={() => { setGroupPopOpen(!groupPopOpen); setSortPopOpen(false); setFilterPopOpen(false); }}
                >
                  <span className="meta-lbl">Group:</span>
                  <span className="meta-val">{GROUP_LABELS[effectiveGroup]}</span>
                </button>
                {groupPopOpen && (
                  <GroupPopover
                    value={effectiveGroup}
                    canAging={!onLunas && !onDraft}
                    onPick={(v) => { setGroupChoice(v); setGroupPopOpen(false); }}
                    onClose={() => setGroupPopOpen(false)}
                  />
                )}
              </div>
              <button className="lg-filter-export" onClick={exportCsv}>
                <svg viewBox="0 0 12 12"><path d="M6 2v6M3 6l3 3 3-3M2 10.5h8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Ekspor CSV
              </button>
              {hasActiveFilters && (
                <button className="lg-reset-all" onClick={resetAll}>Reset semua</button>
              )}
            </div>
          </div>

          {/* Column header */}
          <div className="lg-col-header">
            <div><input type="checkbox" className="lg-row-check" disabled /></div>
            <div>Invoice</div>
            <div>Tanggal</div>
            <div>Customer</div>
            <div style={{ textAlign: "right" }}>Hari Telat</div>
            <div style={{ paddingLeft: 12 }}>Jatuh Tempo</div>
            <div>Aging</div>
            <div style={{ textAlign: "right" }}>Total · IDR</div>
            <div />
          </div>

          {/* Rows (page-level scroll, only column header sticks) */}
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
                        <span className={`lg-group-lbl${isAging ? (g.tone === "danger" ? " danger" : " warn") : ""}`}>
                          {g.label}
                        </span>
                        <span className={`lg-group-count${isAging ? (g.tone === "danger" ? " danger" : " warn") : ""}`}>
                          {g.rows.length}
                        </span>
                      </div>
                      <div className="lg-group-subtotal">
                        <span className="lg-group-subtotal-lbl">Subtotal</span>
                        Rp {fmtRp(g.sum)}
                      </div>
                    </div>
                    {!isCollapsed && g.rows.map((r, i) => {
                      const isOverdue = r.payStatus === "overdue" && r.daysOverdue > 0;
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
                {sortedRows.length === 0 && (
                  <div className="lg-empty">Tidak ada invoice yang cocok</div>
                )}
                {sortedRows.map((r, i) => {
                  const isOverdue = r.payStatus === "overdue" && r.daysOverdue > 0;
                  const bucket = isOverdue
                    ? {
                        minDays: r.daysOverdue >= 90 ? 90 : r.daysOverdue >= 60 ? 60 : r.daysOverdue >= 30 ? 30 : 0,
                        maxDaysCap: r.daysOverdue >= 90 ? 150 : r.daysOverdue >= 60 ? 90 : r.daysOverdue >= 30 ? 60 : 30,
                        tone: r.daysOverdue >= 60 ? "danger" : "warn",
                      }
                    : null;
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

      {/* ── Sticky footer ───────────────────────────────────────────── */}
      <div className="lg-footer">
        <div className="lg-footer-left">
          <span><span className="lg-footer-num">{checked.size}</span> dipilih</span>
          {checked.size > 0 ? (
            <>
              <button className="lg-footer-bulk-btn" onClick={() => onBulk("remind")}>Kirim Reminder</button>
              <button className="lg-footer-clear" onClick={clearChecks}>Batal pilih</button>
            </>
          ) : (
            <>
              <span className="lg-footer-sep">·</span>
              <span>Menampilkan <span className="lg-footer-num">{filteredRows.length}</span> invoice</span>
            </>
          )}
        </div>
        <div className="lg-footer-right">
          <span className="lg-footer-lbl">{checked.size > 0 ? "Subtotal terpilih" : "Subtotal halaman"}</span>
          <span className="lg-footer-total">Rp {fmtRp(checked.size > 0 ? selectedTotal : pageTotal)}</span>
        </div>
      </div>

      {/* ── Side drawer (detail) ────────────────────────────────────── */}
      {selected && (
        <>
          <div className="drawer-overlay" onClick={() => setSelectedId(null)} />
          <div className="drawer">
            <div className="drawer-head">
              <div className={`drawer-av ${selectedCustomer?.type || "perusahaan"}`}>{initials(selected.customerName)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="drawer-title">{selected.customerName}</div>
                <div className="drawer-sub">{selected.invNo === "—" ? "Draft" : selected.invNo}</div>
              </div>
              <button className="drawer-close" onClick={() => setSelectedId(null)}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="drawer-tabs">
              {[["detail","Detail"],["items","Items"],["audit","Audit"]].map(([t,label]) => (
                <div key={t} className={`drawer-tab${drawerTab===t?" active":""}`} onClick={()=>setDrawerTab(t)}>{label}</div>
              ))}
            </div>
            <div className="drawer-body">
              {drawerTab === "detail" && (
                <>
                  <div className="drawer-stat-row">
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">Total Invoice</div>
                      <div className="drawer-stat-val">{formatRupiah(selected.total)}</div>
                    </div>
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">Status Bayar</div>
                      <div className={`drawer-stat-val${selected.payStatus==="lunas"?" success":selected.payStatus==="overdue"?" danger":""}`} style={{ fontSize: 13 }}>
                        {PAY_LABEL[selected.payStatus] || selected.payStatus}
                      </div>
                    </div>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-section-title">Informasi Invoice</div>
                    {[
                      ["Invoice ID", selected.id],
                      ["Nomor Invoice", selected.invNo],
                      ["Customer PO", selected.custPO],
                      ["Customer", selected.customerName],
                      ["Email", selected.custEmail],
                      ["Tanggal Dibuat", formatDate(selected.date)],
                      ["Jatuh Tempo", formatDate(selected.due)],
                      ["Status Invoice", APPROVAL_LABEL[selected.approval] || selected.approval],
                    ].map(([label, value]) => (
                      <div key={label} className="drawer-row">
                        <div className="drawer-label">{label}</div>
                        <div className="drawer-value">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-section-title">Pajak</div>
                    {[
                      ["DPP", formatRupiah(selected.dpp)],
                      ["PPN (11%)", formatRupiah(selected.ppn)],
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
                    <thead><tr><th>Deskripsi</th><th className="r">Qty</th><th>Unit</th><th className="r">Harga</th><th className="r">Subtotal</th></tr></thead>
                    <tbody>
                      {selected.items.map((item, i) => (
                        <tr key={i}>
                          <td>{item.desc}</td>
                          <td className="r">{item.qty}</td>
                          <td>{item.unit}</td>
                          <td className="r">{formatRupiah(item.price)}</td>
                          <td className="r">{formatRupiah(item.subtotal)}</td>
                        </tr>
                      ))}
                      <tr className="items-total-row"><td colSpan={4}>Total</td><td className="r">{formatRupiah(selected.total)}</td></tr>
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
            <div className="drawer-footer">
              {selected.approval === "draft" && (
                <button className="drawer-btn primary" onClick={openSendForSelected}>
                  <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  Kirim Invoice
                </button>
              )}
              {selected.approval === "terkirim" && selected.payStatus !== "lunas" && (
                <button className="drawer-btn primary">
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  Tandai Lunas
                </button>
              )}
              <button className="drawer-btn ghost">
                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Choice modal (Buat Invoice entry point) ─────────────────── */}
      {choiceOpen && (
        <div className="modal-overlay open" onClick={() => setChoiceOpen(false)}>
          <div className="choice-box" onClick={(e) => e.stopPropagation()}>
            <div className="choice-head">
              <div className="choice-title">Buat Invoice Baru</div>
              <button className="choice-close" onClick={() => setChoiceOpen(false)}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="method-cards">
              <div className="method-card" onClick={() => { setChoiceOpen(false); navigate("/invoices/new?mode=upload"); }}>
                <div className="method-icon upload">
                  <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <div className="method-title">Upload PO Customer</div>
                <div className="method-sub">Upload dokumen PO dan AI akan mengekstrak data secara otomatis.</div>
                <span className="method-tag ai"><AISvg />AI Ekstrak Otomatis</span>
              </div>
              <div className="method-card" onClick={() => { setChoiceOpen(false); navigate("/invoices/new?mode=manual"); }}>
                <div className="method-icon manual">
                  <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </div>
                <div className="method-title">Isi Manual</div>
                <div className="method-sub">Input data invoice secara manual dengan form terstruktur.</div>
                <span className="method-tag man">Form Manual</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Send modal (from drawer's "Kirim Invoice") ──────────────── */}
      {sendOpen && selected && (
        <div className="modal-overlay open" onClick={() => !sendSuccess && setSendOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            {sendSuccess ? (
              <div className="send-success">
                <div className="send-success-icon">
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div className="send-success-title">Invoice terkirim ✓</div>
                <div className="send-success-sub">Status berubah ke "Belum Bayar"</div>
              </div>
            ) : (
              <>
                <div className="modal-title">Kirim Invoice</div>
                <div className="modal-sub">Invoice {selected.id} akan dikirimkan ke email customer. PDF dilampirkan otomatis.</div>
                <div className="fld">
                  <label>Kirim ke</label>
                  <input type="email" value={sendEmail} onChange={(e) => setSendEmail(e.target.value)} />
                </div>
                <div className="fld">
                  <label>CC (opsional)</label>
                  <input type="email" value={sendCC} onChange={(e) => setSendCC(e.target.value)} placeholder="cc@kamu.id" />
                </div>
                <div className="fld">
                  <label>Pesan</label>
                  <textarea value={sendMsg} onChange={(e) => setSendMsg(e.target.value)} />
                </div>
                <div className="modal-footer">
                  <button className="modal-cancel" onClick={() => setSendOpen(false)}>Batal</button>
                  <button className="modal-confirm" onClick={confirmSend}>
                    <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    Kirim Sekarang
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast show">{toast}</div>}

      {/* ── Klay AI drawers (Summary + Chat) ────────────────────────── */}
      <div
        className={`ai-backdrop${aiOpen || summaryOpen ? " open" : ""}`}
        onClick={() => { setAiOpen(false); setSummaryOpen(false); }}
        aria-hidden={!(aiOpen || summaryOpen)}
      />
      <SummaryDrawer
        open={summaryOpen}
        insights={insights}
        onClose={() => setSummaryOpen(false)}
        onAsk={askAi}
      />
      <AiChatDrawer
        open={aiOpen}
        onClose={() => { setAiOpen(false); setAiSeedQuestion(null); }}
        initialQuestion={aiSeedQuestion}
        onConsumedInitialQuestion={() => setAiSeedQuestion(null)}
      />
    </div>
  );
}
