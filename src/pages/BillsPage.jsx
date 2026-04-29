import { useState, useMemo } from "react";
import { VENDORS as vendors } from "../data/seed/vendors";
import { BILLS as bills } from "../data/seed/bills";
import { formatRupiah, formatDate, daysSince } from "../lib/format";
import "./modules.css";

const PAY_LABEL = { paid: "Lunas", unpaid: "Belum Bayar", overdue: "Jatuh Tempo" };
const APPROVAL_LABEL = { approved: "Approved", review: "Review", draft: "Draft" };
const GRN_LABEL = { matched: "Matched", pending: "Pending", mismatch: "Mismatch" };

function payBadgeClass(pay) {
  if (pay === "paid") return "badge-paid";
  if (pay === "overdue") return "badge-overdue";
  return "badge-unpaid";
}

export default function BillsPage() {
  const [selectedId, setSelectedId] = useState(null);
  const [drawerTab, setDrawerTab] = useState("detail");
  const [search, setSearch] = useState("");
  const [payFilter, setPayFilter] = useState("");
  const [attnOpen, setAttnOpen] = useState(true);
  const [overdueOpen, setOverdueOpen] = useState(true);
  const [unpaidOpen, setUnpaidOpen] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);

  const overdueBills = bills.filter(b => b.pay === "overdue");
  const unpaidBills = bills.filter(b => b.pay === "unpaid" && b.approval === "approved");
  const draftBills = bills.filter(b => b.approval === "draft");
  const attnCount = overdueBills.length + unpaidBills.length + draftBills.length;

  const filtered = useMemo(() => {
    let list = [...bills];
    const q = search.toLowerCase();
    if (q) list = list.filter(b => b.id.toLowerCase().includes(q) || b.vendorName.toLowerCase().includes(q) || b.invNo.toLowerCase().includes(q));
    if (payFilter) list = list.filter(b => b.pay === payFilter);
    const ord = b => {
      if (b.pay === "overdue") return 0;
      if (b.pay === "unpaid" && b.approval === "review") return 1;
      if (b.pay === "unpaid") return 2;
      if (b.approval === "review") return 3;
      if (b.approval === "draft") return 4;
      return 5;
    };
    return list.sort((a, b) => ord(a) - ord(b) || (a.due > b.due ? 1 : -1));
  }, [bills, search, payFilter]);

  const selected = bills.find(b => b.id === selectedId);
  const totalAP = bills.filter(b => b.pay !== "paid").reduce((s, b) => s + b.sisa, 0);
  const overdueAmt = overdueBills.reduce((s, b) => s + b.sisa, 0);
  const paidAmt = bills.filter(b => b.pay === "paid").reduce((s, b) => s + b.total, 0);
  const totalBills = bills.length;

  // Summary card values
  const cards = [
    { label: "Jatuh Tempo", num: overdueBills.length, numClass: "danger", sub: "bill terlambat", amt: overdueAmt, amtClass: "danger" },
    { label: "Belum Dibayar", num: unpaidBills.length, numClass: "warn", sub: "bill approved", amt: unpaidBills.reduce((s,b)=>s+b.sisa,0), amtClass: "" },
    { label: "Dalam Review", num: bills.filter(b=>b.approval==="review").length, numClass: "", sub: "menunggu approval", amt: bills.filter(b=>b.approval==="review").reduce((s,b)=>s+b.total,0), amtClass: "" },
    { label: "Lunas Bulan Ini", num: bills.filter(b=>b.pay==="paid").length, numClass: "", sub: "sudah dibayar", amt: paidAmt, amtClass: "" },
  ];

  return (
    <div className="mod-page">
      {/* Orange banner */}
      <div className="oz-banner">
        <div className="oz-top">
          <div>
            <div className="oz-title">Bills</div>
            <div className="oz-subtitle">{totalBills} bill · Total AP {formatRupiah(totalAP)}</div>
          </div>
          <div className="oz-actions">
            <button className="oz-btn">
              <svg viewBox="0 0 24 24"><polyline points="21 15 21 21 3 21 3 15"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Export
            </button>
            <button className="oz-btn primary">
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Buat Bill
            </button>
          </div>
        </div>
        <div className="oz-cards">
          {cards.map(c => (
            <div key={c.label} className="oz-card" onClick={() => setPayFilter(payFilter === "overdue" && c.label === "Jatuh Tempo" ? "" : c.label === "Jatuh Tempo" ? "overdue" : c.label === "Lunas Bulan Ini" ? "paid" : "")}>
              <div className="oz-card-label">{c.label}</div>
              <div className={`oz-card-num${c.numClass ? ` ${c.numClass}` : ""}`}>{c.num}</div>
              <div className="oz-card-sub">{c.sub}</div>
              <div className={`oz-card-amt${c.amtClass ? ` ${c.amtClass}` : ""}`}>{formatRupiah(c.amt)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mod-scroll">
        <div className="mod-inner">
          {/* Attention section */}
          {attnCount > 0 && (
            <div className="attn-section">
              <div className="attn-header" onClick={() => setAttnOpen(!attnOpen)}>
                <div className="attn-icon">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <div className="attn-title">{attnCount} bill perlu tindakan</div>
                <div className={`attn-toggle${attnOpen ? " open" : ""}`}>
                  <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
                </div>
              </div>
              {attnOpen && (
                <div className="attn-body open">
                  <div className="attn-desc">Bill berikut memerlukan pembayaran atau persetujuan segera.</div>
                  {overdueBills.length > 0 && (
                    <div className="child-acc">
                      <div className="child-acc-header" onClick={() => setOverdueOpen(!overdueOpen)}>
                        <div className="child-acc-icon unpaid"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
                        <div className="child-acc-title">Jatuh Tempo — {overdueBills.length} bill</div>
                        <div className="child-acc-amount">{formatRupiah(overdueAmt)}</div>
                        <div className="child-acc-badge danger">{overdueBills.length}</div>
                        <div className={`child-acc-toggle${overdueOpen ? " open" : ""}`}><svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg></div>
                      </div>
                      {overdueOpen && (
                        <div className="child-acc-body open">
                          {overdueBills.map(b => (
                            <div key={b.id} className="bill-row-item" onClick={() => { setSelectedId(b.id); setDrawerTab("detail"); }} style={{ cursor: "pointer" }}>
                              <div style={{ flex: 1 }}>
                                <div className="bill-row-item-vendor">{b.vendorName}</div>
                                <div className="bill-row-item-ref">{b.invNo}</div>
                              </div>
                              <div className="bill-row-item-due">Lewat {daysSince(b.due)} hari</div>
                              <div className="bill-row-item-amt">{formatRupiah(b.sisa)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {unpaidBills.length > 0 && (
                    <div className="child-acc">
                      <div className="child-acc-header" onClick={() => setUnpaidOpen(!unpaidOpen)}>
                        <div className="child-acc-icon pending"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                        <div className="child-acc-title">Belum Dibayar — {unpaidBills.length} bill</div>
                        <div className="child-acc-amount" style={{ color: "var(--warning-text)" }}>{formatRupiah(unpaidBills.reduce((s,b)=>s+b.sisa,0))}</div>
                        <div className="child-acc-badge warn">{unpaidBills.length}</div>
                        <div className={`child-acc-toggle${unpaidOpen ? " open" : ""}`}><svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg></div>
                      </div>
                      {unpaidOpen && (
                        <div className="child-acc-body open">
                          {unpaidBills.map(b => (
                            <div key={b.id} className="bill-row-item" onClick={() => { setSelectedId(b.id); setDrawerTab("detail"); }} style={{ cursor: "pointer" }}>
                              <div style={{ flex: 1 }}>
                                <div className="bill-row-item-vendor">{b.vendorName}</div>
                                <div className="bill-row-item-ref">{b.invNo}</div>
                              </div>
                              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>Jatuh tempo: {formatDate(b.due)}</div>
                              <div className="bill-row-item-amt" style={{ color: "var(--warning-text)" }}>{formatRupiah(b.sisa)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {draftBills.length > 0 && (
                    <div className="child-acc">
                      <div className="child-acc-header" onClick={() => setDraftOpen(!draftOpen)}>
                        <div className="child-acc-icon draft"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                        <div className="child-acc-title">Draft — {draftBills.length} bill perlu review</div>
                        <div className="child-acc-badge neutral">{draftBills.length}</div>
                        <div className={`child-acc-toggle${draftOpen ? " open" : ""}`}><svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg></div>
                      </div>
                      {draftOpen && (
                        <div className="child-acc-body open">
                          {draftBills.map(b => (
                            <div key={b.id} className="bill-row-item" onClick={() => { setSelectedId(b.id); setDrawerTab("detail"); }} style={{ cursor: "pointer" }}>
                              <div style={{ flex: 1 }}>
                                <div className="bill-row-item-vendor">{b.vendorName}</div>
                                <div className="bill-row-item-ref">{b.isAI ? "OCR AI Draft" : b.invNo}</div>
                              </div>
                              <div className="bill-row-item-amt" style={{ color: "var(--color-text-tertiary)" }}>{formatRupiah(b.total)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Filter bar */}
          <div className="filter-bar">
            <div className="f-search">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input placeholder="Cari ID bill, vendor, no. invoice…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="fsep" />
            <div className="chip-grp">
              {[["", "Semua"], ["overdue", "Jatuh Tempo"], ["unpaid", "Belum Bayar"], ["paid", "Lunas"]].map(([v, label]) => (
                <div key={v} className={`chip${payFilter === v ? " on" : ""}`} onClick={() => setPayFilter(v)}>{label}</div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>Vendor</th>
                  <th>No. Invoice</th>
                  <th>Tanggal</th>
                  <th>Jatuh Tempo</th>
                  <th>GRN</th>
                  <th className="r">Total (Rp)</th>
                  <th className="r">Sisa (Rp)</th>
                  <th>Approval</th>
                  <th>Pembayaran</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="tbl-empty">Tidak ada bill yang cocok</td></tr>
                )}
                {filtered.map(b => (
                  <tr key={b.id} className={selectedId === b.id ? "sel" : ""} onClick={() => { setSelectedId(b.id); setDrawerTab("detail"); }}>
                    <td>
                      <div className="vn-av inventory" style={{ fontSize: 9, width: 26, height: 26 }}>{b.initials}</div>
                    </td>
                    <td>
                      <div className="td-name">{b.vendorName}</div>
                      <div className="td-sub">{b.id}</div>
                    </td>
                    <td><span className="td-mono td-sub">{b.invNo === "—" ? <em style={{ fontStyle: "italic" }}>Draft</em> : b.invNo}</span></td>
                    <td style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{formatDate(b.date)}</td>
                    <td>
                      <span style={{ fontSize: 11, color: b.pay === "overdue" ? "var(--danger-text)" : "var(--color-text-tertiary)", fontWeight: b.pay === "overdue" ? 600 : 400 }}>
                        {formatDate(b.due)}{b.pay === "overdue" ? ` (+${daysSince(b.due)}h)` : ""}
                      </span>
                    </td>
                    <td><span className={`badge grn-${b.grn}`}>{GRN_LABEL[b.grn]}</span></td>
                    <td className="r"><span className="td-mono">{formatRupiah(b.total)}</span></td>
                    <td className="r">
                      {b.sisa > 0
                        ? <span className={b.pay === "overdue" ? "td-danger" : "td-warn"}>{formatRupiah(b.sisa)}</span>
                        : <span style={{ color: "var(--color-text-tertiary)", opacity: .4 }}>—</span>}
                    </td>
                    <td><span className={`badge badge-${b.approval}`}>{APPROVAL_LABEL[b.approval]}</span></td>
                    <td><span className={`badge ${payBadgeClass(b.pay)}`}>{PAY_LABEL[b.pay]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sticky bar */}
      <div className="sticky-bar">
        <div className="sb-st"><span className="sb-st-lbl">Total Bill</span><span className="sb-st-val">{totalBills}</span></div>
        <div className="sb-sep" />
        <div className="sb-st"><span className="sb-st-lbl">Outstanding AP</span><span className={`sb-st-val${totalAP > 0 ? " danger" : ""}`}>{formatRupiah(totalAP)}</span></div>
        <div className="sb-sep" />
        <div className="sb-st"><span className="sb-st-lbl">Jatuh Tempo</span><span className={`sb-st-val${overdueAmt > 0 ? " danger" : ""}`}>{formatRupiah(overdueAmt)}</span></div>
        <div className="sb-right">
          <div className="sb-st"><span className="sb-st-lbl">Ditampilkan</span><span className="sb-st-val">{filtered.length}</span></div>
        </div>
      </div>

      {/* Drawer */}
      {selected && (
        <>
          <div className="drawer-overlay" onClick={() => setSelectedId(null)} />
          <div className="drawer">
            <div className="drawer-head">
              <div className="drawer-av bill">{selected.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="drawer-title">{selected.vendorName}</div>
                <div className="drawer-sub">{selected.id}</div>
              </div>
              <button className="drawer-close" onClick={() => setSelectedId(null)}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="drawer-tabs">
              {[["detail", "Detail"], ["items", "Items"], ["audit", "Audit"]].map(([t, label]) => (
                <div key={t} className={`drawer-tab${drawerTab === t ? " active" : ""}`} onClick={() => setDrawerTab(t)}>{label}</div>
              ))}
            </div>
            <div className="drawer-body">
              {drawerTab === "detail" && (
                <>
                  <div className="drawer-stat-row">
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">Total</div>
                      <div className="drawer-stat-val">{formatRupiah(selected.total)}</div>
                    </div>
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">Sisa Bayar</div>
                      <div className={`drawer-stat-val${selected.sisa > 0 ? " danger" : " success"}`}>{selected.sisa > 0 ? formatRupiah(selected.sisa) : "Lunas"}</div>
                    </div>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-section-title">Informasi Bill</div>
                    {[
                      ["Bill ID", selected.id],
                      ["No. Invoice Vendor", selected.invNo],
                      ["No. PO", selected.poNo],
                      ["Tanggal", formatDate(selected.date)],
                      ["Jatuh Tempo", formatDate(selected.due)],
                      ["GRN", GRN_LABEL[selected.grn]],
                      ["Status Approval", APPROVAL_LABEL[selected.approval]],
                      ["Status Bayar", PAY_LABEL[selected.pay]],
                    ].map(([label, value]) => (
                      <div key={label} className="drawer-row">
                        <div className="drawer-label">{label}</div>
                        <div className="drawer-value">{value}</div>
                      </div>
                    ))}
                    {selected.keterangan && (
                      <div className="drawer-row">
                        <div className="drawer-label">Keterangan</div>
                        <div className="drawer-value">{selected.keterangan}</div>
                      </div>
                    )}
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-section-title">Pajak</div>
                    {[
                      ["DPP", formatRupiah(selected.dpp)],
                      ["PPN (11%)", formatRupiah(selected.ppn)],
                      ["PPh 23", selected.pph23 > 0 ? formatRupiah(selected.pph23) : "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="drawer-row">
                        <div className="drawer-label">{label}</div>
                        <div className="drawer-value mono">{value}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {drawerTab === "items" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Line Items</div>
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Deskripsi</th>
                        <th className="r">Qty</th>
                        <th className="r">Harga</th>
                        <th className="r">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.items.map((item, i) => (
                        <tr key={i}>
                          <td>
                            <div>{item.desc}</div>
                            <div style={{ fontSize: 10, color: "var(--color-action)", fontFamily: "var(--font-mono)" }}>{item.acct} · {item.acctName}</div>
                          </td>
                          <td className="r">{item.qty.toLocaleString("id-ID")}</td>
                          <td className="r">{formatRupiah(item.price)}</td>
                          <td className="r">{formatRupiah(item.subtotal)}</td>
                        </tr>
                      ))}
                      <tr className="items-total-row">
                        <td colSpan={3}>DPP</td>
                        <td className="r">{formatRupiah(selected.dpp)}</td>
                      </tr>
                      <tr>
                        <td colSpan={3} style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>PPN (11%)</td>
                        <td className="r" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{formatRupiah(selected.ppn)}</td>
                      </tr>
                      <tr className="items-total-row">
                        <td colSpan={3}>Total</td>
                        <td className="r">{formatRupiah(selected.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              {drawerTab === "audit" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Riwayat Audit</div>
                  <div className="audit-list">
                    {selected.audit.map((a, i) => (
                      <div key={i} className="audit-item">
                        <div className={`audit-dot ${a.type}`} />
                        <div>
                          <div className="audit-action">{a.action}</div>
                          <div className="audit-by">{a.by} · {formatDate(a.date)} {a.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="drawer-footer">
              {selected.pay !== "paid" && (
                <button className="drawer-btn primary">
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  Tandai Lunas
                </button>
              )}
              <button className="drawer-btn ghost">
                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
