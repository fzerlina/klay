// Reporting dimensions auto-tagged on every transaction.
export const DIMENSIONS = [
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

// Lookup by key, for resolving labels/classes from a dimension key.
export const DIM_BY_KEY = Object.fromEntries(DIMENSIONS.map((d) => [d.key, d]));

// Tag colour palette — a dimension's `cls` maps to a {dot, bg, fg} triple.
export const DIMENSION_PALETTE = {
  dept:   { dot: "#1A46C8", bg: "#EBF0FD", fg: "#1338A8" },
  loc:    { dot: "#0F6E56", bg: "#E1F5EE", fg: "#0F6E56" },
  proj:   { dot: "#7A4D00", bg: "#FDF3E0", fg: "#7A4D00" },
  chan:   { dot: "#534AB7", bg: "#EEEDFE", fg: "#3C3489" },
  cc:     { dot: "#A02020", bg: "#FBF0F0", fg: "#A02020" },
  pline:  { dot: "#B83D08", bg: "#FCEFE7", fg: "#B83D08" },
  cseg:   { dot: "#1A7A6A", bg: "#E0F2EE", fg: "#1A7A6A" },
  shift:  { dot: "#6B35A0", bg: "#EFE7F7", fg: "#6B35A0" },
  ic:     { dot: "#993556", bg: "#FBEAF0", fg: "#993556" },
  taxreg: { dot: "#2E6F8F", bg: "#E3EEF5", fg: "#2E6F8F" },
  _new:   { dot: "#8C857C", bg: "#F4F0EB", fg: "#2E2B27" },
};

export function paletteFor(cls) {
  return DIMENSION_PALETTE[cls] || DIMENSION_PALETTE._new;
}

// Deterministic pick from a dimension's value list, given a seed string.
// Used to "simulate" dimension values on existing ledger lines that were
// generated before per-line dimension tagging existed. The "—" placeholder
// (meaning "no value") is filtered out so simulated lines always show a value.
export function sampleDimensionValue(key, seed) {
  const dim = DIM_BY_KEY[key];
  if (!dim) return null;
  const vals = dim.values.filter((v) => v !== "—");
  if (vals.length === 0) return null;
  const s = String(seed || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return vals[h % vals.length];
}

// Which dimensions are tagged on postings to a given account. Operational P&L
// accounts carry analytical dimensions; balance-sheet accounts generally don't,
// with tax accounts scoped by Tax Region. Returns an array of dimension keys.
export function dimensionsForAccount(acct) {
  if (!acct || !acct.code) return [];
  const { type, section, parent, code } = acct;
  if (type === "revenue" && section === "Revenue") return ["dept", "loc", "chan", "pline", "cseg"];
  if (type === "contra_revenue") return ["chan", "pline"];
  if (type === "revenue" && section === "Other Revenue") return ["loc"];
  if (section === "COGS") return ["dept", "loc", "pline", "cc", "shift"];
  if (parent === "g-selling") return ["dept", "loc", "cc", "chan"];
  if (parent === "g-ga") return ["dept", "loc", "cc"];
  if (section === "Other") return ["loc"];
  if (section === "Tax") return ["taxreg"];
  if (["2-2100", "2-2200", "2-2300", "1-5100"].includes(code)) return ["taxreg"];
  return [];
}
