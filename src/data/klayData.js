// Synthetic journal-entry generator for the Journal Entry list demo.
// Real curated JE data lives in seed/journalEntries.js; this file produces
// a larger volume of plausible-looking rows on demand.
import { getActiveAccounts } from "./seed/coa";

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
