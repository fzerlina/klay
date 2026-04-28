import { Fragment, useState, useMemo, useEffect, useRef } from "react";
import { TB_COA, TB_JE, TB_OPENING } from "../data/trialBalanceData";
import "./TrialBalancePage.css";

// ── helpers ──────────────────────────────────────────────────────────────
const PARENT_SET = new Set(TB_COA.filter(a => a.parent).map(a => a.parent));
const LEAF = TB_COA.filter(a => !PARENT_SET.has(a.code));

const TYPE_LABELS = {
  asset: "ASET",
  contra_asset: "KONTRA ASET",
  liability: "LIABILITAS",
  equity: "EKUITAS",
  revenue: "PENDAPATAN",
  expense: "BEBAN",
};
const TYPE_ORDER = ["asset", "contra_asset", "liability", "equity", "revenue", "expense"];
const TYPE_BADGE_CLS = {
  asset: "tb-asset",
  contra_asset: "tb-contra",
  liability: "tb-liab",
  equity: "tb-equity",
  revenue: "tb-rev",
  expense: "tb-exp",
};

const rp = (v) => {
  if (v === 0 || v === null || v === undefined) return "—";
  const abs = Math.abs(v);
  return (v < 0 ? "(" : "") + "Rp " + abs.toLocaleString("id-ID") + (v < 0 ? ")" : "");
};
const rpZ = (v) => {
  if (v === undefined || v === null) return "—";
  const abs = Math.abs(v);
  return (v < 0 ? "(" : "") + "Rp " + abs.toLocaleString("id-ID") + (v < 0 ? ")" : "");
};
const fmtIdDate = (s) =>
  new Date(s + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

// Compute trial balance rows for the given period.
function computeTB(dateFrom, dateTo) {
  const acc = {};
  LEAF.forEach((a) => {
    acc[a.code] = { preDr: 0, preCr: 0, perDr: 0, perCr: 0, entries: [] };
  });
  TB_JE.forEach((je) => {
    if (je.status !== "posted") return;
    je.lines.forEach((line) => {
      const a = acc[line.account_code];
      if (!a) return;
      const dr = line.debit || 0;
      const cr = line.credit || 0;
      if (je.je_date < dateFrom) {
        a.preDr += dr;
        a.preCr += cr;
      } else if (je.je_date >= dateFrom && je.je_date <= dateTo) {
        a.perDr += dr;
        a.perCr += cr;
        a.entries.push({
          je_ref: je.je_number,
          date: je.je_date,
          debit: dr,
          credit: cr,
          description: line.description,
          memo: je.memo,
          posted_by: je.posted_by,
          posted_date: je.posted_date,
          reference_type: je.reference_type,
          reference_id: je.reference_id,
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
  let dr = 0;
  let cr = 0;
  rows.forEach((r) => {
    const cb = r.closing_balance;
    if (r.normal_balance === "debit") {
      cb >= 0 ? (dr += cb) : (cr += Math.abs(cb));
    } else {
      cb >= 0 ? (cr += cb) : (dr += Math.abs(cb));
    }
  });
  return { dr, cr, variance: Math.abs(dr - cr), balanced: Math.abs(dr - cr) < 1 };
}

// AI anomaly rules — same logic as v4 prototype.
function detectAnomalies(tb) {
  const out = [];
  const byCode = {};
  tb.forEach((r) => { byCode[r.code] = r; });

  tb.filter((r) => r.type === "contra_asset").forEach((r) => {
    if (r.closing_balance > 0) {
      out.push({
        severity: "critical", code: r.code, name: r.name,
        title: "Saldo kontra aset positif — tidak wajar",
        desc: `${r.name} memiliki saldo akhir +${rp(r.closing_balance)}, seharusnya negatif atau nol untuk akun kontra aset. Kemungkinan entri jurnal terbalik.`,
        action: "Periksa JE yang memengaruhi akun ini dan koreksi jika diperlukan.",
      });
    }
  });

  const ar = byCode["1-1200"];
  const cadangan = byCode["1-1300"];
  if (ar && cadangan && ar.closing_balance > 0 && cadangan.closing_balance === 0) {
    out.push({
      severity: "critical", code: "1-1300", name: "Cadangan Piutang Ragu",
      title: "Cadangan piutang ragu-ragu belum dibentuk",
      desc: `Piutang Usaha bersaldo ${rp(ar.closing_balance)} namun Cadangan Piutang Ragu masih nol. Standar akuntansi mensyaratkan estimasi tidak tertagih.`,
      action: "Hitung dan catat pencadangan piutang sesuai kebijakan perusahaan.",
    });
  }

  const rev4010 = byCode["4-1010"];
  const rev4020 = byCode["4-1020"];
  const totalRev = (rev4010 ? rev4010.closing_balance : 0) + (rev4020 ? rev4020.closing_balance : 0);
  if (ar && totalRev > 0 && ar.closing_balance > totalRev * 0.55) {
    out.push({
      severity: "warn", code: "1-1200", name: "Piutang Usaha",
      title: "Piutang usaha tinggi relatif terhadap pendapatan",
      desc: `Piutang ${rp(ar.closing_balance)} = ${Math.round(ar.closing_balance / totalRev * 100)}% dari total pendapatan. Risiko kolektibilitas meningkat jika melewati 45 hari.`,
      action: "Tinjau aging piutang dan kebijakan kredit pelanggan.",
    });
  }

  const iklan = byCode["5-1030"];
  if (iklan && iklan.opening_balance === 0 && iklan.period_debit > 15000000) {
    out.push({
      severity: "warn", code: "5-1030", name: "Beban Iklan & Pemasaran",
      title: "Lonjakan beban iklan tanpa historis saldo awal",
      desc: `Beban Iklan & Pemasaran mencatat debit ${rp(iklan.period_debit)} pada periode ini dengan saldo awal nol — peningkatan signifikan tanpa referensi historis.`,
      action: "Konfirmasi otorisasi anggaran pemasaran dan kontrak terkait.",
    });
  }

  const ap = byCode["2-1100"];
  if (ap && ap.closing_balance > 80000000) {
    out.push({
      severity: "warn", code: "2-1100", name: "Utang Usaha",
      title: "Saldo utang usaha melebihi ambang batas",
      desc: `Utang Usaha bersaldo ${rp(ap.closing_balance)} — melampaui threshold internal Rp 80 juta. Pastikan jadwal pembayaran vendor sudah direncanakan agar tidak terkena denda keterlambatan.`,
      action: "Tinjau aging schedule utang usaha dan prioritaskan pembayaran jatuh tempo.",
    });
  }

  const konsultan = byCode["5-1070"];
  if (konsultan && konsultan.period_debit >= 25000000) {
    out.push({
      severity: "warn", code: "5-1070", name: "Biaya Konsultan & Profesional",
      title: "Kemungkinan tagihan ganda dari konsultan",
      desc: `Terdapat 2 transaksi konsultan dalam periode yang sama (JE-2025-0004 & JE-2025-0018) dengan total ${rp(konsultan.period_debit)}. Verifikasi tidak ada duplikasi invoice.`,
      action: "Cocokkan dengan kontrak dan invoice fisik dari vendor konsultan.",
    });
  }

  const ppn = byCode["5-2200"];
  if (ppn && ppn.closing_balance > 10000000) {
    out.push({
      severity: "info", code: "5-2200", name: "Beban PPN Masukan",
      title: "PPN masukan belum dikompensasikan ke PPN keluaran",
      desc: `Saldo PPN Masukan ${rp(ppn.closing_balance)} masih diakui sebagai beban. Periksa apakah kompensasi dengan PPN Keluaran (2-1200) sudah dilakukan untuk SPT Masa PPN.`,
      action: "Koordinasikan dengan tim pajak untuk rekonsiliasi PPN bulan berjalan.",
    });
  }

  tb.filter((r) => r.opening_balance !== 0 && r.closing_balance === 0 && r.has_activity && r.type === "liability").forEach((r) => {
    out.push({
      severity: "info", code: r.code, name: r.name,
      title: "Kewajiban terlunasi penuh dalam periode",
      desc: `${r.name} memiliki saldo awal ${rp(r.opening_balance)} dan terlunasi hingga nol pada periode ini. Konfirmasi pelunasan sudah didokumentasikan.`,
      action: "Arsipkan bukti pelunasan untuk keperluan audit.",
    });
  });

  return out;
}

// ── icons ────────────────────────────────────────────────────────────────
const IconExport = () => (
  <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
);
const IconSearch = () => (
  <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
);
const IconFilter = () => (
  <svg viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="12" y1="18" x2="12" y2="18" /></svg>
);
const IconChevDown = () => (
  <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15" /></svg>
);
const IconChevRight = () => (
  <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
);
const IconClose = () => (
  <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
const IconCircleSlash = () => (
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
);
const IconAlertTri = () => (
  <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
);
const IconAlertCircle = () => (
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
);
const IconInfo = () => (
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
);
const IconArrowDown = () => (
  <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
);
const IconArrowUp = () => (
  <svg viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
);
const IconBolt = () => (
  <svg style={{ width: 11, height: 11, fill: "var(--color-action)", flexShrink: 0 }} viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
);

function TypeBadge({ type }) {
  return <span className={`type-badge ${TYPE_BADGE_CLS[type] || "tb-contra"}`}>{TYPE_LABELS[type] || type}</span>;
}

const SEVERITY_COLORS = {
  critical: { bg: "var(--anomaly-critical-surface)", border: "var(--anomaly-critical-border)", text: "var(--anomaly-critical-text)" },
  warn: { bg: "var(--anomaly-warn-surface)", border: "var(--anomaly-warn-border)", text: "var(--anomaly-warn-text)" },
  info: { bg: "var(--anomaly-info-surface)", border: "var(--anomaly-info-border)", text: "var(--anomaly-info-text)" },
};

// ── component ────────────────────────────────────────────────────────────
export default function TrialBalancePage() {
  // filters
  const [dateFrom, setDateFrom] = useState("2025-01-01");
  const [dateTo, setDateTo] = useState("2025-04-30");
  const [hideZero, setHideZero] = useState(false);
  const [groupMode, setGroupMode] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [sortCol, setSortCol] = useState("code");
  const [sortDir, setSortDir] = useState("asc");
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [anomalyFilter, setAnomalyFilter] = useState(null);

  // export menu
  const [expMenuOpen, setExpMenuOpen] = useState(false);
  const [expScope, setExpScope] = useState("visible");
  const [expFmt, setExpFmt] = useState("xlsx");

  // detail drawer
  const [drawerCode, setDrawerCode] = useState(null);
  const [drawerTab, setDrawerTab] = useState(0);

  // filter drawer
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  // staged values inside the filter drawer
  const [fdFrom, setFdFrom] = useState(dateFrom);
  const [fdTo, setFdTo] = useState(dateTo);
  const [fdType, setFdType] = useState("");
  const [fdHideZero, setFdHideZero] = useState(false);
  const [fdGroup, setFdGroup] = useState(true);
  const [fdShortcut, setFdShortcut] = useState("ytd");

  // AI cards shimmer → reveal
  const [aiReady, setAiReady] = useState(false);

  const grandRowRef = useRef(null);
  const expBtnRef = useRef(null);

  // recompute everything when period changes
  const ALL_TB = useMemo(() => computeTB(dateFrom, dateTo), [dateFrom, dateTo]);
  const balance = useMemo(() => checkBalance(ALL_TB), [ALL_TB]);
  const anomalies = useMemo(() => detectAnomalies(ALL_TB), [ALL_TB]);
  const anomaliesByCode = useMemo(() => {
    const m = {};
    anomalies.forEach((a) => {
      if (!m[a.code]) m[a.code] = [];
      m[a.code].push(a);
    });
    return m;
  }, [anomalies]);

  // Reset shimmer timer whenever period changes
  useEffect(() => {
    setAiReady(false);
    const t = setTimeout(() => setAiReady(true), 1400);
    return () => clearTimeout(t);
  }, [dateFrom, dateTo]);

  // Close export menu on outside click
  useEffect(() => {
    if (!expMenuOpen) return;
    const handler = (e) => {
      if (expBtnRef.current && !expBtnRef.current.contains(e.target)) setExpMenuOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [expMenuOpen]);

  // Filter + sort the rows
  const displayedRows = useMemo(() => {
    let rows = [...ALL_TB];
    if (hideZero) rows = rows.filter((r) => r.has_activity);
    const q = searchQ.toLowerCase();
    if (q) rows = rows.filter((r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
    if (typeFilter) {
      const types = typeFilter.split(",");
      rows = rows.filter((r) => types.includes(r.type));
    }
    if (anomalyFilter) {
      const matching = new Set(anomalies.filter((a) => a.severity === anomalyFilter).map((a) => a.code));
      rows = rows.filter((r) => matching.has(r.code));
    }
    rows.sort((a, b) => {
      let va = a[sortCol];
      let vb = b[sortCol];
      if (sortCol !== "code" && sortCol !== "name") {
        va = a[sortCol] || 0;
        vb = b[sortCol] || 0;
      }
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [ALL_TB, hideZero, searchQ, typeFilter, anomalyFilter, anomalies, sortCol, sortDir]);

  const subtitle = useMemo(() => {
    return "PT Sejahtera Makmur · Per " + fmtIdDate(dateTo);
  }, [dateTo]);

  // Net income & expense totals for the income card
  const totalRev = useMemo(() => ALL_TB.filter((r) => r.type === "revenue").reduce((s, r) => s + r.closing_balance, 0), [ALL_TB]);
  const totalExp = useMemo(() => ALL_TB.filter((r) => r.type === "expense").reduce((s, r) => s + r.period_debit, 0), [ALL_TB]);
  const netIncome = totalRev - totalExp;
  const margin = totalRev > 0 ? Math.round((netIncome / totalRev) * 100) : 0;

  const critList = useMemo(() => anomalies.filter((a) => a.severity === "critical"), [anomalies]);
  const warnList = useMemo(() => anomalies.filter((a) => a.severity === "warn"), [anomalies]);

  // Filter count
  const filterCount = (() => {
    let n = 0;
    if (dateFrom !== "2025-01-01" || dateTo !== "2025-04-30") n++;
    if (typeFilter) n++;
    if (hideZero) n++;
    return n;
  })();

  // ── handlers ───────────────────────────────────────────────────────────
  function toggleSort(col) {
    if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  function toggleGroup(type) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function setTypeChip(v) {
    setTypeFilter(v);
    setAnomalyFilter(null);
  }

  function applyAnomalyFilter(severity) {
    setAnomalyFilter((prev) => (prev === severity ? null : severity));
  }

  function scrollToGrandTotal() {
    grandRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function openDrawer(code) {
    setDrawerCode(code);
    setDrawerTab(0);
  }
  function closeDrawer() { setDrawerCode(null); }

  function openFilterDrawer() {
    setFdFrom(dateFrom);
    setFdTo(dateTo);
    setFdType(typeFilter && !typeFilter.includes(",") ? typeFilter : "");
    setFdHideZero(hideZero);
    setFdGroup(groupMode);
    setFilterDrawerOpen(true);
  }
  function closeFilterDrawer() { setFilterDrawerOpen(false); }
  function applyFilterDrawer() {
    setDateFrom(fdFrom);
    setDateTo(fdTo);
    setHideZero(fdHideZero);
    setGroupMode(fdGroup);
    if (fdType) setTypeFilter(fdType);
    setFilterDrawerOpen(false);
  }
  function clearFilters() {
    setFdFrom("2025-01-01");
    setFdTo("2025-04-30");
    setFdType("");
    setFdHideZero(false);
    setFdGroup(true);
    setFdShortcut("ytd");
  }
  function setDateShortcut(r) {
    setFdShortcut(r);
    if (r === "ytd") { setFdFrom("2025-01-01"); setFdTo("2025-04-30"); }
    else if (r === "q1") { setFdFrom("2025-01-01"); setFdTo("2025-03-31"); }
    else if (r === "feb") { setFdFrom("2025-01-01"); setFdTo("2025-02-28"); }
    else if (r === "jan") { setFdFrom("2025-01-01"); setFdTo("2025-01-31"); }
  }

  function doExport() {
    setExpMenuOpen(false);
    const rows = expScope === "visible" ? displayedRows : ALL_TB;
    const hdr = ["Kode Akun", "Nama Akun", "Tipe", "Saldo Normal", "Saldo Awal (Rp)", "Debit Periode (Rp)", "Kredit Periode (Rp)", "Saldo Akhir (Rp)"];
    const lines = [hdr];
    rows.forEach((r) => lines.push([r.code, r.name, r.type, r.normal_balance, r.opening_balance, r.period_debit, r.period_credit, r.closing_balance]));
    lines.push([]);
    lines.push(["TOTAL DR", "", "", "", "", "", balance.dr, ""]);
    lines.push(["TOTAL CR", "", "", "", "", "", "", balance.cr]);
    lines.push(["SEIMBANG", "", "", "", "", "", "", balance.balanced ? "YA" : "TIDAK"]);
    const csv = lines.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `TrialBalance_PTSejahteraMakmur_per${dateTo}.${expFmt === "csv" ? "csv" : "csv"}`;
    a.click();
  }

  // ── spotlight ──────────────────────────────────────────────────────────
  const SPOTLIGHTS = [
    { code: "1-1100", label: "Kas & Bank", barColor: null },
    { code: "1-1200", label: "Piutang Usaha", barColor: null },
    { code: "2-1100", label: "Utang Usaha", barColor: "var(--danger-text)" },
    { code: "3-1200", label: "Laba Ditahan", barColor: "var(--success-text)" },
  ];
  const spotByCode = useMemo(() => {
    const m = {};
    ALL_TB.forEach((r) => { m[r.code] = r; });
    return m;
  }, [ALL_TB]);
  const spotMax = Math.max(
    ...SPOTLIGHTS.map((s) => Math.abs(spotByCode[s.code]?.closing_balance || 0)),
    1
  );

  // ── render row ─────────────────────────────────────────────────────────
  const renderRow = (r) => {
    const neg = r.closing_balance < 0 ? " neg" : "";
    const anom = anomaliesByCode[r.code] || [];
    let flag = null;
    if (anom.length > 0) {
      const top = anom[0];
      const labels = { critical: "Kritis", warn: "Peringatan", info: "Info" };
      const icons = { critical: <IconAlertTri />, warn: <IconAlertCircle />, info: <IconInfo /> };
      flag = (
        <span className={`anom-flag ${top.severity}`}>
          {icons[top.severity]}
          {anom.length > 1 ? `${anom.length} temuan` : labels[top.severity]}
        </span>
      );
    }
    const rowCls = anom.some((a) => a.severity === "critical") ? " highlighted" : "";
    return (
      <tr key={r.code} className={`data-row${rowCls}`} onClick={() => openDrawer(r.code)}>
        <td className="code">{r.code}</td>
        <td className="name">{r.name}<TypeBadge type={r.type} />{flag}</td>
        <td className="num-open">{rp(r.opening_balance)}</td>
        <td className="num-dr">{r.period_debit ? rp(r.period_debit) : <span style={{ color: "var(--color-border-default)" }}>—</span>}</td>
        <td className="num-cr">{r.period_credit ? rp(r.period_credit) : <span style={{ color: "var(--color-border-default)" }}>—</span>}</td>
        <td className={`num-close${neg}`}>{rpZ(r.closing_balance)}</td>
      </tr>
    );
  };

  const sortClass = (col) => {
    if (sortCol !== col) return "sortable";
    return `sortable ${sortDir === "asc" ? "sort-asc" : "sort-desc"}`;
  };

  // ── drawer body ────────────────────────────────────────────────────────
  const drawerRow = drawerCode ? ALL_TB.find((r) => r.code === drawerCode) : null;
  const drawerAcct = drawerCode ? LEAF.find((a) => a.code === drawerCode) : null;
  const drawerAnom = drawerCode ? anomaliesByCode[drawerCode] || [] : [];

  return (
    <div className="tb-page">
      <div className="tb-scroll">

        {/* ── BANNER ── */}
        <div className="oz-banner">
          <div className="oz-top">
            <div>
              <div className="oz-title">Trial Balance</div>
              <div className="oz-subtitle">{subtitle}</div>
            </div>
            <div className="oz-actions">
              <div style={{ position: "relative" }} ref={expBtnRef}>
                <button
                  type="button"
                  className="oz-btn"
                  onClick={(e) => { e.stopPropagation(); setExpMenuOpen((v) => !v); }}
                >
                  <IconExport />Export
                </button>
                <div className={`exp-menu${expMenuOpen ? " open" : ""}`} onClick={(e) => e.stopPropagation()}>
                  <div className="em-lbl">Scope</div>
                  <div className="em-chips">
                    <button type="button" className={`em-chip${expScope === "visible" ? " on" : ""}`} onClick={() => setExpScope("visible")}>Hanya terlihat</button>
                    <button type="button" className={`em-chip${expScope === "all" ? " on" : ""}`} onClick={() => setExpScope("all")}>Semua</button>
                  </div>
                  <div className="em-lbl">Format</div>
                  <div className="em-chips">
                    <button type="button" className={`em-chip${expFmt === "xlsx" ? " on" : ""}`} onClick={() => setExpFmt("xlsx")}>Excel (.xlsx)</button>
                    <button type="button" className={`em-chip${expFmt === "csv" ? " on" : ""}`} onClick={() => setExpFmt("csv")}>CSV (.csv)</button>
                  </div>
                  <div className="em-div" />
                  <button type="button" className="em-dl" onClick={doExport}>
                    <IconExport />Download
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="oz-cards">
            {/* Card 1: Balance status */}
            <div
              className={`oz-card ${balance.balanced ? "balanced" : "unbalanced"}`}
              onClick={scrollToGrandTotal}
              style={{ cursor: "pointer" }}
            >
              <div className="oz-card-label">Status</div>
              {balance.balanced ? (
                <>
                  <div className="oz-card-num"><span style={{ color: "var(--success-text)" }}>✓ Seimbang</span></div>
                  <div className="oz-card-sub">Debit = Kredit</div>
                  <div className="oz-card-detail">Total <strong>{rp(balance.dr)}</strong></div>
                </>
              ) : (
                <>
                  <div className="oz-card-num">✕ Tidak Seimbang</div>
                  <div className="oz-card-sub">Selisih perlu diselesaikan</div>
                  <div className="oz-card-detail">Selisih <strong>{rp(Math.abs(balance.dr - balance.cr))}</strong></div>
                </>
              )}
            </div>

            {/* Card 2: Net income */}
            <div className="oz-card" style={{ cursor: "default" }}>
              <div className="oz-card-label">Estimasi Laba Bersih</div>
              <div className={`oz-card-num${netIncome < 0 ? " danger" : ""}`}>{rp(netIncome)}</div>
              <div className="oz-card-sub">{netIncome >= 0 ? `Margin ${margin}%` : "Rugi periode ini"}</div>
              <div className="oz-card-detail">Pendapatan <strong>{rp(totalRev)}</strong> · Beban <strong>{rp(totalExp)}</strong></div>
            </div>

            {/* Card 3: Critical */}
            <div
              className={`oz-card${anomalyFilter === "critical" ? " active-filter" : ""}`}
              onClick={() => applyAnomalyFilter("critical")}
              style={{ cursor: "pointer" }}
            >
              {!aiReady ? (
                <div className="oz-card-shimmer">
                  <div className="shimmer-line lg" />
                  <div className="shimmer-line sm" />
                  <div className="shimmer-line xs" />
                </div>
              ) : (
                <>
                  <div className="oz-card-label">Kritis</div>
                  <div className={`oz-card-num${critList.length > 0 ? " danger" : ""}`}>{critList.length}</div>
                  <div className="oz-card-sub">{critList.length > 0 ? "temuan perlu tindakan" : "tidak ada temuan kritis"}</div>
                  <div className="oz-card-detail">
                    {critList.length > 0
                      ? critList.map((a, i) => <span key={a.code + i}>{i > 0 ? " · " : ""}<strong>{a.name}</strong></span>)
                      : "Trial balance aman."}
                  </div>
                  {critList.length > 0 && (
                    <div className="oz-card-lihat">Lihat akun <IconChevRight /></div>
                  )}
                </>
              )}
            </div>

            {/* Card 4: Warn */}
            <div
              className={`oz-card${anomalyFilter === "warn" ? " active-filter" : ""}`}
              onClick={() => applyAnomalyFilter("warn")}
              style={{ cursor: "pointer" }}
            >
              {!aiReady ? (
                <div className="oz-card-shimmer">
                  <div className="shimmer-line lg" />
                  <div className="shimmer-line sm" />
                  <div className="shimmer-line xs" />
                </div>
              ) : (
                <>
                  <div className="oz-card-label">Peringatan</div>
                  <div className={`oz-card-num${warnList.length > 0 ? " warn" : ""}`}>{warnList.length}</div>
                  <div className="oz-card-sub">{warnList.length > 0 ? "perlu ditinjau" : "tidak ada peringatan"}</div>
                  <div className="oz-card-detail">
                    {warnList.length > 0
                      ? warnList.map((a, i) => <span key={a.code + i}>{i > 0 ? " · " : ""}<strong>{a.name}</strong></span>)
                      : "Semua dalam batas normal."}
                  </div>
                  {warnList.length > 0 && (
                    <div className="oz-card-lihat">Lihat akun <IconChevRight /></div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── SPOTLIGHT ── */}
        <div className="spotlight-row">
          {SPOTLIGHTS.map((s) => {
            const row = spotByCode[s.code];
            const cb = row?.closing_balance ?? 0;
            const ob = row?.opening_balance ?? 0;
            let delta = { text: "tidak ada aktivitas", cls: "neu" };
            if (ob !== 0) {
              const pct = ((cb - ob) / Math.abs(ob) * 100).toFixed(1);
              const dir = cb >= ob ? "up" : "dn";
              const sign = cb >= ob ? "+" : "";
              delta = { text: `${sign}${pct}% vs saldo awal`, cls: dir };
            } else if (cb !== 0) {
              delta = { text: "baru periode ini", cls: "dn" };
            }
            const widthPct = Math.round(Math.abs(cb) / spotMax * 100);
            return (
              <div key={s.code} className="spot-card" onClick={() => openDrawer(s.code)}>
                <div className="spot-card-code">{s.code}</div>
                <div className="spot-card-name">{s.label}</div>
                <div className="spot-card-num">{rp(cb)}</div>
                <div className={`spot-card-delta ${delta.cls}`}>{delta.text}</div>
                <div className="spot-card-bar">
                  <div
                    className="spot-card-bar-fill"
                    style={{ width: `${widthPct}%`, ...(s.barColor ? { background: s.barColor } : {}) }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="tb-scroll-inner">
          {/* ── FILTER BAR ── */}
          <div className="filter-bar">
            <div className="f-search">
              <IconSearch />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Cari kode atau nama akun…"
                autoComplete="off"
              />
            </div>
            <div className="fsep" />
            <div className="chip-grp">
              {[
                { v: "", label: "Semua" },
                { v: "asset,contra_asset", label: "Aset" },
                { v: "liability", label: "Liabilitas" },
                { v: "equity", label: "Ekuitas" },
                { v: "revenue", label: "Pendapatan" },
                { v: "expense", label: "Beban" },
              ].map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className={`tb-chip${typeFilter === c.v ? " on" : ""}`}
                  onClick={() => setTypeChip(c.v)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="f-right">
              <button type="button" className="f-filter-btn" onClick={openFilterDrawer}>
                <IconFilter />
                Filter Lainnya
                <span className={`f-filter-count${filterCount > 0 ? " show" : ""}`}>{filterCount}</span>
              </button>
            </div>
          </div>

          {/* ── TABLE ── */}
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th className={sortClass("code")} onClick={() => toggleSort("code")} style={{ width: 88 }}>
                    Kode<span className="sort-arrow" />
                  </th>
                  <th className={sortClass("name")} onClick={() => toggleSort("name")}>
                    Nama Akun<span className="sort-arrow" />
                  </th>
                  <th className={`r ${sortClass("opening_balance")}`} onClick={() => toggleSort("opening_balance")} style={{ width: 152 }}>
                    Saldo Awal<span className="sort-arrow" />
                  </th>
                  <th className={`r ${sortClass("period_debit")}`} onClick={() => toggleSort("period_debit")} style={{ width: 152 }}>
                    Debit Periode<span className="sort-arrow" />
                  </th>
                  <th className={`r ${sortClass("period_credit")}`} onClick={() => toggleSort("period_credit")} style={{ width: 152 }}>
                    Kredit Periode<span className="sort-arrow" />
                  </th>
                  <th className={`r ${sortClass("closing_balance")}`} onClick={() => toggleSort("closing_balance")} style={{ width: 160 }}>
                    Saldo Akhir<span className="sort-arrow" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.length === 0 ? null : groupMode ? (
                  <>
                    {TYPE_ORDER.map((type) => {
                      const grp = displayedRows.filter((r) => r.type === type);
                      if (!grp.length) return null;
                      const collapsed = collapsedGroups.has(type);
                      const sumDr = grp.reduce((s, r) => s + r.period_debit, 0);
                      const sumCr = grp.reduce((s, r) => s + r.period_credit, 0);
                      const sumOpen = grp.reduce((s, r) => s + r.opening_balance, 0);
                      const sumClose = grp.reduce((s, r) => s + r.closing_balance, 0);
                      return (
                        <Fragment key={`grp-${type}`}>
                          <tr className="group-row" onClick={() => toggleGroup(type)}>
                            <td colSpan={6}>
                              <div className="group-inner">
                                <span className="group-lbl">{TYPE_LABELS[type]}</span>
                                <span className="group-count">{grp.length} akun</span>
                                <svg className={`group-chev${collapsed ? " collapsed" : ""}`} viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15" /></svg>
                              </div>
                            </td>
                          </tr>
                          {!collapsed && grp.map((r) => renderRow(r))}
                          {!collapsed && (
                            <tr className="subtotal-row">
                              <td className="code" />
                              <td className="name">Subtotal {TYPE_LABELS[type]}</td>
                              <td className="num" style={{ textAlign: "right", color: "var(--color-text-tertiary)" }}>{sumOpen ? rp(sumOpen) : "—"}</td>
                              <td className="num" style={{ textAlign: "right", color: "var(--color-action)" }}>{sumDr ? rp(sumDr) : "—"}</td>
                              <td className="num" style={{ textAlign: "right", color: "var(--success-text)" }}>{sumCr ? rp(sumCr) : "—"}</td>
                              <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{rp(sumClose)}</td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    <tr className="grand-row" ref={grandRowRef}>
                      <td className="code" />
                      <td className="name">TOTAL</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(255,255,255,.45)" }}>—</td>
                      <td className="num-dr">{rp(balance.dr)}</td>
                      <td className="num-cr">{rp(balance.cr)}</td>
                      <td className="bal-cell">
                        <span className="bal-badge ok">
                          <IconCheck />Seimbang
                        </span>
                      </td>
                    </tr>
                  </>
                ) : (
                  displayedRows.map((r) => renderRow(r))
                )}
              </tbody>
            </table>
            {displayedRows.length === 0 && (
              <div className="empty-state">
                <IconCircleSlash />
                <div className="empty-title">Tidak ada data</div>
                <div className="empty-sub">Coba ubah filter atau rentang tanggal</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── STATUS BAR ── */}
      <div className="status-bar">
        <div className="sbs"><span className="sbs-lbl">Akun</span><span className="sbs-val">{displayedRows.length} akun</span></div>
        <div className="sbsep" />
        <div className="sbs"><span className="sbs-lbl">Total Debit</span><span className="sbs-val dr">{rp(balance.dr)}</span></div>
        <div className="sbsep" />
        <div className="sbs"><span className="sbs-lbl">Total Kredit</span><span className="sbs-val cr">{rp(balance.cr)}</span></div>
      </div>

      {/* ── DETAIL DRAWER ── */}
      <div className={`drawer-overlay${drawerCode ? " open" : ""}`} onClick={closeDrawer} />
      <div className={`drawer${drawerCode ? " open" : ""}`}>
        {drawerRow && (
          <>
            <div className="dh">
              <div>
                <div className="dh-code">{drawerRow.code}</div>
                <div className="dh-name">{drawerRow.name}</div>
              </div>
              <button type="button" className="dclose" onClick={closeDrawer}><IconClose /></button>
            </div>
            <div className="dtab-bar">
              {["Detail", "Transaksi", "Audit Trail"].map((label, i) => (
                <div
                  key={label}
                  className={`dtab${drawerTab === i ? " active" : ""}`}
                  onClick={() => setDrawerTab(i)}
                >
                  {label}
                </div>
              ))}
              <div
                className={`dtab${drawerTab === 3 ? " active" : ""}`}
                onClick={() => setDrawerTab(3)}
              >
                <IconBolt />AI Insight
              </div>
            </div>
            <div className="dbody">
              {drawerTab === 0 && (
                <div className="dpane">
                  <div className="d-sum-grid">
                    <div className="d-sum-card"><div className="d-sum-lbl">Saldo Awal</div><div className="d-sum-val" style={{ color: "var(--color-text-tertiary)" }}>{rp(drawerRow.opening_balance)}</div></div>
                    <div className="d-sum-card"><div className="d-sum-lbl">Saldo Akhir</div><div className={`d-sum-val${drawerRow.closing_balance < 0 ? " cr" : ""}`}>{rpZ(drawerRow.closing_balance)}</div></div>
                    <div className="d-sum-card"><div className="d-sum-lbl">Debit Periode</div><div className="d-sum-val dr">{rp(drawerRow.period_debit)}</div></div>
                    <div className="d-sum-card"><div className="d-sum-lbl">Kredit Periode</div><div className="d-sum-val cr">{rp(drawerRow.period_credit)}</div></div>
                  </div>
                  <div className="dsec">
                    <div className="dsec-title">Informasi Akun</div>
                    <div className="info-row"><label>Kode</label><span className="mono">{drawerRow.code}</span></div>
                    <div className="info-row"><label>Nama</label><span>{drawerRow.name}</span></div>
                    <div className="info-row"><label>Tipe</label><span><TypeBadge type={drawerRow.type} /></span></div>
                    <div className="info-row"><label>Saldo Normal</label><span>{drawerRow.normal_balance === "debit" ? "Debit" : "Kredit"}</span></div>
                    <div className="info-row"><label>Kategori</label><span>{drawerAcct?.category || "—"}</span></div>
                    <div className="info-row"><label>Status</label><span className="ok">Aktif</span></div>
                  </div>
                  <div className="dsec">
                    <div className="dsec-title">Periode</div>
                    <div className="info-row"><label>As-of Date</label><span className="mono">{fmtIdDate(dateTo)}</span></div>
                    <div className="info-row"><label>Awal Periode</label><span className="mono">{fmtIdDate(dateFrom)}</span></div>
                    <div className="info-row"><label>Jumlah Transaksi</label><span>{drawerRow.entries.length} JE</span></div>
                  </div>
                </div>
              )}

              {drawerTab === 1 && (
                <div className="dpane">
                  {drawerRow.entries.length === 0 ? (
                    <div style={{ padding: "32px 0", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 12 }}>
                      Tidak ada transaksi dalam periode ini
                    </div>
                  ) : (
                    [...drawerRow.entries]
                      .sort((a, b) => (a.date < b.date ? -1 : 1))
                      .map((e, idx) => {
                        const isDr = e.debit > 0;
                        const amt = isDr ? e.debit : e.credit;
                        const dl = new Date(e.date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
                        return (
                          <div key={`${e.je_ref}-${idx}`} className="txn-item">
                            <div className={`txn-icon ${isDr ? "d" : "c"}`}>{isDr ? <IconArrowUp /> : <IconArrowDown />}</div>
                            <div className="txn-info">
                              <div className="txn-ref">{e.je_ref}</div>
                              <div className="txn-desc">{e.description}</div>
                              <div className="txn-date">{dl} · {(e.reference_type || "JE").toUpperCase()}</div>
                            </div>
                            <div className={`txn-amt ${isDr ? "d" : "c"}`}>{rp(amt)}</div>
                          </div>
                        );
                      })
                  )}
                </div>
              )}

              {drawerTab === 2 && (
                <div className="dpane">
                  <div className="dsec-title" style={{ marginBottom: 12 }}>Log Aktivitas</div>
                  <div className="audit-item">
                    <div className="audit-dot posted"><IconCheck /></div>
                    <div className="audit-content">
                      <div className="audit-action">Akun aktif dalam periode</div>
                      <div className="audit-meta">
                        {drawerRow.entries.length} journal entry
                        {drawerRow.period_debit ? ` · ${rp(drawerRow.period_debit)} DR` : ""}
                        {drawerRow.period_debit && drawerRow.period_credit ? " · " : ""}
                        {drawerRow.period_credit ? `${rp(drawerRow.period_credit)} CR` : ""}
                      </div>
                    </div>
                  </div>
                  {drawerRow.entries[0] && (
                    <div className="audit-item">
                      <div className="audit-dot info"><IconInfo /></div>
                      <div className="audit-content">
                        <div className="audit-action">Transaksi pertama periode ini</div>
                        <div className="audit-meta">
                          {drawerRow.entries[0].je_ref} · {fmtIdDate(drawerRow.entries[0].date)}<br />
                          by {drawerRow.entries[0].posted_by || "system"}
                        </div>
                      </div>
                    </div>
                  )}
                  {drawerRow.entries.length > 1 && (
                    <div className="audit-item">
                      <div className="audit-dot info"><IconInfo /></div>
                      <div className="audit-content">
                        <div className="audit-action">Transaksi terakhir periode ini</div>
                        <div className="audit-meta">
                          {drawerRow.entries[drawerRow.entries.length - 1].je_ref} · {fmtIdDate(drawerRow.entries[drawerRow.entries.length - 1].date)}<br />
                          by {drawerRow.entries[drawerRow.entries.length - 1].posted_by || "system"}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="audit-item">
                    <div className="audit-dot posted"><IconCheck /></div>
                    <div className="audit-content">
                      <div className="audit-action">Akun dibuat & aktif</div>
                      <div className="audit-meta">system · Jan 2025 · entity_id: 1001</div>
                    </div>
                  </div>
                </div>
              )}

              {drawerTab === 3 && (
                <div className="dpane">
                  {(() => {
                    const ratio = drawerRow.opening_balance !== 0
                      ? ((drawerRow.closing_balance - drawerRow.opening_balance) / Math.abs(drawerRow.opening_balance) * 100).toFixed(1)
                      : null;
                    return (
                      <>
                        <div className="d-sum-grid">
                          <div className="d-sum-card">
                            <div className="d-sum-lbl">Perubahan Saldo</div>
                            <div className={`d-sum-val ${drawerRow.closing_balance >= drawerRow.opening_balance ? "dr" : "cr"}`}>
                              {ratio !== null ? `${ratio > 0 ? "+" : ""}${ratio}%` : "—"}
                            </div>
                          </div>
                          <div className="d-sum-card">
                            <div className="d-sum-lbl">Aktivitas Transaksi</div>
                            <div className="d-sum-val">{drawerRow.entries.length} entri</div>
                          </div>
                        </div>
                        {drawerAnom.length > 0 ? (
                          <>
                            <div className="dsec-title" style={{ marginBottom: 10 }}>Temuan AI</div>
                            {drawerAnom.map((a, i) => {
                              const c = SEVERITY_COLORS[a.severity];
                              return (
                                <div
                                  key={i}
                                  style={{
                                    background: c.bg,
                                    border: `1px solid ${c.border}`,
                                    borderRadius: "var(--radius-md)",
                                    padding: "12px 14px",
                                    marginBottom: 8,
                                  }}
                                >
                                  <div style={{ fontSize: 12, fontWeight: 700, color: c.text, marginBottom: 4 }}>{a.title}</div>
                                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.55, marginBottom: 6 }}>{a.desc}</div>
                                  <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>{a.action}</div>
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", padding: "6px 0" }}>
                            Tidak ada anomali terdeteksi untuk akun ini.
                          </div>
                        )}
                        <div className="dsec-title" style={{ marginTop: 14, marginBottom: 8 }}>Komposisi Aktivitas</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <div className="d-sum-card" style={{ flex: 1 }}>
                            <div className="d-sum-lbl">Total Debit</div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--color-action)", marginTop: 4 }}>
                              {drawerRow.period_debit ? rp(drawerRow.period_debit) : "—"}
                            </div>
                          </div>
                          <div className="d-sum-card" style={{ flex: 1 }}>
                            <div className="d-sum-lbl">Total Kredit</div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--success-text)", marginTop: 4 }}>
                              {drawerRow.period_credit ? rp(drawerRow.period_credit) : "—"}
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── FILTER DRAWER ── */}
      <div className={`filter-overlay${filterDrawerOpen ? " open" : ""}`} onClick={closeFilterDrawer} />
      <div className={`filter-drawer${filterDrawerOpen ? " open" : ""}`}>
        <div className="fd-head">
          <span className="fd-title">Filter</span>
          <span className="fd-clear" onClick={clearFilters}>Reset semua</span>
        </div>
        <div className="fd-body">
          <div className="fd-section">
            <div className="fd-label">Per Tanggal (As-of Date)</div>
            <div className="fd-shortcuts">
              {[
                { r: "ytd", label: "YTD Apr 2025" },
                { r: "q1", label: "Per Mar 2025" },
                { r: "feb", label: "Per Feb 2025" },
                { r: "jan", label: "Per Jan 2025" },
              ].map((s) => (
                <div
                  key={s.r}
                  className={`fd-sc${fdShortcut === s.r ? " on" : ""}`}
                  onClick={() => setDateShortcut(s.r)}
                >
                  {s.label}
                </div>
              ))}
            </div>
            <div className="fd-date-row">
              <div>
                <div className="fd-sublabel">Awal Periode</div>
                <input
                  type="date"
                  className="fd-input"
                  value={fdFrom}
                  onChange={(e) => setFdFrom(e.target.value)}
                />
              </div>
              <div>
                <div className="fd-sublabel">Per Tanggal</div>
                <input
                  type="date"
                  className="fd-input"
                  value={fdTo}
                  onChange={(e) => setFdTo(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="fd-section">
            <div className="fd-label">Tipe Akun</div>
            <select
              className="fd-select"
              value={fdType}
              onChange={(e) => setFdType(e.target.value)}
            >
              <option value="">Semua Tipe</option>
              <option value="asset">Aset</option>
              <option value="contra_asset">Kontra Aset</option>
              <option value="liability">Liabilitas</option>
              <option value="equity">Ekuitas</option>
              <option value="revenue">Pendapatan</option>
              <option value="expense">Beban</option>
            </select>
          </div>
          <div className="fd-section">
            <div className="fd-label">Tampilan</div>
            <div className="fd-toggle-row">
              <span className="fd-toggle-label">Sembunyikan saldo nol</span>
              <label className="fd-toggle-sw">
                <input type="checkbox" checked={fdHideZero} onChange={(e) => setFdHideZero(e.target.checked)} />
                <div className="fd-toggle-track" />
                <div className="fd-toggle-thumb" />
              </label>
            </div>
            <div className="fd-toggle-row" style={{ marginTop: 6 }}>
              <span className="fd-toggle-label">Kelompokkan per tipe akun</span>
              <label className="fd-toggle-sw">
                <input type="checkbox" checked={fdGroup} onChange={(e) => setFdGroup(e.target.checked)} />
                <div className="fd-toggle-track" />
                <div className="fd-toggle-thumb" />
              </label>
            </div>
          </div>
        </div>
        <div className="fd-foot">
          <button type="button" className="fd-cancel-btn" onClick={closeFilterDrawer}>Batal</button>
          <button type="button" className="fd-apply" onClick={applyFilterDrawer}>Terapkan Filter</button>
        </div>
      </div>
    </div>
  );
}
