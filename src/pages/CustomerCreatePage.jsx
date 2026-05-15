import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomers } from "../state/CustomersContext";
import { initials } from "../lib/format";
import "./invoice-create.css";
import "./vendor-create.css";
import "./customer-create.css";

const TERM_OPTIONS = ["NET 7", "NET 14", "NET 30", "NET 45", "NET 60", "COD", "CIA"];
const CURRENCY_OPTIONS = [
  { v: "IDR", label: "IDR — Rupiah" },
  { v: "USD", label: "USD — Dolar AS" },
  { v: "SGD", label: "SGD — Dolar Singapura" },
];
const ENTITY_FORMS = [
  { v: "PT", label: "PT (Perseroan Terbatas)" },
  { v: "CV", label: "CV" },
  { v: "UD", label: "UD / PD" },
  { v: "Firma", label: "Firma" },
  { v: "Koperasi", label: "Koperasi" },
  { v: "BUMN", label: "BUMN / Instansi Pemerintah" },
];
const SCHEDULE_OPTIONS = [
  { v: "h0", label: "Hari yang sama (H+0)" },
  { v: "h1", label: "Keesokan hari (H+1)" },
  { v: "h2", label: "2 hari setelah dibuat" },
  { v: "eom", label: "Setiap akhir bulan" },
  { v: "manual", label: "Pilih tanggal & jam manual…" },
];
const REMINDER_OPTIONS = [
  { v: "none", label: "Tidak ada" },
  { v: "h3", label: "3 hari sebelum jatuh tempo" },
  { v: "h7", label: "7 hari sebelum jatuh tempo" },
  { v: "h3h1", label: "H-3 dan H-1 jatuh tempo" },
];

function blankContact(primary = false) {
  return { name: "", title: "", phone: "", waSame: false, email: "", emailFin: "", primary };
}

function fmtCurrency(v) {
  if (!v) return "";
  const n = String(v).replace(/[^\d]/g, "");
  return n ? Number(n).toLocaleString("id-ID") : "";
}

