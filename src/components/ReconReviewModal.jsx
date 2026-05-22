// Shared by JournalEntryPage and CloseManagementPage so the bank-recon review
// surface is one consistent component, with one mock data source.

function KlaySparkleIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1.5l1.3 3.2L11.5 6l-3.2 1L7 10l-1.3-3L2.5 6l3.2-1.3L7 1.5z" />
      <path d="M11.5 9.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2z" />
    </svg>
  );
}

export const RECON_TOTAL = 62;
export const RECON_MATCHED = 57; // 57 auto-matched + 5 unmatched = 62 total
export const RECON_UNMATCHED = [
  { id: "R001", date: "2025-04-23", desc: "BCA transfer in · ref 8821", amount:  12500000, reason: "Multiple matching invoices (3) — pick one", suggested: "Probably PT Berkah Jaya (open AR Rp 12,5 jt)" },
  { id: "R002", date: "2025-04-23", desc: "Wire OUT · vendor unknown",  amount: -47200000, reason: "No matching bill in the last 7 days",       suggested: "Closest: PT Sumber Maju (Rp 46,8 jt, 9 days old)" },
  { id: "R003", date: "2025-04-22", desc: "BNI tax payment",            amount:  -3350000, reason: "Amount off by Rp 50.000 vs PPN schedule",   suggested: "Likely manual PPN top-up — book to PPN Output" },
  { id: "R004", date: "2025-04-22", desc: "Customer payment in",        amount:   8400000, reason: "Customer name on statement doesn't match",  suggested: "Best guess: Toko Sentosa (alt spelling)" },
  { id: "R005", date: "2025-04-21", desc: "Bank service charge",        amount:   -150000, reason: "New category — first time this period",     suggested: "Auto-create Bank Charges account" },
];

export default function ReconReviewModal({ open, items, onClose, onAction }) {
  if (!open) return null;
  return (
    <div className="lg-recon-modal-backdrop" onClick={onClose}>
      <div className="lg-recon-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lg-recon-modal-head">
          <span className="lg-klay-bar-icon" aria-hidden><KlaySparkleIcon /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="lg-recon-modal-title">Bank entries needing review</div>
            <div className="lg-recon-modal-sub">{items.length} of {RECON_TOTAL} bank entries couldn't be auto-matched today</div>
          </div>
          <button type="button" className="lg-recon-modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg>
          </button>
        </div>
        <div className="lg-recon-modal-body">
          {items.map((it) => (
            <div key={it.id} className="lg-recon-item">
              <div className="lg-recon-item-head">
                <div className="lg-recon-item-name">{it.desc}</div>
                <div className={`lg-recon-item-amt${it.amount < 0 ? " neg" : ""}`}>
                  {it.amount < 0 ? "−" : ""}Rp {Math.abs(it.amount).toLocaleString("id-ID")}
                </div>
              </div>
              <div className="lg-recon-item-meta">{it.date}</div>
              <div className="lg-recon-item-reason">
                <span className="lg-recon-item-reason-lbl">Why not auto-matched:</span> {it.reason}
              </div>
              {it.suggested && (
                <div className="lg-recon-item-suggested">
                  <KlaySparkleIcon /> {it.suggested}
                </div>
              )}
              <div className="lg-recon-item-actions">
                <button type="button" className="lg-recon-item-btn ghost" onClick={() => onAction("skip", it)}>Skip</button>
                <button type="button" className="lg-recon-item-btn primary" onClick={() => onAction("match", it)}>Match →</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
