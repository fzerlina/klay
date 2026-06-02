import { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { VENDORS } from "../data/seed/vendors";
import { useBills } from "../state/BillsContext";
import { useJournalEntries } from "../state/JournalEntriesContext";
import { formatRupiah, formatDateEn, initials } from "../lib/format";
import {
  workflowStatus,
  statusCause,
  STATUS_LABEL,
  DEMO_OVERRIDES,
  isApPeriodLocked,
} from "../lib/billStatus";
import { useClosePeriod } from "../state/ClosePeriodContext";
import {
  computeFieldConfidence,
  computeReviewBrief,
  hasUnresolvedAttention,
  anomalyIndexesForField,
  summarizeConfidence,
  FIELD_LABELS,
} from "../lib/billConfidence";
import { previewJournalLines, buildJournalEntry } from "../lib/billJournalPreview";
import "./modules.css";
import "./bill-detail.css";

// ─── Labels ─────────────────────────────────────────────────────────────────

const GRN_LABEL      = { matched: "Matched", pending: "Pending", mismatch: "Mismatch" };
const APPROVAL_LABEL = { approved: "Approved", review: "Review", draft: "Draft" };
const PAY_LABEL      = { paid: "Paid", unpaid: "Unpaid", overdue: "Overdue" };

// ─── Review Brief ───────────────────────────────────────────────────────────
// PRD: a plain-language summary of what requires attention appears at the top
// of the page, above the status bar. Format: "[N] field(s) need your
// attention: [field name] ([reason]), …" Computed from the set of YELLOW/RED
// fields at page load; will update in real time as the FM resolves them
// (Phase J wires field editing).

function ReviewBrief({ brief }) {
  if (!brief) return null;
  if (brief.tone === "ok") {
    return (
      <div className="bd-brief bd-brief-ok">
        <div className="bd-brief-icon" aria-hidden>
          <svg viewBox="0 0 12 12"><polyline points="2.5 6 5 8.5 9.5 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div className="bd-brief-msg">{brief.message}</div>
      </div>
    );
  }
  return (
    <div className={`bd-brief bd-brief-${brief.tone}`}>
      <div className="bd-brief-icon" aria-hidden>!</div>
      <div className="bd-brief-body">
        <div className="bd-brief-msg">{brief.message}</div>
        <ul className="bd-brief-list">
          {brief.fields.slice(0, 4).map((f, i) => (
            <li key={i} className={`bd-brief-item bd-brief-item-${f.visual_state.toLowerCase()}`}>
              <span className="bd-brief-item-lbl">{f.label}</span>
              <span className="bd-brief-item-sep">—</span>
              <span className="bd-brief-item-reason">{f.reason}</span>
            </li>
          ))}
          {brief.fields.length > 4 && (
            <li className="bd-brief-more">+ {brief.fields.length - 4} more</li>
          )}
        </ul>
      </div>
    </div>
  );
}

// ─── Field Row ──────────────────────────────────────────────────────────────
// Replaces the plain drawer-row in the Detail tab. Renders a confidence
// indicator (small colored dot) on the right of each row when a confidence
// object is provided; on row hover, a small tooltip surfaces the source +
// score + explanation. YELLOW/RED rows get a faint background tint so the
// eye is drawn to them. Phase F wires the bounding-box highlight into the
// tooltip ("read from this region of the document").

// FieldRow with inline edit + confirm affordances. When the field carries a
// YELLOW/RED confidence and the caller has passed an `onSave` (and optionally
// `onConfirm`), the row exposes:
//   • Edit / "Enter value" — click to open an inline input. Enter saves,
//     Esc cancels.
//   • Confirm — YELLOW only. Marks the anomaly resolved without changing
//     the value (PRD: "yellow fields can be confirmed or corrected").
// onSave receives the typed-and-parsed value; the page applies it to the
// bill via updateBill and clears any anomaly indexes that hit the field.

function FieldRow({
  label, value, confidence, mono,
  fieldName, rawValue, inputType, parser, onSave, onConfirm,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const vs = confidence?.visual_state;
  const cls = vs ? ` bd-field-${vs.toLowerCase()}` : "";
  const editable = !!onSave && (vs === "YELLOW" || vs === "RED");
  const showConfirm = !!onConfirm && vs === "YELLOW";

  function startEdit() {
    setDraft(rawValue == null ? "" : String(rawValue));
    setEditing(true);
  }
  function cancelEdit() {
    setEditing(false);
    setDraft("");
  }
  function commitEdit() {
    if (!onSave) { cancelEdit(); return; }
    const parsed = parser ? parser(draft) : draft;
    if (parsed === "" || parsed == null) { cancelEdit(); return; }
    onSave(parsed);
    setEditing(false);
    setDraft("");
  }

  if (editing) {
    return (
      <div className={`drawer-row bd-field-row bd-field-editing${cls}`}>
        <div className="drawer-label">{label}</div>
        <div className="bd-field-edit">
          <input
            type={inputType || "text"}
            className="bd-field-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") cancelEdit();
            }}
            autoFocus
          />
          <button type="button" className="bd-field-edit-btn save" onClick={commitEdit}>Save</button>
          <button type="button" className="bd-field-edit-btn cancel" onClick={cancelEdit}>Cancel</button>
        </div>
      </div>
    );
  }

  // Display mode — show the value, inline rule note for RULE_ENGINE /
  // YELLOW / RED, then Edit and (optionally) Confirm action chips below.
  const inline = confidence && (
    confidence.source === "RULE_ENGINE" || vs === "YELLOW" || vs === "RED"
  );
  return (
    <div className={`drawer-row bd-field-row${cls}`}>
      <div className="drawer-label">{label}</div>
      <div className={`drawer-value${mono ? " mono" : ""}`}>
        {value}
        {inline && <div className="bd-rule-note">{confidence.explanation}</div>}
        {(editable || showConfirm) && (
          <div className="bd-field-actions">
            {editable && (
              <button type="button" className="bd-field-action edit" onClick={startEdit}>
                <svg viewBox="0 0 12 12" aria-hidden><path d="M2 10h2l5.5-5.5-2-2L2 8v2zM8.5 2L10 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {vs === "RED" ? "Enter value" : "Edit"}
              </button>
            )}
            {showConfirm && (
              <button type="button" className="bd-field-action confirm" onClick={onConfirm}>
                <svg viewBox="0 0 12 12" aria-hidden><polyline points="2 6 5 9 10 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Confirm anyway
              </button>
            )}
          </div>
        )}
      </div>
      {vs && (
        <div className={`bd-field-indicator bd-field-ind-${vs.toLowerCase()}`} aria-hidden>
          {vs === "GREEN" || vs === "BLUE" ? (
            <svg viewBox="0 0 10 10"><polyline points="2 5 4 7 8 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          ) : (
            <span className="bd-field-dot" />
          )}
        </div>
      )}
      {confidence && (
        <div className="bd-field-tooltip" role="tooltip">
          <div className="bd-field-tt-summary">{summarizeConfidence(confidence)}</div>
          <div className="bd-field-tt-explanation">{confidence.explanation}</div>
        </div>
      )}
    </div>
  );
}

// ─── GL Journal Entry Preview ───────────────────────────────────────────────
// PRD: a collapsible section below the tax summary shows the full DR/CR
// entries the bill will write to the GL on posting. Read-only — the FM edits
// the bill fields above and the preview updates. Phase E surfaces the
// derivation rule per line ("Mapped from CoA: 6-3100 (rule: bill item
// category)" / "PPN 11% creditable: vendor is PKP" / etc) so the FM can see
// not just what will post but why.