export default function CustomerCreatePage() {
  const navigate = useNavigate();
  const { addCustomer } = useCustomers();

  const [entityType, setEntityType] = useState(null); // null | 'perusahaan' | 'individu'

  // Photo
  const [photo, setPhoto] = useState(null);
  const photoRef = useRef(null);

  // Identitas
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [entityForm, setEntityForm] = useState("PT");
  const [npwp, setNpwp] = useState("");
  const [address, setAddress] = useState("");

  // Term & kredit
  const [top, setTop] = useState("NET 30");
  const [creditLimit, setCreditLimit] = useState("");
  const [currency, setCurrency] = useState("IDR");

  // Kontak
  const [contacts, setContacts] = useState([blankContact(true)]);

  // Pengiriman invoice
  const [invMode, setInvMode] = useState("manual");
  const [chEmail, setChEmail] = useState(false);
  const [chWa, setChWa] = useState(false);
  const [destEmail, setDestEmail] = useState("");
  const [destWa, setDestWa] = useState("");
  const [schWhen, setSchWhen] = useState("h0");
  const [schTime, setSchTime] = useState("08:00");
  const [schManualDate, setSchManualDate] = useState("");
  const [reminder, setReminder] = useState("none");

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

  function updateContact(i, patch) {
    setContacts((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function addContact() {
    setContacts((prev) => [...prev, blankContact(false)]);
  }
  function delContact(i) {
    setContacts((prev) => prev.filter((_, idx) => idx !== i));
  }

  function resetForm() {
    setPhoto(null);
    setCode(""); setName(""); setLegalName(""); setEntityForm("PT"); setNpwp(""); setAddress("");
    setTop("NET 30"); setCreditLimit(""); setCurrency("IDR");
    setContacts([blankContact(true)]);
    setInvMode("manual"); setChEmail(false); setChWa(false);
    setDestEmail(""); setDestWa(""); setSchWhen("h0"); setSchTime("08:00"); setSchManualDate("");
    setReminder("none"); setNotes("");
  }

  function backToStep0() {
    setEntityType(null);
    resetForm();
  }

  function onSave() {
    if (!name.trim()) { showToast(entityType === "perusahaan" ? "Nama perusahaan wajib diisi" : "Nama lengkap wajib diisi"); return; }
    if (!address.trim()) { showToast("Alamat penagihan wajib diisi"); return; }
    const primary = contacts[0];
    if (!primary.name.trim() || !primary.phone.trim() || !primary.email.trim()) {
      showToast("Kontak utama wajib: nama, telepon, dan email");
      return;
    }
    const channels = [];
    if (chEmail) channels.push("Email");
    if (chWa) channels.push("WhatsApp");
    if (invMode === "auto" && channels.length === 0) {
      showToast("Pilih minimal satu channel pengiriman");
      return;
    }

    addCustomer({
      type: entityType,
      code: code.trim(),
      name: name.trim(),
      legalName: entityType === "perusahaan" ? legalName.trim() || name.trim() : "",
      entityForm: entityType === "perusahaan" ? entityForm : "",
      npwp: npwp.trim(),
      address: address.trim(),
      top,
      creditLimit: parseInt(String(creditLimit).replace(/[^\d]/g, ""), 10) || 0,
      currency,
      contacts: contacts.filter((c) => c.name.trim()),
      invMode,
      invCh: channels,
      invSch: invMode === "auto" ? (schWhen === "manual" ? `Manual ${schManualDate} ${schTime}` : `${schWhen} ${schTime}`) : "",
      reminder: invMode === "auto" && reminder !== "none" ? reminder : "",
      notes: notes.trim(),
      initials: initials(name.trim()),
    });
    showToast("Customer tersimpan ✓");
    setTimeout(() => navigate("/customers"), 700);
  }

  const isPerusahaan = entityType === "perusahaan";

  // ── STEP 0: Entity Picker ──────────────────────────────────────────────
  if (!entityType) {
    return (
      <div className="addpage">
        <div className="ap-head">
          <button className="ap-close" onClick={() => navigate("/customers")} aria-label="Tutup">
            <svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <div className="ap-title">Tambah Customer Baru</div>
          <div className="ap-hint" style={{ flex: 1, marginLeft: 4 }}>— Pilih tipe entitas terlebih dahulu</div>
          <button className="ap-close" onClick={() => navigate("/customers")} aria-label="Batal">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="entity-step0">
          <h2>Daftarkan customer sebagai apa?</h2>
          <p>Pilihan ini menentukan field yang perlu diisi</p>
          <div className="entity-cards">
            <div className="ec" onClick={() => setEntityType("perusahaan")}>
              <div className="ec-icon">
                <svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
              </div>
              <div className="ec-title">Perusahaan</div>
              <div className="ec-desc">Memiliki badan hukum atau usaha terdaftar</div>
              <div className="ec-eg">PT, CV, UD, Firma, Koperasi, BUMN</div>
            </div>
            <div className="ec" onClick={() => setEntityType("individu")}>
              <div className="ec-icon">
                <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div className="ec-title">Individu</div>
              <div className="ec-desc">Perorangan, bukan atas nama badan usaha</div>
              <div className="ec-eg">Freelancer, reseller perorangan, konsumen langsung</div>
            </div>
          </div>
        </div>
        {toast && <div className="toast show">{toast}</div>}
      </div>
    );
  }

  // ── STEP 1: Form ──────────────────────────────────────────────────────
  return (
    <div className="addpage">
      <div className="ap-head">
        <button className="ap-close" onClick={backToStep0} aria-label="Ganti tipe">
          <svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div className="ap-title">Tambah Customer Baru</div>
        <span className={`entity-pill ${entityType}`} onClick={backToStep0}>
          {isPerusahaan ? "🏢 Perusahaan" : "👤 Individu"}
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </span>
        <div className="ap-hint" style={{ flex: 1, marginLeft: 4 }}>Field bertanda <span style={{ color: "var(--color-danger-text)", fontWeight: 700 }}>*</span> wajib diisi</div>
        <button className="ap-close" onClick={() => navigate("/customers")} aria-label="Batal">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div className="ap-s1" style={{ alignItems: "stretch", padding: "32px 24px 80px" }}>
        <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>

          {/* Foto */}
          <div className="form-sec card">
            <div className="vc-photo">
              <div className="vc-photo-preview" onClick={() => photoRef.current?.click()}>
                {photo ? (
                  <img src={photo} alt="Customer preview" />
                ) : (
                  <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                )}
              </div>
              <div className="vc-photo-info">
                <div className="vc-photo-title">
                  {isPerusahaan ? "Foto Perusahaan / Logo" : "Foto Profil"}
                  <span className="vc-photo-optional">(opsional)</span>
                </div>
                <div className="vc-photo-sub">Akan ditampilkan di tabel dan detail customer. JPG/PNG, maks. 2 MB.</div>
              </div>
              <button className="vc-photo-btn" onClick={() => photoRef.current?.click()}>Pilih Foto</button>
              <input type="file" ref={photoRef} accept="image/*" style={{ display: "none" }} onChange={onPhotoChange} />
            </div>
          </div>

          {/* Identitas */}
          <div className="form-sec card">
            <div className="form-sec-title">{isPerusahaan ? "Identitas Perusahaan" : "Identitas Customer"}</div>
            <div className="fg2">
              <div className="form-fld">
                <label>Kode Customer</label>
                <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="C-071" style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }} />
                <span className="vc-hint">Kosongkan untuk auto-generate</span>
              </div>
              <div className="form-fld">
                <label>{isPerusahaan ? "Nama Perusahaan" : "Nama Lengkap"} <span className="vc-req">*</span></label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={isPerusahaan ? "PT Maju Bersama" : "Budi Santoso"} />
              </div>
            </div>
            {isPerusahaan ? (
              <>
                <div className="form-fld" style={{ marginBottom: 10 }}>
                  <label>Nama Legal (sesuai akta / NPWP)</label>
                  <input type="text" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="PT Maju Bersama Sejahtera" />
                  <span className="vc-hint">Kosongkan jika sama dengan nama di atas</span>
                </div>
                <div className="fg2">
                  <div className="form-fld">
                    <label>Jenis Badan Usaha</label>
                    <select value={entityForm} onChange={(e) => setEntityForm(e.target.value)}>
                      {ENTITY_FORMS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="form-fld">
                    <label>NPWP Perusahaan</label>
                    <input type="text" value={npwp} onChange={(e) => setNpwp(e.target.value)} placeholder="01.234.567.8-001.000" style={{ fontFamily: "var(--font-mono)" }} />
                  </div>
                </div>
              </>
            ) : (
              <div className="form-fld" style={{ marginBottom: 10 }}>
                <label>NPWP Pribadi</label>
                <input type="text" value={npwp} onChange={(e) => setNpwp(e.target.value)} placeholder="12.345.678.9-012.000" style={{ fontFamily: "var(--font-mono)" }} />
                <span className="vc-hint">Opsional</span>
              </div>
            )}
            <div className="form-fld" style={{ marginBottom: 0 }}>
              <label>Alamat Penagihan <span className="vc-req">*</span></label>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder={isPerusahaan ? "Jl. Sudirman No. 1, Jakarta Selatan 12930" : "Jl. Kemang Raya No. 8, Jakarta Selatan 12730"} />
            </div>
          </div>

          {/* Term Pembayaran & Kredit */}
          <div className="form-sec card">
            <div className="form-sec-title">Term Pembayaran &amp; Kredit</div>
            <div className="fg3">
              <div className="form-fld">
                <label>Term of Payment <span className="vc-req">*</span></label>
                <select value={top} onChange={(e) => setTop(e.target.value)}>
                  {TERM_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-fld">
                <label>Batas Kredit (IDR)</label>
                <input type="text" value={fmtCurrency(creditLimit)} onChange={(e) => setCreditLimit(e.target.value)} placeholder="50.000.000" style={{ fontFamily: "var(--font-mono)" }} />
                <span className="vc-hint">Kosongkan = tidak ada batas</span>
              </div>
              <div className="form-fld">
                <label>Mata Uang</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCY_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Kontak */}
          <div className="form-sec card">
            <div className="form-sec-title">Kontak</div>
            <div className="ct-list">
              {contacts.map((c, i) => (
                <div className="ctcard" key={i}>
                  <div className="ctcard-head">
                    <div className="ctcard-lbl">
                      <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      {c.primary ? "Kontak Utama" : `Kontak ${i + 1}`}
                    </div>
                    {c.primary ? (
                      <span className="primary-badge">Utama</span>
                    ) : (
                      <button className="btn-del-bank" onClick={() => delContact(i)} aria-label="Hapus kontak">
                        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                  </div>
                  <div className="fg2">
                    <div className="form-fld">
                      <label>Nama <span className="vc-req">*</span></label>
                      <input type="text" value={c.name} onChange={(e) => updateContact(i, { name: e.target.value })} placeholder={c.primary ? "Nama kontak utama" : "Nama kontak"} />
                    </div>
                    {isPerusahaan ? (
                      <div className="form-fld">
                        <label>Jabatan</label>
                        <input type="text" value={c.title} onChange={(e) => updateContact(i, { title: e.target.value })} placeholder="Finance Manager" />
                      </div>
                    ) : <div />}
                  </div>
                  <div className="form-fld" style={{ marginTop: 8 }}>
                    <label>No. Telepon <span className="vc-req">*</span></label>
                    <div className="phone-row">
                      <input type="tel" value={c.phone} onChange={(e) => updateContact(i, { phone: e.target.value })} placeholder="+62 812-3456-7890" style={{ fontFamily: "var(--font-mono)" }} />
                      <label className="wa-chk">
                        <input type="checkbox" checked={c.waSame} onChange={(e) => updateContact(i, { waSame: e.target.checked })} />
                        Nomor ini juga WA
                      </label>
                    </div>
                  </div>
                  <div className="fg2" style={{ marginTop: 8, marginBottom: 0 }}>
                    <div className="form-fld">
                      <label>Email <span className="vc-req">*</span></label>
                      <input type="email" value={c.email} onChange={(e) => updateContact(i, { email: e.target.value })} placeholder="nama@perusahaan.co.id" />
                    </div>
                    {isPerusahaan ? (
                      <div className="form-fld">
                        <label>Email Finance / AP</label>
                        <input type="email" value={c.emailFin} onChange={(e) => updateContact(i, { emailFin: e.target.value })} placeholder="finance@perusahaan.co.id" />
                        <span className="vc-hint">Khusus terima invoice</span>
                      </div>
                    ) : <div />}
                  </div>
                </div>
              ))}
            </div>
            {isPerusahaan && (
              <button className="btn-add-bank" onClick={addContact}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Tambah Kontak
              </button>
            )}
          </div>

          {/* Pengiriman Invoice */}
          <div className="form-sec card">
            <div className="form-sec-title">Pengiriman Invoice</div>
            <div className="inv-opts">
              <div className={`inv-opt${invMode === "manual" ? " sel" : ""}`} onClick={() => setInvMode("manual")}>
                <div className="inv-opt-title">
                  <div className="inv-opt-icon">
                    <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  Manual
                </div>
                <div className="inv-opt-sub">Finance kirim sendiri dari menu Invoices</div>
              </div>
              <div className={`inv-opt${invMode === "auto" ? " sel" : ""}`} onClick={() => setInvMode("auto")}>
                <div className="inv-opt-title">
                  <div className="inv-opt-icon">
                    <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  </div>
                  Otomatis
                </div>
                <div className="inv-opt-sub">Sistem kirim sesuai jadwal & channel</div>
              </div>
            </div>

            {invMode === "auto" && (
              <div className="auto-fields">
                <div style={{ marginBottom: 12, marginTop: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--color-text-tertiary)", marginBottom: 6 }}>Kirim via</div>
                  <div className="ch-chips">
                    <div className={`ch-chip${chEmail ? " on" : ""}`} onClick={() => setChEmail(!chEmail)}>
                      <svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>
                      Email
                    </div>
                    <div className={`ch-chip${chWa ? " on" : ""}`} onClick={() => setChWa(!chWa)}>
                      <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                      WhatsApp
                    </div>
                  </div>
                </div>
                {chEmail && (
                  <div className="form-fld" style={{ marginBottom: 10 }}>
                    <label>Email tujuan <span className="vc-req">*</span></label>
                    <input type="text" value={destEmail} onChange={(e) => setDestEmail(e.target.value)} placeholder="finance@perusahaan.co.id" />
                    <span className="vc-hint">Pisahkan beberapa alamat dengan koma</span>
                  </div>
                )}
                {chWa && (
                  <div className="form-fld" style={{ marginBottom: 10 }}>
                    <label>No. WhatsApp tujuan <span className="vc-req">*</span></label>
                    <input type="tel" value={destWa} onChange={(e) => setDestWa(e.target.value)} placeholder="+62 812-3456-7890" style={{ fontFamily: "var(--font-mono)" }} />
                  </div>
                )}
                <div className="fg2">
                  <div className="form-fld">
                    <label>Kirim pada</label>
                    <select value={schWhen} onChange={(e) => setSchWhen(e.target.value)}>
                      {SCHEDULE_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="form-fld">
                    <label>Jam pengiriman</label>
                    <input type="time" value={schTime} onChange={(e) => setSchTime(e.target.value)} style={{ fontFamily: "var(--font-mono)" }} />
                  </div>
                </div>
                {schWhen === "manual" && (
                  <div className="form-fld" style={{ marginTop: 10 }}>
                    <label>Tanggal kirim <span className="vc-req">*</span></label>
                    <input type="date" value={schManualDate} onChange={(e) => setSchManualDate(e.target.value)} style={{ fontFamily: "var(--font-mono)" }} />
                    <span className="vc-hint">Invoice akan dikirim pada tanggal dan jam yang ditentukan</span>
                  </div>
                )}
                <div className="form-fld" style={{ marginTop: 10, marginBottom: 0 }}>
                  <label>Reminder jatuh tempo</label>
                  <select value={reminder} onChange={(e) => setReminder(e.target.value)}>
                    {REMINDER_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Catatan Internal */}
          <div className="form-sec card">
            <div className="form-sec-title">Catatan Internal</div>
            <div className="form-fld" style={{ marginBottom: 0 }}>
              <label>Catatan</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Catatan internal tentang customer ini (tidak terlihat customer)" />
            </div>
          </div>

        </div>
      </div>

      <div className="ap-foot">
        <span className="ap-hint">Customer akan langsung aktif setelah disimpan.</span>
        <button className="ap-btn" onClick={backToStep0}>Ganti Tipe</button>
        <button className="ap-btn-send" onClick={onSave}>
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          Simpan Customer
        </button>
      </div>

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
