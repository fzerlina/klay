// AP Aging derivation layer.
//
// AP Aging reads from ap_invoices + vendors but needs fields the existing
// (auto-generated) seed doesn't carry: discount terms with confidence, vendor
// relationship_tier, on_hold, aging buckets, recon-badge state, and a set of
// synthesized ACCRUAL_POSTED records (the prototype's bill seed doesn't yet
// carry accruals — they're owned by AP Close Command Center in production).
// In production all of this would live on `ap_invoices`, `vendors`, and the
// pre-computed `ap_aging_snapshots` table. For the prototype we derive it on
// the client from existing seed plus deterministic per-id hashes so the demo
// is stable across reloads.

import { BILLS } from "../data/seed/bills";
import { VENDORS } from "../data/seed/vendors";
import { TODAY, daysSince, parseDate } from "./clock";
import { workflowStatus } from "./billStatus";

// ── Deterministic per-id hash ──────────────────────────────────────────────
// Same id → same value. Used to assign discount terms, relationship_tier, and
// on_hold without writing it into the seed. Mulberry32 over a string hash.
function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Constants from PRD ─────────────────────────────────────────────────────
// CONFIDENCE_THRESHOLD_PAYMENT_TERMS_MIN — gates the discount pill (TP-03).
// Below this, no countdown is rendered. Per the PRD: "the system does not
// commit to a financial countdown on data it isn't confident about."
export const CONFIDENCE_THRESHOLD_PAYMENT_TERMS_MIN = 0.70;

// Age buckets — Current / 1–30 / 31–60 / 61–90 / 91–120 / >120
export const AGE_BUCKETS = [
  { key: "current",   lbl: "Current",    min: -Infinity, max: 0,        tone: "neutral" },
  { key: "b1_30",     lbl: "1–30",       min: 1,         max: 30,       tone: "warn"    },
  { key: "b31_60",    lbl: "31–60",      min: 31,        max: 60,       tone: "warn"    },
  { key: "b61_90",    lbl: "61–90",      min: 61,        max: 90,       tone: "warn"    },
  { key: "b91_120",   lbl: "91–120",     min: 91,        max: 120,      tone: "danger"  },
  { key: "b_gt120",   lbl: ">120",       min: 121,       max: Infinity, tone: "danger"  },
];

export function ageBucketOf(daysOverdue) {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "b1_30";
  if (daysOverdue <= 60) return "b31_60";
  if (daysOverdue <= 90) return "b61_90";
  if (daysOverdue <= 120) return "b91_120";
  return "b_gt120";
}

// ── Relationship tier — Strategic / Standard / At-Risk ─────────────────────
// Deterministic per vendor. Anchors (V001–V010) curated to make the demo
// readable; the rest is seeded by id-hash so the same id gets the same tier.
const TIER_OVERRIDES = {
  V001: "strategic", // Supplier Elektronik — recurring high-value
  V003: "strategic", // Jasa Logistik — monthly service contract
  V005: "at_risk",   // Koperasi Tani — slow-paying, history of disputes
  V008: "strategic", // Teksol Digital — software maintenance
  V010: "strategic", // Asuransi Mitra Utama — annual cover
  V012: "at_risk",   // Koperasi Jaya Niaga — inactive, disputes
  V020: "at_risk",   // PT Agung Elektronik — large overdue concentration
};
export function relationshipTier(vendorId) {
  if (TIER_OVERRIDES[vendorId]) return TIER_OVERRIDES[vendorId];
  // Roughly 15% strategic, 15% at-risk, 70% standard
  const r = rng(strHash("tier:" + vendorId))();
  if (r < 0.15) return "strategic";
  if (r < 0.30) return "at_risk";
  return "standard";
}

