// Trial Balance dataset — sourced from v4 prototype.
// Self-contained CoA + posted JEs + opening balances designed to be balanced:
// DR(500M Kas + 50M Peralatan) = CR(550M Modal Disetor)

export const TB_COA = [
  { code: "1-1000", name: "Kas", type: "asset", normal_balance: "debit", is_active: true },
  { code: "1-1100", name: "Kas & Bank", type: "asset", normal_balance: "debit", parent: "1-1000", is_active: true },
  { code: "1-1200", name: "Piutang Usaha", type: "asset", normal_balance: "debit", is_active: true },
  { code: "1-1300", name: "Cadangan Piutang Ragu", type: "contra_asset", normal_balance: "credit", is_active: true },
  { code: "1-1400", name: "Uang Muka Pembelian", type: "asset", normal_balance: "debit", is_active: true },
  { code: "1-2000", name: "Aset Tetap", type: "asset", normal_balance: "debit", is_active: true },
  { code: "1-2100", name: "Peralatan Kantor", type: "asset", normal_balance: "debit", parent: "1-2000", is_active: true },
  { code: "1-2110", name: "Akum. Penyusutan Peralatan", type: "contra_asset", normal_balance: "credit", is_active: true },
  { code: "1-2200", name: "Kendaraan Operasional", type: "asset", normal_balance: "debit", parent: "1-2000", is_active: true },
  { code: "1-2210", name: "Akum. Penyusutan Kendaraan", type: "contra_asset", normal_balance: "credit", is_active: true },
  { code: "2-1000", name: "Kewajiban Lancar", type: "liability", normal_balance: "credit", is_active: true },
  { code: "2-1100", name: "Utang Usaha", type: "liability", normal_balance: "credit", parent: "2-1000", is_active: true },
  { code: "2-1200", name: "Utang Pajak", type: "liability", normal_balance: "credit", is_active: true },
  { code: "2-1300", name: "Utang Gaji & Tunjangan", type: "liability", normal_balance: "credit", parent: "2-1000", is_active: true },
  { code: "2-2000", name: "Kewajiban Jangka Panjang", type: "liability", normal_balance: "credit", is_active: true },
  { code: "3-1000", name: "Ekuitas Pemilik", type: "equity", normal_balance: "credit", is_active: true },
  { code: "3-1100", name: "Modal Disetor", type: "equity", normal_balance: "credit", parent: "3-1000", is_active: true },
  { code: "3-1200", name: "Laba Ditahan", type: "equity", normal_balance: "credit", is_active: true },
  { code: "4-1000", name: "Pendapatan Penjualan", type: "revenue", normal_balance: "credit", is_active: true },
  { code: "4-1010", name: "Penjualan Produk - Divisi A", type: "revenue", normal_balance: "credit", parent: "4-1000", is_active: true },
  { code: "4-1020", name: "Penjualan Produk - Divisi B", type: "revenue", normal_balance: "credit", parent: "4-1000", is_active: true },
  { code: "4-1030", name: "Penjualan Jasa Tambahan", type: "revenue", normal_balance: "credit", parent: "4-1000", is_active: true },
  { code: "4-2000", name: "Pendapatan Lainnya", type: "revenue", normal_balance: "credit", is_active: true },
  { code: "5-1000", name: "Beban Operasional", type: "expense", normal_balance: "debit", is_active: true },
  { code: "5-1010", name: "Beban Gaji & Tunjangan", type: "expense", normal_balance: "debit", parent: "5-1000", is_active: true },
  { code: "5-1020", name: "Beban Sewa Kantor", type: "expense", normal_balance: "debit", parent: "5-1000", is_active: true },
  { code: "5-1030", name: "Beban Iklan & Pemasaran", type: "expense", normal_balance: "debit", parent: "5-1000", is_active: true },
  { code: "5-1040", name: "Beban Penyusutan", type: "expense", normal_balance: "debit", parent: "5-1000", is_active: true },
  { code: "5-1050", name: "Beban Listrik, Air & Utilitas", type: "expense", normal_balance: "debit", parent: "5-1000", is_active: true },
  { code: "5-1060", name: "Beban Pemeliharaan Aset", type: "expense", normal_balance: "debit", parent: "5-1000", is_active: true },
  { code: "5-1070", name: "Biaya Konsultan & Profesional", type: "expense", normal_balance: "debit", parent: "5-1000", is_active: true },
  { code: "5-2000", name: "Beban Pajak & Cukai", type: "expense", normal_balance: "debit", is_active: true },
  { code: "5-2100", name: "Beban PPh 21", type: "expense", normal_balance: "debit", parent: "5-2000", is_active: true },
  { code: "5-2200", name: "Beban PPN Masukan", type: "expense", normal_balance: "debit", parent: "5-2000", is_active: true },
  { code: "6-1000", name: "Biaya Pokok Penjualan", type: "expense", normal_balance: "debit", is_active: true },
];

