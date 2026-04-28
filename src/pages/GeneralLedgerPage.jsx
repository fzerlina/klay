import { useState, useMemo, useEffect, useRef } from "react";
import "./GeneralLedgerPage.css";

// ─── STATIC DATA ─────────────────────────────────────────────────────────────
const BILL_REFS = { BILL001:"BILL-2025-0001", BILL002:"BILL-2025-0002", BILL003:"BILL-2025-0003", BILL004:"BILL-2025-0004", BILL005:"BILL-2025-0005" };
const INV_REFS  = { INV001:"INV-C001-20250118", INV002:"INV-C002-20250125", INV003:"INV-C001-20250210", INV004:"INV-C003-20250220", INV005:"INV-C004-20250315" };

const JE_DATA = [
  { id:"JE-2025-0001", date:"2025-01-31", refType:"manual",          refId:null,     memo:"Beban gaji karyawan bulan Januari 2025",                                              postedBy:"Budi Santoso",  postedDate:"2025-01-31", createdBy:"Sarah Wijaya",  createdDate:"2025-01-31", lines:[{acct:"5-1010",acctName:"Beban Gaji & Tunjangan",      debit:45000000, credit:0,        desc:"Gaji pokok + tunjangan bulan Januari"},{acct:"2-1300",acctName:"Utang Gaji & Tunjangan",         debit:0,        credit:45000000, desc:"Akrual gaji bulan Januari"}] },
  { id:"JE-2025-0019", date:"2025-02-28", refType:"manual",          refId:null,     memo:"Beban gaji karyawan bulan Februari 2025",                                             postedBy:"Budi Santoso",  postedDate:"2025-02-28", createdBy:"Sarah Wijaya",  createdDate:"2025-02-28", lines:[{acct:"5-1010",acctName:"Beban Gaji & Tunjangan",      debit:45000000, credit:0,        desc:"Gaji pokok + tunjangan bulan Februari"},{acct:"2-1300",acctName:"Utang Gaji & Tunjangan",        debit:0,        credit:45000000, desc:"Akrual gaji bulan Februari"}] },
  { id:"JE-2025-0020", date:"2025-01-31", refType:"manual",          refId:null,     memo:"Penyusutan aset tetap bulan Januari 2025",                                            postedBy:"Andi Prasetyo", postedDate:"2025-01-31", createdBy:"Andi Prasetyo", createdDate:"2025-01-31", lines:[{acct:"5-1040",acctName:"Beban Penyusutan",             debit:3200000,  credit:0,        desc:"Penyusutan peralatan kantor bulan Januari"},{acct:"1-2110",acctName:"Akum. Penyusutan Peralatan",   debit:0,        credit:3200000,  desc:"Akumulasi penyusutan peralatan kantor"}] },
  { id:"JE-2025-0002", date:"2025-01-15", refType:"bill",            refId:"BILL001",memo:"Pencatatan utang atas pembelian komponen elektronik dari supplier",                   postedBy:"Budi Santoso",  postedDate:"2025-01-20", createdBy:"Sarah Wijaya",  createdDate:"2025-01-15", lines:[{acct:"6-1000",acctName:"Biaya Pokok Penjualan",       debit:75000000, credit:0,        desc:"Pembelian komponen elektronik"},{acct:"5-2200",acctName:"Beban PPN Masukan",               debit:7500000,  credit:0,        desc:"PPN masukan pembelian"},{acct:"2-1100",acctName:"Utang Usaha",debit:0,credit:82500000,desc:"Pencatatan utang kepada supplier"}] },
  { id:"JE-2025-0003", date:"2025-01-20", refType:"bill",            refId:"BILL002",memo:"Pencatatan pembelian peralatan kantor - meja dan kursi kantor",                       postedBy:"Budi Santoso",  postedDate:"2025-02-05", createdBy:"Andi Prasetyo", createdDate:"2025-01-20", lines:[{acct:"1-2100",acctName:"Peralatan Kantor",             debit:19200000, credit:0,        desc:"Pembelian peralatan kantor (meja dan kursi)"},{acct:"5-2200",acctName:"Beban PPN Masukan",            debit:1920000,  credit:0,        desc:"PPN masukan pembelian aset"},{acct:"2-1100",acctName:"Utang Usaha",debit:0,credit:21120000,desc:"Utang pembelian peralatan kantor"}] },
  { id:"JE-2025-0004", date:"2025-02-08", refType:"bill",            refId:"BILL003",memo:"Pencatatan biaya pengiriman & jasa logistik bulan Februari",                          postedBy:"Andi Prasetyo", postedDate:"2025-02-10", createdBy:"Rina Kusuma",   createdDate:"2025-02-08", lines:[{acct:"5-1000",acctName:"Beban Operasional",           debit:12500000, credit:0,        desc:"Biaya jasa logistik & pengiriman produk"},{acct:"5-2200",acctName:"Beban PPN Masukan",              debit:1250000,  credit:0,        desc:"PPN masukan jasa"},{acct:"2-1100",acctName:"Utang Usaha",debit:0,credit:13750000,desc:"Utang atas biaya logistik"}] },
  { id:"JE-2025-0008", date:"2025-03-15", refType:"bill",            refId:"BILL004",memo:"Pencatatan biaya konsultasi audit internal dari PT Penyedia Layanan Konsultasi",       postedBy:"Sarah Wijaya",  postedDate:"2025-03-20", createdBy:"Budi Santoso",  createdDate:"2025-03-15", lines:[{acct:"5-1070",acctName:"Biaya Konsultan & Profesional",debit:25000000, credit:0,        desc:"Jasa konsultasi audit internal"},{acct:"5-2200",acctName:"Beban PPN Masukan",               debit:2500000,  credit:0,        desc:"PPN masukan atas jasa konsultasi"},{acct:"2-1100",acctName:"Utang Usaha",debit:0,credit:27500000,desc:"Utang atas jasa konsultasi"}] },
  { id:"JE-2025-0009", date:"2025-03-15", refType:"bill",            refId:"BILL005",memo:"Pencatatan pembelian bahan baku jagung dari koperasi tani",                           postedBy:"Andi Prasetyo", postedDate:"2025-03-18", createdBy:"Sarah Wijaya",  createdDate:"2025-03-15", lines:[{acct:"6-1000",acctName:"Biaya Pokok Penjualan",       debit:12500000, credit:0,        desc:"Pembelian bahan baku jagung"},{acct:"5-2200",acctName:"Beban PPN Masukan",                 debit:1250000,  credit:0,        desc:"PPN masukan"},{acct:"2-1100",acctName:"Utang Usaha",debit:0,credit:13750000,desc:"Utang pembelian bahan baku"}] },
  { id:"JE-2025-0011", date:"2025-02-10", refType:"bill_payment",    refId:"BILL001",memo:"Pembayaran utang pembelian komponen elektronik dari PT Supplier Elektronik",           postedBy:"Sarah Wijaya",  postedDate:"2025-02-10", createdBy:"Andi Prasetyo", createdDate:"2025-02-10", lines:[{acct:"2-1100",acctName:"Utang Usaha",                debit:82500000, credit:0,        desc:"Pembayaran utang supplier"},{acct:"1-1100",acctName:"Kas & Bank",                          debit:0,        credit:82500000, desc:"Pengeluaran kas"}] },
  { id:"JE-2025-0012", date:"2025-02-05", refType:"bill_payment",    refId:"BILL002",memo:"Pembayaran utang pembelian peralatan kantor ke CV Toko Bangunan Jaya",                postedBy:"Sarah Wijaya",  postedDate:"2025-02-05", createdBy:"Andi Prasetyo", createdDate:"2025-02-05", lines:[{acct:"2-1100",acctName:"Utang Usaha",                debit:21120000, credit:0,        desc:"Pembayaran utang supplier"},{acct:"1-1100",acctName:"Kas & Bank",                          debit:0,        credit:21120000, desc:"Pengeluaran kas"}] },
  { id:"JE-2025-0013", date:"2025-02-16", refType:"bill_payment",    refId:"BILL003",memo:"Pembayaran biaya logistik ke PT Jasa Logistik Cepat",                                 postedBy:"Sarah Wijaya",  postedDate:"2025-02-16", createdBy:"Andi Prasetyo", createdDate:"2025-02-16", lines:[{acct:"2-1100",acctName:"Utang Usaha",                debit:13750000, credit:0,        desc:"Pembayaran utang logistik"},{acct:"1-1100",acctName:"Kas & Bank",                          debit:0,        credit:13750000, desc:"Pengeluaran kas"}] },
  { id:"JE-2025-0014", date:"2025-04-10", refType:"bill_payment",    refId:"BILL004",memo:"Pembayaran biaya konsultasi ke PT Penyedia Layanan Konsultasi",                       postedBy:"Andi Prasetyo", postedDate:"2025-04-10", createdBy:"Sarah Wijaya",  createdDate:"2025-04-10", lines:[{acct:"2-1100",acctName:"Utang Usaha",                debit:27500000, credit:0,        desc:"Pembayaran utang konsultasi"},{acct:"1-1100",acctName:"Kas & Bank",                          debit:0,        credit:27500000, desc:"Pengeluaran kas"}] },
  { id:"JE-2025-0006", date:"2025-02-10", refType:"invoice",         refId:"INV003", memo:"Pencatatan penjualan produk divisi A + jasa setup & training",                        postedBy:"Andi Prasetyo", postedDate:"2025-03-10", createdBy:"Sarah Wijaya",  createdDate:"2025-02-10", lines:[{acct:"1-1200",acctName:"Piutang Usaha",               debit:24200000, credit:0,        desc:"Piutang penjualan produk + jasa"},{acct:"4-1010",acctName:"Penjualan Produk - Divisi A",        debit:0,        credit:20000000, desc:"Pendapatan penjualan divisi A"},{acct:"4-1030",acctName:"Penjualan Jasa Tambahan",debit:0,credit:2000000,desc:"Pendapatan jasa"},{acct:"2-1200",acctName:"Utang Pajak",debit:0,credit:2200000,desc:"PPN keluaran"}] },
  { id:"JE-2025-0007", date:"2025-02-20", refType:"invoice",         refId:"INV004", memo:"Pencatatan penjualan produk divisi B ke Toko Modern Bandung",                         postedBy:"Sarah Wijaya",  postedDate:"2025-03-11", createdBy:"Andi Prasetyo", createdDate:"2025-02-20", lines:[{acct:"1-1200",acctName:"Piutang Usaha",               debit:18562500, credit:0,        desc:"Piutang penjualan produk"},{acct:"4-1020",acctName:"Penjualan Produk - Divisi B",         debit:0,        credit:16875000, desc:"Pendapatan penjualan divisi B"},{acct:"2-1200",acctName:"Utang Pajak",debit:0,credit:1687500,desc:"PPN keluaran"}] },
  { id:"JE-2025-0010", date:"2025-03-15", refType:"invoice",         refId:"INV005", memo:"Pencatatan penjualan produk divisi A ke Hypermarket Medan",                           postedBy:"Budi Santoso",  postedDate:"2025-03-16", createdBy:"Sarah Wijaya",  createdDate:"2025-03-15", lines:[{acct:"1-1200",acctName:"Piutang Usaha",               debit:48400000, credit:0,        desc:"Piutang penjualan produk"},{acct:"4-1010",acctName:"Penjualan Produk - Divisi A",         debit:0,        credit:44000000, desc:"Pendapatan penjualan divisi A"},{acct:"2-1200",acctName:"Utang Pajak",debit:0,credit:4400000,desc:"PPN keluaran"}] },
  { id:"JE-2025-0018", date:"2025-02-12", refType:"invoice_payment", refId:"INV001", memo:"Penerimaan pembayaran piutang dari PT Ritel Utama Indonesia - invoice pertama",       postedBy:"Andi Prasetyo", postedDate:"2025-02-12", createdBy:"Sarah Wijaya",  createdDate:"2025-02-12", lines:[{acct:"1-1100",acctName:"Kas & Bank",                  debit:33000000, credit:0,        desc:"Penerimaan kas dari pelanggan"},{acct:"1-1200",acctName:"Piutang Usaha",                      debit:0,        credit:33000000, desc:"Pelunasan piutang"}] },
  { id:"JE-2025-0015", date:"2025-03-09", refType:"invoice_payment", refId:"INV002", memo:"Penerimaan pembayaran piutang dari CV Distributor Produk Rumahan",                    postedBy:"Andi Prasetyo", postedDate:"2025-03-09", createdBy:"Rina Kusuma",   createdDate:"2025-03-09", lines:[{acct:"1-1100",acctName:"Kas & Bank",                  debit:9625000,  credit:0,        desc:"Penerimaan kas dari pelanggan"},{acct:"1-1200",acctName:"Piutang Usaha",                      debit:0,        credit:9625000,  desc:"Pelunasan piutang"}] },
  { id:"JE-2025-0016", date:"2025-03-10", refType:"invoice_payment", refId:"INV003", memo:"Penerimaan pembayaran piutang dari PT Ritel Utama Indonesia",                         postedBy:"Budi Santoso",  postedDate:"2025-03-10", createdBy:"Sarah Wijaya",  createdDate:"2025-03-10", lines:[{acct:"1-1100",acctName:"Kas & Bank",                  debit:24200000, credit:0,        desc:"Penerimaan kas dari pelanggan"},{acct:"1-1200",acctName:"Piutang Usaha",                      debit:0,        credit:24200000, desc:"Pelunasan piutang"}] },
  { id:"JE-2025-0017", date:"2025-03-11", refType:"invoice_payment", refId:"INV004", memo:"Penerimaan pembayaran piutang dari Toko Modern Bandung",                              postedBy:"Sarah Wijaya",  postedDate:"2025-03-11", createdBy:"Andi Prasetyo", createdDate:"2025-03-11", lines:[{acct:"1-1100",acctName:"Kas & Bank",                  debit:18562500, credit:0,        desc:"Penerimaan kas dari pelanggan"},{acct:"1-1200",acctName:"Piutang Usaha",                      debit:0,        credit:18562500, desc:"Pelunasan piutang"}] },
];

