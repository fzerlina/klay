// Re-date the generated bills for AP-aging realism. Run via:
//
//     node scripts/regenerate-bills.mjs
//
// WHY: the master-data generator spreads bill dates uniformly across Jan–Apr
// 2025 and never lets an old past-due bill be "paid", so at the demo's "today"
// (2025-04-23) most of the ledger reads as overdue — unrealistic. This pass
// rewrites ONLY src/data/seed/bills.js:
//   - keeps BILL001..008 (the hand-curated JE anchors) untouched
//   - keeps every other bill's vendor / amounts / line items as-is
//   - re-rolls each bill's date toward recent months (April-heavy), recomputes
//     due from the vendor's terms, and assigns an age-aware status so older
//     bills are mostly settled and only a realistic minority stay overdue
//   - re-derives every date-dependent field (due, invNo, discount/payment/tax,
//     audit) from the new date
//
// Deterministic per bill id, so re-runs are stable. Does NOT touch vendors,
// customers, invoices, or journal entries. Re-run this after any full
// `node scripts/generate-master-data.mjs` to re-apply the date realism.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VENDORS } from "../src/data/seed/vendors.js";
import { BILLS } from "../src/data/seed/bills.js";
import { deriveBillDetailFields } from "./bill-detail-fields.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const TODAY = "2025-04-23";
const CLOSED_THROUGH = "2025-02";             // periods ≤ this are locked (AP_CLOSED_THROUGH)
const ANCHOR_COUNT = 8;                       // BILL001..008 stay as curated
// Bills referenced elsewhere as on-hold (src/lib/apAging.js) must stay
// outstanding so the hold showcase still renders.
const KEEP_OUTSTANDING = new Set(["BILL019", "BILL040", "BILL048"]);

