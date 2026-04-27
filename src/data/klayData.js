export const KLAY_DIMS = [
  { key: "dept", label: "Department", cls: "dept", values: ["Finance", "Operations", "Sales", "Procurement", "HRD", "Technology", "Legal", "Executive"] },
  { key: "loc", label: "Location", cls: "loc", values: ["Jakarta", "Surabaya", "Bandung", "Medan", "Semarang"] },
  { key: "proj", label: "Project", cls: "proj", values: ["PRJ-Anggrek", "PRJ-Melati", "PRJ-Mawar", "PRJ-Dahlia", "PRJ-Kenanga", "—"] },
  { key: "chan", label: "Sales Channel", cls: "chan", values: ["Direct", "Distributor", "Online", "Retail", "—"] },
  { key: "cc", label: "Cost Centre", cls: "cc", values: ["CC-001", "CC-002", "CC-003", "CC-004", "CC-005", "—"] },
  { key: "pline", label: "Product Line", cls: "pline", values: ["Furniture", "Textile", "Packaging", "Electronics", "—"] },
  { key: "cseg", label: "Customer Segment", cls: "cseg", values: ["Enterprise", "SME", "Retail", "Government", "—"] },
  { key: "shift", label: "Production Shift", cls: "shift", values: ["Morning", "Afternoon", "Night", "—"] },
  { key: "ic", label: "Intercompany", cls: "ic", values: ["PT Induk", "PT Anak A", "PT Anak B", "—"] },
  { key: "taxreg", label: "Tax Region", cls: "taxreg", values: ["DKI Jakarta", "Jawa Timur", "Jawa Barat", "Jawa Tengah", "Sumatera Utara", "—"] },
];

