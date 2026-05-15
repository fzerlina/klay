import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useVendors } from "../state/VendorsContext";
import { initials } from "../lib/format";
import "./invoice-create.css";
import "./vendor-create.css";

const CATEGORY_OPTIONS = [
  { v: "inventory", label: "Inventory — pembelian barang dagang" },
  { v: "expense", label: "Expense — beban operasional" },
  { v: "service", label: "Service — jasa profesional" },
];

const TYPE_OPTIONS = [
  { v: "company", label: "Badan Usaha (PT/CV/UD)" },
  { v: "individual", label: "Individu / Perorangan" },
  { v: "government", label: "Instansi Pemerintah" },
  { v: "cooperative", label: "Koperasi" },
];

const TERM_OPTIONS = ["NET 7", "NET 15", "NET 30", "NET 45", "NET 60"];

const PPH_OPTIONS = [
  { v: "none", label: "Tidak ada pemotongan PPh" },
  { v: "pph23_2", label: "PPh 23 — 2% (jasa, sewa, royalti)" },
  { v: "pph23_15", label: "PPh 23 — 15% (dividen, bunga)" },
  { v: "pph4_final", label: "PPh 4(2) Final — jasa konstruksi" },
  { v: "pph21", label: "PPh 21 — individu / tenaga ahli" },
];

const ACCT_OPTIONS = [
  { v: "", label: "— Pilih akun —" },
  { v: "5-1000", label: "5-1000 · Beban Operasional" },
  { v: "5-1070", label: "5-1070 · Biaya Konsultan" },
  { v: "6-1000", label: "6-1000 · Biaya Pokok Penjualan" },
];

const DEFTAX_OPTIONS = [
  { v: "", label: "— Tidak ada —" },
  { v: "ppn_masukan", label: "PPN Masukan 11%" },
  { v: "bebas", label: "Bebas Pajak" },
];

function blankBank() {
  return { name: "", branch: "", acc: "", holder: "", isDefault: true };
}