function JournalEntryPreview({ bill, vendor, onViewPostedJe }) {
  const { lines, totalDr, totalCr, balanced, anyFlag } = previewJournalLines(bill, vendor);
  const isPosted = !!bill.je_number;
  return (
    <div className="bd-je-tab">
      <div className="bd-je-tab-head">
        <div>
          <div className="bd-je-tab-title">
            {isPosted ? "Posted to General Ledger" : "GL Journal Entry Preview"}
          </div>
          <div className="bd-je-tab-sub">
            {isPosted ? (
              <>
                <span className="bd-mono">{bill.je_number}</span>
                {bill.je_posted_date && (
                  <>
                    <span className="bd-sub-sep"> · </span>
                    posted {formatDateEn(bill.je_posted_date)}
                  </>
                )}
              </>
            ) : (
              "What will write to the General Ledger when this bill is approved. Read-only — edit the bill fields to change."
            )}
          </div>
        </div>
        <div className="bd-je-tab-actions">
          {!isPosted && (
            <span className={`bd-je-status${balanced ? " ok" : " err"}`}>
              {balanced ? "Balanced" : "Out of balance"}
            </span>
          )}
          {anyFlag && !isPosted && (
            <span className="bd-je-flag" title="One or more lines were generated with low confidence" aria-hidden>
              ⚠
            </span>
          )}
          {isPosted && onViewPostedJe && (
            <button type="button" className="drawer-btn ghost" onClick={onViewPostedJe}>
              View in GL →
            </button>
          )}
        </div>
      </div>
      <table className="bd-je-table">
        <thead>
          <tr>
            <th>Account</th>
            <th className="r">Debit</th>
            <th className="r">Credit</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className={line.flag ? `bd-je-row-${line.flag.toLowerCase()}` : ""}>
              <td>
                <div className="bd-je-line-acct">
                  <span className="bd-mono bd-je-acct-code">{line.account_code}</span>
                  <span className="bd-je-acct-name">{line.account_name}</span>
                </div>
                <div className="bd-rule-note">{line.rule}</div>
              </td>
              <td className="r mono">{line.side === "DR" ? line.amount.toLocaleString("id-ID") : ""}</td>
              <td className="r mono">{line.side === "CR" ? line.amount.toLocaleString("id-ID") : ""}</td>
            </tr>
          ))}
          <tr className="bd-je-total-row">
            <td>Total</td>
            <td className="r mono">{totalDr.toLocaleString("id-ID")}</td>
            <td className="r mono">{totalCr.toLocaleString("id-ID")}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Vendor Context Panel ───────────────────────────────────────────────────
// PRD: a collapsible panel that surfaces deterministic vendor data — PKP
// status, NPWP, payment terms, bank (last 4 digits + bank name), PPh default.
// Read-only in MVP. Surfaces what the FM would otherwise have to switch to
// the Vendor Master to look up.

function pphLabel(pph) {
  if (pph === "pph23_2")    return "PPh 23 · 2% (service / sewa)";
  if (pph === "pph23_15")   return "PPh 23 · 15% (dividen / bunga)";
  if (pph === "pph4_final") return "PPh 4(2) Final · 2% (konstruksi)";
  return "None";
}

function VendorContextPanel({ vendor }) {
  if (!vendor) return null;
  const bank = vendor.banks && vendor.banks[0];
  const lastFour = bank ? bank.acc.replace(/\D/g, "").slice(-4) : null;
  const npwpMissing = vendor.pkp === "PKP" && !vendor.tax_id;
  const termsMissing = !vendor.payment_terms;
  return (
    <div className="drawer-section bd-vendor-section">
      <div className="drawer-section-title">Vendor Context</div>
      <div className="drawer-row">
        <div className="drawer-label">PKP Status</div>
        <div className="drawer-value">
          <span className={`bd-vendor-pill bd-vendor-pill-${vendor.pkp === "PKP" ? "pkp" : "nonpkp"}`}>
            {vendor.pkp === "PKP" ? "PKP (Pengusaha Kena Pajak)" : "Non-PKP"}
          </span>
        </div>
      </div>
      {!npwpMissing && (
        <div className="drawer-row">
          <div className="drawer-label">NPWP</div>
          <div className="drawer-value mono">{vendor.tax_id || "—"}</div>
        </div>
      )}
      {npwpMissing && (
        <div className="drawer-row bd-field-red">
          <div className="drawer-label">NPWP</div>
          <div className="drawer-value">
            —
            <div className="bd-rule-note">Required for PKP vendor — set in Vendor Master before posting</div>
          </div>
        </div>
      )}
      <div className={`drawer-row${termsMissing ? " bd-field-yellow" : ""}`}>
        <div className="drawer-label">Payment Terms</div>
        <div className="drawer-value">
          {vendor.payment_terms || "not set"}
          {termsMissing && (
            <div className="bd-rule-note">No payment terms configured — set in Vendor Master to enable discount tracking</div>
          )}
        </div>
      </div>
      {bank && (
        <div className="drawer-row">
          <div className="drawer-label">Bank Account</div>
          <div className="drawer-value">
            <div>{bank.name} · ····<span className="mono">{lastFour}</span></div>
            <div className="bd-rule-note">a/n {bank.holder}</div>
          </div>
        </div>
      )}
      <div className="drawer-row">
        <div className="drawer-label">PPh Default</div>
        <div className="drawer-value">{pphLabel(vendor.pph)}</div>
      </div>
    </div>
  );
}

// ─── Status Stepper ─────────────────────────────────────────────────────────
// PRD: a stepped indicator showing where the bill is in the review/approval
// pipeline. Pre-posting (DRAFT → PENDING REVIEW → [RETURNED] → APPROVED →
// POSTED) flips to the payment lifecycle after posting (OPEN → PARTIAL →
// PAID). Branching states (ON_HOLD, EXCEPTION) render as a banner above the
// stepper rather than as inline steps — they're "off the happy path."
// RETURNED is shown inline when it's the current state, with the reason text.

