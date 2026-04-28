// Canned demo responses for the GL "Klay AI" co-pilot. Cycled by message count
// for generic queries; keyed-match for the suggestion chips.
//
// Numbers are illustrative — they don't recompute when the JE seed changes.
// Re-anchor when the demo narrative shifts.

export const AI_RESPONSES = [
  "Across Jan–Apr 2025, total debits and credits both reach Rp 11,7 milyar — the GL is balanced.",
  "Most active account: Bank — BCA Operating (1-1300) with 47 transactions netting Rp 2,1 milyar of activity.",
  "1 customer invoice still outstanding (INV005 — Rp 48,4jt) and 1 vendor bill still due (BILL005 — Rp 13,75jt).",
  "VAT Input (1-5100) accumulated Rp 286jt this quarter. Confirm it nets correctly against VAT Output (2-2100) before the SPT masa filing.",
  "Operating margin is healthy through March; April activity is light because closing is still in progress.",
];

export const SUGGESTION_RESPONSES = {
  "What should I focus on today? ↗": `Three items are blocking the Apr 2025 close:<br><br><strong>1. Resolve the flagged payroll accrual</strong><br>This month's payroll is +17% above the 3-month average. Confirm whether the increase is expected (new hires, bonus run) or an entry error.<br><br><strong>2. Push approvals on pending JEs</strong><br>Several JEs are still waiting on Finance Manager approval. The GL can't lock without them.<br><br><strong>3. Close the bank reconciliation gap</strong><br>The bank match rate is at 76% for the period. AI has auto-matched 38 lines — the rest need manual review.<br><br>Closing window: <strong>7 days remaining</strong>. Prioritise the anomaly + approvals first.`,
  "Compare with last month ↗": `Apr 2025 vs Mar 2025:<br><br>Running balance up 11% · Total entries +24 · Operating expense up 8% · Reconciliation: 76% (Mar was 98%) · Anomalies: 1 new flag.<br><br>The balance lift mostly comes from stronger collections; expenses rose due to the higher payroll accrual that's already flagged for review.`,
};