export const KLAY_COA_TREE = [
  { id: "g-asset", type: "group", level: 0, label: "Assets" },
  { id: "g-cur-asset", type: "group", level: 1, parent: "g-asset", label: "Current Assets" },
  { id: "1-1000", code: "1-1000", name: "Cash & Equivalents", type: "Asset", fs: "BS", sec: "Current Asset", bal: "Debit", parent: "g-cur-asset", level: 2, active: true },
  { id: "1-1100", code: "1-1100", name: "Cash on Hand", type: "Asset", fs: "BS", sec: "Current Asset", bal: "Debit", parent: "1-1000", level: 3, active: true },
  { id: "1-1200", code: "1-1200", name: "Bank Accounts", type: "Asset", fs: "BS", sec: "Current Asset", bal: "Debit", parent: "1-1000", level: 3, active: true },
  { id: "1-1210", code: "1-1210", name: "Bank BCA — Operasional", type: "Asset", fs: "BS", sec: "Current Asset", bal: "Debit", parent: "1-1200", level: 4, active: true },
  { id: "1-2000", code: "1-2000", name: "Trade Receivables", type: "Asset", fs: "BS", sec: "Current Asset", bal: "Debit", parent: "g-cur-asset", level: 2, active: true },
  { id: "1-3000", code: "1-3000", name: "Inventories", type: "Asset", fs: "BS", sec: "Current Asset", bal: "Debit", parent: "g-cur-asset", level: 2, active: true },
  { id: "1-3300", code: "1-3300", name: "Finished Goods", type: "Asset", fs: "BS", sec: "Current Asset", bal: "Debit", parent: "1-3000", level: 3, active: true },
  { id: "1-4000", code: "1-4000", name: "Prepaid Expenses", type: "Asset", fs: "BS", sec: "Current Asset", bal: "Debit", parent: "g-cur-asset", level: 2, active: true },
  { id: "g-nca", type: "group", level: 1, parent: "g-asset", label: "Non-current Assets" },
  { id: "1-5000", code: "1-5000", name: "Property, Plant & Equipment", type: "Asset", fs: "BS", sec: "Non-current Asset", bal: "Debit", parent: "g-nca", level: 2, active: true },
  { id: "1-5300", code: "1-5300", name: "Machinery & Equipment", type: "Asset", fs: "BS", sec: "Non-current Asset", bal: "Debit", parent: "1-5000", level: 3, active: true },
  { id: "1-5900", code: "1-5900", name: "Accumulated Depreciation", type: "Asset", fs: "BS", sec: "Non-current Asset", bal: "Credit", parent: "1-5000", level: 3, active: true },
  { id: "1-6000", code: "1-6000", name: "Intangible Assets", type: "Asset", fs: "BS", sec: "Non-current Asset", bal: "Debit", parent: "g-nca", level: 2, active: true },
  { id: "1-9000", code: "1-9000", name: "Deferred Tax Asset", type: "Asset", fs: "BS", sec: "Non-current Asset", bal: "Debit", parent: "g-nca", level: 2, active: true },

  { id: "g-liab", type: "group", level: 0, label: "Liabilities" },
  { id: "g-cur-liab", type: "group", level: 1, parent: "g-liab", label: "Current Liabilities" },
  { id: "2-1000", code: "2-1000", name: "Trade Payables", type: "Liability", fs: "BS", sec: "Current Liability", bal: "Credit", parent: "g-cur-liab", level: 2, active: true },
  { id: "2-2000", code: "2-2000", name: "Tax Payables", type: "Liability", fs: "BS", sec: "Current Liability", bal: "Credit", parent: "g-cur-liab", level: 2, active: true },
  { id: "2-2100", code: "2-2100", name: "VAT Payable (PPN Keluaran)", type: "Liability", fs: "BS", sec: "Current Liability", bal: "Credit", parent: "2-2000", level: 3, active: true },
  { id: "2-3000", code: "2-3000", name: "Accrued Liabilities", type: "Liability", fs: "BS", sec: "Current Liability", bal: "Credit", parent: "g-cur-liab", level: 2, active: true },
  { id: "2-4000", code: "2-4000", name: "Deferred Revenue", type: "Liability", fs: "BS", sec: "Current Liability", bal: "Credit", parent: "g-cur-liab", level: 2, active: true },
  { id: "g-nc-liab", type: "group", level: 1, parent: "g-liab", label: "Non-current Liabilities" },
  { id: "2-6000", code: "2-6000", name: "Long-term Bank Loans", type: "Liability", fs: "BS", sec: "Non-current Liability", bal: "Credit", parent: "g-nc-liab", level: 2, active: true },
  { id: "2-8000", code: "2-8000", name: "Lease Liabilities (PSAK 73)", type: "Liability", fs: "BS", sec: "Non-current Liability", bal: "Credit", parent: "g-nc-liab", level: 2, active: true },

  { id: "g-equity", type: "group", level: 0, label: "Equity" },
  { id: "3-1000", code: "3-1000", name: "Paid-in Capital", type: "Equity", fs: "BS", sec: "Equity", bal: "Credit", parent: "g-equity", level: 1, active: true },
  { id: "3-2000", code: "3-2000", name: "Retained Earnings", type: "Equity", fs: "BS", sec: "Equity", bal: "Credit", parent: "g-equity", level: 1, active: true },
  { id: "9-1000", code: "9-1000", name: "Income Summary (Closing)", type: "Equity", fs: "BS", sec: "Equity", bal: "Credit", parent: "g-equity", level: 1, active: true },

  { id: "g-rev", type: "group", level: 0, label: "Revenue" },
  { id: "4-1000", code: "4-1000", name: "Operating Revenue", type: "Revenue", fs: "PL", sec: "Revenue", bal: "Credit", parent: "g-rev", level: 1, active: true },
  { id: "4-1100", code: "4-1100", name: "Product Sales — Furniture", type: "Revenue", fs: "PL", sec: "Revenue", bal: "Credit", parent: "4-1000", level: 2, active: true },
  { id: "4-1200", code: "4-1200", name: "Product Sales — Textile", type: "Revenue", fs: "PL", sec: "Revenue", bal: "Credit", parent: "4-1000", level: 2, active: true },
  { id: "4-1300", code: "4-1300", name: "Product Sales — Packaging", type: "Revenue", fs: "PL", sec: "Revenue", bal: "Credit", parent: "4-1000", level: 2, active: true },
  { id: "4-2000", code: "4-2000", name: "Other Income", type: "Revenue", fs: "PL", sec: "Revenue", bal: "Credit", parent: "g-rev", level: 1, active: true },

  { id: "g-cogs", type: "group", level: 0, label: "Cost of Goods Sold" },
  { id: "5-1000", code: "5-1000", name: "Direct Materials", type: "Expense", fs: "PL", sec: "COGS", bal: "Debit", parent: "g-cogs", level: 1, active: true },
  { id: "5-2000", code: "5-2000", name: "Direct Labour", type: "Expense", fs: "PL", sec: "COGS", bal: "Debit", parent: "g-cogs", level: 1, active: true },
  { id: "5-3000", code: "5-3000", name: "Manufacturing Overhead", type: "Expense", fs: "PL", sec: "COGS", bal: "Debit", parent: "g-cogs", level: 1, active: true },

  { id: "g-opex", type: "group", level: 0, label: "Operating Expenses" },
  { id: "g-sell", type: "group", level: 1, parent: "g-opex", label: "Selling Expenses" },
  { id: "6-1000", code: "6-1000", name: "Sales Staff Salaries", type: "Expense", fs: "PL", sec: "OpEx", bal: "Debit", parent: "g-sell", level: 2, active: true },
  { id: "6-1200", code: "6-1200", name: "Advertising & Promotion", type: "Expense", fs: "PL", sec: "OpEx", bal: "Debit", parent: "g-sell", level: 2, active: true },
  { id: "g-ga", type: "group", level: 1, parent: "g-opex", label: "General & Administrative" },
  { id: "6-2000", code: "6-2000", name: "Management Salaries", type: "Expense", fs: "PL", sec: "OpEx", bal: "Debit", parent: "g-ga", level: 2, active: true },
  { id: "6-2100", code: "6-2100", name: "Staff Salaries — Admin", type: "Expense", fs: "PL", sec: "OpEx", bal: "Debit", parent: "g-ga", level: 2, active: true },
  { id: "6-3000", code: "6-3000", name: "Office Rent", type: "Expense", fs: "PL", sec: "OpEx", bal: "Debit", parent: "g-ga", level: 2, active: true },
  { id: "6-4500", code: "6-4500", name: "Software Subscriptions (SaaS)", type: "Expense", fs: "PL", sec: "OpEx", bal: "Debit", parent: "g-ga", level: 2, active: true },
  { id: "6-9000", code: "6-9000", name: "Bank Charges & Fees", type: "Expense", fs: "PL", sec: "OpEx", bal: "Debit", parent: "g-ga", level: 2, active: true },

  { id: "g-other-exp", type: "group", level: 0, label: "Other Expenses" },
  { id: "7-1000", code: "7-1000", name: "Interest Expense", type: "Expense", fs: "PL", sec: "Other", bal: "Debit", parent: "g-other-exp", level: 1, active: true },
  { id: "7-2000", code: "7-2000", name: "Forex Loss", type: "Expense", fs: "PL", sec: "Other", bal: "Debit", parent: "g-other-exp", level: 1, active: true },
  { id: "g-tax-exp", type: "group", level: 0, label: "Income Tax" },
  { id: "8-1000", code: "8-1000", name: "Current Income Tax", type: "Expense", fs: "PL", sec: "Other", bal: "Debit", parent: "g-tax-exp", level: 1, active: true },
];

