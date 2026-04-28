import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { formatRupiah, formatDate, initials } from "../lib/format";
import "./modules.css";

const APPROVAL_LABEL = { terkirim: "Terkirim", draft: "Draft" };
const PAY_LABEL = { lunas: "Lunas", overdue: "Jatuh Tempo", belumbayar: "Belum Bayar" };

function payBadgeClass(payStatus) {
  if (payStatus === "lunas") return "badge-lunas";
  if (payStatus === "overdue") return "badge-overdue";
  return "badge-belumbayar";
}

export default function InvoicesPage() {
  const { invoices, customers } = useApp();
  const [selectedId, setSelectedId] = useState(null);
  const [drawerTab, setDrawerTab] = useState("detail");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const overdue = invoices.filter(i => i.payStatus === "overdue");
  const sentUnpaid = invoices.filter(i => i.approval === "terkirim" && i.payStatus === "belumbayar");
  const drafts = invoices.filter(i => i.approval === "draft");
  const totalAR = invoices.filter(i => i.payStatus !== "lunas").reduce((s, i) => s + i.total, 0);

  const filtered = useMemo(() => {
    let list = [...invoices];
    const q = search.toLowerCase();
    if (q) list = list.filter(i => i.invNo.toLowerCase().includes(q) || i.customerName.toLowerCase().includes(q) || i.custPO.toLowerCase().includes(q));
    if (statusFilter === "terkirim") list = list.filter(i => i.approval === "terkirim");
    else if (statusFilter === "draft") list = list.filter(i => i.approval === "draft");
    else if (statusFilter === "overdue") list = list.filter(i => i.payStatus === "overdue");
    else if (statusFilter === "lunas") list = list.filter(i => i.payStatus === "lunas");
    const ord = i => {
      if (i.payStatus === "overdue") return 0;
      if (i.approval === "terkirim" && i.payStatus === "belumbayar") return 1;
      if (i.approval === "draft") return 2;
      return 3;
    };
    return list.sort((a, b) => ord(a) - ord(b));
  }, [invoices, search, statusFilter]);

  const selected = invoices.find(i => i.id === selectedId);
  const selectedCustomer = selected ? customers.find(c => c.id === selected.customer) : null;

  const bannerCards = [
    { label: "Jatuh Tempo", count: overdue.length, amt: overdue.reduce((s,i)=>s+i.total,0), cls: "overdue" },
    { label: "Belum Dibayar", count: sentUnpaid.length, amt: sentUnpaid.reduce((s,i)=>s+i.total,0), cls: "warn" },
    { label: "Draft", count: drafts.length, amt: drafts.reduce((s,i)=>s+i.total,0), cls: "draft" },
    { label: "Lunas Bulan Ini", count: invoices.filter(i=>i.payStatus==="lunas").length, amt: invoices.filter(i=>i.payStatus==="lunas").reduce((s,i)=>s+i.total,0), cls: "" },
  ];

  return (
    <div className="mod-page">
      {/* Invoice Banner */}
      <div className="inv-banner">
        <div className="inv-banner-top">
          <div>
            <div className="inv-banner-title">Invoices</div>
            <div className="inv-banner-sub">{invoices.length} invoice · {invoices.filter(i=>i.payStatus!=="lunas").length} aktif</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="inv-ar-badge">
              Total Piutang <span className="inv-ar-amt">{formatRupiah(totalAR)}</span>
            </div>
            <button className="oz-btn primary" style={{ marginLeft: 4 }}>
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Buat Invoice
            </button>
          </div>
        </div>
        <div className="inv-banner-cards">
          {bannerCards.map(c => (
            <div key={c.label} className={`inv-bc${c.cls ? ` ${c.cls}` : ""}`} onClick={() => setStatusFilter(c.label === "Jatuh Tempo" ? "overdue" : c.label === "Draft" ? "draft" : c.label === "Lunas Bulan Ini" ? "lunas" : statusFilter === "terkirim" ? "" : "terkirim")}>
              <div className="inv-bc-label">{c.label}</div>
              <div className="inv-bc-count">{c.count}</div>
              <div className="inv-bc-sub">invoice</div>
              <div className="inv-bc-amt">{formatRupiah(c.amt)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mod-scroll">
        <div className="mod-inner">
          {/* Filter bar */}
          <div className="filter-bar">
            <div className="f-search">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input placeholder="Cari nomor invoice, customer…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="fsep" />
            <div className="chip-grp">
              {[["", "Semua"], ["terkirim", "Terkirim"], ["draft", "Draft"], ["overdue", "Jatuh Tempo"], ["lunas", "Lunas"]].map(([v, label]) => (
                <div key={v} className={`chip${statusFilter === v ? " on" : ""}`} onClick={() => setStatusFilter(v)}>{label}</div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>Tanggal</th>
                  <th>Nomor Invoice</th>
                  <th>Customer</th>
                  <th>Customer PO</th>
                  <th>Jatuh Tempo</th>
                  <th className="r">Total (Rp)</th>
                  <th>Status Invoice</th>
                  <th>Status Bayar</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="tbl-empty">Tidak ada invoice yang cocok</td></tr>
                )}
                {filtered.map(inv => {
                  const cust = customers.find(c => c.id === inv.customer);
                  return (
                    <tr key={inv.id} className={selectedId === inv.id ? "sel" : ""} onClick={() => { setSelectedId(inv.id); setDrawerTab("detail"); }}>
                      <td>
                        <div className={`cn-av ${cust?.type || "perusahaan"}`} style={{ width: 26, height: 26, fontSize: 9 }}>
                          {initials(inv.customerName)}
                        </div>
                      </td>
                      <td style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{formatDate(inv.date)}</td>
                      <td>
                        <span className="td-mono" style={{ color: "var(--color-action)", fontSize: 11 }}>
                          {inv.invNo === "—" ? <em style={{ fontStyle: "italic", color: "var(--color-text-tertiary)" }}>Draft</em> : inv.invNo}
                        </span>
                        {inv.isAI && <span className="badge badge-ai" style={{ marginLeft: 5 }}>AI</span>}
                      </td>
                      <td>
                        <div className="td-name">{inv.customerName}</div>
                        <div className="td-sub">{inv.custCode}</div>
                      </td>
                      <td style={{ fontSize: 11, color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)" }}>{inv.custPO}</td>
                      <td style={{ fontSize: 11, color: inv.payStatus === "overdue" ? "var(--danger-text)" : "var(--color-text-tertiary)", fontWeight: inv.payStatus === "overdue" ? 600 : 400 }}>
                        {formatDate(inv.due)}
                      </td>
                      <td className="r"><span className="td-mono">{formatRupiah(inv.total)}</span></td>
                      <td><span className={`badge badge-${inv.approval}`}>{APPROVAL_LABEL[inv.approval] || inv.approval}</span></td>
                      <td><span className={`badge ${payBadgeClass(inv.payStatus)}`}>{PAY_LABEL[inv.payStatus] || inv.payStatus}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sticky bar */}
      <div className="sticky-bar">
        <div className="sb-st"><span className="sb-st-lbl">Total</span><span className="sb-st-val">{invoices.length}</span></div>
        <div className="sb-sep" />
        <div className="sb-st"><span className="sb-st-lbl">Total Piutang</span><span className="sb-st-val">{formatRupiah(totalAR)}</span></div>
        <div className="sb-sep" />
        <div className="sb-st"><span className="sb-st-lbl">Jatuh Tempo</span><span className={`sb-st-val${overdue.length > 0 ? " danger" : ""}`}>{formatRupiah(overdue.reduce((s,i)=>s+i.total,0))}</span></div>
        <div className="sb-sep" />
        <div className="sb-st"><span className="sb-st-lbl">Lunas</span><span className="sb-st-val success">{formatRupiah(invoices.filter(i=>i.payStatus==="lunas").reduce((s,i)=>s+i.total,0))}</span></div>
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
              <div className={`drawer-av ${selectedCustomer?.type || "perusahaan"}`}>{initials(selected.customerName)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="drawer-title">{selected.customerName}</div>
                <div className="drawer-sub">{selected.invNo === "—" ? "Draft" : selected.invNo}</div>
              </div>
              <button className="drawer-close" onClick={() => setSelectedId(null)}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="drawer-tabs">
              {[["detail","Detail"],["items","Items"],["audit","Audit"]].map(([t,label]) => (
                <div key={t} className={`drawer-tab${drawerTab===t?" active":""}`} onClick={()=>setDrawerTab(t)}>{label}</div>
              ))}
            </div>
            <div className="drawer-body">
              {drawerTab === "detail" && (
                <>
                  <div className="drawer-stat-row">
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">Total Invoice</div>
                      <div className="drawer-stat-val">{formatRupiah(selected.total)}</div>
                    </div>
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">Status Bayar</div>
                      <div className={`drawer-stat-val${selected.payStatus==="lunas"?" success":selected.payStatus==="overdue"?" danger":""}`} style={{ fontSize: 13 }}>
                        {PAY_LABEL[selected.payStatus] || selected.payStatus}
                      </div>
                    </div>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-section-title">Informasi Invoice</div>
                    {[
                      ["Invoice ID", selected.id],
                      ["Nomor Invoice", selected.invNo],
                      ["Customer PO", selected.custPO],
                      ["Customer", selected.customerName],
                      ["Email", selected.custEmail],
                      ["Tanggal Dibuat", formatDate(selected.date)],
                      ["Jatuh Tempo", formatDate(selected.due)],
                      ["Status Invoice", APPROVAL_LABEL[selected.approval] || selected.approval],
                    ].map(([label, value]) => (
                      <div key={label} className="drawer-row">
                        <div className="drawer-label">{label}</div>
                        <div className="drawer-value">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-section-title">Pajak</div>
                    {[
                      ["DPP", formatRupiah(selected.dpp)],
                      ["PPN (11%)", formatRupiah(selected.ppn)],
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
                        <th>Unit</th>
                        <th className="r">Harga</th>
                        <th className="r">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.items.map((item, i) => (
                        <tr key={i}>
                          <td>{item.desc}</td>
                          <td className="r">{item.qty}</td>
                          <td>{item.unit}</td>
                          <td className="r">{formatRupiah(item.price)}</td>
                          <td className="r">{formatRupiah(item.subtotal)}</td>
                        </tr>
                      ))}
                      <tr className="items-total-row">
                        <td colSpan={4}>DPP</td>
                        <td className="r">{formatRupiah(selected.dpp)}</td>
                      </tr>
                      <tr>
                        <td colSpan={4} style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>PPN (11%)</td>
                        <td className="r" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{formatRupiah(selected.ppn)}</td>
                      </tr>
                      <tr className="items-total-row">
                        <td colSpan={4}>Total</td>
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
                          <div className="audit-by">{a.by} · {a.date} {a.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="drawer-footer">
              {selected.approval === "draft" && (
                <button className="drawer-btn primary">
                  <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  Kirim Invoice
                </button>
              )}
              {selected.approval === "terkirim" && selected.payStatus !== "lunas" && (
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