// ── Discount terms — derived per-vendor, persistent at the bill level ──────
// PRD three-tier source hierarchy (invoice override / AI extracted / vendor
// default). Prototype simplification: per-vendor default, with confidence
// drawn deterministically per vendor. Service vendors (pph=pph23_2) are most
// likely to offer early-payment discounts in Indonesian SMB context.
function vendorDiscountTerms(v) {
  if (!v) return null;
  const r = rng(strHash("disc:" + v.id));
  const offerProb = v.pph === "pph23_2" ? 0.55 : v.category === "service" ? 0.45 : 0.25;
  if (r() > offerProb) return null;

  // Most common terms in Indonesian SMB B2B: 2/10 net 30, 1/10 net 30, 2/15 net 45
  const pick = r();
  const terms = pick < 0.45 ? { pct: 2.0, days: 10 } :
                pick < 0.75 ? { pct: 1.0, days: 10 } :
                pick < 0.90 ? { pct: 2.0, days: 15 } :
                              { pct: 1.5, days: 14 };

  // Confidence: vendors with PKP status confirmed lean higher
  const baseConf = v.pkp === "PKP" ? 0.78 : 0.62;
  const conf = Math.min(0.97, Math.max(0.45, baseConf + (r() - 0.5) * 0.30));

  return {
    discount_pct: terms.pct,
    discount_days: terms.days,
    payment_terms_confidence: Number(conf.toFixed(2)),
    payment_terms_source: r() < 0.70 ? "vendor_default" : "extracted",
  };
}

// Parse "NET 30" / "NET 7" / "NET 60" → integer net days. Falls back to 30.
function parseNetDays(s) {
  if (!s) return 30;
  const m = /NET\s+(\d+)/i.exec(s);
  return m ? parseInt(m[1], 10) : 30;
}

// ── On-hold — small deterministic subset, FM-set ───────────────────────────
const ON_HOLD_OVERRIDES = {
  BILL048: { reason: "Awaiting credit note — qty short-delivered", since: "2025-04-12", by: "Budi Santoso" },
  BILL019: { reason: "Vendor dispute on rate card",                since: "2025-04-08", by: "Sarah Wijaya"  },
  BILL040: { reason: "Pending bank account verification",          since: "2025-04-15", by: "Budi Santoso" },
};
export function onHoldFor(billId) {
  return ON_HOLD_OVERRIDES[billId] || null;
}

// ── Synthetic accruals (ACCRUAL_POSTED) ────────────────────────────────────
// The prototype seed doesn't carry accrual records yet — those are owned by
// the AP Close Command Center. We synthesize a handful so the Aging Table can
// render the [ACCRUAL] tag in the Current bucket and the KPI bar's "Accrued
// Liabilities" tile reflects something real.
const ACCRUAL_SEED = [
  { vendor: "V003", amount: 13800000, expense: "6-3100", desc: "Jasa pengiriman April 2025 — bulanan" },
  { vendor: "V008", amount: 18500000, expense: "6-2700", desc: "IT support maintenance April 2025" },
  { vendor: "V010", amount: 46200000, expense: "6-2300", desc: "Asuransi aset operasional April 2025" },
  { vendor: "V004", amount: 22000000, expense: "6-2700", desc: "Audit internal — fase 2" },
];

function buildAccrualRecords() {
  return ACCRUAL_SEED.map((a, i) => {
    const v = VENDORS.find((x) => x.id === a.vendor);
    const idNum = String(i + 1).padStart(3, "0");
    return {
      id: "ACR" + idNum,
      vendor: a.vendor,
      vendorName: v?.name || a.vendor,
      initials: v?.initials || "?",
      poNo: "—",
      invNo: "—",
      date: "2025-04-30",         // posted at period-end
      due: "2025-04-30",          // accruals have no real due date
      grn: "—",
      dpp: a.amount,
      ppn: 0,                     // PPN excluded from accrual entries per PRD
      pph23: v?.pph === "pph23_2" ? Math.round(a.amount * 0.02) : 0,
      total: a.amount,
      sisa: a.amount,
      approval: "approved",
      pay: "unpaid",
      isAI: true,
      keterangan: a.desc,
      source: "ACCRUAL",          // PRD source enum value
      workflow_status: "ACCRUAL_POSTED",
      accrual_reversal_date: "2025-05-01",
      items: [{ desc: a.desc, qty: 1, price: a.amount, subtotal: a.amount, acct: a.expense, acctName: "Accrued — " + a.desc.slice(0, 30) }],
      audit: [{ type: "created", action: "Accrual posted by Klay AI", by: "Klay AI", date: "2025-04-30", time: "23:05" }],
    };
  });
}