const REKON_DATA = {
  "JE-2025-0002":"matched","JE-2025-0003":"matched","JE-2025-0011":"matched",
  "JE-2025-0012":"matched","JE-2025-0013":"matched","JE-2025-0015":"matched",
  "JE-2025-0016":"matched","JE-2025-0017":"matched","JE-2025-0018":"matched",
};
const ANOMALIES_KEYS = { "JE-2025-0001": 1 };
const ANOMALIES = {
  "JE-2025-0001": { type:"warn", flag:"Nilai tidak wajar", detail:"Nilai beban gaji melebihi rata-rata 3 bulan sebelumnya.", grid:[{label:"Rata-rata Historis",val:"Rp 38.500.000"},{label:"Nilai Saat Ini",val:"Rp 45.000.000"},{label:"Selisih",val:"+16.9%"}] },
};
const KURS_DATA = {
  "JE-2025-0002":{orig:"USD 5.222",rate:"15.800"},
  "JE-2025-0004":{orig:"USD 791",rate:"15.800"},
  "JE-2025-0008":{orig:"USD 1.582",rate:"15.800"},
};
const JE_DIM = {
  "JE-2025-0001":{dept:"Finance",proj:null,branch:"HQ Jakarta"},
  "JE-2025-0002":{dept:"Operations",proj:"Produk Divisi A",branch:"HQ Jakarta"},
  "JE-2025-0003":{dept:"General Affairs",proj:null,branch:"HQ Jakarta"},
  "JE-2025-0004":{dept:"Operations",proj:"Distribusi Feb",branch:"Surabaya"},
  "JE-2025-0006":{dept:"Sales",proj:"Produk Divisi A",branch:"HQ Jakarta"},
  "JE-2025-0007":{dept:"Sales",proj:"Produk Divisi B",branch:"Bandung"},
  "JE-2025-0008":{dept:"Finance",proj:"Audit Internal Q1",branch:"HQ Jakarta"},
  "JE-2025-0009":{dept:"Operations",proj:"Produk Divisi B",branch:"Yogyakarta"},
  "JE-2025-0010":{dept:"Sales",proj:"Produk Divisi A",branch:"Medan"},
  "JE-2025-0019":{dept:"Finance",proj:null,branch:"HQ Jakarta"},
  "JE-2025-0020":{dept:"Finance",proj:null,branch:"HQ Jakarta"},
};
const AI_RESPONSES = [
  "Berdasarkan data GL periode Jan–Apr 2025, total debit sebesar Rp 413.357.500 dan kredit Rp 413.357.500 — seimbang sempurna.",
  "Akun dengan aktivitas tertinggi adalah Kas & Bank (1-1100) dengan 7 transaksi senilai total Rp 200.387.500.",
  "Terdapat 1 piutang belum terlunasi (INV005 — Rp 48.400.000) dan 1 utang belum dibayar (BILL005 — Rp 13.750.000).",
  "Beban PPN Masukan (5-2200) mencatat Rp 14.420.000 untuk periode ini. Pastikan dikompensasi dengan PPN Keluaran (2-1200) sebelum pelaporan SPT masa.",
  "Margin operasional bersih terlihat positif di Feb–Mar 2025. Perlu perhatian di April karena hanya ada 1 transaksi tanpa pendapatan yang tercatat.",
];
const SUGGESTION_RESPONSES = {
  "Apa yang perlu dilakukan hari ini? ↗": `Berdasarkan status GL Jan 2025, ada <strong>3 hal mendesak</strong> yang perlu diselesaikan sebelum closing:<br><br><strong>1. Resolve anomali JE-2025-0001</strong><br>Beban Gaji Rp 45jt — naik 16.9% dari rata-rata 3 bulan (Rp 38,5jt). Perlu konfirmasi apakah wajar.<br><br><strong>2. Dorong approval 3 JE pending</strong><br>JE menunggu persetujuan Finance Manager. Tanpa ini GL tidak bisa dikunci.<br><br><strong>3. Selesaikan rekonsiliasi bank (76% → 100%)</strong><br>12 transaksi belum matched. AI sudah auto-match 38 — sisanya butuh manual review.<br><br>Closing window tinggal <strong>7 hari</strong>. Prioritas hari ini: anomali + approval.`,
  "Bandingkan dengan bulan lalu ↗": `Perbandingan <strong>Jan 2025 vs Des 2024</strong>:<br><br>Running balance naik 28% · Total transaksi +12 entri · Beban operasional naik 19% · Rekonsiliasi turun dari 100% ke 76% · Anomali: 1 baru (Des: 0).<br><br>Kenaikan saldo signifikan didorong pendapatan lebih tinggi, tapi beban operasional juga naik — terutama dari komponen gaji yang perlu dikonfirmasi.`,
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getDisplayRef(je) {
  if (je.refType === "invoice" || je.refType === "invoice_payment") return INV_REFS[je.refId] || je.id;
  if (je.refType === "bill"    || je.refType === "bill_payment")    return BILL_REFS[je.refId] || je.id;
  return je.id;
}
function mapRefType(t) {
  if (t === "invoice" || t === "invoice_payment") return "inv";
  if (t === "bill"    || t === "bill_payment")    return "bill";
  return "je";
}
function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day:"2-digit", month:"short", year:"numeric" });
}
function fmt(n)    { if (!n && n !== 0) return "–"; return "Rp " + Math.abs(n).toLocaleString("id-ID"); }
function fmtNum(n) { if (!n) return "–"; return Math.abs(n).toLocaleString("id-ID"); }

