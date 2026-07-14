// Vendor lifecycle status + health signal — layered onto the auto-generated
// seed the same way relationship tier is (vendors.js is generated, so extra
// attributes live here to survive regeneration).
//
// STATUS extends the base active/inactive with the AP lifecycle states shown as
// the Vendors list tabs:
//   pending | active | inactive | blocked
//   - pending: onboarded, awaiting approval (an approver activates it)
//   - inactive: not available for new transactions (retired or replaced)
//   - blocked: compliance/security hold — cannot transact until released
// Only overrides are listed; any vendor absent here keeps its seed status.
export const VENDOR_STATUS_OVERRIDE = {
  V011: "pending",
  V030: "pending",
  V057: "pending",
  V067: "pending",
  V069: "pending",
  V035: "blocked",
  V043: "blocked",
};

// HEALTH is the at-a-glance risk chip shown next to the vendor name:
//   healthy → no chip · review → yellow chip · flagged → red chip
// "flagged" also stands in for an active security event. Default is healthy.
export const VENDOR_HEALTH_SEED = {
  V005: "review",
  V014: "review",
  V020: "review",
  V051: "review",
  V063: "review",
  V012: "flagged",
  V035: "flagged",
  V043: "flagged",
  V070: "flagged",
};

export function seedStatusFor(vendorId, fallback) {
  return VENDOR_STATUS_OVERRIDE[vendorId] || fallback;
}
export function seedHealthFor(vendorId) {
  return VENDOR_HEALTH_SEED[vendorId] || "healthy";
}