export default function VendorCreatePage() {
  const navigate = useNavigate();
  const { addVendor } = useVendors();

  const [photo, setPhoto] = useState(null);
  const photoRef = useRef(null);

  const [code, setCode] = useState("");
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("company");
  const [term, setTerm] = useState("NET 30");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [npwp, setNpwp] = useState("");

  const [pkp, setPkp] = useState("PKP");
  const [pph, setPph] = useState("none");

  const [banks, setBanks] = useState([blankBank()]);

  const [acct, setAcct] = useState("");
  const [defTax, setDefTax] = useState("");
  const [notes, setNotes] = useState("");

  const [toast, setToast] = useState("");
  const toastTmr = useRef(null);

  function showToast(msg) {
    setToast(msg);
    if (toastTmr.current) clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToast(""), 2000);
  }

  function onPhotoChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target.result);
    reader.readAsDataURL(f);
  }

  function updateBank(i, patch) {
    setBanks((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }
  function addBank() {
    setBanks((prev) => [...prev, { ...blankBank(), isDefault: prev.length === 0 }]);
  }
  function delBank(i) {
    setBanks((prev) => prev.filter((_, idx) => idx !== i));
  }
  function setDefaultBank(i) {
    setBanks((prev) => prev.map((b, idx) => ({ ...b, isDefault: idx === i })));
  }

  const canSubmit = name.trim() && category;

  function onSave() {
    if (!name.trim()) { showToast("Nama vendor wajib diisi"); return; }
    if (!category) { showToast("Pilih kategori vendor"); return; }
    const validBanks = banks.filter((b) => b.name && b.acc);
    addVendor({
      code: code.trim(),
      name: name.trim(),
      initials: initials(name.trim()),
      category,
      type,
      payment_terms: term,
      address: address.trim(),
      phone: phone.trim(),
      email: email.trim(),
      contact: contact.trim(),
      tax_id: npwp.trim(),
      pkp,
      pph,
      banks: validBanks,
      acct,
      defTax,
      notes: notes.trim(),
    });
    showToast("Vendor tersimpan ✓");
    setTimeout(() => navigate("/vendors"), 700);
  }

  return (
    <div className="addpage">
      {/* Header */}
      <div className="ap-head">
        <button className="ap-close" onClick={() => navigate("/vendors")} aria-label="Tutup">
          <svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div className="ap-title">Tambah Vendor Baru</div>
        <div className="ap-hint" style={{ flex: 1, marginLeft: 4 }}>Field bertanda <span style={{ color: "var(--color-danger-text)" }}>*</span> wajib diisi</div>
        <button className="ap-close" onClick={() => navigate("/vendors")} aria-label="Batal">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Body */}
      <div className="ap-s1" style={{ alignItems: "stretch", padding: "32px 24px 80px" }}>
        <div style={{ width: "100%", maxWidth: 680, margin: "0 auto" }}>
          {/* Photo upload card */}
          <div className="form-sec card">
            <div className="vc-photo">
              <div className="vc-photo-preview" onClick={() => photoRef.current?.click()}>
                {photo ? (
                  <img src={photo} alt="Vendor preview" />
                ) : (
                  <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                )}
              </div>
              <div className="vc-photo-info">
                <div className="vc-photo-title">
                  Foto Vendor
                  <span className="vc-photo-optional">(opsional)</span>
                </div>
                <div className="vc-photo-sub">Logo atau foto kantor vendor. JPG, PNG, maks. 2 MB.</div>
              </div>
              <button className="vc-photo-btn" onClick={() => photoRef.current?.click()}>Pilih Foto</button>
              <input type="file" ref={photoRef} accept="image/*" style={{ display: "none" }} onChange={onPhotoChange} />
            </div>
          </div>

          {/* Identitas Vendor */}
          <div className="form-sec card">
            <div className="form-sec-title">Identitas Vendor</div>
            <div className="fg2">
              <div className="form-fld">
                <label>Kode Vendor</label>
                <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="V-026" style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }} />
                <span className="vc-hint">Kosongkan untuk auto-generate</span>
              </div>
              <div className="form-fld">
                <label>Kategori <span className="vc-req">*</span></label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Pilih kategori…</option>
                  {CATEGORY_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-fld" style={{ marginBottom: 10 }}>
              <label>Nama Vendor <span className="vc-req">*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: PT Maju Teknologi Indonesia" />
            </div>
            <div className="fg2">
              <div className="form-fld">
                <label>Tipe Entitas</label>
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  {TYPE_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-fld">
                <label>Payment Term</label>
                <select value={term} onChange={(e) => setTerm(e.target.value)}>
                  {TERM_OPTIONS.map((t) => <option key={t} value={t}>{t} hari</option>)}
                </select>
              </div>
            </div>
            <div className="form-fld" style={{ marginBottom: 10 }}>
              <label>Alamat</label>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Jl. Sudirman No. 123, Jakarta Selatan 12190" rows={2} />
            </div>
            <div className="fg2">
              <div className="form-fld">
                <label>Nomor Telepon</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+62-21-1234-5678" />
              </div>
              <div className="form-fld">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ap@vendor.com" />
              </div>
            </div>
            <div className="fg2" style={{ marginBottom: 0 }}>
              <div className="form-fld">
                <label>Contact Person</label>
                <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Nama PIC" />
              </div>
              <div className="form-fld">
                <label>NPWP</label>
                <input type="text" value={npwp} onChange={(e) => setNpwp(e.target.value)} placeholder="12.345.678.9-001.000" style={{ fontFamily: "var(--font-mono)" }} />
              </div>
            </div>
          </div>

          {/* Perpajakan */}
          <div className="form-sec card">
            <div className="form-sec-title">Perpajakan</div>
            <div className="form-fld" style={{ marginBottom: 14 }}>
              <label style={{ marginBottom: 8, display: "block" }}>Status PKP <span className="vc-req">*</span></label>
              <div className="pkp-group">
                <label className={`pkp-opt${pkp === "PKP" ? " selected" : ""}`} onClick={() => setPkp("PKP")}>
                  <input type="radio" name="pkp" value="PKP" checked={pkp === "PKP"} onChange={() => setPkp("PKP")} />
                  <div className="pkp-dot"><div className="pkp-dot-inner" /></div>
                  <div className="pkp-text">
                    <div className="pkp-label">PKP — Pengusaha Kena Pajak</div>
                    <div className="pkp-desc">Vendor terdaftar sebagai PKP. Transaksi dikenai PPN dan dapat menerbitkan Faktur Pajak.</div>
                  </div>
                </label>
                <label className={`pkp-opt${pkp === "NON_PKP" ? " selected" : ""}`} onClick={() => setPkp("NON_PKP")}>
                  <input type="radio" name="pkp" value="NON_PKP" checked={pkp === "NON_PKP"} onChange={() => setPkp("NON_PKP")} />
                  <div className="pkp-dot"><div className="pkp-dot-inner" /></div>
                  <div className="pkp-text">
                    <div className="pkp-label">Non-PKP</div>
                    <div className="pkp-desc">Vendor tidak memiliki NPKP. Tidak ada PPN pada transaksi. Umumnya koperasi, individu, atau usaha kecil di bawah threshold.</div>
                  </div>
                </label>
              </div>
            </div>
            <div className="form-fld">
              <label>Pemotongan PPh</label>
              <select value={pph} onChange={(e) => setPph(e.target.value)}>
                {PPH_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Rekening Bank */}
          <div className="form-sec card">
            <div className="form-sec-title">Rekening Bank</div>
            <div className="bank-list">
              {banks.map((b, i) => (
                <div key={i} className="bank-entry">
                  <div className="bank-entry-head">
                    <span className="bank-entry-num">Rekening #{i + 1}</span>
                    <label className="bank-default-toggle">
                      <input type="radio" name="defaultBank" checked={b.isDefault} onChange={() => setDefaultBank(i)} />
                      <span>Default</span>
                    </label>
                    {banks.length > 1 && (
                      <button className="btn-del-bank" onClick={() => delBank(i)} aria-label="Hapus rekening">
                        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                  </div>
                  <div className="fg2">
                    <div className="form-fld">
                      <label>Bank</label>
                      <input type="text" value={b.name} onChange={(e) => updateBank(i, { name: e.target.value })} placeholder="BCA / Mandiri / BNI / BRI…" />
                    </div>
                    <div className="form-fld">
                      <label>Cabang</label>
                      <input type="text" value={b.branch} onChange={(e) => updateBank(i, { branch: e.target.value })} placeholder="KCU Sudirman" />
                    </div>
                  </div>
                  <div className="fg2" style={{ marginBottom: 0 }}>
                    <div className="form-fld">
                      <label>No. Rekening</label>
                      <input type="text" value={b.acc} onChange={(e) => updateBank(i, { acc: e.target.value })} placeholder="123-456-7890" style={{ fontFamily: "var(--font-mono)" }} />
                    </div>
                    <div className="form-fld">
                      <label>Atas Nama</label>
                      <input type="text" value={b.holder} onChange={(e) => updateBank(i, { holder: e.target.value })} placeholder="Nama pemilik rekening" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-add-bank" onClick={addBank}>
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Tambah Rekening Bank
            </button>
          </div>

          {/* Default Akuntansi */}
          <div className="form-sec card">
            <div className="form-sec-title">
              Default Akuntansi
              <span style={{ fontSize: 10, fontWeight: 400, color: "var(--color-text-tertiary)", textTransform: "none", letterSpacing: 0, marginLeft: 4 }}>
                — opsional
              </span>
            </div>
            <div className="fg2">
              <div className="form-fld">
                <label>Akun Beban Default</label>
                <select value={acct} onChange={(e) => setAcct(e.target.value)}>
                  {ACCT_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-fld">
                <label>Kode Pajak Default</label>
                <select value={defTax} onChange={(e) => setDefTax(e.target.value)}>
                  {DEFTAX_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-fld" style={{ marginBottom: 0 }}>
              <label>Catatan Internal</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Kontrak, PIC, syarat pembayaran khusus…" rows={3} />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="ap-foot">
        <span className="ap-hint">Vendor akan langsung aktif setelah disimpan.</span>
        <button className="ap-btn" onClick={() => navigate("/vendors")}>Batal</button>
        <button className="ap-btn-send" onClick={onSave} disabled={!canSubmit}>
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          Simpan Vendor
        </button>
      </div>

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
