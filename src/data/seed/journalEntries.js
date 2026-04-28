// Journal entries plus the GL-only side maps that hang off them.
// `refId` references a bill or invoice by id when refType is bill/bill_payment
// or invoice/invoice_payment, so the GL display reference can be looked up
// from bills.js / invoices.js rather than duplicated here.

export const JOURNAL_ENTRIES = [
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

// Bill display reference (separate from the vendor's invoice number stored on
// each bill). Demo uses internal "BILL-2025-NNNN" sequence numbers — keep as a
// lookup until a real `ref` field gets added to bills.
export const BILL_REFS = {
  BILL001: "BILL-2025-0001",
  BILL002: "BILL-2025-0002",
  BILL003: "BILL-2025-0003",
  BILL004: "BILL-2025-0004",
  BILL005: "BILL-2025-0005",
};

// Bank-reconciliation status keyed by JE id. JEs not present here are unmatched.
export const RECONCILIATION = {
  "JE-2025-0002": "matched",
  "JE-2025-0003": "matched",
  "JE-2025-0011": "matched",
  "JE-2025-0012": "matched",
  "JE-2025-0013": "matched",
  "JE-2025-0015": "matched",
  "JE-2025-0016": "matched",
  "JE-2025-0017": "matched",
  "JE-2025-0018": "matched",
};

// Anomaly flags surfaced by the AI. Keys mirror JE ids.
export const ANOMALY_FLAGS = { "JE-2025-0001": 1 };
export const ANOMALIES = {
  "JE-2025-0001": {
    type: "warn",
    flag: "Nilai tidak wajar",
    detail: "Nilai beban gaji melebihi rata-rata 3 bulan sebelumnya.",
    grid: [
      { label: "Rata-rata Historis", val: "Rp 38.500.000" },
      { label: "Nilai Saat Ini",     val: "Rp 45.000.000" },
      { label: "Selisih",            val: "+16.9%" },
    ],
  },
};

// FX rate metadata for entries originally booked in foreign currency.
export const KURS = {
  "JE-2025-0002": { orig: "USD 5.222", rate: "15.800" },
  "JE-2025-0004": { orig: "USD 791",   rate: "15.800" },
  "JE-2025-0008": { orig: "USD 1.582", rate: "15.800" },
};

// Dimension tags applied to each JE (Department / Project / Branch).
export const JE_DIMENSIONS = {
  "JE-2025-0001": { dept: "Finance",         proj: null,                  branch: "HQ Jakarta" },
  "JE-2025-0002": { dept: "Operations",      proj: "Produk Divisi A",     branch: "HQ Jakarta" },
  "JE-2025-0003": { dept: "General Affairs", proj: null,                  branch: "HQ Jakarta" },
  "JE-2025-0004": { dept: "Operations",      proj: "Distribusi Feb",      branch: "Surabaya" },
  "JE-2025-0006": { dept: "Sales",           proj: "Produk Divisi A",     branch: "HQ Jakarta" },
  "JE-2025-0007": { dept: "Sales",           proj: "Produk Divisi B",     branch: "Bandung" },
  "JE-2025-0008": { dept: "Finance",         proj: "Audit Internal Q1",   branch: "HQ Jakarta" },
  "JE-2025-0009": { dept: "Operations",      proj: "Produk Divisi B",     branch: "Yogyakarta" },
  "JE-2025-0010": { dept: "Sales",           proj: "Produk Divisi A",     branch: "Medan" },
  "JE-2025-0019": { dept: "Finance",         proj: null,                  branch: "HQ Jakarta" },
  "JE-2025-0020": { dept: "Finance",         proj: null,                  branch: "HQ Jakarta" },
};
