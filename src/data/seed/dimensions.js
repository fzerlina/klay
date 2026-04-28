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
