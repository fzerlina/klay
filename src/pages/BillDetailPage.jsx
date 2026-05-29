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
} from "../lib/billStatus";
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

// ─── Source Document (left panel) ───────────────────────────────────────────
// HTML mock rendered from bill + vendor data. Faithful enough that the FM
// can compare the form on the right against what was "scanned" on the left.
// Phase F replaces this with a real PDF for BILL007 (the OCR/AI hero) and
// wires bounding-box highlight on field focus.

function SourceDocument({ bill, vendor }) {
  return (
    <div className="bd-doc-wrap">
      <div className="bd-doc-toolbar">
        <span className="bd-doc-toolbar-lbl">Source Document</span>
        <span className="bd-doc-toolbar-sep">·</span>
        <span className="bd-doc-toolbar-meta">
          {bill.isAI ? "OCR extraction (email ingest)" : "Manual entry"}
        </span>
      </div>
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
    </div>
  );
}

// ─── Action bar ─────────────────────────────────────────────────────────────
// Same status-aware shape as the drawer footer it replaces. The action set
// adapts to workflow_status so the FM / AP Staff always see the relevant next
// step. Phase C will gate Post on flagged-field resolution; Phase G will gate
// it on period-lock status. SoD enforcement is deferred — see the
// "demo: SoD not enforced" note on the left of the bar.

function ActionBar({ bill, onAction, onSecondary, gateReason }) {
  if (!bill) return null;
  const ws = workflowStatus(bill);
  const ov = DEMO_OVERRIDES[bill.id] || {};
  // Gate the workflow-progressing primary action (Submit / Approve / Edit &
  // resubmit) when there are unresolved YELLOW/RED fields. Per PRD: "Post is
  // active when all RED filled and all YELLOW confirmed/corrected." Other
  // primaries (Record payment, Release hold, etc.) are not gated.
  const gateableStates = ws === "DRAFT" || ws === "PENDING_REVIEW" || ws === "RETURNED";
  const gated = !!gateReason && gateableStates;

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

  return (
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
            className={`drawer-btn primary${gated ? " disabled" : ""}`}
            disabled={gated}
            title={gated ? gateReason : undefined}
            onClick={() => !gated && onAction(primary)}
          >
            {primary}
            {gated && <span className="bd-actionbar-gate"> · resolve flags first</span>}
          </button>
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

export default function BillDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { bills, updateBill } = useBills();
  const { addJournalEntry, peekNextJeNumber } = useJournalEntries();
  const [tab, setTab] = useState("detail");
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
        {/* Left: source document */}
        <div className="bd-source">
          <SourceDocument bill={bill} vendor={vendor} />
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
              ["items",   "Items"],
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
                    value={bill.invNo}
                    confidence={fields.invNo}
                    fieldName="invNo"
                    rawValue={bill.invNo === "—" ? "" : bill.invNo}
                    inputType="text"
                    parser={parseText}
                    onSave={(v) => editField("invNo", v)}
                    onConfirm={() => confirmField("invNo")}
                  />
                  <FieldRow
                    label="PO No."
                    value={bill.poNo}
                    confidence={fields.poNo}
                    fieldName="poNo"
                    rawValue={bill.poNo === "—" ? "" : bill.poNo}
                    inputType="text"
                    parser={parseText}
                    onSave={(v) => editField("poNo", v)}
                    onConfirm={() => confirmField("poNo")}
                  />
                  <FieldRow
                    label="Date"
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
                  <div className="drawer-row">
                    <div className="drawer-label">GRN</div>
                    <div className="drawer-value">{GRN_LABEL[bill.grn]}</div>
                  </div>
                  <div className="drawer-row">
                    <div className="drawer-label">Payment Status</div>
                    <div className="drawer-value">{PAY_LABEL[bill.pay]}</div>
                  </div>
                  {bill.keterangan && (
                    <div className="drawer-row">
                      <div className="drawer-label">Description</div>
                      <div className="drawer-value">{bill.keterangan}</div>
                    </div>
                  )}
                </div>
                <div className="drawer-section">
                  <div className="drawer-section-title">Tax</div>
                  <FieldRow
                    label="DPP"
                    value={formatRupiah(bill.dpp)}
                    confidence={fields.dpp}
                    mono
                    fieldName="dpp"
                    rawValue={bill.dpp}
                    inputType="number"
                    parser={parseInt0}
                    onSave={(v) => editField("dpp", v)}
                    onConfirm={() => confirmField("dpp")}
                  />
                  <FieldRow label="PPN (11%)" value={formatRupiah(bill.ppn)} confidence={fields.ppn} mono />
                  <FieldRow
                    label="PPh 23"
                    value={bill.pph23 > 0 ? formatRupiah(bill.pph23) : "—"}
                    confidence={fields.pph23}
                    mono
                  />
                  {fields.faktur && (
                    <FieldRow
                      label="Faktur Pajak"
                      value={
                        bill.faktur_pajak
                          ? bill.faktur_pajak
                          : fields.faktur.visual_state === "RED" ? "—" : "Not applicable"
                      }
                      confidence={fields.faktur}
                      fieldName="faktur_pajak"
                      rawValue={bill.faktur_pajak || ""}
                      inputType="text"
                      parser={parseText}
                      onSave={(v) => editField("faktur_pajak", v)}
                    />
                  )}
                  <FieldRow
                    label="Total"
                    value={formatRupiah(bill.total)}
                    confidence={fields.total}
                    mono
                    fieldName="total"
                    rawValue={bill.total}
                    inputType="number"
                    parser={parseInt0}
                    onSave={(v) => editField("total", v)}
                    onConfirm={() => confirmField("total")}
                  />
                  <FieldRow
                    label="Net Payable"
                    value={formatRupiah(bill.total - (bill.pph23 || 0))}
                    confidence={fields.net_payable}
                    mono
                  />
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

            {tab === "items" && (
              <div className="drawer-section">
                <div className="drawer-section-title">Line Items</div>
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
                    <tr className="items-total-row">
                      <td colSpan={3}>Total</td>
                      <td className="r">{formatRupiah(bill.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
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
        onAction={onPrimary}
        onSecondary={onSecondary}
      />

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
