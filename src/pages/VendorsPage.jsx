import { useState } from "react";
import { useApp } from "../context/AppContext";
import { CAT_LABELS, PPH_LABELS, ACCT_LABELS, DEFTAX_LABELS, fmtRp } from "../data/moduleData";
import "./modules.css";

const TODAY = new Date("2025-04-23T00:00:00");
function daysSince(dateStr) {
  if (!dateStr) return 9999;
  return Math.floor((TODAY - new Date(dateStr + "T00:00:00")) / 86400000);
}
function fmtLastTx(dateStr) {
  if (!dateStr) return { text: "Belum ada", stale: false };
  const days = daysSince(dateStr);
  const d = new Date(dateStr + "T00:00:00");
  const text = d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  return { text: days > 60 ? `${text} · ${days} hari lalu` : text, stale: days > 60 };
}

const AP_BALANCE = { V001: 0, V002: 9435000, V003: 16650000, V004: 27500000, V005: 13750000 };

export default function VendorsPage() {
  const { vendors } = useApp();
  const [selectedId, setSelectedId] = useState(null);
  const [drawerTab, setDrawerTab] = useState("detail");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [attnOpen, setAttnOpen] = useState(true);
  const [overdueOpen, setOverdueOpen] = useState(true);
  const [staleOpen, setStaleOpen] = useState(false);

  const staleVendors = vendors.filter(v => daysSince(v.lastTx) > 60 && v.status === "active");
  const overdueVendors = vendors.filter(v => (AP_BALANCE[v.id] || 0) > 0 && daysSince(v.lastTx) > 30);

  const filtered = vendors.filter(v => {
    if (catFilter && v.category !== catFilter) return false;
    const q = search.toLowerCase();
    if (q && !v.name.toLowerCase().includes(q) && !v.code.toLowerCase().includes(q)) return false;
    return true;
  });

  const selected = vendors.find(v => v.id === selectedId);
  const totalAP = vendors.reduce((s, v) => s + (AP_BALANCE[v.id] || 0), 0);
  const activeCount = vendors.filter(v => v.status === "active").length;

  return (
    <div className="mod-page">
      <div className="mod-scroll">
        <div className="mod-inner">
          <div className="page-head">
            <div>
              <div className="page-title">Vendors</div>
              <div className="page-sub">{vendors.length} vendor · {activeCount} aktif</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-ghost">
                <svg viewBox="0 0 24 24"><polyline points="21 15 21 21 3 21 3 15"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Export
              </button>
              <button className="btn-primary">
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Tambah Vendor
              </button>
            </div>
          </div>

          {/* Attention */}
          {(staleVendors.length > 0 || overdueVendors.length > 0) && (
            <div className="attn-wrap">
              <div className="attn-hd" onClick={() => setAttnOpen(!attnOpen)}>
                <div className="attn-hd-icon">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <div className="attn-hd-title">
                  {overdueVendors.length + staleVendors.length} vendor perlu perhatian
                </div>
                <svg className={`attn-hd-chev${attnOpen ? "" : " collapsed"}`} viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
              </div>
              {attnOpen && (
                <>
                  <div className="attn-wrap-desc">
                    Terdapat vendor dengan outstanding AP atau tidak ada transaksi dalam 60 hari.
                  </div>
                  {overdueVendors.length > 0 && (
                    <div className="acc">
                      <div className="acc-hd" onClick={() => setOverdueOpen(!overdueOpen)}>
                        <div className="acc-icon red"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
                        <div className="acc-label">Outstanding AP — {overdueVendors.length} vendor</div>
                        <div className="acc-amt">{fmtRp(overdueVendors.reduce((s, v) => s + (AP_BALANCE[v.id] || 0), 0))}</div>
                        <div className="acc-badge red">{overdueVendors.length}</div>
                        <svg className={`acc-chev${overdueOpen ? " open" : ""}`} viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
                      </div>
                      {overdueOpen && (
                        <div className="acc-body">
                          <div className="acc-body-inner">
                            {overdueVendors.map(v => (
                              <div key={v.id} className="item-card overdue">
                                <div className="item-ref">{v.code}</div>
                                <div className="item-name">{v.name}</div>
                                <div className="item-sub">{v.contact} · {v.payment_terms}</div>
                                <div className="item-foot">
                                  <div className="item-actions">
                                    <button className="btn-sm btn-pay" onClick={() => { setSelectedId(v.id); setDrawerTab("detail"); }}>Lihat Detail</button>
                                  </div>
                                  <div className="item-amt">{fmtRp(AP_BALANCE[v.id] || 0)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {staleVendors.length > 0 && (
                    <div className="acc">
                      <div className="acc-hd" onClick={() => setStaleOpen(!staleOpen)}>
                        <div className="acc-icon amber"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                        <div className="acc-label">Tidak ada transaksi 60+ hari — {staleVendors.length} vendor</div>
                        <div className="acc-badge amber">{staleVendors.length}</div>
                        <svg className={`acc-chev${staleOpen ? " open" : ""}`} viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
                      </div>
                      {staleOpen && (
                        <div className="acc-body">
                          <div className="acc-body-inner">
                            {staleVendors.map(v => {
                              const lt = fmtLastTx(v.lastTx);
                              return (
                                <div key={v.id} className="item-card">
                                  <div className="item-ref">{v.code}</div>
                                  <div className="item-name">{v.name}</div>
                                  <div className="item-sub">{lt.text}</div>
                                  <div className="item-foot">
                                    <div className="item-actions">
                                      <button className="btn-sm btn-bill" onClick={() => { setSelectedId(v.id); setDrawerTab("detail"); }}>Lihat Vendor</button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Filter bar */}
          <div className="filter-bar">
            <div className="f-search">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input placeholder="Cari nama atau kode vendor…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="fsep" />
            <div className="chip-grp">
              {["", "inventory", "service", "expense"].map(cat => (
                <div key={cat} className={`chip${catFilter === cat ? " on" : ""}`} onClick={() => setCatFilter(cat)}>
                  {cat === "" ? "Semua" : CAT_LABELS[cat]}
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 44 }}></th>
                  <th>Vendor</th>
                  <th>Kategori</th>
                  <th>Terms</th>
                  <th className="r">AP Balance</th>
                  <th>Transaksi Terakhir</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="tbl-empty">Tidak ada vendor yang cocok</td></tr>
                )}
                {filtered.map(v => {
                  const bal = AP_BALANCE[v.id] || 0;
                  const lt = fmtLastTx(v.lastTx);
                  return (
                    <tr key={v.id} className={`${selectedId === v.id ? "sel" : ""}${v.status === "inactive" ? " inactive-row" : ""}`} onClick={() => { setSelectedId(v.id); setDrawerTab("detail"); }}>
                      <td>
                        <div className={`vn-av ${v.category}`}>{v.initials}</div>
                      </td>
                      <td>
                        <div className="td-name">{v.name}</div>
                        <div className="td-sub">{v.code} · {v.contact}</div>
                      </td>
                      <td><span className={`cat-badge ${v.category}`}>{CAT_LABELS[v.category] || v.category}</span></td>
                      <td style={{ color: "var(--color-text-tertiary)", fontSize: 12 }}>{v.payment_terms}</td>
                      <td className="r">
                        {bal > 0 ? <span className="td-warn">{fmtRp(bal)}</span> : <span className="td-dim">—</span>}
                      </td>
                      <td>
                        <span className={lt.stale ? "last-tx-stale" : "last-tx-ok"} style={{ fontSize: 11 }}>{lt.text}</span>
                      </td>
                      <td><span className={`status-badge ${v.status}`}>{v.status === "active" ? "Aktif" : "Non-aktif"}</span></td>
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
        <div className="sb-st"><span className="sb-st-lbl">Total</span><span className="sb-st-val">{vendors.length} vendor</span></div>
        <div className="sb-sep" />
        <div className="sb-st"><span className="sb-st-lbl">Aktif</span><span className="sb-st-val">{activeCount}</span></div>
        <div className="sb-sep" />
        <div className="sb-st"><span className="sb-st-lbl">Outstanding AP</span><span className={`sb-st-val${totalAP > 0 ? " danger" : ""}`}>{fmtRp(totalAP)}</span></div>
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
              <div className={`drawer-av ${selected.category}`}>{selected.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="drawer-title">{selected.name}</div>
                <div className="drawer-sub">{selected.code} · <span className={`cat-badge ${selected.category}`}>{CAT_LABELS[selected.category]}</span></div>
              </div>
              <button className="drawer-close" onClick={() => setSelectedId(null)}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="drawer-tabs">
              {["detail", "bank", "bills"].map(t => (
                <div key={t} className={`drawer-tab${drawerTab === t ? " active" : ""}`} onClick={() => setDrawerTab(t)}>
                  {t === "detail" ? "Detail" : t === "bank" ? "Bank" : "Riwayat Bill"}
                </div>
              ))}
            </div>
            <div className="drawer-body">
              {drawerTab === "detail" && (
                <>
                  <div className="drawer-stat-row">
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">AP Balance</div>
                      <div className={`drawer-stat-val${(AP_BALANCE[selected.id] || 0) > 0 ? " danger" : ""}`}>{fmtRp(AP_BALANCE[selected.id] || 0)}</div>
                    </div>
                    <div className="drawer-stat-card">
                      <div className="drawer-stat-lbl">Terms</div>
                      <div className="drawer-stat-val" style={{ fontSize: 13 }}>{selected.payment_terms}</div>
                    </div>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-section-title">Informasi Vendor</div>
                    {[
                      ["Nama Legal", selected.name],
                      ["Kode", selected.code],
                      ["Tipe", selected.type],
                      ["PIC / Kontak", selected.contact],
                      ["Telepon", selected.phone],
                      ["Email", selected.email],
                      ["Alamat", selected.address],
                      ["NPWP", selected.tax_id || "—"],
                      ["Status PKP", selected.pkp],
                    ].map(([label, value]) => (
                      <div key={label} className="drawer-row">
                        <div className="drawer-label">{label}</div>
                        <div className="drawer-value">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-section-title">Akuntansi & Pajak</div>
                    {[
                      ["Akun Default", ACCT_LABELS[selected.acct] || selected.acct],
                      ["Pajak Default", DEFTAX_LABELS[selected.defTax] || selected.defTax],
                      ["PPh Pemotongan", PPH_LABELS[selected.pph] || selected.pph],
                    ].map(([label, value]) => (
                      <div key={label} className="drawer-row">
                        <div className="drawer-label">{label}</div>
                        <div className="drawer-value">{value}</div>
                      </div>
                    ))}
                  </div>
                  {selected.notes && (
                    <div className="drawer-section">
                      <div className="drawer-section-title">Catatan</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.6, padding: "6px 0" }}>{selected.notes}</div>
                    </div>
                  )}
                </>
              )}
              {drawerTab === "bank" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Rekening Bank</div>
                  {selected.banks.map((bank, i) => (
                    <div key={i} style={{ background: "var(--color-surface-sunken)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-md)", padding: "12px 14px", marginBottom: 8 }}>
                      {bank.isDefault && <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-action)", marginBottom: 6, letterSpacing: ".06em", textTransform: "uppercase" }}>Default</div>}
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>{bank.name} — {bank.branch}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: ".05em" }}>{bank.acc}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 4 }}>a/n {bank.holder}</div>
                    </div>
                  ))}
                </div>
              )}
              {drawerTab === "bills" && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Riwayat Transaksi</div>
                  <div style={{ color: "var(--color-text-tertiary)", fontSize: 12, padding: "12px 0" }}>Transaksi terbaru dari Bills tercatat di sini.</div>
                  <div className="drawer-row">
                    <div className="drawer-label">Terakhir</div>
                    <div className="drawer-value">{selected.lastTx || "—"}</div>
                  </div>
                  <div className="drawer-row">
                    <div className="drawer-label">AP Saat Ini</div>
                    <div className="drawer-value mono">{fmtRp(AP_BALANCE[selected.id] || 0)}</div>
                  </div>
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
                Buat Bill Baru
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
