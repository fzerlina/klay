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

// Vendor "default account" labels — should mirror leaf accounts in seed/coa.js.
// Kept here so the vendor dropdown stays a fixed shortlist; pages render
// arbitrary account labels via COA_BY_CODE lookup.
export const ACCT_LABELS = {
  '1-3100': '1-3100 · Raw Materials',
  '6-2300': '6-2300 · Office Rent',
  '6-2700': '6-2700 · Professional Services',
  '1-6300': '1-6300 · Office Equipment',
};

export const DEFTAX_LABELS = {
  ppn_masukan: 'PPN Masukan 11%',
  bebas: 'Bebas Pajak',
};