function buildGLRows() {
  const sorted = [...JE_DATA].sort((a, b) => a.date.localeCompare(b.date));
  const rows = [];
  let runBal = 500000000;
  sorted.forEach(je => {
    const displayRef = getDisplayRef(je);
    const refType    = mapRefType(je.refType);
    const isAnomaly  = !!ANOMALIES_KEYS[je.id];
    if (isAnomaly) {
      const pl = je.lines.find(l => l.debit > 0) || je.lines[0];
      const netEffect = je.lines.reduce((s, l) => s + (l.debit || 0) - (l.credit || 0), 0);
      runBal += netEffect;
      rows.push({ id:je.id+"-L0", jeId:je.id, date:je.date, dateLabel:fmtDate(je.date), ref:displayRef, refType, refId:je.refId, acct:pl.acct, acctName:pl.acctName, desc:je.memo, debit:pl.debit||0, credit:pl.credit||0, balance:runBal, jeData:je });
    } else {
      je.lines.forEach((l, idx) => {
        const debit  = l.debit  > 0 ? l.debit  : 0;
        const credit = l.credit > 0 ? l.credit : 0;
        runBal += debit - credit;
        rows.push({ id:je.id+"-L"+idx, jeId:je.id, date:je.date, dateLabel:fmtDate(je.date), ref:displayRef, refType, refId:je.refId, acct:l.acct, acctName:l.acctName, desc:l.desc||je.memo, debit, credit, balance:runBal, jeData:je });
      });
    }
  });
  return rows;
}