export const TB_JE = [
  { je_number: "JE-2025-0001", je_date: "2025-01-18", status: "posted", memo: "Penerimaan pembayaran invoice INV001", created_by: "system", posted_by: "Ahmad Fauzi", posted_date: "2025-01-18", reference_type: "invoice", reference_id: "INV-C001-20250118", lines: [
    { account_code: "1-1100", account_name: "Kas & Bank", debit: 33000000, credit: 0, description: "Kas masuk dari pelanggan" },
    { account_code: "1-1200", account_name: "Piutang Usaha", debit: 0, credit: 33000000, description: "Pelunasan piutang usaha" },
  ] },
  { je_number: "JE-2025-0002", je_date: "2025-01-15", status: "posted", memo: "Pembelian peralatan dari PT Teknologi Prima", created_by: "system", posted_by: "Ahmad Fauzi", posted_date: "2025-01-15", reference_type: "bill", reference_id: "BILL-V001-20250115", lines: [
    { account_code: "6-1000", account_name: "Biaya Pokok Penjualan", debit: 75000000, credit: 0, description: "Pembelian persediaan/peralatan" },
    { account_code: "5-2200", account_name: "Beban PPN Masukan", debit: 7500000, credit: 0, description: "PPN masukan 10%" },
    { account_code: "2-1100", account_name: "Utang Usaha", debit: 0, credit: 82500000, description: "Utang ke PT Teknologi Prima" },
  ] },
  { je_number: "JE-2025-0003", je_date: "2025-01-20", status: "posted", memo: "Pembelian kendaraan dari CV Logistik Nusantara", created_by: "system", posted_by: "Ahmad Fauzi", posted_date: "2025-01-20", reference_type: "bill", reference_id: "BILL-V002-20250120", lines: [
    { account_code: "1-2100", account_name: "Peralatan Kantor", debit: 19200000, credit: 0, description: "Pembelian peralatan kantor" },
    { account_code: "5-2200", account_name: "Beban PPN Masukan", debit: 1920000, credit: 0, description: "PPN masukan 10%" },
    { account_code: "2-1100", account_name: "Utang Usaha", debit: 0, credit: 21120000, description: "Utang ke CV Logistik Nusantara" },
  ] },
  { je_number: "JE-2025-0004", je_date: "2025-02-08", status: "posted", memo: "Pembayaran jasa konsultan", created_by: "system", posted_by: "Siti Rahayu", posted_date: "2025-02-08", reference_type: "bill", reference_id: "BILL-V003-20250208", lines: [
    { account_code: "5-1070", account_name: "Biaya Konsultan & Profesional", debit: 12500000, credit: 0, description: "Jasa konsultan bisnis Q1" },
    { account_code: "5-2200", account_name: "Beban PPN Masukan", debit: 1250000, credit: 0, description: "PPN masukan 10%" },
    { account_code: "2-1100", account_name: "Utang Usaha", debit: 0, credit: 13750000, description: "Utang ke Konsultan Bisnis Indonesia" },
  ] },
  { je_number: "JE-2025-0005", je_date: "2025-01-25", status: "posted", memo: "Invoice penjualan INV002 ke CV Retail Sukses", created_by: "system", posted_by: "Ahmad Fauzi", posted_date: "2025-01-25", reference_type: "invoice", reference_id: "INV-C002-20250125", lines: [
    { account_code: "1-1200", account_name: "Piutang Usaha", debit: 9625000, credit: 0, description: "Piutang penjualan INV002" },
    { account_code: "4-1020", account_name: "Penjualan Produk - Divisi B", debit: 0, credit: 8750000, description: "Penjualan produk Divisi B" },
    { account_code: "2-1200", account_name: "Utang Pajak", debit: 0, credit: 875000, description: "PPN keluaran 10%" },
  ] },
  { je_number: "JE-2025-0006", je_date: "2025-02-10", status: "posted", memo: "Invoice penjualan INV003 ke PT Distribusi Handal", created_by: "system", posted_by: "Siti Rahayu", posted_date: "2025-02-10", reference_type: "invoice", reference_id: "INV-C003-20250210", lines: [
    { account_code: "1-1200", account_name: "Piutang Usaha", debit: 24200000, credit: 0, description: "Piutang penjualan INV003" },
    { account_code: "4-1010", account_name: "Penjualan Produk - Divisi A", debit: 0, credit: 22000000, description: "Penjualan produk Divisi A" },
    { account_code: "2-1200", account_name: "Utang Pajak", debit: 0, credit: 2200000, description: "PPN keluaran 10%" },
  ] },
  { je_number: "JE-2025-0007", je_date: "2025-02-20", status: "posted", memo: "Invoice penjualan INV004 ke Hypermarket Sentosa", created_by: "system", posted_by: "Siti Rahayu", posted_date: "2025-02-20", reference_type: "invoice", reference_id: "INV-C004-20250220", lines: [
    { account_code: "1-1200", account_name: "Piutang Usaha", debit: 18562500, credit: 0, description: "Piutang penjualan INV004" },
    { account_code: "4-1020", account_name: "Penjualan Produk - Divisi B", debit: 0, credit: 16875000, description: "Penjualan produk Divisi B" },
    { account_code: "2-1200", account_name: "Utang Pajak", debit: 0, credit: 1687500, description: "PPN keluaran 10%" },
  ] },
  { je_number: "JE-2025-0008", je_date: "2025-03-15", status: "posted", memo: "Pembelian bahan baku dari Koperasi Tani Maju", created_by: "system", posted_by: "Ahmad Fauzi", posted_date: "2025-03-15", reference_type: "bill", reference_id: "BILL-V004-20250315", lines: [
    { account_code: "6-1000", account_name: "Biaya Pokok Penjualan", debit: 12500000, credit: 0, description: "Pembelian bahan baku" },
    { account_code: "5-2200", account_name: "Beban PPN Masukan", debit: 1250000, credit: 0, description: "PPN masukan 10%" },
    { account_code: "2-1100", account_name: "Utang Usaha", debit: 0, credit: 13750000, description: "Utang ke Koperasi Tani Maju" },
  ] },
  { je_number: "JE-2025-0009", je_date: "2025-03-15", status: "posted", memo: "Biaya operasional Maret 2025", created_by: "system", posted_by: "Siti Rahayu", posted_date: "2025-03-15", reference_type: "journal", reference_id: "JE-2025-0009", lines: [
    { account_code: "5-1050", account_name: "Beban Listrik, Air & Utilitas", debit: 12500000, credit: 0, description: "Beban operasional Maret 2025" },
    { account_code: "2-1100", account_name: "Utang Usaha", debit: 0, credit: 12500000, description: "Akrual beban operasional" },
  ] },
  { je_number: "JE-2025-0010", je_date: "2025-03-15", status: "posted", memo: "Invoice penjualan INV005 ke Hypermarket Sentosa", created_by: "system", posted_by: "Ahmad Fauzi", posted_date: "2025-03-15", reference_type: "invoice", reference_id: "INV-C004-20250315", lines: [
    { account_code: "1-1200", account_name: "Piutang Usaha", debit: 48400000, credit: 0, description: "Piutang penjualan INV005" },
    { account_code: "4-1010", account_name: "Penjualan Produk - Divisi A", debit: 0, credit: 42000000, description: "Penjualan produk Divisi A" },
    { account_code: "2-1200", account_name: "Utang Pajak", debit: 0, credit: 4400000, description: "PPN keluaran 10%" },
    { account_code: "4-1030", account_name: "Penjualan Jasa Tambahan", debit: 0, credit: 2000000, description: "Jasa instalasi tambahan" },
  ] },
  { je_number: "JE-2025-0011", je_date: "2025-02-10", status: "posted", memo: "Pembayaran utang ke PT Teknologi Prima", created_by: "system", posted_by: "Ahmad Fauzi", posted_date: "2025-02-10", reference_type: "bill", reference_id: "BILL-V001-20250115", lines: [
    { account_code: "2-1100", account_name: "Utang Usaha", debit: 82500000, credit: 0, description: "Pelunasan utang BILL001" },
    { account_code: "1-1100", account_name: "Kas & Bank", debit: 0, credit: 82500000, description: "Kas keluar pembayaran vendor" },
  ] },
  { je_number: "JE-2025-0012", je_date: "2025-02-05", status: "posted", memo: "Pembayaran utang ke CV Logistik Nusantara", created_by: "system", posted_by: "Siti Rahayu", posted_date: "2025-02-05", reference_type: "bill", reference_id: "BILL-V002-20250120", lines: [
    { account_code: "2-1100", account_name: "Utang Usaha", debit: 21120000, credit: 0, description: "Pelunasan utang BILL002" },
    { account_code: "1-1100", account_name: "Kas & Bank", debit: 0, credit: 21120000, description: "Kas keluar pembayaran vendor" },
  ] },
  { je_number: "JE-2025-0013", je_date: "2025-02-16", status: "posted", memo: "Pembayaran jasa konsultan BILL003", created_by: "system", posted_by: "Ahmad Fauzi", posted_date: "2025-02-16", reference_type: "bill", reference_id: "BILL-V003-20250208", lines: [
    { account_code: "2-1100", account_name: "Utang Usaha", debit: 13750000, credit: 0, description: "Pelunasan utang konsultan" },
    { account_code: "1-1100", account_name: "Kas & Bank", debit: 0, credit: 13750000, description: "Kas keluar pembayaran konsultan" },
  ] },
  { je_number: "JE-2025-0014", je_date: "2025-04-10", status: "posted", memo: "Pembelian bahan baku dari CV Bahan Baku Lokal", created_by: "system", posted_by: "Siti Rahayu", posted_date: "2025-04-10", reference_type: "bill", reference_id: "BILL-V005-20250410", lines: [
    { account_code: "6-1000", account_name: "Biaya Pokok Penjualan", debit: 25000000, credit: 0, description: "Pembelian bahan baku April" },
    { account_code: "5-2200", account_name: "Beban PPN Masukan", debit: 2500000, credit: 0, description: "PPN masukan 10%" },
    { account_code: "2-1100", account_name: "Utang Usaha", debit: 0, credit: 27500000, description: "Utang ke CV Bahan Baku Lokal" },
  ] },
  { je_number: "JE-2025-0015", je_date: "2025-03-09", status: "posted", memo: "Penerimaan pembayaran INV002", created_by: "system", posted_by: "Ahmad Fauzi", posted_date: "2025-03-09", reference_type: "invoice", reference_id: "INV-C002-20250125", lines: [
    { account_code: "1-1100", account_name: "Kas & Bank", debit: 9625000, credit: 0, description: "Penerimaan pembayaran INV002" },
    { account_code: "1-1200", account_name: "Piutang Usaha", debit: 0, credit: 9625000, description: "Pelunasan piutang" },
  ] },
  { je_number: "JE-2025-0016", je_date: "2025-03-10", status: "posted", memo: "Penerimaan pembayaran INV003", created_by: "system", posted_by: "Siti Rahayu", posted_date: "2025-03-10", reference_type: "invoice", reference_id: "INV-C003-20250210", lines: [
    { account_code: "1-1100", account_name: "Kas & Bank", debit: 24200000, credit: 0, description: "Penerimaan pembayaran INV003" },
    { account_code: "1-1200", account_name: "Piutang Usaha", debit: 0, credit: 24200000, description: "Pelunasan piutang" },
  ] },
  { je_number: "JE-2025-0017", je_date: "2025-03-11", status: "posted", memo: "Penerimaan pembayaran INV004", created_by: "system", posted_by: "Ahmad Fauzi", posted_date: "2025-03-11", reference_type: "invoice", reference_id: "INV-C004-20250220", lines: [
    { account_code: "1-1100", account_name: "Kas & Bank", debit: 18562500, credit: 0, description: "Penerimaan pembayaran INV004" },
    { account_code: "1-1200", account_name: "Piutang Usaha", debit: 0, credit: 18562500, description: "Pelunasan piutang" },
  ] },
  { je_number: "JE-2025-0018", je_date: "2025-02-12", status: "posted", memo: "Biaya konsultasi lanjutan Q1", created_by: "system", posted_by: "Siti Rahayu", posted_date: "2025-02-12", reference_type: "invoice", reference_id: "INV-C001-20250118", lines: [
    { account_code: "5-1070", account_name: "Biaya Konsultan & Profesional", debit: 12500000, credit: 0, description: "Biaya konsultasi lanjutan Q1" },
    { account_code: "1-1100", account_name: "Kas & Bank", debit: 0, credit: 12500000, description: "Pelunasan" },
  ] },
];

// Opening balances (DR + DR = CR for balance):
// 1-1100 Kas & Bank 500M DR + 1-2100 Peralatan Kantor 50M DR = 3-1100 Modal Disetor 550M CR
export const TB_OPENING = {
  "1-1100": 500000000,
  "1-2100": 50000000,
  "3-1100": 550000000,
};