// ── Aging line — one row per outstanding bill ─────────────────────────────
// Joins bill + vendor + derived fields. The Decision Queue and Aging Table
// both consume this. Filter at the view layer.
export function buildAgingLines(asOfDate) {
  const accruals = buildAccrualRecords();
  const allBills = [...BILLS, ...accruals];

  return allBills.map((b) => {
    const v = VENDORS.find((x) => x.id === b.vendor) || null;
    const tier = relationshipTier(b.vendor);
    const ws = b.workflow_status || workflowStatus(b);  // accruals carry it explicitly
    const isAccrual = ws === "ACCRUAL_POSTED" || b.source === "ACCRUAL" || b.source === "MIGRATION_ACCRUAL";

    // Discount terms — pulled from per-vendor default. Skip for accruals (no
    // discount window on unbilled liabilities).
    const terms = !isAccrual ? vendorDiscountTerms(v) : null;
    const invoiceDate = parseDate(b.date);
    const discountExpiresAt = terms && invoiceDate
      ? new Date(invoiceDate.getTime() + terms.discount_days * 86400000)
      : null;
    const discountAmountIdr = terms ? Math.round(b.total * (terms.discount_pct / 100)) : 0;
    const daysToDiscount = discountExpiresAt
      ? Math.ceil((discountExpiresAt - TODAY) / 86400000)
      : null;

    // Aging
    const daysOverdue = isAccrual ? 0 : daysSince(b.due);  // accruals never age
    const ageBucket  = isAccrual ? "current" : ageBucketOf(daysOverdue);
    const ageDays    = isAccrual ? 0 : Math.max(0, daysSince(b.date));

    // Hold state — set by FM via Bill Detail Hold action in production
    const hold = onHoldFor(b.id);

    // Net days — from vendor's payment_terms string (fallback 30)
    const netDays = parseNetDays(v?.payment_terms);

    return {
      // identity
      id: b.id,
      vendorId: b.vendor,
      vendorName: b.vendorName,
      vendorInitials: b.initials,
      vendorCode: v?.code || "",
      relationship_tier: tier,
      invNo: b.invNo === "—" || !b.invNo ? b.id : b.invNo,
      invoiceDate: b.date,
      dueDate: b.due,

      // state
      workflow_status: ws,
      payment_status: b.pay,
      is_accrual: isAccrual,
      on_hold: !!hold,
      hold_reason: hold?.reason || null,
      hold_since: hold?.since || null,
      hold_by: hold?.by || null,

      // money (IDR)
      total: b.total,
      remaining: b.sisa,
      pph23: b.pph23 || 0,

      // aging
      daysOverdue,
      ageBucket,
      ageDays,

      // discount terms
      has_terms: !!terms,
      discount_pct: terms?.discount_pct || null,
      discount_days: terms?.discount_days || null,
      net_days: netDays,
      payment_terms_confidence: terms?.payment_terms_confidence || null,
      payment_terms_source: terms?.payment_terms_source || (terms ? "vendor_default" : null),
      discount_expires_at: discountExpiresAt,
      discount_amount_idr: discountAmountIdr,
      days_to_discount: daysToDiscount,
      discount_captured: false,

      // raw fallback
      raw: b,
      vendorRaw: v,
    };
  });
}

