// Deterministic derivation of the extended Bill Detail fields. Shared by the
// master-data generator (so newly generated bills carry the fields) and the
// one-off migration that backfills the existing seed records. Pure functions
// of the bill + its vendor — no RNG — so the seed stays stable across runs.

function offsetDays(isoDate, days) {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// The demo's "today". Tax for a masa pajak is filed the following month, so a
// reporting period earlier than the current month reads as already reported.
const CURRENT_PERIOD = "2025-04";

export function deriveBillDetailFields(b, vendor, idx) {
  const dpp = b.dpp || 0;
  const isPkp = vendor?.pkp === "PKP";

  // Rates back-derived from the seeded amounts so existing PPN/PPh totals stay
  // consistent; fall back to the standard rates when an amount is absent.
  const ppnRate = dpp > 0 && b.ppn ? Math.round((b.ppn / dpp) * 10000) / 10000 : (isPkp ? 0.11 : 0);
  const pphRate = dpp > 0 && b.pph23 ? Math.round((b.pph23 / dpp) * 10000) / 10000 : 0;

  const num = idx != null ? idx : (parseInt(String(b.id).replace(/\D/g, ""), 10) || 0);
  const pad = String(num).padStart(3, "0");

  const hasGrnDoc = b.grn === "matched" || b.grn === "mismatch";
  const recurring = ["NET 30", "NET 45", "NET 60"].includes(vendor?.payment_terms);
  const hasContract = recurring || /kontrak/i.test(b.keterangan || "");
  const paid = b.pay === "paid";
  const period = b.date ? b.date.slice(0, 7) : "";

  return {
    ppnRate,
    pphRate,
    discountDueDate: b.date ? offsetDays(b.date, 10) : "",
    grnNo: hasGrnDoc ? `GRN-${pad}` : "",
    contractNo: hasContract ? `KTR-${(vendor?.code || "V-000").replace("V-", "V")}-2025` : "",
    fakturNo: isPkp ? `010.000-25.${String(20000000 + num).slice(-8)}` : "",
    bankReconStatus: paid ? (num % 4 === 0 ? "unreconciled" : "reconciled") : "",
    paymentDate: paid && b.due ? offsetDays(b.due, -3) : "",
    paymentTime: paid ? "14:30" : "",
    taxReportingPeriod: b.ppn > 0 ? period : "",
    taxReportingStatus: b.ppn > 0 ? (period < CURRENT_PERIOD ? "reported" : "pending") : "not-applicable",
  };
}
