import { useClosePeriod } from "../state/ClosePeriodContext";
import "./modules.css";
import "./invoices-ledger.css";
import "./settings-pages.css";

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function periodLabel(yyyymm) {
  if (!yyyymm || yyyymm.length < 7) return "—";
  const [y, m] = yyyymm.split("-");
  return `${MONTHS_EN[parseInt(m, 10) - 1] || m} ${y}`;
}

// Settings → Accounting → Posting periods. Owns the "auto-assign late bills"
// preference. When ON (default), a bill whose invoice period is already closed
// posts to the current open period automatically — no manual reassign step.
export default function PostingPeriodsSettingsPage() {
  const { closedThrough, nextOpenPeriod, autoAssignLateBills, setAutoAssignLateBills } = useClosePeriod();

  return (
    <div className="lg-page">
      <div className="lg-scroll-container">
        <div className="lg-head">
          <div className="lg-head-top">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="lg-title">Posting periods</h1>
              <p className="settings-sub">
                How Klay handles bills that arrive after their accounting period has already closed.
                Periods up to and including <strong>{periodLabel(closedThrough)}</strong> are locked;
                the current open period is <strong>{periodLabel(nextOpenPeriod)}</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="pp-setting-card">
          <div className="pp-setting-main">
            <div className="pp-setting-text">
              <div className="pp-setting-title">Auto-assign late bills to the open period</div>
              <p className="pp-setting-desc">
                When a bill is dated in a period that&rsquo;s already closed, post it to the current open
                period (<strong>{periodLabel(nextOpenPeriod)}</strong>) automatically. The invoice date is
                preserved as a document fact — only the accounting period rolls forward. Staff never see a
                &ldquo;reassign to period&rdquo; step.
              </p>
              <p className="pp-setting-note">
                Turn this off to require someone to reassign each late bill by hand before it can post.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoAssignLateBills}
              className={`pp-switch${autoAssignLateBills ? " on" : ""}`}
              onClick={() => setAutoAssignLateBills(!autoAssignLateBills)}
            >
              <span className="pp-switch-knob" />
            </button>
          </div>
          <div className={`pp-setting-status${autoAssignLateBills ? " on" : ""}`}>
            {autoAssignLateBills
              ? `On — late bills post to ${periodLabel(nextOpenPeriod)} automatically.`
              : "Off — late bills must be reassigned manually before posting."}
          </div>
        </div>
      </div>
    </div>
  );
}