// ── Discount pill state — drives TP-03 rendering ──────────────────────────
// Per PRD: pill only renders when payment_terms_confidence ≥ threshold AND
// the discount window hasn't expired. States: green (>5d) / amber (3–5d) /
// red (today or tomorrow) / muted (expired, not captured) / captured.
export function discountPillState(line) {
  if (!line.has_terms) return null;
  if (line.discount_captured) return { tone: "captured", text: "Captured", days: null };
  const conf = line.payment_terms_confidence ?? 0;
  if (conf < CONFIDENCE_THRESHOLD_PAYMENT_TERMS_MIN) return null;  // PRD gate
  const d = line.days_to_discount;
  if (d == null) return null;
  if (d < 0) return { tone: "muted", text: "Expired", days: d };
  if (d <= 1) return { tone: "danger", text: d === 0 ? "Expires today" : "1 day left",  days: d };
  if (d <= 5) return { tone: "warn",   text: `${d} days left`, days: d };
  return         { tone: "ok",         text: `${d} days left`, days: d };
}

// ── Decision Queue filter ─────────────────────────────────────────────────
// PRD baseline: workflow_status IN (PENDING_REVIEW, APPROVED, RETURNED). We
// also include POSTED: this is a payment-intelligence surface, and a posted-
// but-unpaid bill is a live payment decision (discount window / overdue) — so
// it belongs in the queue. Accruals never enter (managed in AP Close).
export function isDecisionQueueRow(line) {
  if (line.is_accrual) return false;
  if (line.on_hold) return false;
  if (line.remaining <= 0) return false;
  return ["PENDING_REVIEW", "APPROVED", "RETURNED", "POSTED"].includes(line.workflow_status);
}

// ── Aging Table filter ────────────────────────────────────────────────────
// POSTED liabilities only (+ posted accruals, tagged separately). The aging
// table is the financial report that reconciles to the GL AP Control account
// (Gate 3a), so its grand total must equal the posted-only "AP Outstanding"
// KPI — pre-posting bills (PENDING_REVIEW / RETURNED / APPROVED) are NOT
// liabilities yet and are excluded here. They still surface for chasing in the
// Decision Queue (isDecisionQueueRow), which is a work-list, not a GL total.
export function isAgingTableRow(line) {
  if (line.remaining <= 0) return false;
  return line.workflow_status === "POSTED" || line.is_accrual;
}

// ── Urgency for Decision Queue ────────────────────────────────────────────
// PRD ordering:
//   (1) discount expires today/tomorrow
//   (2) discount expires in 3–5 days
//   (3) overdue > 90
//   (4) overdue 61–90
//   (5) overdue 31–60
//   (6) overdue 1–30
//   (7) current with discount
//   (8) current no discount
// Returns a tier (lower = more urgent). Within a tier, more-overdue / larger
// amounts surface first.
export function decisionQueueTier(line) {
  const pill = discountPillState(line);
  if (pill?.tone === "danger") return 1;  // expires today / 1 day left
  if (pill?.tone === "warn")   return 2;  // 3–5 days
  const d = line.daysOverdue;
  if (d > 90) return 3;
  if (d > 60) return 4;
  if (d > 30) return 5;
  if (d > 0)  return 6;
  if (pill)   return 7;                    // current with discount
  return 8;                                // current no discount
}

export function decisionQueueSort(a, b) {
  const ta = decisionQueueTier(a);
  const tb = decisionQueueTier(b);
  if (ta !== tb) return ta - tb;
  // Within a tier: discount-tier rows rank by days-to-discount asc;
  // overdue rows by days-overdue desc; current rows by amount desc.
  if (ta <= 2) return (a.days_to_discount ?? 99) - (b.days_to_discount ?? 99);
  if (ta <= 6) return b.daysOverdue - a.daysOverdue;
  return b.remaining - a.remaining;
}

