// Display labels for enum-style fields. Kept separate from seed data so the
// data files stay machine-readable and labels can be swapped for i18n.
export const CAT_LABELS = {
  inventory: 'Inventory',
  service: 'Service',
  expense: 'Expense',
  cooperative: 'Koperasi',
  individual: 'Individu',
};

export const PPH_LABELS = {
  none: 'Tidak ada pemotongan',
  pph23_2: 'PPh 23 — 2% (jasa/sewa)',
  pph23_15: 'PPh 23 — 15% (dividen/bunga)',
  pph4_final: 'PPh 4(2) Final — konstruksi',
  pph21: 'PPh 21 — individu',
};

export const ACCT_LABELS = {
  '6-1000': '6-1000 · Biaya Pokok Penjualan',
  '5-1000': '5-1000 · Beban Operasional',
  '5-1070': '5-1070 · Biaya Konsultan',
  '1-2100': '1-2100 · Aset Tetap',
};

export const DEFTAX_LABELS = {
  ppn_masukan: 'PPN Masukan 11%',
  bebas: 'Bebas Pajak',
};
