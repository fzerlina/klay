import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CUSTOMERS as customers } from "../data/seed/customers";
import { useInvoices } from "../state/InvoicesContext";
import { TODAY } from "../lib/clock";
import { formatRupiah, formatDate, initials } from "../lib/format";
import "./modules.css";
import "./invoice-create.css";

const APPROVAL_LABEL = { terkirim: "Terkirim", draft: "Draft" };
const PAY_LABEL = { lunas: "Lunas", overdue: "Jatuh Tempo", belumbayar: "Belum Bayar" };

function payBadgeClass(payStatus) {
  if (payStatus === "lunas") return "badge-lunas";
  if (payStatus === "overdue") return "badge-overdue";
  return "badge-belumbayar";
}

function RowMenu({ inv, onClose, onAction }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);
  const canPay = inv.approval === "terkirim" && inv.payStatus !== "lunas";
  return (
    <div className="row-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <div className="row-menu-item" onClick={() => onAction("edit", inv)}>
        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Edit
      </div>
      {canPay && (
        <div className="row-menu-item" onClick={() => onAction("payment", inv)}>
          <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          Catat Pembayaran
        </div>
      )}
      <div className="row-menu-item" onClick={() => onAction("recurring", inv)}>
        <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
        Buat Berulang
      </div>
      <div className="row-menu-item" onClick={() => onAction("duplicate", inv)}>
        <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        Duplikat
      </div>
      <div className="row-menu-sep" />
      <div className="row-menu-item danger" onClick={() => onAction("archive", inv)}>
        <svg viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
        Arsipkan
      </div>
    </div>
  );
}