// ── KPI snapshot — feeds the 5-tile command bar + recon badge ─────────────
// In production this comes from `ap_aging_snapshots` (per the PRD's pre-
// computed snapshot architecture). Here it's computed live since the dataset
// is small.
export function buildSnapshot(lines, asOfDate = TODAY) {
  let apOutstanding = 0;
  let accruedLiabilities = 0;
  let dueIn7Days = 0;
  let discountsThisWeekIdr = 0;
  let discountsTodayIdr = 0;
  let totalSinceJan = 0;
  let paidSinceJan = 0;

  const bucketTotals = {
    current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b91_120: 0, b_gt120: 0,
  };

  for (const l of lines) {
    if (l.is_accrual) {
      accruedLiabilities += l.remaining;
      bucketTotals.current += 0;  // accruals do NOT contribute to per-bucket total per PRD
      continue;
    }
    // KPI / reconciliation scope = POSTED liabilities only (Gate 3a). Pre-
    // posting bills (PENDING_REVIEW / RETURNED / APPROVED) are subledger-only
    // and excluded from the GL-reconciled total by design — they still SHOW in
    // the Decision Queue / Aging Table, they just don't count toward this number.
    if (l.workflow_status !== "POSTED") continue;
    if (l.remaining <= 0) continue;

    apOutstanding += l.remaining;
    bucketTotals[l.ageBucket] += l.remaining;

    // Due in next 7 days — based on due date, regardless of overdue state
    const dueDays = -daysSince(l.dueDate);  // positive = future
    if (dueDays >= 0 && dueDays <= 7) dueIn7Days += l.remaining;

    // Discount aggregates — PRD: discounts expiring within 7d, gated by conf
    const pill = discountPillState(l);
    if (pill && pill.tone !== "muted" && pill.tone !== "captured") {
      if (pill.days != null && pill.days >= 0 && pill.days <= 7) {
        discountsThisWeekIdr += l.discount_amount_idr;
      }
      if (pill.days != null && pill.days <= 1) {
        discountsTodayIdr += l.discount_amount_idr;
      }
    }
  }

  // DPO — simple approximation: avg age across open invoices weighted by
  // remaining. Real formula needs purchases base; this is a reasonable proxy.
  let weightedAge = 0;
  let weightTotal = 0;
  for (const l of lines) {
    if (l.is_accrual || l.workflow_status !== "POSTED" || l.remaining <= 0) continue;
    weightedAge += l.ageDays * l.remaining;
    weightTotal += l.remaining;
  }
  const dpoDays = weightTotal > 0 ? Math.round(weightedAge / weightTotal) : 0;

  return {
    asOfDate,
    apOutstanding,
    accruedLiabilities,
    dpoDays,
    dueIn7Days,
    discountsThisWeekIdr,
    discountsTodayIdr,
    bucketTotals,
    reconciliation: {
      // Gate 3a / 3b per PRD — both deltas Rp 0 = green. In production this
      // comes from the latest reconciliation_log entry.
      gate_3a_delta: 0,
      gate_3b_delta: 0,
      verified_hours_ago: 2,
      status: "ok",   // ok | mismatch | unavailable
    },
  };
}

// ── Vendor-pivot — for the Aging Table view ────────────────────────────────
// Groups lines by vendor. Each vendor row carries bucket totals and an
// expandable list of underlying invoices.
export function buildVendorPivot(lines) {
  const byVendor = new Map();
  for (const l of lines) {
    if (l.workflow_status === "DRAFT") continue;
    if (l.remaining <= 0) continue;
    if (!byVendor.has(l.vendorId)) {
      byVendor.set(l.vendorId, {
        vendorId: l.vendorId,
        vendorName: l.vendorName,
        vendorCode: l.vendorCode,
        initials: l.vendorInitials,
        relationship_tier: l.relationship_tier,
        buckets: { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b91_120: 0, b_gt120: 0 },
        accrual: 0,
        total: 0,                // sum across non-accrual buckets
        invoices: [],
      });
    }
    const row = byVendor.get(l.vendorId);
    if (l.is_accrual) {
      row.accrual += l.remaining;
    } else {
      row.buckets[l.ageBucket] += l.remaining;
      row.total += l.remaining;
    }
    row.invoices.push(l);
  }
  // Sort vendors by total outstanding desc (largest exposure first)
  return Array.from(byVendor.values()).sort((a, b) => b.total - a.total);
}

// ── Display helpers ────────────────────────────────────────────────────────
export const RELATIONSHIP_LABEL = {
  strategic: "Strategic",
  standard:  "Standard",
  at_risk:   "At-Risk",
};
