import { useState } from "react";
import { useApp } from "../context/AppContext";
import { formatRupiah, daysSince, initials } from "../lib/format";
import "./modules.css";

export default function CustomersPage() {
  const { customers, invoices } = useApp();
  const [selectedId, setSelectedId] = useState(null);
  const [drawerTab, setDrawerTab] = useState("detail");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [bannerOpen, setBannerOpen] = useState(true);

  const overdueCustomers = customers.filter(c => c.arOverdue && c.active);
  const staleCustomers = customers.filter(c => daysSince(c.lastInv) >= 60 && c.active);

  const filtered = customers.filter(c => {
    if (typeFilter && c.type !== typeFilter) return false;
    const q = search.toLowerCase();
    if (q && !c.name.toLowerCase().includes(q) && !c.code.toLowerCase().includes(q)) return false;
    return true;
  });

  const selected = customers.find(c => c.id === selectedId);
  const totalAR = customers.reduce((s, c) => s + c.ar, 0);
  const overdueAR = customers.filter(c => c.arOverdue).reduce((s, c) => s + c.ar, 0);
  const activeCount = customers.filter(c => c.active).length;
  const custInvoices = selected ? (invoices || []).filter(inv => inv.customer === selected.id) : [];

  return (
    <div className="mod-page">
      <div className="mod-scroll">
        <div className="mod-inner">
          <div className="page-head">
            <div>
              <div className="page-title">Customers</div>
              <div className="page-sub">{customers.length} customer · {activeCount} aktif</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-ghost">
                <svg viewBox="0 0 24 24"><polyline points="21 15 21 21 3 21 3 15"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Export
              </button>
              <button className="btn-primary">
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Tambah Customer
              </button>
            </div>
          </div>

          {/* Attention Banner */}
          {(overdueCustomers.length > 0 || staleCustomers.length > 0) && (
            <div className="wb">
              <div className="wb-hd" onClick={() => setBannerOpen(!bannerOpen)}>
                <div className="wb-hd-icon">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <div className="wb-hd-title">
                  {overdueCustomers.length > 0 && `${overdueCustomers.length} customer jatuh tempo`}
                  {overdueCustomers.length > 0 && staleCustomers.length > 0 && " · "}
                  {staleCustomers.length > 0 && `${staleCustomers.length} customer tidak aktif`}
                </div>
                <svg className={`wb-hd-chev${bannerOpen ? " open" : ""}`} viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
              </div>
              {bannerOpen && (
                <div className="wb-body">
                  {overdueCustomers.length > 0 && (
                    <div className="wb-row">
                      <div className="wb-row-title">Piutang Jatuh Tempo · {formatRupiah(overdueAR)}</div>
                      <div className="wb-items">
                        {overdueCustomers.map(c => (
                          <div key={c.id} className="wb-item-card overdue">
                            <div className="wb-item-badge overdue">
                              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                              Jatuh tempo
                            </div>
                            <div className="wb-item-ref">{c.code}</div>
                            <div className="wb-item-name">{c.name}</div>
                            <div className="wb-item-desc">{c.contacts[0]?.name} · {c.lastInv}</div>
                            <div className="wb-item-foot">
                              <div className="wb-item-actions">
                                <button className="wb-btn-primary" onClick={() => { setSelectedId(c.id); setDrawerTab("invoices"); }}>Lihat Invoice</button>
                                <button className="wb-btn-secondary" onClick={() => { setSelectedId(c.id); setDrawerTab("detail"); }}>Detail</button>
                              </div>
                              <div className="wb-item-amt">{formatRupiah(c.ar)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {staleCustomers.length > 0 && (
                    <div className="wb-row">
                      <div className="wb-row-title">Tidak Ada Invoice 60+ Hari</div>
                      <div className="wb-items">
                        {staleCustomers.map(c => (
                          <div key={c.id} className="wb-item-card">
                            <div className="wb-item-badge stale">
                              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              {daysSince(c.lastInv)} hari lalu
                            </div>
                            <div className="wb-item-ref">{c.code}</div>
                            <div className="wb-item-name">{c.name}</div>
                            <div className="wb-item-desc">{c.contacts[0]?.phone}</div>
                            <div className="wb-item-foot">
                              <div className="wb-item-actions">
                                <button className="wb-btn-secondary" onClick={() => { setSelectedId(c.id); setDrawerTab("detail"); }}>Lihat Customer</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
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
              <input placeholder="Cari nama atau kode customer…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="fsep" />
            <div className="chip-grp">
              {[["", "Semua"], ["perusahaan", "Perusahaan"], ["individu", "Individu"]].map(([v, label]) => (
                <div key={v} className={`chip${typeFilter === v ? " on" : ""}`} onClick={() => setTypeFilter(v)}>{label}</div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 44 }}></th>
                  <th>Customer</th>
                  <th>Tipe</th>
                  <th>Terms</th>
                  <th className="r">Credit Limit</th>
                  <th className="r">AR Aktif</th>
                  <th>Invoice Terakhir</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="tbl-empty">Tidak ada customer yang cocok</td></tr>
                )}
                {filtered.map(c => {
                  const stale = daysSince(c.lastInv) >= 60;
                  return (
                    <tr key={c.id} className={`${selectedId === c.id ? "sel" : ""}${!c.active ? " inactive-row" : ""}`} onClick={() => { setSelectedId(c.id); setDrawerTab("detail"); }}>
                      <td>
                        <div className={`cn-av ${c.type}`}>{initials(c.name)}</div>
                      </td>
                      <td>
                        <div className="td-name">{c.name}</div>
                        <div className="td-sub">{c.code}</div>
                      </td>
                      <td><span className={`type-badge ${c.type}`}>{c.type === "perusahaan" ? "Perusahaan" : "Individu"}</span></td>
                      <td style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>{c.top}</td>
                      <td className="r"><span className="td-mono" style={{ color: "var(--color-text-tertiary)" }}>{c.creditLimit > 0 ? formatRupiah(c.creditLimit) : "—"}</span></td>
                      <td className="r">
                        {c.ar > 0
                          ? <span className={c.arOverdue ? "td-danger" : "td-mono"}>{formatRupiah(c.ar)}</span>
                          : <span style={{ color: "var(--color-text-tertiary)", opacity: .5 }}>—</span>}
                      </td>
                      <td style={{ fontSize: 11, color: stale ? "var(--danger-text)" : "var(--color-text-tertiary)", fontWeight: stale ? 600 : 400 }}>
                        {c.lastInv}
                      </td>
                      <td><span className={`status-badge ${c.active ? "active" : "inactive"}`}>{c.active ? "Aktif" : "Non-aktif"}</span></td>
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
        <div className="sb-st"><span className="sb-st-lbl">Total</span><span className="sb-st-val">{customers.length} customer</span></div>
        <div className="sb-sep" />
        <div className="sb-st"><span className="sb-st-lbl">Aktif</span><span className="sb-st-val">{activeCount}</span></div>
        <div className="sb-sep" />
        <div className="sb-st"><span className="sb-st-lbl">Total AR</span><span className="sb-st-val">{formatRupiah(totalAR)}</span></div>
        <div className="sb-sep" />
        <div className="sb-st"><span className="sb-st-lbl">Jatuh Tempo</span><span className={`sb-st-val${overdueAR > 0 ? " danger" : ""}`}>{formatRupiah(overdueAR)}</span></div>
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
              <div className={`drawer-av ${selected.type}`}>{initials(selected.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="drawer-title">{selected.name}</div>
                <div className="drawer-sub" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {selected.code}
                  <span className={`type-badge ${selected.type}`}>{selected.type === "perusahaan" ? "Perusahaan" : "Individu"}</span>
                </div>
              </div>
              <button className="drawer-close" onClick={() => setSelectedId(null)}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="drawer-tabs">
              {[["detail", "Detail"], ["contacts", "Kontak"], ["invoices", "Invoice"]].map(([t, label]) => (
                <div key={t} className={`drawer-tab${drawerTab === t ? " active" : ""}`} onClick={() => setDrawerTab(t)}>{label}</div>
              ))}
            </div>
            <div className="drawer-body">
              {drawerTab === "detail" && (
                <>
                  <div className="drawer-stat-row">
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">AR Aktif</div>
                      <div className={`drawer-stat-val${selected.arOverdue ? " danger" : ""}`}>{formatRupiah(selected.ar)}</div>
                    </div>
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">Total Invoice</div>
                      <div className="drawer-stat-val">{selected.totalInv}</div>
                    </div>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-section-title">Informasi Customer</div>
                    {[
                      ["Nama Legal", selected.legalName || selected.name],
                      ["Kode", selected.code],
                      ["NPWP", selected.npwp || "—"],
                      ["Alamat", selected.address],
                      ["Terms", selected.top],
                      ["Credit Limit", selected.creditLimit > 0 ? formatRupiah(selected.creditLimit) : "—"],
                      ["Invoice Terakhir", selected.lastInv || "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="drawer-row">
                        <div className="drawer-label">{label}</div>
                        <div className="drawer-value">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-section-title">Pengaturan Invoice</div>
                    {[
                      ["Mode Invoice", selected.invMode === "auto" ? "Otomatis" : "Manual"],
                      ["Channel Kirim", selected.invCh?.length > 0 ? selected.invCh.join(", ") : "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="drawer-row">
                        <div className="drawer-label">{label}</div>
                        <div className="drawer-value">{value}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {drawerTab === "contacts" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Kontak</div>
                  {selected.contacts.map((ct, i) => (
                    <div key={i} style={{ background: "var(--color-surface-sunken)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-md)", padding: "12px 14px", marginBottom: 8 }}>
                      {ct.primary && <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-action)", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>PIC Utama</div>}
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{ct.name}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 6 }}>{ct.title}</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{ct.phone}</div>
                      {ct.email && <div style={{ fontSize: 12, color: "var(--color-action)" }}>{ct.email}</div>}
                    </div>
                  ))}
                </div>
              )}
              {drawerTab === "invoices" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Invoice</div>
                  {custInvoices.length === 0
                    ? <div style={{ color: "var(--color-text-tertiary)", fontSize: 12, padding: "12px 0" }}>Belum ada invoice.</div>
                    : custInvoices.map(inv => (
                      <div key={inv.id} style={{ background: "var(--color-surface-sunken)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-md)", padding: "10px 12px", marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-action)" }}>{inv.invNo}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{inv.items?.[0]?.desc}</div>
                            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>Jatuh tempo: {inv.due}</div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700 }}>{formatRupiah(inv.total)}</div>
                            <span className={`badge badge-${inv.payStatus}`} style={{ marginTop: 4, display: "inline-flex" }}>
                              {inv.payStatus === "lunas" ? "Lunas" : inv.payStatus === "overdue" ? "Jatuh Tempo" : inv.payStatus === "belumbayar" ? "Belum Bayar" : inv.payStatus}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
            <div className="drawer-footer">
              <button className="drawer-btn ghost">
                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </button>
              <button className="drawer-btn primary">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Buat Invoice
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