const AISvg = () => (
  <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg>
);

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { invoices, sendInvoice } = useInvoices();
  const [selectedId, setSelectedId] = useState(null);
  const [drawerTab, setDrawerTab] = useState("detail");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [checked, setChecked] = useState(() => new Set());
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [toast, setToast] = useState("");
  const toastTmr = useRef(null);

  // Drawer send modal
  const [sendOpen, setSendOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [sendCC, setSendCC] = useState("");
  const [sendMsg, setSendMsg] = useState("Terlampir invoice kami, mohon ditindaklanjuti.");
  const [sendSuccess, setSendSuccess] = useState(false);

  const overdue = invoices.filter(i => i.payStatus === "overdue");
  const sentUnpaid = invoices.filter(i => i.approval === "terkirim" && i.payStatus === "belumbayar");
  const totalAR = invoices.filter(i => i.payStatus !== "lunas").reduce((s, i) => s + i.total, 0);

  // Invoices created this month (calendar month of TODAY)
  const thisMonthPrefix = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, "0")}`;
  const createdThisMonth = invoices.filter(i => i.date && i.date.startsWith(thisMonthPrefix));

  function showToast(msg) {
    setToast(msg);
    if (toastTmr.current) clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToast(""), 1800);
  }

  const filtered = useMemo(() => {
    let list = [...invoices];
    const q = search.toLowerCase();
    if (q) list = list.filter(i => i.invNo.toLowerCase().includes(q) || i.customerName.toLowerCase().includes(q) || i.custPO.toLowerCase().includes(q));
    if (statusFilter === "terkirim") list = list.filter(i => i.approval === "terkirim");
    else if (statusFilter === "draft") list = list.filter(i => i.approval === "draft");
    else if (statusFilter === "overdue") list = list.filter(i => i.payStatus === "overdue");
    else if (statusFilter === "belumbayar") list = list.filter(i => i.approval === "terkirim" && i.payStatus === "belumbayar");
    else if (statusFilter === "lunas") list = list.filter(i => i.payStatus === "lunas");
    const ord = i => {
      if (i.payStatus === "overdue") return 0;
      if (i.approval === "draft") return 1;
      if (i.approval === "terkirim" && i.payStatus === "belumbayar") return 2;
      return 3;
    };
    return list.sort((a, b) => ord(a) - ord(b));
  }, [invoices, search, statusFilter]);

  const selected = invoices.find(i => i.id === selectedId);
  const selectedCustomer = selected ? customers.find(c => c.id === selected.customer) : null;

  // 4 cards — amount-first
  const bannerCards = [
    {
      label: "Jatuh Tempo",
      primary: formatRupiah(overdue.reduce((s, i) => s + i.total, 0)),
      secondary: `${overdue.length} invoice`,
      cls: "overdue",
      filterValue: "overdue",
    },
    {
      label: "Belum Dibayar",
      primary: formatRupiah(sentUnpaid.reduce((s, i) => s + i.total, 0)),
      secondary: `${sentUnpaid.length} invoice`,
      cls: "warn",
      filterValue: "belumbayar",
    },
    {
      label: "Total Invoice",
      primary: invoices.length.toString(),
      secondary: "semua invoice",
      cls: "",
      filterValue: "",
    },
    {
      label: "Dibuat Bulan Ini",
      primary: createdThisMonth.length.toString(),
      secondary: `${formatRupiah(createdThisMonth.reduce((s, i) => s + i.total, 0))}`,
      cls: "action",
      filterValue: null,
    },
  ];

  // Checkbox helpers
  const allChecked = filtered.length > 0 && filtered.every(i => checked.has(i.id));
  function toggleAll() {
    if (allChecked) setChecked(new Set());
    else setChecked(new Set(filtered.map(i => i.id)));
  }
  function toggleOne(id) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onRowAction(action, inv) {
    setMenuOpenFor(null);
    if (action === "edit") showToast(`Edit ${inv.id} (demo)`);
    else if (action === "payment") showToast(`Catat pembayaran untuk ${inv.id}`);
    else if (action === "recurring") showToast(`Buat invoice berulang dari ${inv.id}`);
    else if (action === "duplicate") showToast(`Duplikat ${inv.id}`);
    else if (action === "archive") showToast(`${inv.id} diarsipkan`);
  }

  function onBulkAction(action) {
    const count = checked.size;
    if (action === "remind") showToast(`Reminder dikirim ke ${count} customer`);
    else if (action === "lunas") showToast(`${count} invoice ditandai Lunas`);
    else if (action === "archive") showToast(`${count} invoice diarsipkan`);
    setChecked(new Set());
  }

  function openSendForSelected() {
    if (!selected) return;
    setSendEmail(selected.custEmail || "");
    setSendCC("");
    setSendMsg("Terlampir invoice kami, mohon ditindaklanjuti.");
    setSendSuccess(false);
    setSendOpen(true);
  }

  function confirmSend() {
    if (!selected) return;
    sendInvoice(selected.id, { channel: "email" });
    setSendSuccess(true);
    setTimeout(() => {
      setSendOpen(false);
      setSelectedId(null);
    }, 1300);
  }

  return (
    <div className="mod-page">
      {/* Invoice Banner */}
      <div className="inv-banner">
        <div className="inv-banner-top">
          <div>
            <div className="inv-banner-title">Invoices</div>
            <div className="inv-banner-sub">{invoices.length} invoice · {invoices.filter(i => i.payStatus !== "lunas").length} aktif</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="inv-ar-badge">
              Total Piutang <span className="inv-ar-amt">{formatRupiah(totalAR)}</span>
            </div>
            <button className="oz-btn primary" style={{ marginLeft: 4 }} onClick={() => setChoiceOpen(true)}>
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Buat Invoice
            </button>
          </div>
        </div>
        <div className="inv-banner-cards">
          {bannerCards.map(c => (
            <div
              key={c.label}
              className={`inv-bc${c.cls ? ` ${c.cls}` : ""}${statusFilter === c.filterValue && c.filterValue ? " active" : ""}`}
              onClick={() => {
                if (c.filterValue === null) return;
                setStatusFilter(statusFilter === c.filterValue ? "" : c.filterValue);
              }}
              style={c.filterValue === null ? { cursor: "default" } : undefined}
            >
              <div className="inv-bc-label">{c.label}</div>
              <div className="inv-bc-primary">{c.primary}</div>
              <div className="inv-bc-secondary">{c.secondary}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mod-scroll">
        <div className="mod-inner">
          {/* Filter / bulk bar */}
          {checked.size > 0 ? (
            <div className="bulk-bar">
              <div className="bulk-count">{checked.size} invoice dipilih</div>
              <button className="bulk-btn" onClick={() => onBulkAction("remind")}>
                Kirim Reminder
              </button>
              <button className="bulk-btn primary" onClick={() => onBulkAction("lunas")}>
                Tandai Lunas
              </button>
              <button className="bulk-btn" onClick={() => onBulkAction("archive")}>
                Arsipkan
              </button>
              <button className="bulk-close" onClick={() => setChecked(new Set())}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ) : (
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
          )}

          {/* Table */}
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36, paddingLeft: 14 }}>
                    <input type="checkbox" className="row-check" checked={allChecked} onChange={toggleAll} />
                  </th>
                  <th>Invoice No.</th>
                  <th>Tanggal Invoice</th>
                  <th>Company</th>
                  <th>Jatuh Tempo</th>
                  <th className="r">Total</th>
                  <th>Status Invoice</th>
                  <th>Status Bayar</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="tbl-empty">Tidak ada invoice yang cocok</td></tr>
                )}
                {filtered.map(inv => {
                  const cust = customers.find(c => c.id === inv.customer);
                  const isChecked = checked.has(inv.id);
                  return (
                    <tr
                      key={inv.id}
                      className={selectedId === inv.id ? "sel" : ""}
                      onClick={() => { setSelectedId(inv.id); setDrawerTab("detail"); }}
                    >
                      <td onClick={(e) => e.stopPropagation()} style={{ paddingLeft: 14 }}>
                        <input
                          type="checkbox"
                          className="row-check"
                          checked={isChecked}
                          onChange={() => toggleOne(inv.id)}
                        />
                      </td>
                      <td>
                        <span className="td-mono" style={{ color: "var(--color-action)", fontSize: 11 }}>
                          {inv.invNo === "—" ? <em style={{ fontStyle: "italic", color: "var(--color-text-tertiary)" }}>Draft</em> : inv.invNo}
                        </span>
                        {inv.isAI && <span className="badge badge-ai" style={{ marginLeft: 5 }}>AI</span>}
                      </td>
                      <td style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{formatDate(inv.date)}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <div className={`cn-av ${cust?.type || "perusahaan"}`} style={{ width: 30, height: 30, fontSize: 10, flexShrink: 0 }}>
                            {initials(inv.customerName)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="td-name" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 }}>{inv.customerName}</div>
                            <div className="td-sub" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 }}>{cust?.address || ""}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 11, color: inv.payStatus === "overdue" ? "var(--danger-text)" : "var(--color-text-tertiary)", fontWeight: inv.payStatus === "overdue" ? 600 : 400 }}>
                        {formatDate(inv.due)}
                      </td>
                      <td className="r"><span className="td-mono">{formatRupiah(inv.total)}</span></td>
                      <td><span className={`badge badge-${inv.approval}`}>{APPROVAL_LABEL[inv.approval] || inv.approval}</span></td>
                      <td><span className={`badge ${payBadgeClass(inv.payStatus)}`}>{PAY_LABEL[inv.payStatus] || inv.payStatus}</span></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="row-kebab-wrap">
                          <button
                            className="row-kebab"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenFor(menuOpenFor === inv.id ? null : inv.id);
                            }}
                          >
                            <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
                          </button>
                          {menuOpenFor === inv.id && (
                            <RowMenu inv={inv} onClose={() => setMenuOpenFor(null)} onAction={onRowAction} />
                          )}
                        </div>
                      </td>
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
        <div className="sb-st"><span className="sb-st-lbl">Jatuh Tempo</span><span className={`sb-st-val${overdue.length > 0 ? " danger" : ""}`}>{formatRupiah(overdue.reduce((s, i) => s + i.total, 0))}</span></div>
        <div className="sb-sep" />
        <div className="sb-st"><span className="sb-st-lbl">Lunas</span><span className="sb-st-val success">{formatRupiah(invoices.filter(i => i.payStatus === "lunas").reduce((s, i) => s + i.total, 0))}</span></div>
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
              {[["detail", "Detail"], ["items", "Items"], ["audit", "Audit"]].map(([t, label]) => (
                <div key={t} className={`drawer-tab${drawerTab === t ? " active" : ""}`} onClick={() => setDrawerTab(t)}>{label}</div>
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
                      <div className={`drawer-stat-val${selected.payStatus === "lunas" ? " success" : selected.payStatus === "overdue" ? " danger" : ""}`} style={{ fontSize: 13 }}>
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
                          <div className="audit-by">{a.by} · {formatDate(a.date)} {a.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="drawer-footer">
              {selected.approval === "draft" && (
                <button className="drawer-btn primary" onClick={openSendForSelected}>
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

      {/* Choice modal */}
      {choiceOpen && (
        <div className="modal-overlay open" onClick={() => setChoiceOpen(false)}>
          <div className="choice-box" onClick={(e) => e.stopPropagation()}>
            <div className="choice-head">
              <div className="choice-title">Buat Invoice Baru</div>
              <button className="choice-close" onClick={() => setChoiceOpen(false)}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="method-cards">
              <div className="method-card" onClick={() => { setChoiceOpen(false); navigate("/invoices/new?mode=upload"); }}>
                <div className="method-icon upload">
                  <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <div className="method-title">Upload PO Customer</div>
                <div className="method-sub">Upload dokumen PO dan AI akan mengekstrak data secara otomatis.</div>
                <span className="method-tag ai"><AISvg />AI Ekstrak Otomatis</span>
              </div>
              <div className="method-card" onClick={() => { setChoiceOpen(false); navigate("/invoices/new?mode=manual"); }}>
                <div className="method-icon manual">
                  <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </div>
                <div className="method-title">Isi Manual</div>
                <div className="method-sub">Input data invoice secara manual dengan form terstruktur.</div>
                <span className="method-tag man">Form Manual</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Send modal */}
      {sendOpen && selected && (
        <div className="modal-overlay open" onClick={() => !sendSuccess && setSendOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            {sendSuccess ? (
              <div className="send-success">
                <div className="send-success-icon">
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div className="send-success-title">Invoice terkirim ✓</div>
                <div className="send-success-sub">Status berubah ke "Belum Bayar"</div>
              </div>
            ) : (
              <>
                <div className="modal-title">Kirim Invoice</div>
                <div className="modal-sub">Invoice {selected.id} akan dikirimkan ke email customer. PDF dilampirkan otomatis.</div>
                <div className="fld">
                  <label>Kirim ke</label>
                  <input type="email" value={sendEmail} onChange={(e) => setSendEmail(e.target.value)} placeholder="email@customer.id" />
                </div>
                <div className="fld">
                  <label>CC (opsional)</label>
                  <input type="email" value={sendCC} onChange={(e) => setSendCC(e.target.value)} placeholder="cc@kamu.id" />
                </div>
                <div className="fld">
                  <label>Pesan</label>
                  <textarea value={sendMsg} onChange={(e) => setSendMsg(e.target.value)} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", background: "var(--color-surface-sunken)", borderRadius: "var(--radius-sm)", marginTop: 2, fontSize: 11, color: "var(--color-text-tertiary)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" style={{ stroke: "var(--color-action)", fill: "none", strokeWidth: 1.5 }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>
                  PDF invoice dilampirkan otomatis
                </div>
                <div className="modal-footer">
                  <button className="modal-cancel" onClick={() => setSendOpen(false)}>Batal</button>
                  <button className="modal-confirm" onClick={confirmSend}>
                    <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    Kirim Sekarang
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