export function getAccountRows() {
  return KLAY_COA_TREE.filter((node) => Boolean(node.code));
}

export function getAccountGroups() {
  return KLAY_COA_TREE.filter((node) => node.type === "group");
}

export function getActiveAccounts() {
  return KLAY_COA_TREE.filter((node) => Boolean(node.code) && node.active !== false);
}

// ~65% Posted, 20% Draft, 10% Pending, 5% Void
const statusCycle = [
  "Posted","Posted","Posted","Posted","Posted","Posted","Posted","Posted","Posted","Posted",
  "Posted","Posted","Posted","Draft","Draft","Draft","Draft","Pending","Pending","Void",
];
const memoCycle = [
  "Accrual adjustment",
  "Monthly depreciation",
  "Payroll posting",
  "Inventory reclass",
  "Revenue recognition",
  "Tax provision",
];

function formatDateFromOffset(daysOffset) {
  const base = new Date("2025-04-30T00:00:00");
  base.setDate(base.getDate() - daysOffset);
  return base.toISOString().slice(0, 10);
}

function formatIdr(amount) {
  return new Intl.NumberFormat("en-US").format(amount);
}

export function generateJournalEntries(count = 320) {
  const active = getActiveAccounts();
  return Array.from({ length: count }, (_, index) => {
    const debitAccount = active[index % active.length];
    const creditAccount = active[(index + 7) % active.length];
    const amount = 1500000 + ((index * 735000) % 250000000);
    return {
      date: formatDateFromOffset(index % 120),
      reference: `JE-2025-${String(index + 1).padStart(3, "0")}`,
      memo: `${memoCycle[index % memoCycle.length]} · ${debitAccount.name} / ${creditAccount.name}`,
      lines: 2 + (index % 7),
      debit: formatIdr(amount),
      credit: formatIdr(amount),
      status: statusCycle[index % statusCycle.length],
    };
  });
}