const ALL_ROWS    = buildGLRows();
const ACCT_OPTIONS = [...new Set(ALL_ROWS.map(r => r.acct + "|" + r.acctName))].sort().map(a => { const [code,name]=a.split("|"); return {code,name}; });

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function GeneralLedgerPage() {
  // ── State ────────────────────────────────────────────────────────────────
  const [cmdCollapsed,    setCmdCollapsed]    = useState(false);
  const [closingOpen,     setClosingOpen]     = useState(false);
  const [aiOpen,          setAiOpen]          = useState(false);
  const [tipHidden,       setTipHidden]       = useState(false);
  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [selectedJeId,    setSelectedJeId]    = useState(null);
  const [drawerTab,       setDrawerTab]       = useState(0);
  const [filterDrawerOpen,setFilterDrawerOpen]= useState(false);
  const [expMenuOpen,     setExpMenuOpen]     = useState(false);
  const [search,          setSearch]          = useState("");
  const [filterType,      setFilterType]      = useState("all");
  const [sortCol,         setSortCol]         = useState("date");
  const [sortDir,         setSortDir]         = useState("asc");
  const [page,            setPage]            = useState(1);
  const [pageSize,        setPageSize]        = useState(50);
  const [dateFrom,        setDateFrom]        = useState("");
  const [dateTo,          setDateTo]          = useState("");
  const [filterAcct,      setFilterAcct]      = useState("");
  const [dateShortcut,    setDateShortcut]    = useState(null);
  const [kursVisible,     setKursVisible]     = useState(false);
  const [dismissed,       setDismissed]       = useState(new Set());
  const [expandedRows,    setExpandedRows]    = useState(new Set());
  const [customRows,      setCustomRows]      = useState(null);
  const [customLabel,     setCustomLabel]     = useState(null);
  const [expScope,        setExpScope]        = useState("visible");
  const [expFmt,          setExpFmt]          = useState("xlsx");
  // AI
  const [aiMsgs,          setAiMsgs]          = useState([]);
  const [aiInited,        setAiInited]        = useState(false);
  const [aiInput,         setAiInput]         = useState("");
  const [aiTyping,        setAiTyping]        = useState(false);
  const [aiMsgCount,      setAiMsgCount]      = useState(0);
  const [aiTab,           setAiTab]           = useState(0);

  const scrollRef  = useRef(null);
  const aiMsgsRef  = useRef(null);
  const aiInputRef = useRef(null);

  // ── Scroll collapse ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop > 20 && !cmdCollapsed) setCmdCollapsed(true);
      else if (el.scrollTop <= 20 && cmdCollapsed) setCmdCollapsed(false);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [cmdCollapsed]);

  // ── Close export menu on outside click ───────────────────────────────────
  useEffect(() => {
    const handler = () => setExpMenuOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // ── Auto-scroll AI messages ───────────────────────────────────────────────
  useEffect(() => {
    if (aiMsgsRef.current) aiMsgsRef.current.scrollTop = aiMsgsRef.current.scrollHeight;
  }, [aiMsgs, aiTyping]);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (customRows) return customRows;
    let rows = [...ALL_ROWS];
    if (filterType !== "all") rows = rows.filter(r => r.refType === filterType);
    if (search)    rows = rows.filter(r => (r.ref+r.acct+r.acctName+r.desc).toLowerCase().includes(search.toLowerCase()));
    if (dateFrom)  rows = rows.filter(r => r.date >= dateFrom);
    if (dateTo)    rows = rows.filter(r => r.date <= dateTo);
    if (filterAcct)rows = rows.filter(r => r.acct === filterAcct);
    return rows;
  }, [customRows, filterType, search, dateFrom, dateTo, filterAcct]);

  // ── Sorted rows with running balance recalculation ────────────────────────
  const sortedRows = useMemo(() => {
    const s = [...filteredRows].sort((a, b) => {
      let va, vb;
      if (sortCol === "date")   { va=a.date;       vb=b.date; }
      else if (sortCol === "ref")    { va=a.ref;        vb=b.ref; }
      else if (sortCol === "acct")   { va=a.acct;       vb=b.acct; }
      else if (sortCol === "debit")  { va=a.debit||0;   vb=b.debit||0; }
      else if (sortCol === "credit") { va=a.credit||0;  vb=b.credit||0; }
      else                           { va=a.balance||0; vb=b.balance||0; }
      const cmp = va<vb ? -1 : va>vb ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    let bal = 500000000;
    s.forEach(r => { bal += (r.debit||0) - (r.credit||0); r.balance = bal; });
    return s;
  }, [filteredRows, sortCol, sortDir]);

  const totalPages   = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage     = Math.min(page, totalPages);
  const pageRows     = sortedRows.slice((safePage-1)*pageSize, safePage*pageSize);
  const statsDebit   = filteredRows.reduce((s,r) => s+(r.debit||0), 0);
  const statsCredit  = filteredRows.reduce((s,r) => s+(r.credit||0), 0);
  const statsBalance = sortedRows.length > 0 ? sortedRows[sortedRows.length-1].balance : 500000000;
  const filterBadge  = [dateFrom||dateTo, filterAcct].filter(Boolean).length;

  // ── Actions ───────────────────────────────────────────────────────────────
  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d==="asc"?"desc":"asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  function openDrawer(jeId) { setSelectedJeId(jeId); setDrawerTab(0); setDrawerOpen(true); }

  function openAI() {
    setTipHidden(true);
    setAiOpen(true);
    if (!aiInited) {
      setAiInited(true);
      setAiMsgs([{ role:"ai", text:"GL seimbang dan saldo berjalan <strong>Rp 616,6jt</strong>. Tapi ada <strong>3 JE pending approval</strong> dan <strong>1 anomali</strong> yang perlu diselesaikan sebelum Jan 2025 bisa dikunci — dan closing window tinggal <strong>7 hari</strong>.", chips:true }]);
      setAiMsgCount(1);
    }
  }

  function sendAI(txt) {
    const text = txt || aiInput.trim();
    if (!text) return;
    openAI();
    setAiMsgs(m => [...m, { role:"user", text }]);
    setAiInput("");
    if (aiInputRef.current) aiInputRef.current.style.height = "auto";
    setAiTyping(true);
    const count = aiMsgCount;
    setTimeout(() => {
      setAiTyping(false);
      const resp = SUGGESTION_RESPONSES[text] || AI_RESPONSES[count % AI_RESPONSES.length];
      setAiMsgs(m => [...m, { role:"ai", text:resp }]);
    }, 900 + Math.random()*600);
    setAiMsgCount(c => c+1);
  }

  function markValid(jeId) { setDismissed(s => new Set([...s, jeId])); }

  function resetCustomFilter() { setCustomRows(null); setCustomLabel(null); }

  function setTypeFilter(t) { resetCustomFilter(); setFilterType(t); setPage(1); }

  function filterUnmatched() {
    setCustomRows(ALL_ROWS.filter(r => !REKON_DATA[r.jeId]));
    setCustomLabel("Unmatched ↩"); setPage(1); scrollToTable();
  }
  function filterAIMatched() {
    setCustomRows(ALL_ROWS.filter(r => REKON_DATA[r.jeId] === "matched"));
    setCustomLabel("AI Matched ↩"); setPage(1); scrollToTable();
  }
  function openAnomalyFromCard() {
    resetCustomFilter(); setFilterType("all"); setPage(1);
    setTimeout(() => { openDrawer("JE-2025-0001"); scrollToTable(); }, 100);
  }

  function scrollToTable() {
    setTimeout(() => { scrollRef.current?.scrollTo({ top: 220, behavior:"smooth" }); }, 100);
  }

  function expandCommandCenter() { setCmdCollapsed(false); scrollRef.current && (scrollRef.current.scrollTop = 0); }

  function applyDateShortcut(range) {
    setDateShortcut(range);
    const today = new Date().toISOString().slice(0,10);
    if (range === "today") { setDateFrom(today); setDateTo(today); }
    else if (range === "week")  { const d=new Date(); d.setDate(d.getDate()-7); setDateFrom(d.toISOString().slice(0,10)); setDateTo(today); }
    else if (range === "month") { const d=new Date(); d.setDate(1); setDateFrom(d.toISOString().slice(0,10)); setDateTo(today); }
    else if (range === "q1")    { setDateFrom("2025-01-01"); setDateTo("2025-03-31"); }
    else if (range === "all")   { setDateFrom(""); setDateTo(""); }
    setPage(1);
  }

  function resetFilters() { setDateFrom(""); setDateTo(""); setFilterAcct(""); setDateShortcut(null); setPage(1); }

  function doExport() {
    setExpMenuOpen(false);
    const data = expScope === "all" ? [...ALL_ROWS].sort((a,b) => a.date.localeCompare(b.date)) : sortedRows;
    const rows = [["Tanggal","Referensi","Tipe","Akun","Nama Akun","Keterangan","Debit (Rp)","Kredit (Rp)","Saldo (Rp)"]];
    data.forEach(r => rows.push([r.dateLabel,r.ref,r.refType.toUpperCase(),r.acct,r.acctName,r.desc,r.debit||"",r.credit||"",r.balance]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿"+csv], {type:"text/csv;charset=utf-8"}));
    a.download = `GL_Klay_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  const selectedJe = selectedJeId ? JE_DATA.find(j => j.id === selectedJeId) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="gl-wrap">

        {/* ── ORANGE ZONE ───────────────────────────────────────────────── */}
        <div className="gl-orange-zone">

          {/* Period head row */}
          <div className="gl-period-head-row">
            <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
              <div className="gl-period-label">Periode Berjalan: <strong>Januari 2025</strong></div>
              {cmdCollapsed && (
                <div className="gl-balance-chip">
                  <span className="gl-bc-lbl">Saldo</span>
                  <span className="gl-bc-val">Rp 616,6jt</span>
                  <span className="gl-bc-delta">↑ 28%</span>
                </div>
              )}
            </div>
            <div className="gl-period-ctas">
              {/* Klay AI */}
              <div style={{position:"relative"}}>
                <button className="gl-btn-ai" onClick={openAI}>
                  <svg width="14" height="14" viewBox="0 0 24 24" style={{flexShrink:0,fill:"var(--color-brand)"}}><path d="M12 2 L13.8 8.5 L20.5 8.5 L15.2 12.5 L17.1 19 L12 15.2 L6.9 19 L8.8 12.5 L3.5 8.5 L10.2 8.5 Z"/><circle cx="19" cy="4" r="2"/><circle cx="5" cy="5" r="1.3"/><circle cx="20" cy="16" r="1.3"/></svg>
                  Klay AI
                  <span className="gl-ai-badge">4</span>
                </button>
                {!tipHidden && !aiOpen && (
                  <div className="gl-ai-float-tip">
                    <div className="gl-aft-close" onClick={e=>{e.stopPropagation();setTipHidden(true);}}>
                      <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </div>
                    <div className="gl-aft-body">7 hari lagi closing. GL seimbang tapi <strong style={{color:"#fff"}}>3 JE pending</strong> &amp; <strong style={{color:"#fff"}}>1 anomali</strong> masih belum selesai — rekon <strong style={{color:"#fff"}}>76%</strong>.</div>
                    <div className="gl-aft-cta" onClick={openAI}>
                      <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#fff" stroke="none"/></svg>
                      Klik untuk tanya Klay AI
                    </div>
                  </div>
                )}
              </div>
              {/* Export */}
              <div style={{position:"relative"}}>
                <button className="gl-btn-export" onClick={e=>{e.stopPropagation();setExpMenuOpen(v=>!v);}}>
                  <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Export
                </button>
                {expMenuOpen && (
                  <div className="gl-exp-menu" onClick={e=>e.stopPropagation()}>
                    <div className="gl-exp-sec-lbl">Scope</div>
                    <label className="gl-exp-item"><input type="radio" name="glExpScope" value="visible" checked={expScope==="visible"} onChange={()=>setExpScope("visible")} /> Hanya yang terlihat</label>
                    <label className="gl-exp-item"><input type="radio" name="glExpScope" value="all"     checked={expScope==="all"}     onChange={()=>setExpScope("all")} /> Semua data</label>
                    <div className="gl-exp-div" />
                    <div className="gl-exp-sec-lbl">Format</div>
                    <label className="gl-exp-item"><input type="radio" name="glExpFmt" value="xlsx" checked={expFmt==="xlsx"} onChange={()=>setExpFmt("xlsx")} /> Excel (.xlsx)</label>
                    <label className="gl-exp-item"><input type="radio" name="glExpFmt" value="csv"  checked={expFmt==="csv"}  onChange={()=>setExpFmt("csv")} /> CSV</label>
                    <div className="gl-exp-div" />
                    <button className="gl-exp-do-btn" onClick={doExport}>Export Sekarang</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Period tabs */}
          <div className="gl-period-tabs">
            <div className="gl-pt-arr"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></div>
            {[{l:"Okt 2024",s:"locked"},{l:"Nov 2024",s:"locked"},{l:"Des 2024",s:"locked"},{l:"Jan 2025",s:"active"},{l:"Feb 2025",s:"future"},{l:"Mar 2025",s:"future"},{l:"Apr 2025",s:"future"},{l:"Mei 2025",s:"future"}].map(t=>(
              <div key={t.l} className={`gl-pt-tab ${t.s}`} title={t.s==="locked"?"Periode terkunci":t.s==="future"?"Periode belum dimulai":""}>
                {t.s==="locked"&&<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
                {t.l}
              </div>
            ))}
            <div className="gl-pt-arr"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></div>
            <div style={{flex:1,minWidth:8}}/>
            {cmdCollapsed && (
              <div className="gl-open-pill" onClick={expandCommandCenter}>
                <svg viewBox="0 0 24 24" width="10" height="10" style={{stroke:"currentColor",fill:"none",strokeWidth:2.5}}><polyline points="18 15 12 9 6 15"/></svg>
                Buka command center
              </div>
            )}
          </div>

          {/* Command center */}
          <div className={`gl-cmd-center${cmdCollapsed?" collapsed":""}`}>
            <div className="gl-cmd-inner">

              {/* Metric cards */}
              <div className="gl-metric-cards">
                {[
                  { accent:"neutral", onClick:openAI,         title:"Running Balance", value:<div className="gl-mc-value">616,6jt</div>,        sub:"PT Sejahtera Makmur · Jan 2025", badge:<span className="gl-mc-badge up"><svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>+28% dari periode lalu</span>, action:null },
                  { accent:"warn",    onClick:null,            title:"JE Pending",      value:<div className="gl-mc-count">3</div>,               sub:"pending approval",               badge:<span className="gl-mc-badge muted">Belum bisa dipost</span>,              action:<div className="gl-mc-action" style={{color:"var(--color-text-tertiary)",fontWeight:500}}>Butuh approval manager</div>, disabled:true },
                  { accent:"danger",  onClick:openAnomalyFromCard, title:"Anomali",     value:<div className="gl-mc-count">1</div>,               sub:"terdeteksi",                     badge:<span className="gl-mc-badge danger">Gaji naik 16.9%</span>,               action:<div className="gl-mc-action">Lihat di tabel <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div> },
                  { accent:"info",    onClick:filterUnmatched, title:"Unmatched ke Bank",value:<div className="gl-mc-count">12</div>,             sub:"perlu direkonsiliasi",           badge:<span className="gl-mc-badge info">Buka rekonsiliasi</span>,               action:<div className="gl-mc-action">Filter unmatched <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div> },
                  { accent:"success", onClick:filterAIMatched, title:"Auto Rekon AI",   value:<div className="gl-mc-count" style={{color:"#16A34A"}}>38</div>, sub:"matched by AI",     badge:<span className="gl-mc-badge success">Terakhir 08:12</span>,              action:<div className="gl-mc-action">Spot-check <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div> },
                ].map((mc,i)=>(
                  <div key={i} className={`gl-mc gl-mc-${mc.accent}${mc.disabled?" gl-mc-disabled":""}`} onClick={mc.onClick||undefined} style={mc.disabled?{cursor:"default"}:{}}>
                    <div className="gl-mc-label">{mc.title}</div>
                    {mc.value}
                    <div className="gl-mc-sub">{mc.sub}</div>
                    {mc.badge}
                    {mc.action}
                  </div>
                ))}
              </div>

              {/* Closing section */}
              <div className="gl-new-closing">
                <div className="gl-ncl-head" onClick={()=>setClosingOpen(v=>!v)}>
                  <div className="gl-ncl-prog-wrap">
                    <span className="gl-ncl-label">Closing Progress</span>
                    <div className="gl-ncl-track"><div className="gl-ncl-fill" style={{width:"60%"}}/></div>
                    <span className="gl-ncl-pct">60%</span>
                    <span className="gl-ncl-period-tag">Jan 2025</span>
                  </div>
                  <div className={`gl-ncl-trigger${closingOpen?" open":""}`}>
                    Lihat closing checklist &amp; AI Log
                    <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
                  </div>
                </div>
                {closingOpen && (
                  <div className="gl-ncl-body">
                    <div className="gl-ncl-two-col">
                      <div className="gl-ncl-checklist">
                        <div className="gl-ncl-col-title">Closing Checklist · Jan 2025</div>
                        {[
                          {ic:"ok",  title:"GL seimbang",                 sub:"Total debit = kredit",                  btn:"Trial balance →",  onClick:()=>{}                                               },
                          {ic:"ok",  title:"Rekonsiliasi 76%",             sub:"38 dari 50 matched",                    btn:"Lanjutkan →",       onClick:filterUnmatched                                      },
                          {ic:"warn",title:"Anomali belum diselesaikan",   sub:"JE-2025-0001 perlu review",             btn:"Lihat anomali →",   onClick:openAnomalyFromCard                                  },
                          {ic:"err", title:"3 JE belum di-post",           sub:"Menunggu approval finance manager",     btn:"Tinjau JE →",       onClick:()=>{setTypeFilter("je");scrollToTable();}           },
                          {ic:"err", title:"Periode belum dikunci",        sub:"Selesaikan semua item di atas dulu",    btn:"Kunci Jan 2025",    onClick:()=>{},                    disabled:true             },
                        ].map((item,i)=>(
                          <div key={i} className="gl-ncl-ci">
                            <div className={`gl-ncl-ci-icon gl-ci-${item.ic}`}>
                              {item.ic==="ok"  && <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>}
                              {item.ic==="warn" && <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>}
                              {item.ic==="err"  && <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                            </div>
                            <div className="gl-ncl-ci-body">
                              <div className="gl-ncl-ci-title">{item.title}</div>
                              <div className="gl-ncl-ci-sub">{item.sub}</div>
                            </div>
                            <button className="gl-ncl-ci-btn" disabled={item.disabled} style={item.disabled?{opacity:.4,cursor:"not-allowed"}:{}} onClick={e=>{e.stopPropagation();item.onClick();}}>{item.btn}</button>
                          </div>
                        ))}
                      </div>
                      <div className="gl-ncl-ailog">
                        <div className="gl-ncl-col-title">Yang Dilakukan AI Hari Ini</div>
                        {[
                          {warn:false, text:"Auto-rekonsiliasi bank — 38 transaksi matched berdasarkan nominal + tanggal ±1 hari, confidence 97%",             ts:"08:02"},
                          {warn:false, text:"Klasifikasi otomatis — 21 entri baru, model v2.1, akurasi rata-rata 96%",                                           ts:"10:14"},
                          {warn:true,  text:"Anomali terdeteksi — JE-2025-0001 Beban Gaji Rp 85,5jt, +16.9% dari rata-rata historis 3 bulan (Rp 73,1jt)",        ts:"11:30"},
                          {warn:false, text:"Running balance diperbarui setelah 5 entri baru di-post",                                                            ts:"14:07"},
                        ].map((item,i)=>(
                          <div key={i} className="gl-ncl-log-item">
                            <div className={`gl-ncl-log-dot${item.warn?" warn":""}`}/>
                            <div className="gl-ncl-log-text">
                              <div className="gl-ncl-log-action">{item.text}</div>
                              <div className="gl-ncl-log-ts">{item.ts}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>{/* /gl-orange-zone */}

        {/* ── CONTENT ROW ───────────────────────────────────────────────── */}
        <div className="gl-content-row">

          {/* Content main */}
          <div className="gl-content-main">
            <div className="gl-scroll-area" ref={scrollRef}>

              {/* Filter bar */}
              <div className="gl-filter-bar">
                <div className="gl-f-search">
                  <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input type="text" placeholder="Cari di General Ledger…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} />
                </div>
                <div className="gl-fsep"/>
                <div className="gl-chip-grp">
                  {["all","je","inv","bill"].map(v=>(
                    <div key={v} className={`gl-chip${(customLabel ? v==="all" : filterType===v)?" on":""}`}
                      style={(customLabel&&v==="all")?{borderStyle:"dashed"}:{}}
                      onClick={()=>{ if (customLabel&&v==="all") resetCustomFilter(); else setTypeFilter(v); }}>
                      {customLabel&&v==="all" ? customLabel : {all:"Semua",je:"Jurnal Entry",inv:"Invoice",bill:"Bill"}[v]}
                    </div>
                  ))}
                </div>
                <div className="gl-f-right">
                  <button className="gl-f-filter-btn" onClick={()=>setFilterDrawerOpen(true)}>
                    <svg viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
                    Filter Lainnya
                    {filterBadge > 0 && <span className="gl-f-badge">{filterBadge}</span>}
                  </button>
                  <div className="gl-fsep"/>
                  <div className="gl-kurs-wrap">
                    <label className="gl-kurs-switch">
                      <input type="checkbox" checked={kursVisible} onChange={e=>setKursVisible(e.target.checked)} />
                      <div className="gl-kurs-track"/>
                      <div className="gl-kurs-thumb"/>
                    </label>
                    <span className="gl-kurs-lbl">Tampilkan kurs</span>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="gl-table-wrap">
                <div className="gl-tbl-scroll">
                  <table className="gl-table">
                    <thead>
                      <tr>
                        {[{col:"date",lbl:"Tanggal"},{col:"ref",lbl:"Referensi"},{col:null,lbl:"Tipe"},{col:"acct",lbl:"Akun"},{col:"debit",lbl:"Debit (Rp)",r:true},{col:"credit",lbl:"Kredit (Rp)",r:true},{col:"balance",lbl:"Saldo (Rp)",r:true},{col:null,lbl:"Rekon",center:true}].map(h=>(
                          <th key={h.lbl} className={[h.col?"gl-sortable":"",h.r?"gl-r":"",sortCol===h.col?("gl-sort-"+sortDir):""].filter(Boolean).join(" ")} style={h.center?{textAlign:"center"}:{}} onClick={h.col?()=>handleSort(h.col):undefined}>
                            {h.lbl}{h.col&&<span className="gl-sort-arrow"/>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.length === 0 ? (
                        <tr><td colSpan={8}>
                          <div className="gl-empty">
                            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                            <div className="gl-empty-title">Tidak ada data</div>
                            <div className="gl-empty-sub">Coba ubah filter atau pencarian</div>
                          </div>
                        </td></tr>
                      ) : (() => {
                        const out = [];
                        const seen = new Set();
                        pageRows.forEach((r,idx) => {
                          const anom = !dismissed.has(r.jeId) ? ANOMALIES[r.jeId] : null;
                          const anomCls = anom ? (anom.type==="warn"?"gl-arow-warn":"gl-arow-danger") : "";
                          const isFirst = !seen.has(r.jeId); seen.add(r.jeId);
                          const isLast  = !pageRows[idx+1] || pageRows[idx+1].jeId !== r.jeId;
                          const isExp   = expandedRows.has(r.id);
                          const kurs    = kursVisible ? (KURS_DATA[r.jeId]||null) : null;
                          const rekon   = REKON_DATA[r.jeId] || "unmatched";

                          out.push(
                            <tr key={r.id} className={anomCls} onClick={()=>openDrawer(r.jeId)}>
                              <td className="gl-td-date">{r.dateLabel}</td>
                              <td>
                                <span className="gl-td-ref">{r.ref}</span>
                                {anom&&isFirst&&<span className={`gl-anom-flag ${anom.type}`}>✨ {anom.flag}</span>}
                                {anom&&isFirst&&<span style={{cursor:"pointer",marginLeft:6,fontSize:10,color:"var(--color-text-tertiary)"}} onClick={e=>{e.stopPropagation();setExpandedRows(s=>{const n=new Set(s);n.has(r.id)?n.delete(r.id):n.add(r.id);return n;})}}>{isExp?"▲":"▼"}</span>}
                              </td>
                              <td><span className={`gl-type-badge ${r.refType}`}>{r.refType==="je"?"JE":r.refType==="inv"?"Invoice":"Bill"}</span></td>
                              <td>
                                <div className="gl-td-acct-name">{r.acctName}</div>
                                <div className="gl-td-acct">{r.acct}</div>
                              </td>
                              <td className="gl-r">
                                {r.debit ? <div><span className="gl-td-amount debit">{fmtNum(r.debit)}</span>{kurs&&<div className="gl-kurs-detail">{kurs.orig} @ {kurs.rate}</div>}</div> : <span className="gl-dash">–</span>}
                              </td>
                              <td className="gl-r">
                                {r.credit ? <div><span className="gl-td-amount credit">{fmtNum(r.credit)}</span>{kurs&&<div className="gl-kurs-detail">{kurs.orig} @ {kurs.rate}</div>}</div> : <span className="gl-dash">–</span>}
                              </td>
                              <td className="gl-r"><span className="gl-td-balance">{fmtNum(r.balance)}</span></td>
                              <td style={{textAlign:"center"}}>
                                <span className={`gl-rekon-badge ${rekon}`}>
                                  {rekon==="matched"
                                    ? <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Matched</>
                                    : <><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/></svg>Unmatched</>}
                                </span>
                              </td>
                            </tr>
                          );

                          if (anom && isExp && isLast) {
                            out.push(
                              <tr key={r.id+"-exp"} className={`gl-exp-row ${anomCls}`}>
                                <td colSpan={8}>
                                  <div className="gl-exp-inner">
                                    <div className="gl-exp-title">{anom.detail}</div>
                                    <div className="gl-exp-grid">
                                      {anom.grid.map(g=>(
                                        <div key={g.label} className="gl-exp-cell">
                                          <div className="gl-exp-cell-lbl">{g.label}</div>
                                          <div className="gl-exp-cell-val">{g.val}</div>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="gl-exp-actions">
                                      <button className="gl-ai-btn-valid" onClick={e=>{e.stopPropagation();markValid(r.jeId);}}>Tandai sebagai valid</button>
                                      <button className="gl-ai-btn-reklas" onClick={e=>e.stopPropagation()}>Lihat di Jurnal Entry</button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                        });
                        return out;
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>{/* /gl-scroll-area */}
          </div>{/* /gl-content-main */}

          {/* ── AI PANEL ────────────────────────────────────────────────── */}
          <div className={`gl-ai-panel${aiOpen?" open":""}`}>
            <div className="gl-ai-panel-inner">
              <div className="gl-ai-head">
                <div className="gl-ai-head-icon">
                  <svg viewBox="0 0 24 24" fill="white" style={{width:14,height:14}}><path d="M12 2 L13.8 8.5 L20.5 8.5 L15.2 12.5 L17.1 19 L12 15.2 L6.9 19 L8.8 12.5 L3.5 8.5 L10.2 8.5 Z"/><circle cx="19" cy="4" r="2"/><circle cx="5" cy="5" r="1.3"/><circle cx="20" cy="16" r="1.3"/></svg>
                </div>
                <div className="gl-ai-head-text">
                  <div className="gl-ai-head-title">Klay AI Co-pilot</div>
                  <div className="gl-ai-head-sub">● AKTIF · General Ledger Jan 2025</div>
                </div>
                <div className="gl-ai-head-close" onClick={()=>setAiOpen(false)}>
                  <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </div>
              </div>
              {/* Closing deadline banner */}
              <div style={{background:"var(--warning-surface)",borderBottom:"1px solid var(--warning-border)",padding:"8px 14px",display:"flex",alignItems:"flex-start",gap:8,flexShrink:0}}>
                <svg width="13" height="13" viewBox="0 0 24 24" style={{stroke:"var(--warning-text)",fill:"none",strokeWidth:2,flexShrink:0,marginTop:1}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{fontSize:11,color:"var(--warning-text)",fontWeight:500,lineHeight:1.5}}><strong>7 hari lagi closing Jan 2025.</strong> Ada 4 item yang perlu diselesaikan sebelum periode bisa dikunci.</span>
              </div>
              {/* Tabs */}
              <div className="gl-ai-tabs">
                <div className={`gl-ai-tab${aiTab===0?" on":""}`} onClick={()=>setAiTab(0)}>Percakapan</div>
                <div className={`gl-ai-tab${aiTab===1?" on":""}`} onClick={()=>setAiTab(1)}>Riwayat</div>
              </div>
              {/* Messages */}
              {aiTab===0 && (
                <>
                  <div className="gl-ai-session-bar">
                    <span className="gl-ai-session-title">Sesi 1</span>
                    <span style={{fontSize:10,color:"var(--color-text-tertiary)",marginLeft:4}}>✎ edit</span>
                  </div>
                  <div className="gl-ai-msgs" ref={aiMsgsRef}>
                    {aiMsgs.map((msg,i)=>(
                      <div key={i} className={`gl-ai-bubble ${msg.role}`}>
                        {msg.role==="ai"&&<div className="gl-ai-bubble-lbl">✦ Klay AI</div>}
                        <div dangerouslySetInnerHTML={{__html:msg.text}}/>
                        {msg.chips&&(
                          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:8}}>
                            <span className="gl-ai-chip je"   onClick={()=>{setTypeFilter("je");scrollToTable();}}>3 JE pending →</span>
                            <span className="gl-ai-chip warn" onClick={openAnomalyFromCard}>Anomali JE-0001 →</span>
                            <span className="gl-ai-chip muted" onClick={filterUnmatched}>12 unmatched →</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {aiTyping&&<div className="gl-ai-typing"><span/><span/><span/></div>}
                  </div>
                  <div className="gl-ai-chips">
                    {Object.keys(SUGGESTION_RESPONSES).map(s=>(
                      <span key={s} className="gl-ai-sc" onClick={()=>sendAI(s)}>{s}</span>
                    ))}
                  </div>
                  <div className="gl-ai-chat-box">
                    <div className="gl-ai-chat-inner">
                      <textarea ref={aiInputRef} className="gl-ai-chat-ta" placeholder="Tanya tentang GL Jan 2025…" value={aiInput} rows={1}
                        onChange={e=>{setAiInput(e.target.value);e.target.style.height="auto";e.target.style.height=e.target.scrollHeight+"px";}}
                        onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendAI();}}}
                      />
                      <button className="gl-ai-chat-send" onClick={()=>sendAI()}>
                        <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      </button>
                    </div>
                    <div className="gl-ai-chat-hint">Enter untuk kirim · Shift+Enter baris baru</div>
                  </div>
                </>
              )}
              {/* History tab */}
              {aiTab===1 && (
                <div className="gl-ai-hist-list">
                  {aiMsgs.filter(m=>m.role==="user").length===0
                    ? <div style={{padding:20,textAlign:"center",fontSize:12,color:"var(--color-text-tertiary)"}}>Belum ada riwayat percakapan</div>
                    : <>
                        <div style={{padding:"10px 12px 4px",fontSize:10,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"var(--color-text-tertiary)"}}>Pertanyaan</div>
                        {aiMsgs.filter(m=>m.role==="user").map((m,i)=>(
                          <div key={i} className="gl-ai-hist-item" onClick={()=>setAiTab(0)}>
                            <div className="gl-ai-hist-preview">{m.text}</div>
                          </div>
                        ))}
                      </>
                  }
                </div>
              )}
            </div>
          </div>{/* /gl-ai-panel */}

        </div>{/* /gl-content-row */}
      </div>{/* /gl-wrap */}

      {/* ── STICKY STATUS BAR (fixed) ──────────────────────────────────── */}
      <div className={`gl-status-bar${aiOpen?" ai-open":""}`}>
        <div className="gl-sb-stat"><span className="gl-sb-lbl">Total</span><span className="gl-sb-val">{filteredRows.length} item</span></div>
        <div className="gl-sb-sep"/>
        <div className="gl-sb-stat"><span className="gl-sb-lbl">Tampil</span><span className="gl-sb-val">{pageRows.length} dari {filteredRows.length}</span></div>
        <div className="gl-sb-sep"/>
        <div className="gl-sb-stat"><span className="gl-sb-lbl">Debit</span><span className="gl-sb-val gl-sb-debit">{fmt(statsDebit)}</span></div>
        <div className="gl-sb-sep"/>
        <div className="gl-sb-stat"><span className="gl-sb-lbl">Kredit</span><span className="gl-sb-val gl-sb-credit">{fmt(statsCredit)}</span></div>
        <div className="gl-sb-sep"/>
        <div className="gl-sb-stat"><span className="gl-sb-lbl">Saldo</span><span className="gl-sb-val gl-sb-balance">{fmt(statsBalance)}</span></div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:16}}>
          <div className="gl-sb-stat" style={{gap:5}}>
            <span className="gl-sb-lbl">Baris</span>
            <select className="gl-pg-size-sel" value={pageSize} onChange={e=>{setPageSize(parseInt(e.target.value));setPage(1);}}>
              <option value="20">20</option><option value="50">50</option><option value="100">100</option>
            </select>
          </div>
          <div className="gl-sb-sep"/>
          <div className="gl-sb-stat" style={{gap:4}}>
            <button className="gl-pg-btn" onClick={()=>setPage(p=>Math.max(1,p-1))}>‹</button>
            <span className="gl-sb-val" style={{minWidth:32,textAlign:"center"}}>{safePage}/{totalPages}</span>
            <button className="gl-pg-btn" onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>›</button>
          </div>
        </div>
      </div>

      {/* ── DETAIL DRAWER ─────────────────────────────────────────────── */}
      {drawerOpen && <div className="gl-drawer-overlay" onClick={()=>setDrawerOpen(false)}/>}
      <div className={`gl-drawer${drawerOpen?" open":""}`}>
        {selectedJe && (
          <>
            <div className="gl-drawer-head">
              <div>
                <div className="gl-d-ref">{getDisplayRef(selectedJe)}</div>
                <div className="gl-d-badge">Posted</div>
              </div>
              <div className="gl-d-close" onClick={()=>setDrawerOpen(false)}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </div>
            </div>
            <div className="gl-d-tabs">
              {["Detail","Line Items","Audit Trail"].map((t,i)=>(
                <div key={i} className={`gl-d-tab${drawerTab===i?" on":""}`} onClick={()=>setDrawerTab(i)}>{t}</div>
              ))}
            </div>
            <div className="gl-d-body">
              {drawerTab===0 && <DrawerDetail je={selectedJe} anom={!dismissed.has(selectedJe.id)?ANOMALIES[selectedJe.id]:null} onMarkValid={markValid} onClose={()=>setDrawerOpen(false)}/>}
              {drawerTab===1 && <DrawerLines  je={selectedJe}/>}
              {drawerTab===2 && <DrawerAudit  je={selectedJe}/>}
            </div>
          </>
        )}
      </div>

      {/* ── FILTER DRAWER ─────────────────────────────────────────────── */}
      {filterDrawerOpen && <div className="gl-filter-overlay" onClick={()=>setFilterDrawerOpen(false)}/>}
      <div className={`gl-filter-drawer${filterDrawerOpen?" open":""}`}>
        <div className="gl-fd-head">
          <span className="gl-fd-title">Filter Lainnya</span>
          <div className="gl-d-close" onClick={()=>setFilterDrawerOpen(false)}>
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
        </div>
        <div className="gl-fd-body">
          <div className="gl-fd-section">
            <div className="gl-fd-lbl">Rentang Tanggal</div>
            <div className="gl-fd-shortcuts">
              {[{r:"today",l:"Hari ini"},{r:"week",l:"7 hari"},{r:"month",l:"Bulan ini"},{r:"q1",l:"Q1 2025"},{r:"all",l:"Semua"}].map(s=>(
                <div key={s.r} className={`gl-fd-sc${dateShortcut===s.r?" on":""}`} onClick={()=>applyDateShortcut(s.r)}>{s.l}</div>
              ))}
            </div>
            <div className="gl-fd-date-row">
              <input type="date" className="gl-fd-input" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPage(1);}} />
              <input type="date" className="gl-fd-input" value={dateTo}   onChange={e=>{setDateTo(e.target.value);setPage(1);}} />
            </div>
          </div>
          <div className="gl-fd-section">
            <div className="gl-fd-lbl">Akun</div>
            <select className="gl-fd-select" value={filterAcct} onChange={e=>{setFilterAcct(e.target.value);setPage(1);}}>
              <option value="">Semua Akun</option>
              {ACCT_OPTIONS.map(a=><option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
            </select>
          </div>
          <div className="gl-fd-section">
            <div className="gl-fd-lbl">Dimensi</div>
            <select className="gl-fd-select">
              <option value="">Semua Dimensi</option>
              <option>Finance</option><option>Sales</option><option>Operations</option><option>HR</option>
            </select>
          </div>
        </div>
        <div className="gl-fd-foot">
          <button className="gl-btn-ghost"    style={{flex:1}} onClick={resetFilters}>Reset</button>
          <button className="gl-btn-primary"  style={{flex:2}} onClick={()=>setFilterDrawerOpen(false)}>Terapkan</button>
        </div>
      </div>
    </>
  );
}

// ─── DRAWER SUB-COMPONENTS ───────────────────────────────────────────────────
function DrawerDetail({ je, anom, onMarkValid, onClose }) {
  const dim = JE_DIM[je.id] || null;
  const refLabel = { manual:"Jurnal Entry Manual", bill:"Bill", bill_payment:"Pembayaran Bill", invoice:"Invoice", invoice_payment:"Pembayaran Invoice" }[je.refType] || "Jurnal Entry Manual";
  const hasRef = je.refType.includes("invoice") || je.refType.includes("bill");
  return (
    <div>
      {anom && (
        <div style={{background:"var(--warning-surface)",border:"1px solid var(--warning-border)",borderRadius:"var(--radius-md)",padding:"12px 14px",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
            <svg width="12" height="12" viewBox="0 0 24 24" style={{fill:"var(--warning-text)",flexShrink:0}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
            <span style={{fontSize:10,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:"var(--warning-text)"}}>AI Reasoning — Anomali</span>
          </div>
          <div style={{fontSize:12,color:"var(--warning-text)",marginBottom:10,lineHeight:1.5}}>{anom.detail}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:10}}>
            {anom.grid.map(g=>(
              <div key={g.label} style={{background:"#fff",border:"1px solid var(--warning-border)",borderRadius:"var(--radius-sm)",padding:"6px 8px",textAlign:"center"}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",color:"var(--warning-text)",marginBottom:3}}>{g.label}</div>
                <div style={{fontSize:12,fontWeight:700,color:"var(--color-text-primary)",fontFamily:"var(--font-mono)"}}>{g.val}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>{onMarkValid(je.id);onClose();}} style={{flex:1,fontFamily:"var(--font-sans)",fontSize:11,fontWeight:600,padding:"6px 10px",borderRadius:"var(--radius-sm)",border:"1px solid var(--warning-border)",background:"#fff",color:"var(--warning-text)",cursor:"pointer"}}>Tandai valid</button>
            <button style={{flex:1.5,fontFamily:"var(--font-sans)",fontSize:11,fontWeight:600,padding:"6px 10px",borderRadius:"var(--radius-sm)",border:"none",background:"var(--color-action)",color:"#fff",cursor:"pointer"}}>Lihat di Jurnal Entry</button>
          </div>
        </div>
      )}
      {hasRef && (
        <div className="gl-d-open-link">
          <svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Buka {je.refId}
        </div>
      )}
      <div className="gl-dsec">
        <div className="gl-dlbl">Informasi Transaksi</div>
        {[["Referensi",getDisplayRef(je)],["No. JE",je.id],["Tipe",refLabel],["Tanggal",fmtDate(je.date)],["Keterangan",je.memo],["Dibuat oleh",je.createdBy],["Posted oleh",je.postedBy],["Tanggal post",fmtDate(je.postedDate)]].map(([lbl,val])=>(
          <div key={lbl} className="gl-info-row"><label>{lbl}</label><span>{val}</span></div>
        ))}
      </div>
      <div className="gl-dsec">
        <div className="gl-dlbl">Dimensi</div>
        {dim ? (
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {dim.dept   && <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:11,color:"var(--color-text-tertiary)"}}>Departemen</span><span className="gl-dpill dept">{dim.dept}</span></div>}
            {dim.proj   && <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:11,color:"var(--color-text-tertiary)"}}>Proyek</span><span className="gl-dpill proj">{dim.proj}</span></div>}
            {dim.branch && <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:11,color:"var(--color-text-tertiary)"}}>Cabang</span><span className="gl-dpill branch">{dim.branch}</span></div>}
          </div>
        ) : <div style={{fontSize:12,color:"var(--color-text-tertiary)"}}>Tidak ada dimensi untuk transaksi ini.</div>}
      </div>
    </div>
  );
}

function DrawerLines({ je }) {
  const tD = je.lines.reduce((s,l)=>s+(l.debit||0),0);
  const tC = je.lines.reduce((s,l)=>s+(l.credit||0),0);
  return (
    <div className="gl-dsec">
      <div className="gl-dlbl">Line Items</div>
      <table className="gl-d-tbl">
        <thead><tr><th>Akun</th><th className="gl-r">Debit (Rp)</th><th className="gl-r">Kredit (Rp)</th></tr></thead>
        <tbody>
          {je.lines.map((l,i)=>(
            <tr key={i}>
              <td><div style={{fontWeight:600,color:"var(--color-text-primary)"}}>{l.acctName}</div><div className="gl-li-sub">{l.acct} · {l.desc}</div></td>
              <td className="gl-r" style={{color:l.debit?"#A02020":"var(--color-text-tertiary)"}}>{l.debit?fmt(l.debit):"–"}</td>
              <td className="gl-r" style={{color:l.credit?"#166638":"var(--color-text-tertiary)"}}>{l.credit?fmt(l.credit):"–"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td style={{fontWeight:700}}>Total</td><td className="gl-r">{fmt(tD)}</td><td className="gl-r">{fmt(tC)}</td></tr>
          {tD===tC&&<tr><td colSpan={3} style={{fontSize:10,color:"var(--success-text)",textAlign:"center",background:"var(--success-surface)",padding:5,borderRadius:4}}>✓ Seimbang — Debit = Kredit</td></tr>}
        </tfoot>
      </table>
    </div>
  );
}

function DrawerAudit({ je }) {
  return (
    <div className="gl-dsec">
      <div className="gl-dlbl">Audit Trail</div>
      <div className="gl-audit-list">
        <div className="gl-audit-item">
          <div className="gl-audit-dot posted"><svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/></svg></div>
          <div><div className="gl-audit-action">Posted</div><div className="gl-audit-meta">oleh <strong>{je.postedBy}</strong> · {fmtDate(je.postedDate)}</div></div>
        </div>
        <div className="gl-audit-item">
          <div className="gl-audit-dot created"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="currentColor"/></svg></div>
          <div><div className="gl-audit-action">Dibuat</div><div className="gl-audit-meta">oleh <strong>{je.createdBy}</strong> · {fmtDate(je.createdDate)}</div></div>
        </div>
      </div>
    </div>
  );
}