function StatusStepper({ bill, brief }) {
  const ws = workflowStatus(bill);
  const ov = DEMO_OVERRIDES[bill.id] || {};
  const cause = statusCause(bill);

  // Branching states get a banner, no stepper. When the brief also has
  // flagged fields, fold them into this same callout so the FM sees one
  // unified "this bill is blocked because…" surface instead of two
  // overlapping ones (exception banner + field-level brief).
  const fieldsList = brief && brief.count > 0 ? brief.fields.slice(0, 4) : [];
  const extraCount = brief && brief.count > 4 ? brief.count - 4 : 0;
  if (ws === "EXCEPTION") {
    return (
      <div className="bd-banner bd-banner-exception">
        <div className="bd-banner-icon" aria-hidden>⚠</div>
        <div className="bd-banner-body">
          <div className="bd-banner-lbl">Exception</div>
          <div className="bd-banner-msg">{ov.exception?.reason || cause}</div>
          {fieldsList.length > 0 && (
            <ul className="bd-banner-fields">
              {fieldsList.map((f, i) => (
                <li key={i} className={`bd-brief-item bd-brief-item-${f.visual_state.toLowerCase()}`}>
                  <span className="bd-brief-item-lbl">{f.label}</span>
                  <span className="bd-brief-item-sep">—</span>
                  <span className="bd-brief-item-reason">{f.reason}</span>
                </li>
              ))}
              {extraCount > 0 && <li className="bd-brief-more">+ {extraCount} more</li>}
            </ul>
          )}
        </div>
      </div>
    );
  }
  if (ws === "ON_HOLD") {
    return (
      <div className="bd-banner bd-banner-hold">
        <div className="bd-banner-icon" aria-hidden>⏸</div>
        <div className="bd-banner-body">
          <div className="bd-banner-lbl">On Hold</div>
          <div className="bd-banner-msg">{cause}</div>
          {fieldsList.length > 0 && (
            <ul className="bd-banner-fields">
              {fieldsList.map((f, i) => (
                <li key={i} className={`bd-brief-item bd-brief-item-${f.visual_state.toLowerCase()}`}>
                  <span className="bd-brief-item-lbl">{f.label}</span>
                  <span className="bd-brief-item-sep">—</span>
                  <span className="bd-brief-item-reason">{f.reason}</span>
                </li>
              ))}
              {extraCount > 0 && <li className="bd-brief-more">+ {extraCount} more</li>}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // Two lifecycles. We flip to the payment stepper once the bill has been
  // approved (the demo's proxy for POSTED — there's no separate POSTED state
  // until the workflow_status enum is materialized in the seed).
  const isPostApproval = bill.approval === "approved";

  let steps;
  let activeKey;
  let returnedReason = null;

  if (isPostApproval) {
    // Payment lifecycle. PARTIAL only fires when sisa is strictly between 0
    // and total — none of the demo bills currently hit this, but the step
    // renders so the lifecycle is visible end-to-end.
    steps = [
      { key: "OPEN",    label: "Open" },
      { key: "PARTIAL", label: "Partial" },
      { key: "PAID",    label: "Paid" },
    ];
    if (bill.pay === "paid")                          activeKey = "PAID";
    else if (bill.sisa > 0 && bill.sisa < bill.total) activeKey = "PARTIAL";
    else                                              activeKey = "OPEN";
  } else {
    // Review lifecycle. RETURNED only appears as an inline step when the bill
    // is currently in that state; otherwise we skip it so the happy-path
    // sequence reads cleanly.
    const baseSteps = [
      { key: "DRAFT",          label: "Draft" },
      { key: "PENDING_REVIEW", label: "Pending Review" },
      { key: "RETURNED",       label: "Returned" },
      { key: "APPROVED",       label: "Approved" },
      { key: "POSTED",         label: "Posted" },
    ];
    steps = ws === "RETURNED" ? baseSteps : baseSteps.filter((s) => s.key !== "RETURNED");
    activeKey = ws;
    if (ws === "RETURNED") returnedReason = ov.returned?.reason;
  }

  const activeIdx = steps.findIndex((s) => s.key === activeKey);

  return (
    <div className="bd-stepper-wrap">
      <ol className="bd-stepper">
        {steps.map((s, i) => {
          const state =
            i < activeIdx ? "done" :
            i === activeIdx ? "active" :
            "pending";
          // RETURNED is always rendered danger when it appears (it only does
          // when current); the rest follow done/active/pending.
          const tone = s.key === "RETURNED" ? "danger" : state;
          return (
            <li key={s.key} className={`bd-step bd-step-${tone}`}>
              <div className="bd-step-dot">
                {state === "done" ? (
                  <svg viewBox="0 0 12 12" aria-hidden><polyline points="2 6 5 9 10 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : (
                  <span className="bd-step-num">{i + 1}</span>
                )}
              </div>
              <div className="bd-step-lbl">{s.label}</div>
            </li>
          );
        })}
      </ol>
      {returnedReason && (
        <div className="bd-stepper-note">
          <span className="bd-stepper-note-lbl">FM returned:</span> {returnedReason}
        </div>
      )}
      {!returnedReason && cause && (
        <div className="bd-stepper-cause">{cause}</div>
      )}
    </div>
  );
}

// ─── Source Documents (left panel) ──────────────────────────────────────────
// The left panel shows the vendor invoice by default but is switchable: the
// reference rows on the right (PO / GRN / Contract / Faktur Pajak) and a
// segmented control in the toolbar swap in the matching source document.
// Each is an HTML mock rendered from bill + vendor data — faithful enough that
// the FM can compare the form on the right against the "scanned" source.

const KLAY_NPWP = "01.234.567.8-901.000";
const KLAY_ADDRESS = "Jl. Sudirman Kav. 52, Jakarta 12190";

const DOC_DEFS = [
  { key: "invoice",  label: "Vendor Invoice" },
  { key: "po",       label: "Purchase Order" },
  { key: "grn",      label: "Goods Receipt" },
  { key: "contract", label: "Contract" },
  { key: "faktur",   label: "Faktur Pajak" },
];

// Which source documents exist for this bill — drives both the switcher and
// whether a given reference row is clickable.
function availableDocs(bill) {
  const has = {
    invoice:  true,
    po:       bill.poNo && bill.poNo !== "—",
    grn:      !!bill.grnNo,
    contract: !!bill.contractNo,
    faktur:   !!bill.fakturNo,
  };
  return DOC_DEFS.filter((d) => has[d.key]);
}

function SourcePanel({ bill, vendor, docView, setDocView }) {
  const docs = availableDocs(bill);
  const active = docs.some((d) => d.key === docView) ? docView : "invoice";
  const meta =
    active === "invoice" ? (bill.isAI ? "OCR extraction (email ingest)" : "Manual entry") :
    active === "po"       ? "Procurement record" :
    active === "grn"      ? "Warehouse receipt" :
    active === "contract" ? "Master agreement" :
                            "DJP e-Faktur";
  return (
    <div className="bd-doc-wrap">
      <div className="bd-doc-toolbar">
        <span className="bd-doc-toolbar-lbl">Source Document</span>
        <span className="bd-doc-toolbar-sep">·</span>
        <span className="bd-doc-toolbar-meta">{meta}</span>
      </div>
      {docs.length > 1 && (
        <div className="bd-doc-switch" role="tablist">
          {docs.map((d) => (
            <button
              key={d.key}
              type="button"
              role="tab"
              aria-selected={active === d.key}
              className={`bd-doc-switch-tab${active === d.key ? " active" : ""}`}
              onClick={() => setDocView(d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}
      {active === "invoice"  && <SourceInvoice  bill={bill} vendor={vendor} />}
      {active === "po"       && <SourcePO       bill={bill} vendor={vendor} />}
      {active === "grn"      && <SourceGRN      bill={bill} vendor={vendor} />}
      {active === "contract" && <SourceContract bill={bill} vendor={vendor} />}
      {active === "faktur"   && <SourceFaktur   bill={bill} vendor={vendor} />}
    </div>
  );
}

function SourceInvoice({ bill, vendor }) {
  return (
    <>
      <div className="bd-doc-page">
        <div className="bd-doc-letterhead">
          <div className="bd-doc-vendor-name">{vendor?.name || bill.vendorName}</div>
          {vendor?.address && <div className="bd-doc-vendor-meta">{vendor.address}</div>}
          {vendor?.tax_id && (
            <div className="bd-doc-vendor-meta">
              NPWP <span className="bd-mono">{vendor.tax_id}</span>
            </div>
          )}
        </div>
        <div className="bd-doc-divider" />

        <div className="bd-doc-title">INVOICE</div>

        <div className="bd-doc-header">
          <div className="bd-doc-header-block">
            <div className="bd-doc-lbl">Bill To</div>
            <div className="bd-doc-val">PT Klay Indonesia</div>
            <div className="bd-doc-val-sub">Jl. Sudirman Kav. 52, Jakarta 12190</div>
          </div>
          <div className="bd-doc-header-block">
            <div className="bd-doc-lbl">Invoice No.</div>
            <div className="bd-doc-val bd-mono">{bill.invNo && bill.invNo !== "—" ? bill.invNo : "—"}</div>
            <div className="bd-doc-lbl bd-doc-lbl-spaced">PO Reference</div>
            <div className="bd-doc-val bd-mono">{bill.poNo && bill.poNo !== "—" ? bill.poNo : "—"}</div>
          </div>
          <div className="bd-doc-header-block">
            <div className="bd-doc-lbl">Invoice Date</div>
            <div className="bd-doc-val">{formatDateEn(bill.date)}</div>
            <div className="bd-doc-lbl bd-doc-lbl-spaced">Due Date</div>
            <div className="bd-doc-val">{formatDateEn(bill.due)}</div>
          </div>
        </div>

        <table className="bd-doc-items">
          <thead>
            <tr>
              <th className="bd-doc-items-num">#</th>
              <th>Description</th>
              <th className="r">Qty</th>
              <th className="r">Price</th>
              <th className="r">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((item, i) => (
              <tr key={i}>
                <td className="bd-doc-items-num">{String(i + 1).padStart(2, "0")}</td>
                <td>{item.desc}</td>
                <td className="r bd-mono">{item.qty.toLocaleString("id-ID")}</td>
                <td className="r bd-mono">{item.price.toLocaleString("id-ID")}</td>
                <td className="r bd-mono">{item.subtotal.toLocaleString("id-ID")}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="bd-doc-totals">
          <div className="bd-doc-tr">
            <span className="lbl">DPP</span>
            <span className="val bd-mono">{bill.dpp.toLocaleString("id-ID")}</span>
          </div>
          <div className="bd-doc-tr">
            <span className="lbl">PPN 11%</span>
            <span className="val bd-mono">{bill.ppn.toLocaleString("id-ID")}</span>
          </div>
          {bill.pph23 > 0 && (
            <div className="bd-doc-tr">
              <span className="lbl">PPh 23 (potongan)</span>
              <span className="val bd-mono">− {bill.pph23.toLocaleString("id-ID")}</span>
            </div>
          )}
          <div className="bd-doc-tr grand">
            <span className="lbl">Total</span>
            <span className="val bd-mono">Rp {bill.total.toLocaleString("id-ID")}</span>
          </div>
        </div>

        <div className="bd-doc-meta-row">
          <div className="bd-doc-meta-block">
            <div className="bd-doc-lbl">Faktur Pajak</div>
            <div className="bd-doc-val bd-mono">
              {vendor?.pkp === "PKP" ? "010.000-25.12345678" : "— (Non-PKP)"}
            </div>
          </div>
          <div className="bd-doc-meta-block">
            <div className="bd-doc-lbl">Payment Terms</div>
            <div className="bd-doc-val">{vendor?.payment_terms || "—"}</div>
          </div>
        </div>

        {(bill.keterangan || vendor?.banks?.[0]) && (
          <div className="bd-doc-notes">
            {vendor?.banks?.[0] && (
              <>
                <div className="bd-doc-lbl">Pembayaran ke</div>
                <div className="bd-doc-val">
                  {vendor.banks[0].name} {vendor.banks[0].acc}
                  <div className="bd-doc-val-sub">a/n {vendor.banks[0].holder}</div>
                </div>
              </>
            )}
            {bill.keterangan && (
              <>
                <div className="bd-doc-lbl bd-doc-lbl-spaced">Catatan</div>
                <div className="bd-doc-val">{bill.keterangan}</div>
              </>
            )}
          </div>
        )}

        <div className="bd-doc-footer">
          {vendor?.email || ""} {vendor?.phone ? " · " + vendor.phone : ""}
        </div>
      </div>
    </>
  );
}

// ── Purchase Order ────────────────────────────────────────────────────────
function SourcePO({ bill, vendor }) {
  const ppn = bill.ppn || 0;
  return (
    <div className="bd-doc-page">
      <div className="bd-doc-letterhead">
        <div className="bd-doc-vendor-name">PT Klay Indonesia</div>
        <div className="bd-doc-vendor-meta">{KLAY_ADDRESS}</div>
        <div className="bd-doc-vendor-meta">NPWP <span className="bd-mono">{KLAY_NPWP}</span></div>
      </div>
      <div className="bd-doc-divider" />
      <div className="bd-doc-title">PURCHASE ORDER</div>
      <div className="bd-doc-header">
        <div className="bd-doc-header-block">
          <div className="bd-doc-lbl">Supplier</div>
          <div className="bd-doc-val">{vendor?.name || bill.vendorName}</div>
          {vendor?.address && <div className="bd-doc-val-sub">{vendor.address}</div>}
        </div>
        <div className="bd-doc-header-block">
          <div className="bd-doc-lbl">PO No.</div>
          <div className="bd-doc-val bd-mono">{bill.poNo}</div>
          <div className="bd-doc-lbl bd-doc-lbl-spaced">PO Date</div>
          <div className="bd-doc-val">{formatDateEn(bill.date)}</div>
        </div>
        <div className="bd-doc-header-block">
          <div className="bd-doc-lbl">Payment Terms</div>
          <div className="bd-doc-val">{vendor?.payment_terms || "—"}</div>
          <div className="bd-doc-lbl bd-doc-lbl-spaced">Status</div>
          <div className="bd-doc-val">Approved</div>
        </div>
      </div>
      <table className="bd-doc-items">
        <thead>
          <tr>
            <th className="bd-doc-items-num">#</th>
            <th>Description</th>
            <th className="r">Qty</th>
            <th className="r">Unit Price</th>
            <th className="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item, i) => (
            <tr key={i}>
              <td className="bd-doc-items-num">{String(i + 1).padStart(2, "0")}</td>
              <td>{item.desc}</td>
              <td className="r bd-mono">{item.qty.toLocaleString("id-ID")}</td>
              <td className="r bd-mono">{item.price.toLocaleString("id-ID")}</td>
              <td className="r bd-mono">{item.subtotal.toLocaleString("id-ID")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="bd-doc-totals">
        <div className="bd-doc-tr"><span className="lbl">Subtotal (DPP)</span><span className="val bd-mono">{bill.dpp.toLocaleString("id-ID")}</span></div>
        <div className="bd-doc-tr"><span className="lbl">PPN</span><span className="val bd-mono">{ppn.toLocaleString("id-ID")}</span></div>
        <div className="bd-doc-tr grand"><span className="lbl">PO Total</span><span className="val bd-mono">Rp {(bill.dpp + ppn).toLocaleString("id-ID")}</span></div>
      </div>
      <div className="bd-doc-notes">
        <div className="bd-doc-lbl">Authorized by</div>
        <div className="bd-doc-val">Procurement · PT Klay Indonesia</div>
      </div>
      <div className="bd-doc-footer">This purchase order is issued subject to Klay standard procurement terms.</div>
    </div>
  );
}

// ── Goods Receipt Note ──────────────────────────────────────────────────────
function SourceGRN({ bill, vendor }) {
  const mismatch = bill.grn === "mismatch";
  return (
    <div className="bd-doc-page">
      <div className="bd-doc-letterhead">
        <div className="bd-doc-vendor-name">PT Klay Indonesia — Warehouse</div>
        <div className="bd-doc-vendor-meta">{KLAY_ADDRESS}</div>
      </div>
      <div className="bd-doc-divider" />
      <div className="bd-doc-title">GOODS RECEIPT NOTE</div>
      <div className="bd-doc-header">
        <div className="bd-doc-header-block">
          <div className="bd-doc-lbl">GRN No.</div>
          <div className="bd-doc-val bd-mono">{bill.grnNo}</div>
          <div className="bd-doc-lbl bd-doc-lbl-spaced">PO Reference</div>
          <div className="bd-doc-val bd-mono">{bill.poNo && bill.poNo !== "—" ? bill.poNo : "—"}</div>
        </div>
        <div className="bd-doc-header-block">
          <div className="bd-doc-lbl">Supplier</div>
          <div className="bd-doc-val">{vendor?.name || bill.vendorName}</div>
          <div className="bd-doc-lbl bd-doc-lbl-spaced">Received Date</div>
          <div className="bd-doc-val">{formatDateEn(bill.date)}</div>
        </div>
        <div className="bd-doc-header-block">
          <div className="bd-doc-lbl">Match Status</div>
          <div className={`bd-doc-val${mismatch ? " bd-doc-flag" : ""}`}>
            {GRN_LABEL[bill.grn] || "—"}
          </div>
        </div>
      </div>
      <table className="bd-doc-items">
        <thead>
          <tr>
            <th className="bd-doc-items-num">#</th>
            <th>Description</th>
            <th className="r">Qty Ordered</th>
            <th className="r">Qty Received</th>
            <th className="r">Status</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item, i) => {
            const recv = mismatch && i === 0 ? Math.max(0, Math.round(item.qty * 0.9)) : item.qty;
            const ok = recv === item.qty;
            return (
              <tr key={i}>
                <td className="bd-doc-items-num">{String(i + 1).padStart(2, "0")}</td>
                <td>{item.desc}</td>
                <td className="r bd-mono">{item.qty.toLocaleString("id-ID")}</td>
                <td className="r bd-mono">{recv.toLocaleString("id-ID")}</td>
                <td className={`r${ok ? "" : " bd-doc-flag"}`}>{ok ? "OK" : "Short"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="bd-doc-notes">
        <div className="bd-doc-lbl">Received by</div>
        <div className="bd-doc-val">Warehouse Staff · PT Klay Indonesia</div>
        {mismatch && (
          <>
            <div className="bd-doc-lbl bd-doc-lbl-spaced">Note</div>
            <div className="bd-doc-val">Quantity received does not match the invoiced quantity — flagged for AP review.</div>
          </>
        )}
      </div>
      <div className="bd-doc-footer">Goods inspected and recorded at receipt.</div>
    </div>
  );
}

// ── Contract / Master agreement ─────────────────────────────────────────────
function SourceContract({ bill, vendor }) {
  return (
    <div className="bd-doc-page">
      <div className="bd-doc-letterhead">
        <div className="bd-doc-vendor-name">Supply &amp; Service Agreement</div>
        <div className="bd-doc-vendor-meta">PT Klay Indonesia &nbsp;×&nbsp; {vendor?.name || bill.vendorName}</div>
      </div>
      <div className="bd-doc-divider" />
      <div className="bd-doc-title">CONTRACT</div>
      <div className="bd-doc-header">
        <div className="bd-doc-header-block">
          <div className="bd-doc-lbl">Contract No.</div>
          <div className="bd-doc-val bd-mono">{bill.contractNo}</div>
          <div className="bd-doc-lbl bd-doc-lbl-spaced">Effective</div>
          <div className="bd-doc-val">1 Jan 2025 – 31 Dec 2025</div>
        </div>
        <div className="bd-doc-header-block">
          <div className="bd-doc-lbl">Vendor</div>
          <div className="bd-doc-val">{vendor?.name || bill.vendorName}</div>
          {vendor?.tax_id && <div className="bd-doc-val-sub">NPWP {vendor.tax_id}</div>}
        </div>
        <div className="bd-doc-header-block">
          <div className="bd-doc-lbl">Payment Terms</div>
          <div className="bd-doc-val">{vendor?.payment_terms || "—"}</div>
        </div>
      </div>
      <div className="bd-doc-notes">
        <div className="bd-doc-lbl">Scope of Work</div>
        <div className="bd-doc-val">
          {bill.keterangan || `Recurring supply of ${bill.items[0]?.acctName || "goods & services"} as per agreed schedule.`}
        </div>
        <div className="bd-doc-lbl bd-doc-lbl-spaced">Pricing</div>
        <div className="bd-doc-val">As per agreed rate card. This bill draws against the contract.</div>
      </div>
      <div className="bd-doc-meta-row">
        <div className="bd-doc-meta-block">
          <div className="bd-doc-lbl">For PT Klay Indonesia</div>
          <div className="bd-doc-sign">Budi Santoso</div>
          <div className="bd-doc-val-sub">Finance Manager</div>
        </div>
        <div className="bd-doc-meta-block">
          <div className="bd-doc-lbl">For {vendor?.name || bill.vendorName}</div>
          <div className="bd-doc-sign">{vendor?.contact || "Authorized Signatory"}</div>
          <div className="bd-doc-val-sub">Authorized Signatory</div>
        </div>
      </div>
      <div className="bd-doc-footer">Executed in two counterparts, each an original.</div>
    </div>
  );
}

// ── Faktur Pajak (Indonesian tax invoice) ──────────────────────────────────
function SourceFaktur({ bill, vendor }) {
  return (
    <div className="bd-doc-page bd-doc-faktur">
      <div className="bd-doc-faktur-head">
        <div>
          <div className="bd-doc-lbl">Kode dan Nomor Seri Faktur Pajak</div>
          <div className="bd-doc-faktur-no bd-mono">{bill.fakturNo}</div>
        </div>
        <div className="bd-doc-faktur-stamp">FAKTUR PAJAK</div>
      </div>
      <div className="bd-doc-divider" />
      <div className="bd-doc-faktur-party">
        <div className="bd-doc-lbl">Pengusaha Kena Pajak</div>
        <div className="bd-doc-val">{vendor?.name || bill.vendorName}</div>
        {vendor?.address && <div className="bd-doc-val-sub">{vendor.address}</div>}
        <div className="bd-doc-val-sub">NPWP : {vendor?.tax_id || "—"}</div>
      </div>
      <div className="bd-doc-faktur-party">
        <div className="bd-doc-lbl">Pembeli Barang Kena Pajak / Penerima Jasa Kena Pajak</div>
        <div className="bd-doc-val">PT Klay Indonesia</div>
        <div className="bd-doc-val-sub">{KLAY_ADDRESS}</div>
        <div className="bd-doc-val-sub">NPWP : {KLAY_NPWP}</div>
      </div>
      <table className="bd-doc-items">
        <thead>
          <tr>
            <th className="bd-doc-items-num">No.</th>
            <th>Nama Barang Kena Pajak / Jasa Kena Pajak</th>
            <th className="r">Harga Jual</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item, i) => (
            <tr key={i}>
              <td className="bd-doc-items-num">{String(i + 1).padStart(2, "0")}</td>
              <td>{item.desc}</td>
              <td className="r bd-mono">{item.subtotal.toLocaleString("id-ID")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="bd-doc-totals">
        <div className="bd-doc-tr"><span className="lbl">Dasar Pengenaan Pajak</span><span className="val bd-mono">{bill.dpp.toLocaleString("id-ID")}</span></div>
        <div className="bd-doc-tr grand"><span className="lbl">PPN = 11% × DPP</span><span className="val bd-mono">{(bill.ppn || 0).toLocaleString("id-ID")}</span></div>
      </div>
      <div className="bd-doc-footer">
        Masa Pajak {bill.taxReportingPeriod || formatDateEn(bill.date)} · Faktur Pajak ini sah sesuai ketentuan DJP.
      </div>
    </div>
  );
}

// ─── Action bar ─────────────────────────────────────────────────────────────
// Same status-aware shape as the drawer footer it replaces. The action set
// adapts to workflow_status so the FM / AP Staff always see the relevant next
// step. Phase C will gate Post on flagged-field resolution; Phase G will gate
// it on period-lock status. SoD enforcement is deferred — see the
// "demo: SoD not enforced" note on the left of the bar.

function ActionBar({ bill, onAction, onSecondary, gateReason, periodLocked, lockedPeriodLabel, onReassign }) {
  if (!bill) return null;
  const ws = workflowStatus(bill);
  const ov = DEMO_OVERRIDES[bill.id] || {};
  // Gate the workflow-progressing primary action (Submit / Approve / Edit &
  // resubmit) when there are unresolved YELLOW/RED fields. Per PRD: "Post is
  // active when all RED filled and all YELLOW confirmed/corrected." Other
  // primaries (Record payment, Release hold, etc.) are not gated.
  const gateableStates = ws === "DRAFT" || ws === "PENDING_REVIEW" || ws === "RETURNED";
  const gated = !!gateReason && gateableStates;
  // Period-lock gate: when the bill's accounting period is closed, all client
  // users (FM included) are blocked from posting via normal flow. Per PRD,
  // the Post button is disabled with a Reassign affordance — the FM either
  // reassigns the bill to the current open period or reopens the closed
  // period via Settings → Period Locking (not surfaced here).
  //
  // The banner appears whenever the period is locked (any workflow state) so
  // the FM always sees the reason. The primary-action disable only kicks in
  // for workflow states where posting is the next step.
  const periodActionGated = !!periodLocked && (gateableStates || ws === "APPROVED");
  const periodGateReason = periodActionGated
    ? `${lockedPeriodLabel || "Period"} is closed — reassign to current open period to post`
    : null;

  // Resolve sub-actions for EXCEPTION based on the seeded reason text
  const exceptionPrimaryLabel = (() => {
    const reason = (ov.exception?.reason || "").toLowerCase();
    if (reason.includes("ocr") || reason.includes("confidence")) return "Verify & resubmit";
    if (reason.includes("duplicate")) return "Mark as new";
    if (reason.includes("vendor")) return "Confirm vendor";
    if (reason.includes("type")) return "Classify document";
    if (reason.includes("field")) return "Enter manually";
    return "Resolve";
  })();

  let primary = null;
  let secondaries = [];
  switch (ws) {
    case "DRAFT":          primary = "Submit for review"; secondaries = ["Edit", "Delete"]; break;
    case "PENDING_REVIEW": primary = "Approve";            secondaries = ["Return to AP", "Put on hold", "Edit"]; break;
    case "RETURNED":       primary = "Edit & resubmit";    secondaries = ["View FM comments"]; break;
    case "ON_HOLD":        primary = "Release hold";       secondaries = ["Edit", "Cancel bill"]; break;
    case "APPROVED":       primary = "Record payment";     secondaries = ["Revert to review", "Edit"]; break;
    case "POSTED":         primary = "Record payment";     secondaries = ["View GL entry"]; break;
    case "PAID":           primary = null;                 secondaries = ["View receipt", "Revert to unpaid"]; break;
    case "EXCEPTION":      primary = exceptionPrimaryLabel; secondaries = ["Open source document", "Skip — mark for later"]; break;
    default:               primary = "Edit";               secondaries = [];
  }

  const anyDisabled = gated || periodActionGated;

  return (
    <>
      {periodLocked && (
        <div className="bd-period-locked-banner">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="2.5" y="5.5" width="7" height="5" rx="0.8"/><path d="M4.2 5.5V3.8a1.8 1.8 0 0 1 3.6 0v1.7"/>
          </svg>
          <span>
            <strong>{lockedPeriodLabel} is closed.</strong> This bill's accounting period was locked by the AP close declaration. Reassign to the current open period to continue, or reopen the period from Settings → Period Locking.
          </span>
          {onReassign && (
            <button type="button" className="bd-period-locked-cta" onClick={onReassign}>
              Reassign to current period
            </button>
          )}
        </div>
      )}
      <div className="bd-actionbar">
        <div className="bd-actionbar-note">demo: SoD not enforced</div>
        <div className="bd-actionbar-buttons">
          {secondaries.map((label) => (
            <button key={label} type="button" className="drawer-btn ghost" onClick={() => onSecondary(label)}>
              {label}
            </button>
          ))}
          {primary && (
            <button
              type="button"
              className={`drawer-btn primary${anyDisabled ? " disabled" : ""}`}
              disabled={anyDisabled}
              title={periodActionGated ? periodGateReason : (gated ? gateReason : undefined)}
              onClick={() => !anyDisabled && onAction(primary)}
            >
              {primary}
              {periodActionGated && <span className="bd-actionbar-gate"> · period closed</span>}
              {!periodActionGated && gated && <span className="bd-actionbar-gate"> · resolve flags first</span>}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Detail-tab row helpers ─────────────────────────────────────────────────

// A plain read-only label/value row (no confidence indicator).
function PlainRow({ label, value, mono }) {
  return (
    <div className="drawer-row">
      <div className="drawer-label">{label}</div>
      <div className={`drawer-value${mono ? " mono" : ""}`}>{value}</div>
    </div>
  );
}

// Indented sub-row, used for the items nested under Payment Status.
function SubRow({ label, value }) {
  return (
    <div className="drawer-row bd-subrow">
      <div className="drawer-label">{label}</div>
      <div className="drawer-value">{value}</div>
    </div>
  );
}

// A reference row whose value, when present, is a link that switches the
// source document shown on the left.
function RefRow({ label, value, onClick }) {
  const has = value && value !== "—";
  return (
    <div className="drawer-row bd-ref-row">
      <div className="drawer-label">{label}</div>
      <div className="drawer-value mono">
        {has ? (
          <button type="button" className="bd-ref-link" onClick={onClick}>{value}</button>
        ) : (
          <span className="bd-ref-empty">—</span>
        )}
      </div>
    </div>
  );
}

// A tax-rate row: the rate is an editable chip (click → inline % input); the
// computed amount sits beside it. Saving recomputes the downstream totals.
function RateRow({ label, rate, amount, onSaveRate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const pct = +((rate || 0) * 100).toFixed(2);
  function start() { setDraft(String(pct)); setEditing(true); }
  function commit() {
    const n = parseFloat(draft);
    if (!Number.isFinite(n) || n < 0) { setEditing(false); return; }
    onSaveRate(n / 100);
    setEditing(false);
  }
  return (
    <div className="drawer-row bd-rate-row">
      <div className="drawer-label">{label}</div>
      <div className="drawer-value bd-rate-value">
        {editing ? (
          <span className="bd-rate-edit">
            <input
              type="number"
              step="0.01"
              className="bd-rate-input"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            />
            <span className="bd-rate-pct">%</span>
            <button type="button" className="bd-field-edit-btn save" onClick={commit}>Save</button>
            <button type="button" className="bd-field-edit-btn cancel" onClick={() => setEditing(false)}>Cancel</button>
          </span>
        ) : (
          <>
            <button type="button" className="bd-rate-chip" onClick={start} title="Edit rate">{pct}%</button>
            <span className="bd-rate-amt mono">{formatRupiah(amount)}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

// Demo user identities — there's no current-user concept yet, so the audit
// trail uses fixed names that match the existing seed (Sarah Wijaya =
// AP staff, Budi Santoso = Finance Manager).
const AP_USER = "Sarah Wijaya";
const FM_USER = "Budi Santoso";

function nowAuditStamp() {
  const d = new Date();
  return { date: d.toISOString().slice(0, 10), time: d.toTimeString().slice(0, 5) };
}

const MONTH_LABEL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function periodLabel(yyyymm) {
  if (!yyyymm) return "";
  const [y, m] = yyyymm.split("-").map((n) => parseInt(n, 10));
  return `${MONTH_LABEL[m - 1] || ""} ${y}`;
}

export default function BillDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { bills, updateBill } = useBills();
  const { addJournalEntry, peekNextJeNumber } = useJournalEntries();
  const { closedThrough } = useClosePeriod();
  const [tab, setTab] = useState("detail");
  const [docView, setDocView] = useState("invoice");
  const [toast, setToast] = useState("");
  const toastTmr = useRef(null);

  function showToast(msg) {
    setToast(msg);
    if (toastTmr.current) clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToast(""), 2400);
  }

  const bill = bills.find((b) => b.id === id);

  if (!bill) {
    return (
      <div className="bd-page">
        <div className="bd-notfound">
          <div className="bd-notfound-title">Bill not found</div>
          <div className="bd-notfound-sub">
            No bill with ID <span className="bd-mono">{id}</span> exists in the current dataset.
          </div>
          <button className="bd-back" onClick={() => navigate("/bills")}>← Back to Bills</button>
        </div>
      </div>
    );
  }

  const vendor = VENDORS.find((v) => v.id === bill.vendor);
  const fields = computeFieldConfidence(bill, vendor);
  const brief = computeReviewBrief(bill, fields);

  // Gate the Post button on YELLOW/RED fields — but exclude the Faktur Pajak
  // RED that fires on every PKP-vendor bill in the demo (the seed doesn't
  // carry a faktur number column). Without this exclusion the posting demo
  // would be blocked on nearly every bill. Phase J will make faktur editable
  // so the FM can fill it in and the gate becomes meaningful.
  const realBlockers = Object.values(fields).filter(
    (f) => (f.visual_state === "YELLOW" || f.visual_state === "RED") && f.field_name !== "faktur",
  );
  const gateReason = realBlockers.length > 0
    ? `${realBlockers.length} flagged field${realBlockers.length === 1 ? "" : "s"} need attention before posting`
    : null;

  // Period-lock gate — read the dynamic closedThrough from ClosePeriodContext.
  // When the bill's accounting period is locked, the Post action is disabled
  // and a Reassign affordance lets the FM move the bill to the current open
  // period (the path of least resistance per the AP Close PRD).
  const billPeriodLocked = isApPeriodLocked(bill.date, closedThrough);
  const lockedPeriodLabel = billPeriodLocked ? periodLabel(bill.date?.slice(0, 7)) : null;
  function onReassignToCurrentPeriod() {
    // Demo behavior: advance the bill's date to the first day of the next
    // open period (closedThrough + 1 month). In production this would be a
    // user-confirmed period change via the bill's period field.
    const [y, m] = closedThrough.split("-").map((n) => parseInt(n, 10));
    const nextY = m === 12 ? y + 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    const newDate = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
    updateBill(bill.id, { date: newDate }, {
      type:   "reassigned",
      action: `Reassigned to ${periodLabel(`${nextY}-${String(nextM).padStart(2, "0")}`)} (was ${lockedPeriodLabel})`,
      by:     FM_USER,
      ...nowAuditStamp(),
    });
    showToast(`Reassigned to ${periodLabel(`${nextY}-${String(nextM).padStart(2, "0")}`)} — period unlocked for this bill`);
  }

  // ── Action handlers — actually mutate the bill (and post a JE on Approve)
  function onPrimary(label) {
    const stamp = nowAuditStamp();
    switch (label) {
      case "Submit for review":
        updateBill(bill.id, { approval: "review" }, {
          type:   "submitted",
          action: "Submitted for FM review",
          by:     AP_USER,
          ...stamp,
        });
        showToast(`${bill.id} submitted for review`);
        break;
      case "Approve": {
        // Approving the bill is the moment it posts to the GL. Build a full
        // journal entry from the bill + vendor (same shape as seed JEs) and
        // push it onto the JournalEntriesContext list. Switch the user to
        // the Posting tab so the new JE header is immediately visible.
        const jeNumber = peekNextJeNumber();
        const je = buildJournalEntry(bill, vendor, jeNumber, FM_USER);
        addJournalEntry(je);
        updateBill(bill.id, {
          approval:       "approved",
          je_number:      jeNumber,
          je_posted_date: stamp.date,
        }, {
          type:   "approved",
          action: `Approved & posted to GL · ${jeNumber}`,
          by:     FM_USER,
          ...stamp,
        });
        showToast(`Posted to GL · ${jeNumber}`);
        setTab("posting");
        break;
      }
      case "Record payment":
        updateBill(bill.id, { pay: "paid", sisa: 0 }, {
          type:   "paid",
          action: "Payment recorded",
          by:     AP_USER,
          ...stamp,
        });
        showToast(`Payment recorded for ${bill.id}`);
        break;
      default:
        // DEMO_OVERRIDES-driven actions (Release hold, Edit & resubmit, etc.)
        // can't fully mutate state without making the override map reactive
        // — that's Phase J territory. Acknowledge with a toast.
        showToast(`${label} — ${bill.id} (demo)`);
    }
  }

  function onSecondary(label) {
    const stamp = nowAuditStamp();
    switch (label) {
      case "Return to AP":
        updateBill(bill.id, { approval: "draft" }, {
          type:   "returned",
          action: "Returned to AP for rework",
          by:     FM_USER,
          ...stamp,
        });
        showToast(`${bill.id} returned to AP`);
        break;
      default:
        showToast(`${label} — ${bill.id} (demo)`);
    }
  }

  // ── Field-level edit + confirm ────────────────────────────────────────
  // Phase J: FM corrects or confirms a flagged field. Edit overwrites the
  // value on the bill and marks every anomaly that hit the field as
  // resolved (so the indicator flips back to GREEN). Confirm leaves the
  // value alone and just marks the anomalies resolved — used when the FM
  // reviews a YELLOW warning and decides the value is fine as-is.
  function fieldAuditValue(fieldName, val) {
    if (val == null || val === "") return "—";
    if (fieldName === "dpp" || fieldName === "total")  return `Rp ${Number(val).toLocaleString("id-ID")}`;
    if (fieldName === "date" || fieldName === "due")   return formatDateEn(val);
    return String(val);
  }

  function editField(fieldName, newValue) {
    const before = bill[fieldName];
    const stamp = nowAuditStamp();
    const resolved = new Set(bill.anomalies_resolved || []);
    for (const idx of anomalyIndexesForField(bill, fieldName)) resolved.add(idx);
    updateBill(bill.id, {
      [fieldName]:         newValue,
      anomalies_resolved:  [...resolved],
    }, {
      type:   "edited",
      action: `${FIELD_LABELS[fieldName] || fieldName} corrected: ${fieldAuditValue(fieldName, before)} → ${fieldAuditValue(fieldName, newValue)}`,
      by:     AP_USER,
      field:  fieldName,
      before,
      after:  newValue,
      ...stamp,
    });
    showToast(`Saved. This will be applied to future invoices from ${vendor?.name || bill.vendorName}.`);
  }

  function confirmField(fieldName) {
    const stamp = nowAuditStamp();
    const resolved = new Set(bill.anomalies_resolved || []);
    for (const idx of anomalyIndexesForField(bill, fieldName)) resolved.add(idx);
    updateBill(bill.id, { anomalies_resolved: [...resolved] }, {
      type:   "confirmed",
      action: `${FIELD_LABELS[fieldName] || fieldName} confirmed despite anomaly`,
      by:     AP_USER,
      field:  fieldName,
      ...stamp,
    });
    showToast(`Confirmed.`);
  }

  // Parsers for inline edit inputs
  const parseInt0 = (v) => {
    const n = Number(String(v).replace(/[^\d-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const parseText = (v) => String(v).trim();

  // ── Tax-rate edits (Item Details) — changing a rate recomputes the
  // downstream amounts. PPN drives Total (and Remaining); PPh is a
  // withholding that only affects Net Payable, not Total.
  function setPpnRate(r) {
    const ppn = Math.round(bill.dpp * r);
    const total = bill.dpp + ppn;
    updateBill(bill.id, {
      ppnRate: r,
      ppn,
      total,
      sisa: bill.pay === "paid" ? 0 : total,
    }, {
      type:   "edited",
      action: `PPN rate set to ${(r * 100).toFixed(2)}% — recalculated to ${formatRupiah(ppn)}`,
      by:     AP_USER,
      ...nowAuditStamp(),
    });
    showToast(`PPN recalculated at ${(r * 100).toFixed(2)}%`);
  }
  function setPphRate(r) {
    const pph23 = Math.round(bill.dpp * r);
    updateBill(bill.id, { pphRate: r, pph23 }, {
      type:   "edited",
      action: `PPh rate set to ${(r * 100).toFixed(2)}% — recalculated to ${formatRupiah(pph23)}`,
      by:     AP_USER,
      ...nowAuditStamp(),
    });
    showToast(`PPh recalculated at ${(r * 100).toFixed(2)}%`);
  }

  // Effective rates — prefer the stored rate, fall back to deriving from the
  // amount (covers bills created before the rate fields existed).
  const ppnRate = bill.ppnRate != null ? bill.ppnRate : (bill.dpp > 0 && bill.ppn ? bill.ppn / bill.dpp : 0);
  const pphRate = bill.pphRate != null ? bill.pphRate : (bill.dpp > 0 && bill.pph23 ? bill.pph23 / bill.dpp : 0);
  const netPayable = bill.total - (bill.pph23 || 0);

  // Compliance / status label maps for the new Detail rows.
  const RECON_LABEL = { reconciled: "Reconciled", unreconciled: "Unreconciled" };
  const TAX_STATUS_LABEL = { reported: "Reported", pending: "Pending", "not-applicable": "Not applicable" };

  return (
    <div className="bd-page">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="bd-head">
        <button className="bd-back" onClick={() => navigate("/bills")}>← Bills</button>
        <div className="bd-head-main">
          <div className="drawer-av bill">{bill.initials || initials(bill.vendorName)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bd-title">{bill.vendorName}</div>
            <div className="bd-sub">
              <span className="bd-mono">{bill.id}</span>
              {bill.invNo && bill.invNo !== "—" && (
                <>
                  <span className="bd-sub-sep">·</span>
                  <span className="bd-mono">{bill.invNo}</span>
                </>
              )}
              <span className="bd-sub-sep">·</span>
              <span>Issued {formatDateEn(bill.date)}</span>
            </div>
          </div>
          <div className="bd-head-total">
            <div className="bd-head-total-lbl">Total</div>
            <div className="bd-head-total-val">{formatRupiah(bill.total)}</div>
          </div>
        </div>
      </div>

      {/* ── Two-panel body ────────────────────────────────────────── */}
      <div className="bd-main">
        {/* Left: source document (switchable) */}
        <div className="bd-source">
          <SourcePanel bill={bill} vendor={vendor} docView={docView} setDocView={setDocView} />
        </div>

        {/* Right: review brief + status stepper + form. When the bill is in
            EXCEPTION or ON_HOLD, the stepper-banner absorbs the brief's
            field list (one merged callout, not two competing surfaces). */}
        <div className="bd-form">
          <div className="bd-form-top">
            {(() => {
              const ws = workflowStatus(bill);
              const merged = ws === "EXCEPTION" || ws === "ON_HOLD";
              return (
                <>
                  {!merged && <ReviewBrief brief={brief} />}
                  <StatusStepper bill={bill} brief={brief} />
                </>
              );
            })()}
          </div>

          <div className="drawer-tabs bd-tabs">
            {[
              ["detail",  "Detail"],
              ["posting", "Posting"],
              ["vendor",  "Vendor"],
              ["audit",   "Audit"],
            ].map(([t, label]) => (
              <div key={t} className={`drawer-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
                {label}
                {t === "posting" && bill.je_number && (
                  <span className="bd-tab-badge" aria-label="posted">✓</span>
                )}
              </div>
            ))}
          </div>

          <div className="bd-form-body">
            {tab === "detail" && (
              <>
                <div className="drawer-stat-row bd-stat-row">
                  <div className="drawer-stat-card">
                    <div className="drawer-stat-lbl">Remaining</div>
                    <div className={`drawer-stat-val${bill.sisa > 0 ? " danger" : " success"}`}>
                      {bill.sisa > 0 ? formatRupiah(bill.sisa) : "Paid"}
                    </div>
                  </div>
                  <div className="drawer-stat-card">
                    <div className="drawer-stat-lbl">Approval</div>
                    <div className="drawer-stat-val">{APPROVAL_LABEL[bill.approval]}</div>
                  </div>
                </div>
                <div className="drawer-section">
                  <div className="drawer-section-title">Bill Information</div>
                  <div className="drawer-row">
                    <div className="drawer-label">Bill ID</div>
                    <div className="drawer-value">{bill.id}</div>
                  </div>
                  <FieldRow
                    label="Vendor Invoice No."
                    value={
                      bill.invNo && bill.invNo !== "—" ? (
                        <button type="button" className="bd-ref-link" onClick={() => setDocView("invoice")}>
                          {bill.invNo}
                        </button>
                      ) : bill.invNo
                    }
                    confidence={fields.invNo}
                    fieldName="invNo"
                    rawValue={bill.invNo === "—" ? "" : bill.invNo}
                    inputType="text"
                    parser={parseText}
                    onSave={(v) => editField("invNo", v)}
                    onConfirm={() => confirmField("invNo")}
                  />
                  <FieldRow
                    label="Invoice Date"
                    value={formatDateEn(bill.date)}
                    confidence={fields.date}
                    fieldName="date"
                    rawValue={bill.date}
                    inputType="date"
                    parser={parseText}
                    onSave={(v) => editField("date", v)}
                    onConfirm={() => confirmField("date")}
                  />
                  <FieldRow label="Due Date" value={formatDateEn(bill.due)} confidence={fields.due} />
                  <PlainRow label="Discount Due Date" value={bill.discountDueDate ? formatDateEn(bill.discountDueDate) : "—"} />
                  <PlainRow label="GRN Status" value={GRN_LABEL[bill.grn] || "—"} />
                  <PlainRow label="Payment Status" value={PAY_LABEL[bill.pay]} />
                  <SubRow
                    label="Bank Reconciliation Status"
                    value={RECON_LABEL[bill.bankReconStatus] || "—"}
                  />
                  <SubRow
                    label="Payment Date & Time"
                    value={bill.paymentDate ? `${formatDateEn(bill.paymentDate)}${bill.paymentTime ? " · " + bill.paymentTime : ""}` : "—"}
                  />
                  {bill.keterangan && (
                    <div className="drawer-row">
                      <div className="drawer-label">Description</div>
                      <div className="drawer-value">{bill.keterangan}</div>
                    </div>
                  )}
                </div>

                <div className="drawer-section">
                  <div className="drawer-section-title">Tax</div>
                  <PlainRow
                    label="Tax Reporting Period"
                    value={bill.taxReportingPeriod ? periodLabel(bill.taxReportingPeriod) : "—"}
                  />
                  <div className="drawer-row">
                    <div className="drawer-label">Tax Reporting Status</div>
                    <div className="drawer-value">
                      <span className={`bd-tax-status bd-tax-${bill.taxReportingStatus || "not-applicable"}`}>
                        {TAX_STATUS_LABEL[bill.taxReportingStatus] || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="drawer-section">
                  <div className="drawer-section-title">References</div>
                  <RefRow label="PO #"           value={bill.poNo}       onClick={() => setDocView("po")} />
                  <RefRow label="GRN #"          value={bill.grnNo}      onClick={() => setDocView("grn")} />
                  <RefRow label="Contract #"     value={bill.contractNo} onClick={() => setDocView("contract")} />
                  <RefRow label="Faktur Pajak"   value={bill.fakturNo}   onClick={() => setDocView("faktur")} />
                </div>

                <div className="drawer-section">
                  <div className="drawer-section-title">Item Details</div>
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th className="r">Qty</th>
                        <th className="r">Price</th>
                        <th className="r">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bill.items.map((item, i) => (
                        <tr key={i}>
                          <td>
                            <div>{item.desc}</div>
                            <div style={{ fontSize: 10, color: "var(--color-action)", fontFamily: "var(--font-mono)" }}>
                              {item.acct} · {item.acctName}
                            </div>
                          </td>
                          <td className="r">{item.qty.toLocaleString("id-ID")}</td>
                          <td className="r">{formatRupiah(item.price)}</td>
                          <td className="r">{formatRupiah(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="bd-amounts">
                    <PlainRow label="DPP" value={formatRupiah(bill.dpp)} mono />
                    <RateRow label="PPN" rate={ppnRate} amount={bill.ppn} onSaveRate={setPpnRate} />
                    <RateRow label="PPh" rate={pphRate} amount={bill.pph23} onSaveRate={setPphRate} />
                    <div className="drawer-row bd-amt-strong">
                      <div className="drawer-label">Total</div>
                      <div className="drawer-value mono">{formatRupiah(bill.total)}</div>
                    </div>
                    <PlainRow label="Net Payable" value={formatRupiah(netPayable)} mono />
                  </div>
                </div>
              </>
            )}

            {tab === "posting" && (
              <JournalEntryPreview
                bill={bill}
                vendor={vendor}
                onViewPostedJe={() => navigate("/journal-entry")}
              />
            )}

            {tab === "vendor" && (
              <VendorContextPanel vendor={vendor} />
            )}

            {tab === "audit" && (
              <div className="drawer-section">
                <div className="drawer-section-title">Audit History</div>
                <div className="audit-list">
                  {bill.audit.map((a, i) => (
                    <div key={i} className="audit-item">
                      <div className={`audit-dot ${a.type}`} />
                      <div>
                        <div className="audit-action">{a.action}</div>
                        <div className="audit-by">{a.by} · {formatDateEn(a.date)} {a.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Action bar ─────────────────────────────────────────────── */}
      <ActionBar
        bill={bill}
        gateReason={gateReason}
        periodLocked={billPeriodLocked}
        lockedPeriodLabel={lockedPeriodLabel}
        onReassign={onReassignToCurrentPeriod}
        onAction={onPrimary}
        onSecondary={onSecondary}
      />

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
