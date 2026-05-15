import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { VENDORS } from "../data/seed/vendors";
import { useBills } from "../state/BillsContext";
import { formatDate, initials } from "../lib/format";
import "./invoice-create.css";

const EXPENSE_ACCOUNTS = [
  { code: "1-3100", name: "Raw Materials" },
  { code: "1-3300", name: "Finished Goods" },
  { code: "1-6300", name: "Office Equipment" },
  { code: "6-1000", name: "Beban Pembelian" },
  { code: "6-2300", name: "Office Rent" },
  { code: "6-2700", name: "Professional Services" },
  { code: "6-3100", name: "Postage & Courier" },
];

const PPH_OPTIONS = [
  { v: "none", label: "Tidak ada PPh", rate: 0 },
  { v: "pph23_2", label: "PPh 23 — 2% (jasa/sewa)", rate: 0.02 },
  { v: "pph23_15", label: "PPh 23 — 15% (dividen/bunga)", rate: 0.15 },
  { v: "pph4_final", label: "PPh 4(2) Final — konstruksi", rate: 0.02 },
];

function fmtNum(n) {
  if (!n) return "0";
  return Number(n).toLocaleString("id-ID");
}

function CheckSvg() {
  return <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>;
}

const AISvg = () => (
  <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg>
);

