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
  { v: "company", label: "Legal Entity (PT/CV/UD)" },
  { v: "individual", label: "Individualal" },
  { v: "government", label: "Government Entity" },
  { v: "cooperative", label: "Cooperative" },
];

const TERM_OPTIONS = ["NET 7", "NET 15", "NET 30", "NET 45", "NET 60"];

const PPH_OPTIONS = [
  { v: "none", label: "No withholding" },
  { v: "pph23_2", label: "PPh 23 — 2% (jasa, sewa, royalti)" },
  { v: "pph23_15", label: "PPh 23 — 15% (dividen, bunga)" },
  { v: "pph4_final", label: "PPh 4(2) Final — jasa konstruksi" },
  { v: "pph21", label: "PPh 21 — individu / tenaga ahli" },
];

const ACCT_OPTIONS = [
  { v: "", label: "— Pick account —" },
  { v: "5-1000", label: "5-1000 · Expenses Operasional" },
  { v: "5-1070", label: "5-1070 · Biaya Konsultan" },
  { v: "6-1000", label: "6-1000 · Biaya Pokok Penjualan" },
];

const DEFTAX_OPTIONS = [
  { v: "", label: "— None —" },
  { v: "ppn_masukan", label: "Input VAT (PPN) 11%" },
  { v: "bebas", label: "Bebas Tax" },
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
    if (!name.trim()) { showToast("Name vendor are required"); return; }
    if (!category) { showToast("Pick category vendor"); return; }
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
        <button className="ap-close" onClick={() => navigate("/vendors")} aria-label="Close">
          <svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div className="ap-title">Add New Vendor</div>
        <div className="ap-hint" style={{ flex: 1, marginLeft: 4 }}>Fields marked <span style={{ color: "var(--color-danger-text)" }}>*</span> are required</div>
        <button className="ap-close" onClick={() => navigate("/vendors")} aria-label="Cancel">
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
                  Vendor Photo
                  <span className="vc-photo-optional">(opsional)</span>
                </div>
                <div className="vc-photo-sub">Vendor logo or office photo. JPG, PNG, maks. 2 MB.</div>
              </div>
              <button className="vc-photo-btn" onClick={() => photoRef.current?.click()}>Pick Photo</button>
              <input type="file" ref={photoRef} accept="image/*" style={{ display: "none" }} onChange={onPhotoChange} />
            </div>
          </div>

          {/* Vendor Information */}
          <div className="form-sec card">
            <div className="form-sec-title">Vendor Information</div>
            <div className="fg2">
              <div className="form-fld">
                <label>Vendor Code</label>
                <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="V-026" style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }} />
                <span className="vc-hint">Kosongkan for auto-generate</span>
              </div>
              <div className="form-fld">
                <label>Category <span className="vc-req">*</span></label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Pick category…</option>
                  {CATEGORY_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-fld" style={{ marginBottom: 10 }}>
              <label>Vendor Name <span className="vc-req">*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: PT Maju Tekzeroogi Indonesia" />
            </div>
            <div className="fg2">
              <div className="form-fld">
                <label>Entity Type</label>
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  {TYPE_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-fld">
                <label>Payment Term</label>
                <select value={term} onChange={(e) => setTerm(e.target.value)}>
                  {TERM_OPTIONS.map((t) => <option key={t} value={t}>{t} days</option>)}
                </select>
              </div>
            </div>
            <div className="form-fld" style={{ marginBottom: 10 }}>
              <label>Address</label>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Jl. Sudirman No. 123, Jakarta Selatan 12190" rows={2} />
            </div>
            <div className="fg2">
              <div className="form-fld">
                <label>Phone Number</label>
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
                <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Name PIC" />
              </div>
              <div className="form-fld">
                <label>NPWP</label>
                <input type="text" value={npwp} onChange={(e) => setNpwp(e.target.value)} placeholder="12.345.678.9-001.000" style={{ fontFamily: "var(--font-mono)" }} />
              </div>
            </div>
          </div>

          {/* Tax Settings */}
          <div className="form-sec card">
            <div className="form-sec-title">Tax Settings</div>
            <div className="form-fld" style={{ marginBottom: 14 }}>
              <label style={{ marginBottom: 8, display: "block" }}>Status PKP <span className="vc-req">*</span></label>
              <div className="pkp-group">
                <label className={`pkp-opt${pkp === "PKP" ? " selected" : ""}`} onClick={() => setPkp("PKP")}>
                  <input type="radio" name="pkp" value="PKP" checked={pkp === "PKP"} onChange={() => setPkp("PKP")} />
                  <div className="pkp-dot"><div className="pkp-dot-inner" /></div>
                  <div className="pkp-text">
                    <div className="pkp-label">PKP — Pengusaha Kena Tax</div>
                    <div className="pkp-desc">Vendor is VAT-registered. Transactions are subject to VAT and can issue Tax Invoices.</div>
                  </div>
                </label>
                <label className={`pkp-opt${pkp === "NON_PKP" ? " selected" : ""}`} onClick={() => setPkp("NON_PKP")}>
                  <input type="radio" name="pkp" value="NON_PKP" checked={pkp === "NON_PKP"} onChange={() => setPkp("NON_PKP")} />
                  <div className="pkp-dot"><div className="pkp-dot-inner" /></div>
                  <div className="pkp-text">
                    <div className="pkp-label">Non-PKP</div>
                    <div className="pkp-desc">Vendor is not VAT-registered. No VAT on transactions. Typically cooperatives, individuals, or small businesses below threshold.</div>
                  </div>
                </label>
              </div>
            </div>
            <div className="form-fld">
              <label>Withholding (PPh)</label>
              <select value={pph} onChange={(e) => setPph(e.target.value)}>
                {PPH_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Bank Account */}
          <div className="form-sec card">
            <div className="form-sec-title">Bank Account</div>
            <div className="bank-list">
              {banks.map((b, i) => (
                <div key={i} className="bank-entry">
                  <div className="bank-entry-head">
                    <span className="bank-entry-num">Account #{i + 1}</span>
                    <label className="bank-default-toggle">
                      <input type="radio" name="defaultBank" checked={b.isDefault} onChange={() => setDefaultBank(i)} />
                      <span>Default</span>
                    </label>
                    {banks.length > 1 && (
                      <button className="btn-del-bank" onClick={() => delBank(i)} aria-label="Delete rekening">
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
                      <label>Branch</label>
                      <input type="text" value={b.branch} onChange={(e) => updateBank(i, { branch: e.target.value })} placeholder="KCU Sudirman" />
                    </div>
                  </div>
                  <div className="fg2" style={{ marginBottom: 0 }}>
                    <div className="form-fld">
                      <label>Account No.</label>
                      <input type="text" value={b.acc} onChange={(e) => updateBank(i, { acc: e.target.value })} placeholder="123-456-7890" style={{ fontFamily: "var(--font-mono)" }} />
                    </div>
                    <div className="form-fld">
                      <label>Atas Name</label>
                      <input type="text" value={b.holder} onChange={(e) => updateBank(i, { holder: e.target.value })} placeholder="Name pemilik rekening" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-add-bank" onClick={addBank}>
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Bank Account
            </button>
          </div>

          {/* Default Accounttansi */}
          <div className="form-sec card">
            <div className="form-sec-title">
              Default Accounttansi
              <span style={{ fontSize: 10, fontWeight: 400, color: "var(--color-text-tertiary)", textTransform: "none", letterSpacing: 0, marginLeft: 4 }}>
                — opsional
              </span>
            </div>
            <div className="fg2">
              <div className="form-fld">
                <label>Account Expenses Default</label>
                <select value={acct} onChange={(e) => setAcct(e.target.value)}>
                  {ACCT_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-fld">
                <label>Code Tax Default</label>
                <select value={defTax} onChange={(e) => setDefTax(e.target.value)}>
                  {DEFTAX_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-fld" style={{ marginBottom: 0 }}>
              <label>Internal Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Kontrak, PIC, syarat payment khusus…" rows={3} />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="ap-foot">
        <span className="ap-hint">Vendor will be active immediately after saving.</span>
        <button className="ap-btn" onClick={() => navigate("/vendors")}>Cancel</button>
        <button className="ap-btn-send" onClick={onSave} disabled={!canSubmit}>
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          Save Vendor
        </button>
      </div>

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