// ── Deterministic per-id PRNG (mulberry32 over a string hash) ──────────────
function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Date helpers ───────────────────────────────────────────────────────────
function offsetDays(isoDate, days) {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetween(fromIso, toIso) {           // (TODAY - due): positive = overdue
  return Math.floor((new Date(fromIso + "T00:00:00") - new Date(toIso + "T00:00:00")) / 86400000);
}
function parseNetDays(terms) {
  const m = /NET\s+(\d+)/i.exec(terms || "");
  return m ? parseInt(m[1], 10) : 30;
}

// Recent-weighted invoice date. The bulk lands in April (current month), with a
// thinning tail back through Q1 so the aging buckets fall off realistically.
//   April ≈ 52%  ·  March ≈ 28%  ·  Feb ≈ 14%  ·  Jan ≈ 6%
function pickRecentDate(r) {
  const x = r();
  let month, dmin, dmax;
  if (x < 0.52)      { month = "04"; dmin = 1;  dmax = 23; }
  else if (x < 0.80) { month = "03"; dmin = 1;  dmax = 31; }
  else if (x < 0.94) { month = "02"; dmin = 1;  dmax = 28; }
  else               { month = "01"; dmin = 6;  dmax = 31; }
  const day = Math.floor(r() * (dmax - dmin + 1)) + dmin;
  return `2025-${month}-${String(day).padStart(2, "0")}`;
}

// Age-aware payment status. The older a bill's due date, the more likely it has
// already been settled — so the outstanding pool skews current/recent.
function paidProbability(dueDays) {
  if (dueDays <= 0)  return 0.18;   // not yet due — usually still open
  if (dueDays <= 30) return 0.42;
  if (dueDays <= 60) return 0.68;
  if (dueDays <= 90) return 0.85;
  return 0.93;                       // 90+ days past due — almost always cleared
}

// A small, deterministic slice of bills are chronic-overdue — the disputed /
// at-risk-vendor invoices that populate the 91–120 and >120 buckets. Decided
// from an independent id-hash so toggling it never shifts other bills' dates.
// ~5% of generated bills, plus any non-draft bill from an at-risk vendor.
const AT_RISK_VENDORS = new Set(["V005", "V012", "V020"]);
function isChronic(b, vendor) {
  if (b.approval === "draft") return false;
  if (AT_RISK_VENDORS.has(b.vendor) && makeRng(strHash("chronic:" + b.id))() < 0.35) return true;
  return makeRng(strHash("chronic:" + b.id))() < 0.03;
}

// ── Re-date a single generated bill in place ───────────────────────────────
function redateBill(b, idxNum) {
  const vendor = VENDORS.find((v) => v.id === b.vendor) || null;
  const r = makeRng(strHash(b.id));

  const isDraft = b.approval === "draft";
  const isAI = !!b.isAI;
  const chronic = isChronic(b, vendor);

  // Chronic bills target a specific overdue depth (91–170 days) so they spread
  // across the 91–120 and >120 buckets; back the date out from due − terms.
  const terms = parseNetDays(vendor?.payment_terms);
  const date = chronic
    ? offsetDays(TODAY, -(91 + Math.floor(r() * 80) + terms))
    : pickRecentDate(r);
  const due = offsetDays(date, terms);
  const dueDays = daysBetween(TODAY, due);

  // Status
  let approval, pay;
  if (isDraft) {
    approval = "draft"; pay = "unpaid";
  } else if (chronic || KEEP_OUTSTANDING.has(b.id)) {
    approval = "approved"; pay = dueDays > 0 ? "overdue" : "unpaid";
  } else if (dueDays <= 0 && r() < 0.15) {
    approval = "review"; pay = "unpaid";
  } else {
    approval = "approved";
    pay = r() < paidProbability(dueDays) ? "paid" : (dueDays > 0 ? "overdue" : "unpaid");
  }
  const sisa = pay === "paid" ? 0 : b.total;

  // invNo embeds the date for non-draft bills — keep it consistent.
  const invNo = isDraft || b.invNo === "—"
    ? b.invNo
    : `INV-${(vendor?.code || "V-000").replace("V-", "V")}-${date.replace(/-/g, "")}`;

  // Build the head the detail-field deriver expects, then merge the derived
  // date-dependent fields back over the original record (preserves key order).
  const head = { ...b, date, due, invNo, approval, pay, sisa };
  const derived = deriveBillDetailFields(head, vendor, idxNum);

  // Posting model. In reality a bill is posted promptly — when its period is
  // still open — and "overdue" means UNPAID, not un-posted. So MOST outstanding
  // bills are POSTED, including deep-overdue ones (posted back when their period
  // was open, now simply unpaid). je_posted_date sits in the bill's own period,
  // so a posted bill in a now-closed month is fine (you don't re-post it). Two
  // small sets stay un-posted, on purpose:
  //   • ready-to-post: a few recently-approved open-period bills (→ APPROVED)
  //   • reassign:      a few late-arriving bills whose period already closed
  //                    (→ APPROVED + period-locked, the reassign showcase)
  const periodOpen = date.slice(0, 7) > CLOSED_THROUGH;
  const ageDays = daysBetween(TODAY, date);
  const held = KEEP_OUTSTANDING.has(b.id);
  const isReadyToPost = approval === "approved" && pay !== "paid" && periodOpen && ageDays <= 18 && r() < 0.55;
  const isReassign = approval === "approved" && pay !== "paid" && !periodOpen && !held && makeRng(strHash("reassign:" + b.id))() < 0.20;
  const jeNumber = `JE-${date.slice(0, 4)}-${String(1000 + idxNum).padStart(4, "0")}`;
  const approvedDate = approval === "approved" ? offsetDays(date, 1 + Math.floor(r() * 5)) : null;
  let je_number = null, je_posted_date = null;
  if (pay === "paid") {
    je_number = jeNumber;
    je_posted_date = approvedDate || offsetDays(date, 2);
  } else if (approval === "approved" && !isReadyToPost && !isReassign && !held) {
    je_number = jeNumber;
    je_posted_date = offsetDays(approvedDate || date, Math.floor(r() * 2));
  }

  // Audit trail re-anchored to the new bill date.
  const creator = b.audit?.[0]?.by || "Sarah Wijaya";
  const createTime = b.audit?.[0]?.time || "10:00";
  const audit = [{
    type: "created",
    action: isAI ? "Bill dibuat (Draft — OCR AI)" : "Bill dibuat",
    by: isAI ? "System (OCR Auto)" : creator,
    date, time: createTime,
  }];
  if (approval === "approved") {
    audit.push({
      type: "approved", action: "Disetujui", by: "Budi Santoso",
      date: approvedDate,
      time: b.audit?.find((a) => a.type === "approved")?.time || "11:00",
    });
  }
  if (je_number) {
    audit.push({ type: "posted", action: `Posted to GL · ${je_number}`, by: "Budi Santoso", date: je_posted_date, time: "09:15" });
  }
  if (pay === "paid" && derived.paymentDate) {
    audit.push({ type: "paid", action: "Pembayaran dilakukan", by: "Sarah Wijaya", date: derived.paymentDate, time: derived.paymentTime || "14:30" });
  }

  const out = { ...b, date, due, invNo, approval, pay, sisa, ...derived, audit };
  if (je_number) { out.je_number = je_number; out.je_posted_date = je_posted_date; }
  return out;
}

// ── Rewrite bills.js ───────────────────────────────────────────────────────
const out = BILLS.map((b, i) => {
  if (i < ANCHOR_COUNT) return b;               // curated anchors untouched
  const idxNum = parseInt(String(b.id).replace(/\D/g, ""), 10) || (i + 1);
  return redateBill(b, idxNum);
});

const HEADER =
  "// AUTO-GENERATED by scripts/generate-master-data.mjs, then re-dated by\n" +
  "// scripts/regenerate-bills.mjs for AP-aging realism (deterministic).\n" +
  "// AP bills. `vendor` references vendors.js by id. The first 8 records are\n" +
  "// hand-curated demo anchors that the JE generator references; the rest are\n" +
  "// synthetic but reference the same vendor + CoA universe.";

const body = `${HEADER}\nexport const BILLS = [\n${
  out.map((r) => "  " + JSON.stringify(r).replace(/"([a-zA-Z_][a-zA-Z0-9_]*)":/g, "$1:")).join(",\n")
},\n];\n`;
fs.writeFileSync(path.join(ROOT, "src/data/seed/bills.js"), body);

// ── Report the resulting aging so the change is verifiable ─────────────────
function bucketOf(d) {
  if (d <= 0) return "current";
  if (d <= 30) return "1–30";
  if (d <= 60) return "31–60";
  if (d <= 90) return "61–90";
  if (d <= 120) return "91–120";
  return ">120";
}
const fmt = (n) => "Rp " + n.toLocaleString("id-ID");
const payMix = {};
const wfMix = { POSTED: 0, APPROVED: 0, PAID: 0, postedOverdue: 0 };
const mkB = () => ({ current: { n: 0, amt: 0 }, "1–30": { n: 0, amt: 0 }, "31–60": { n: 0, amt: 0 },
                  "61–90": { n: 0, amt: 0 }, "91–120": { n: 0, amt: 0 }, ">120": { n: 0, amt: 0 } });
const buckets = mkB();        // all outstanding (inclusive — Aging Table / Decision Queue view)
const postedBuckets = mkB();  // POSTED-only (the GL-reconciled AP Outstanding KPI / by-age bar)
let outstandingTotal = 0, postedTotal = 0;
for (const b of out) {
  payMix[b.pay] = (payMix[b.pay] || 0) + 1;
  // Mirror workflowStatus() precedence: PAID > POSTED > APPROVED
  if (b.approval === "approved" && b.pay === "paid") wfMix.PAID++;
  else if (b.approval === "approved" && b.je_number) { wfMix.POSTED++; if (b.pay === "overdue") wfMix.postedOverdue++; }
  else if (b.approval === "approved") wfMix.APPROVED++;
  if (b.approval === "draft" || b.sisa <= 0) continue;
  const k = bucketOf(daysBetween(TODAY, b.due));
  buckets[k].n += 1; buckets[k].amt += b.sisa; outstandingTotal += b.sisa;
  // POSTED-only = approved + je_number + not paid (matches workflowStatus POSTED)
  if (b.approval === "approved" && b.je_number && b.pay !== "paid") {
    postedBuckets[k].n += 1; postedBuckets[k].amt += b.sisa; postedTotal += b.sisa;
  }
}
console.log(`Re-dated ${out.length - ANCHOR_COUNT} bills (kept ${ANCHOR_COUNT} anchors). Today = ${TODAY}\n`);
console.log("Pay-status mix:");
for (const [k, v] of Object.entries(payMix)) console.log(`  ${k.padEnd(8)} ${v}`);
console.log(`\nWorkflow mix:  POSTED ${wfMix.POSTED} (of which overdue ${wfMix.postedOverdue}) · APPROVED/ready-to-post ${wfMix.APPROVED} · PAID ${wfMix.PAID} (all carry a posted JE)`);
console.log(`\nOutstanding AP aging — INCLUSIVE (${fmt(outstandingTotal)}; Aging Table / Decision Queue view):`);
for (const [k, v] of Object.entries(buckets)) {
  const pct = outstandingTotal ? Math.round((v.amt / outstandingTotal) * 100) : 0;
  console.log(`  ${k.padEnd(8)} ${String(v.n).padStart(3)} bills  ${fmt(v.amt).padStart(22)}  ${String(pct).padStart(3)}%`);
}
console.log(`\nOutstanding AP aging — POSTED-only (${fmt(postedTotal)}; GL-reconciled AP Outstanding KPI / by-age bar):`);
for (const [k, v] of Object.entries(postedBuckets)) {
  const pct = postedTotal ? Math.round((v.amt / postedTotal) * 100) : 0;
  console.log(`  ${k.padEnd(8)} ${String(v.n).padStart(3)} bills  ${fmt(v.amt).padStart(22)}  ${String(pct).padStart(3)}%`);
}