function VendorCombobox({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = VENDORS.find((v) => v.id === value);
  const q = search.toLowerCase();
  const list = VENDORS.filter(
    (v) => !q || v.name.toLowerCase().includes(q) || (v.contact || "").toLowerCase().includes(q),
  );

  return (
    <div className="cust-combo" ref={ref}>
      <button type="button" className={`cust-combo-btn${open ? " open" : ""}`} onClick={() => setOpen(!open)}>
        {selected ? (
          <>
            <span className="cust-combo-name">{selected.name}</span>
            <span className="cust-combo-addr">{selected.address}</span>
          </>
        ) : (
          <span className="cust-combo-placeholder">Pilih Vendor…</span>
        )}
        <svg className="cust-combo-chev" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div className="cust-combo-pop">
          <div className="cust-combo-search">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau PIC…" autoFocus />
          </div>
          <div className="cust-combo-list">
            {list.length === 0 && <div className="cust-combo-empty">Tidak ada vendor cocok</div>}
            {list.map((v) => (
              <div
                key={v.id}
                className={`cust-combo-item${value === v.id ? " selected" : ""}`}
                onClick={() => { onChange(v.id); setOpen(false); setSearch(""); }}
              >
                <div className="cust-combo-item-av">{initials(v.name)}</div>
                <div className="cust-combo-item-body">
                  <div className="cust-combo-item-name">{v.name}</div>
                  <div className="cust-combo-item-addr">{v.contact} · {v.payment_terms}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillCreatePage() {
  const navigate = useNavigate();
  const { addBill } = useBills();

  const [step, setStep] = useState("upload"); // upload | scanning | review
  const [scanPhase, setScanPhase] = useState(0);
  const [aiFilled, setAiFilled] = useState(false);
  const [toast, setToast] = useState("");
  const toastTmr = useRef(null);

  // Form state
  const [vendorId, setVendorId] = useState("");
  const [poNo, setPoNo] = useState("");
  const [invNo, setInvNo] = useState("");
  const [date, setDate] = useState("2025-04-15");
  const [due, setDue] = useState("2025-05-15");
  const [keterangan, setKeterangan] = useState("");
  const [items, setItems] = useState([]); // {desc,qty,price,acct}
  const [ppnRate, setPpnRate] = useState(0.11);
  const [pphChoice, setPphChoice] = useState("none");
  const [attachments, setAttachments] = useState([]);

  const vendor = useMemo(() => VENDORS.find((v) => v.id === vendorId), [vendorId]);

  function showToast(msg) {
    setToast(msg);
    if (toastTmr.current) clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToast(""), 2000);
  }

  function simulateScan() {
    setStep("scanning");
    setScanPhase(0);
    setTimeout(() => setScanPhase(1), 1500);
    setTimeout(() => setScanPhase(2), 3000);
    setTimeout(() => goToReview(), 3700);
  }

  function goToReview() {
    // Prefill from a fake OCR result (anchor on V001 - PT Supplier Elektronik)
    setVendorId("V001");
    setPoNo("PO-2025-0006");
    setInvNo("INV-V001-20250415");
    setDate("2025-04-15");
    setDue("2025-05-15");
    setKeterangan("Pengadaan komponen elektronik Q2 — sesuai PO.");
    setItems([
      { desc: "Komponen Elektronik - Panel LCD 24 inch", qty: 50, price: 1500000, acct: "1-3100" },
    ]);
    setPpnRate(0.11);
    setPphChoice("none");
    setAttachments([{ name: "invoice_supplier_elektronik.pdf", size: "PDF · 2.4 MB", fromOCR: true }]);
    setAiFilled(true);
    setStep("review");
  }

  // Totals
  const dpp = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const ppn = Math.round(dpp * ppnRate);
  const pphRate = PPH_OPTIONS.find((o) => o.v === pphChoice)?.rate || 0;
  const pph = Math.round(dpp * pphRate);
  const total = dpp + ppn - pph;

  // Items handlers
  function addRow() { setItems((p) => [...p, { desc: "", qty: 1, price: 0, acct: "6-1000" }]); }
  function updateRow(i, patch) { setItems((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it))); }
  function delRow(i) { setItems((p) => p.filter((_, idx) => idx !== i)); }
  function addAttach() {
    const names = ["po_vendor.pdf", "berita_acara.pdf", "faktur_pajak.pdf"];
    setAttachments((p) => [...p, { name: names[Math.floor(Math.random() * names.length)], size: "PDF · 1.1 MB", fromOCR: false }]);
  }
  function delAttach(i) { setAttachments((p) => p.filter((_, idx) => idx !== i)); }

  // Save
  function buildDraft(approval) {
    if (!vendor) return null;
    return {
      vendor: vendor.id,
      vendorName: vendor.name,
      initials: vendor.initials || initials(vendor.name),
      poNo,
      invNo,
      date,
      due,
      keterangan,
      dpp,
      ppn,
      pph23: pph,
      total,
      approval,
      grn: poNo ? "matched" : "pending",
      items: items.map((it) => {
        const acct = EXPENSE_ACCOUNTS.find((a) => a.code === it.acct);
        return {
          ...it,
          subtotal: (Number(it.qty) || 0) * (Number(it.price) || 0),
          acctName: acct?.name || "",
        };
      }),
      fromAI: aiFilled,
    };
  }

  function onSaveDraft() {
    const draft = buildDraft("draft");
    if (!draft) { showToast("Pilih vendor dulu"); return; }
    if (!items.length) { showToast("Tambahkan minimal 1 item"); return; }
    addBill(draft);
    showToast("Draft tersimpan ✓");
    setTimeout(() => navigate("/bills"), 600);
  }

  function onSubmitForApproval() {
    const draft = buildDraft("review");
    if (!draft) { showToast("Pilih vendor dulu"); return; }
    if (!items.length) { showToast("Tambahkan minimal 1 item"); return; }
    addBill(draft);
    showToast("Bill dikirim untuk approval ✓");
    setTimeout(() => navigate("/bills"), 700);
  }

  const canSubmit = vendor && items.length > 0 && total > 0;

  return (
    <div className="addpage">
      {/* Header */}
      <div className="ap-head">
        <div className="ap-title">Tambah Bill</div>
        <div className="ap-stepper">
          {[
            { n: 1, label: "Upload Dokumen", done: step === "review", active: step === "upload" || step === "scanning" },
            { n: 2, label: "Review & Simpan", done: false, active: step === "review" },
          ].map((s, i) => (
            <span key={s.n} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <div className={`ap-step${s.active ? " active" : ""}${s.done ? " done" : ""}`}>
                <div className="ap-step-num">{s.done ? <CheckSvg /> : s.n}</div>
                {s.label}
              </div>
              {i < 1 && <div className={`ap-step-line${s.done ? " done" : ""}`} />}
            </span>
          ))}
        </div>
        <button className="ap-close" onClick={() => navigate("/bills")}>
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* STEP 1 — Upload */}
      {(step === "upload" || step === "scanning") && (
        <div className="ap-s1">
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 5 }}>Upload Invoice dari Vendor</div>
            <div style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>
              Upload foto, screenshot, atau file PDF tagihan dari vendor.
            </div>
          </div>
          <div className="upload-zone" onClick={simulateScan}>
            <div className="upload-zone-icon">
              <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Drag & drop file di sini</div>
            <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginBottom: 14 }}>
              atau klik untuk memilih dari perangkat kamu
            </div>
            <button className="upload-zone-cta" onClick={(e) => { e.stopPropagation(); simulateScan(); }}>Pilih File</button>
          </div>
          <div className="ftgrid">
            <div className="ftcard">
              <div className="ftcard-icon" style={{ background: "var(--success-surface)" }}>
                <svg viewBox="0 0 24 24" style={{ stroke: "var(--success-text)" }}><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/></svg>
              </div>
              <div className="ftcard-title">Screenshot</div>
              <div className="ftcard-sub">WA, email, atau tampilan invoice digital</div>
              <div className="ftcard-ext">JPG · PNG · WEBP</div>
            </div>
            <div className="ftcard">
              <div className="ftcard-icon" style={{ background: "var(--warning-surface)" }}>
                <svg viewBox="0 0 24 24" style={{ stroke: "var(--warning-text)" }}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </div>
              <div className="ftcard-title">Foto Invoice Fisik</div>
              <div className="ftcard-sub">Foto kamera HP, pastikan teks terbaca jelas</div>
              <div className="ftcard-ext">JPG · PNG · HEIC</div>
            </div>
            <div className="ftcard">
              <div className="ftcard-icon" style={{ background: "var(--danger-surface)" }}>
                <svg viewBox="0 0 24 24" style={{ stroke: "var(--danger-text)" }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div className="ftcard-title">PDF Invoice</div>
              <div className="ftcard-sub">File PDF dari sistem vendor atau e-faktur</div>
              <div className="ftcard-ext">PDF · maks. 10 MB</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", textAlign: "center" }}>
            AI akan mengekstrak semua data otomatis — kamu bisa koreksi sebelum menyimpan
          </div>
        </div>
      )}

      {/* Scanning overlay */}
      {step === "scanning" && (
        <div className="scan-overlay">
          <div className="scan-loading-card">
            <div className="scan-spinner" />
            <div className="scan-loading-title">Memproses Dokumen</div>
            <div className="scan-loading-status">
              {scanPhase === 0 && "Memverifikasi keamanan file…"}
              {scanPhase === 1 && "Mengekstrak data invoice vendor…"}
              {scanPhase >= 2 && "Matching vendor & PO…"}
            </div>
            <div className="scan-progress">
              <div className="scan-progress-fill" style={{ width: scanPhase === 0 ? "33%" : scanPhase === 1 ? "70%" : "100%" }} />
            </div>
            <div className="scan-loading-file">invoice_supplier_elektronik.pdf · 2.4 MB</div>
          </div>
        </div>
      )}

      {/* STEP 2 — Review */}
      {step === "review" && (
        <div className="ap-split">
          {/* Form side */}
          <div className="ap-form-side">
            {aiFilled && (
              <div className="ai-fill-banner">
                <div className="ai-fill-banner-title"><AISvg />AI mengekstrak data dari invoice vendor</div>
                <div className="ai-fill-banner-sub">Periksa setiap field. Akurasi rata-rata 96% — koreksi seperlunya.</div>
              </div>
            )}

            <div className="form-sec card">
              <div className="form-sec-title">Informasi Tagihan</div>
              <div className="fg2">
                <div className="form-fld">
                  <label>Vendor <span className="fld-conf hi">98%</span></label>
                  <VendorCombobox value={vendorId} onChange={setVendorId} />
                </div>
                <div className="form-fld">
                  <label>Nomor Invoice Vendor <span className="fld-conf hi">97%</span></label>
                  <input type="text" value={invNo} onChange={(e) => setInvNo(e.target.value)} placeholder="No. invoice dari vendor" style={{ fontFamily: "var(--font-mono)" }} />
                </div>
              </div>
              <div className="fg3">
                <div className="form-fld">
                  <label>Tanggal Invoice <span className="fld-conf hi">96%</span></label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="form-fld">
                  <label>Jatuh Tempo <span className="fld-conf hi">94%</span></label>
                  <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
                </div>
                <div className="form-fld">
                  <label>Nomor PO <span className="fld-conf hi">97%</span></label>
                  <input type="text" value={poNo} onChange={(e) => setPoNo(e.target.value)} placeholder="PO-…" style={{ fontFamily: "var(--font-mono)" }} />
                </div>
              </div>
            </div>

            <div className="form-sec card">
              <div className="form-sec-title">Rincian Item</div>
              <div className="items-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: "32%" }}>Deskripsi</th>
                      <th className="r" style={{ width: "9%" }}>Qty</th>
                      <th className="r" style={{ width: "15%" }}>Harga (Rp)</th>
                      <th className="r" style={{ width: "15%" }}>Subtotal (Rp)</th>
                      <th style={{ width: "24%" }}>Akun</th>
                      <th style={{ width: "5%" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--color-text-tertiary)", padding: 12, fontSize: 11 }}>Belum ada item</td></tr>
                    )}
                    {items.map((it, i) => {
                      const sub = (Number(it.qty) || 0) * (Number(it.price) || 0);
                      return (
                        <tr key={i}>
                          <td>
                            <input type="text" value={it.desc} onChange={(e) => updateRow(i, { desc: e.target.value })} placeholder="Deskripsi item…" />
                          </td>
                          <td><input type="text" value={it.qty} style={{ textAlign: "right" }} onChange={(e) => updateRow(i, { qty: parseInt(e.target.value) || 0 })} /></td>
                          <td><input type="text" value={fmtNum(it.price)} style={{ textAlign: "right", fontFamily: "var(--font-mono)" }} onChange={(e) => updateRow(i, { price: parseInt(e.target.value.replace(/\./g, "")) || 0 })} /></td>
                          <td><input type="text" value={fmtNum(sub)} readOnly style={{ textAlign: "right", fontWeight: 700, fontFamily: "var(--font-mono)" }} /></td>
                          <td>
                            <select value={it.acct} onChange={(e) => updateRow(i, { acct: e.target.value })} style={{ fontSize: 11 }}>
                              {EXPENSE_ACCOUNTS.map((a) => (
                                <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <button className="btn-del-row" onClick={() => delRow(i)}>
                              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button className="btn-add-row" onClick={addRow}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Tambah Baris
              </button>
              {items.length > 0 && (
                <div className="total-block">
                  <div className="t-row">
                    <span className="t-row-lbl">DPP (sebelum pajak)</span>
                    <span className="t-row-val">{fmtNum(dpp)}</span>
                  </div>
                  <div className="t-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span className="t-row-lbl">PPN Masukan</span>
                      <select className="ppn-select" value={ppnRate} onChange={(e) => setPpnRate(parseFloat(e.target.value))}>
                        <option value="0.11">11%</option>
                        <option value="0.10">10%</option>
                        <option value="0">0%</option>
                      </select>
                    </div>
                    <span className="t-row-val" style={{ color: "var(--danger-text)" }}>+ {fmtNum(ppn)}</span>
                  </div>
                  <div className="t-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span className="t-row-lbl">Pemotongan PPh</span>
                      <select className="ppn-select" value={pphChoice} onChange={(e) => setPphChoice(e.target.value)}>
                        {PPH_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                      </select>
                    </div>
                    <span className="t-row-val" style={{ color: pph > 0 ? "var(--success-text)" : "var(--color-text-tertiary)" }}>
                      {pph > 0 ? `− ${fmtNum(pph)}` : "—"}
                    </span>
                  </div>
                  <div className="t-row grand">
                    <span className="t-row-lbl">Total Tagihan</span>
                    <span className="t-row-val">{fmtNum(total)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="form-sec card">
              <div className="form-sec-title">Lampiran</div>
              {attachments.length > 0 && (
                <div className="attach-list">
                  {attachments.map((a, i) => (
                    <div key={i} className="attach-item">
                      <div className="attach-icon">
                        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="attach-name">{a.name}</div>
                        <div className="attach-size">{a.size}{a.fromOCR ? " · dari upload" : ""}</div>
                      </div>
                      <button className="attach-rm" onClick={() => delAttach(i)}>
                        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button className="btn-add-attach" onClick={addAttach}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Tambah Lampiran
              </button>
            </div>

            <div className="form-sec card">
              <div className="form-sec-title">Keterangan</div>
              <div className="form-fld">
                <label>Catatan / Memo</label>
                <textarea value={keterangan} onChange={(e) => setKeterangan(e.target.value)} rows={3} placeholder="Tambahkan keterangan atau catatan untuk transaksi ini…" />
              </div>
            </div>

            {total > 0 && (
              <div className="form-sec card">
                <div className="form-sec-title">
                  Jurnal Entry
                  <span className="ai-chip" style={{ marginLeft: 4 }}>
                    <AISvg />AI Generated · 95%
                  </span>
                </div>
                <table className="jurnal-table">
                  <thead>
                    <tr>
                      <th>Akun</th>
                      <th>Nama</th>
                      <th className="r">Debit</th>
                      <th className="r">Kredit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.filter((it) => it.desc).map((it, i) => {
                      const acct = EXPENSE_ACCOUNTS.find((a) => a.code === it.acct);
                      const sub = (Number(it.qty) || 0) * (Number(it.price) || 0);
                      return (
                        <tr key={i}>
                          <td className="mono">{it.acct}</td>
                          <td>{acct?.name || "—"}</td>
                          <td className="r">{fmtNum(sub)}</td>
                          <td className="dim r">—</td>
                        </tr>
                      );
                    })}
                    {ppn > 0 && (
                      <tr>
                        <td className="mono">1-5100</td>
                        <td>PPN Masukan</td>
                        <td className="r">{fmtNum(ppn)}</td>
                        <td className="dim r">—</td>
                      </tr>
                    )}
                    {pph > 0 && (
                      <tr>
                        <td className="mono">2-2300</td>
                        <td>Utang PPh</td>
                        <td className="dim r">—</td>
                        <td className="r">{fmtNum(pph)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="mono">2-1100</td>
                      <td>Utang Usaha</td>
                      <td className="dim r">—</td>
                      <td className="r">{fmtNum(total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ height: 20 }} />
          </div>

          {/* Document preview side */}
          <div className="ap-preview-side">
            <div className="ap-prev-bar">
              <div className="ap-prev-lbl">
                <svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/></svg>
                Preview Invoice Vendor (A4)
              </div>
              <button className="a4-download-btn" onClick={() => showToast("Download PDF…")}>
                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download PDF
              </button>
            </div>
            <div className="a4-doc">
              <div className="a4-head2">
                <div className="a4-brand">
                  <div className="a4-brand-name">{vendor?.name || "—"}</div>
                  <div className="a4-brand-tag">Invoice dari vendor</div>
                </div>
                <div className="a4-head-meta">
                  <div className="a4-head-row"><span className="a4-head-lbl">Invoice</span><span className="a4-head-val">{invNo || "—"}</span></div>
                  <div className="a4-head-row"><span className="a4-head-lbl">Tanggal</span><span className="a4-head-val">{formatDate(date)}</span></div>
                  <div className="a4-head-row"><span className="a4-head-lbl">Jatuh Tempo</span><span className="a4-head-val">{formatDate(due)}</span></div>
                  {poNo && <div className="a4-head-row"><span className="a4-head-lbl">PO</span><span className="a4-head-val">{poNo}</span></div>}
                </div>
              </div>

              <div className="a4-addr-grid">
                <div className="a4-addr">
                  <div className="a4-addr-lbl">DARI VENDOR</div>
                  <div className="a4-addr-name">{vendor?.name || "—"}</div>
                  <div className="a4-addr-line">{vendor?.address || ""}</div>
                  {vendor?.tax_id && <div className="a4-addr-line">NPWP {vendor.tax_id}</div>}
                  {vendor?.contact && <div className="a4-addr-line a4-addr-attn">Attn: {vendor.contact}</div>}
                </div>
                <div className="a4-addr">
                  <div className="a4-addr-lbl">DITAGIHKAN KE</div>
                  <div className="a4-addr-name">PT Sejahtera Makmur</div>
                  <div className="a4-addr-line">Jl. Sudirman No. 99</div>
                  <div className="a4-addr-line">Jakarta 10220, Indonesia</div>
                  <div className="a4-addr-line">NPWP 12.345.678.9-000.000</div>
                </div>
                <div className="a4-addr">
                  <div className="a4-addr-lbl">TERMS</div>
                  <div className="a4-addr-name">{vendor?.payment_terms || "—"}</div>
                  <div className="a4-addr-line a4-addr-muted">Pembayaran via transfer bank</div>
                  {vendor?.banks?.[0] && (
                    <>
                      <div className="a4-addr-line" style={{ marginTop: 6 }}>{vendor.banks[0].name} {vendor.banks[0].acc}</div>
                      <div className="a4-addr-line">a/n {vendor.banks[0].holder}</div>
                    </>
                  )}
                </div>
              </div>

              <div className="a4-items2">
                <table>
                  <thead>
                    <tr>
                      <th className="a4-item-num">ITEM</th>
                      <th>DESKRIPSI</th>
                      <th className="r">QTY</th>
                      <th className="r">HARGA</th>
                      <th className="r">JUMLAH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.filter((it) => it.desc).length === 0 && (
                      <tr><td colSpan={5} className="empty">Tambahkan item di form kiri</td></tr>
                    )}
                    {items.filter((it) => it.desc).map((it, i) => (
                      <tr key={i}>
                        <td className="a4-item-num">{String(i + 1).padStart(2, "0")}</td>
                        <td><div className="a4-item-name">{it.desc}</div></td>
                        <td className="r mono">{it.qty}</td>
                        <td className="r mono">{fmtNum(it.price)}</td>
                        <td className="r mono">{fmtNum((Number(it.qty) || 0) * (Number(it.price) || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="a4-total">
                <div className="a4-tb">
                  <div className="a4-tr"><span className="lbl">DPP</span><span className="val">{fmtNum(dpp)}</span></div>
                  <div className="a4-tr"><span className="lbl">PPN ({Math.round(ppnRate * 100)}%)</span><span className="val">{fmtNum(ppn)}</span></div>
                  {pph > 0 && <div className="a4-tr"><span className="lbl">PPh (potongan)</span><span className="val">− {fmtNum(pph)}</span></div>}
                  <div className="a4-tr grand"><span className="lbl">Total</span><span className="val">Rp {fmtNum(total)}</span></div>
                </div>
              </div>

              <div className="a4-notes">
                <div className="a4-notes-lbl">CATATAN</div>
                <div className="a4-notes-body">
                  {keterangan
                    ? keterangan
                    : <span className="a4-notes-empty">Mohon lakukan pembayaran sebelum tanggal jatuh tempo. Cantumkan nomor invoice sebagai berita transfer.</span>}
                </div>
              </div>

              <div className="a4-footer">
                {vendor?.email || "—"} · {vendor?.phone || ""}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="ap-foot">
        <button className="ap-btn" onClick={() => navigate("/bills")}>Batal</button>
        <span className="ap-hint">{step === "review" ? "Semua perubahan tersimpan otomatis" : ""}</span>
        {step === "review" && (
          <>
            <button className="ap-btn" onClick={onSaveDraft} disabled={!canSubmit}>
              <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v14a2 2 0 01-2 2z"/></svg>
              Simpan Draft
            </button>
            <button className="ap-btn-send" onClick={onSubmitForApproval} disabled={!canSubmit}>
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              Submit untuk Approval
            </button>
          </>
        )}
      </div>

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
