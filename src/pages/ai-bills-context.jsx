import { VENDORS } from "../data/seed/vendors";
import { TODAY, daysSince } from "../lib/clock";
import { initials } from "../lib/format";
import { workflowStatus } from "../lib/billStatus";
import { ChatChip } from "./AiChatDrawer";

function fmtRpShort(n) {
  if (n == null) return "—";
  if (n >= 1e9) return "Rp " + (n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " M";
  if (n >= 1e6) return "Rp " + (n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 0 }) + " jt";
  return "Rp " + n.toLocaleString("id-ID");
}

function shortName(name) {
  if (!name) return "—";
  const tokens = name.split(/\s+/).filter((t) => t && !/^(PT|CV|UD|Toko|Cooperative)$/i.test(t));
  return tokens.slice(0, 2).join(" ");
}

// ── Insights (cycle in the AiSubtitle) ────────────────────────────────────
// Each insight has { id, node (JSX), question (string seed for chat) }

// `role` scopes which tasks surface in the "Your Tasks" rail:
//   "operator"  — FM/Admin: supervisory queue (ready-to-post, cashflow, approvals)
//   "preparer"  — AP Staff: their prep queue (returns to fix, exceptions, drafts)
//   "viewer"    — View Only: read-only analytics, no action framing
export function computeBillsInsights(bills, closedThrough = "2025-02", role = "operator") {
  const overdue = bills.filter((b) => b.pay === "overdue");
  const totalOverdue = overdue.reduce((s, b) => s + b.sisa, 0);

  // Top vendors by overdue exposure
  const byVendor = new Map();
  for (const b of overdue) {
    const prev = byVendor.get(b.vendor) || { id: b.vendor, name: b.vendorName, amount: 0, count: 0 };
    prev.amount += b.sisa;
    prev.count += 1;
    byVendor.set(b.vendor, prev);
  }
  const top3 = Array.from(byVendor.values()).sort((a, b) => b.amount - a.amount).slice(0, 3);
  const top3Sum = top3.reduce((s, c) => s + c.amount, 0);
  const top3Pct = totalOverdue ? Math.round((top3Sum / totalOverdue) * 100) : 0;

  // Cashflow OUT next 7 days — unpaid bills due in next week
  const todayKey = TODAY.toISOString().slice(0, 10);
  const in7 = new Date(TODAY);
  in7.setDate(TODAY.getDate() + 7);
  const in7Key = in7.toISOString().slice(0, 10);
  const upcoming = bills.filter(
    (b) => b.pay !== "paid" && b.approval === "approved" && b.due && b.due > todayKey && b.due <= in7Key,
  );
  const upcomingTotal = upcoming.reduce((s, b) => s + b.sisa, 0);

  // Bills needing approval (in review)
  const inReview = bills.filter((b) => b.approval === "review");
  const inReviewTotal = inReview.reduce((s, b) => s + b.total, 0);

  // Average days past due
  const avgDpd = overdue.length
    ? Math.round(overdue.reduce((s, b) => s + Math.max(0, daysSince(b.due)), 0) / overdue.length)
    : 0;

  // Largest single overdue bill
  const largest = overdue.reduce((m, b) => (b.sisa > (m?.sisa || 0) ? b : m), null);

  // Bills approved + unpaid — verified by Klay, ready to be posted to payment batch.
  const readyToPost = bills.filter((b) => b.approval === "approved" && b.pay === "unpaid");
  const readyToPostTotal = readyToPost.reduce((s, b) => s + b.total, 0);

  // Period-locked: bills in PENDING_REVIEW / APPROVED-unpaid whose `date` falls in a closed AP period.
  // Demo rule: months ≤ closedThrough are closed (advances when FM declares a new close
  // via the Close Command Center). Production would call is_ap_period_locked(entity_id, bill.period).
  const periodLocked = bills.filter((b) => {
    if (!b.date || b.date.slice(0, 7) > closedThrough) return false;
    if (b.approval === "review") return true;
    if (b.approval === "approved" && b.pay !== "paid") return true;
    return false;
  });
  const periodLockedTotal = periodLocked.reduce((s, b) => s + (b.sisa || b.total), 0);

  // Workflow-derived prep queue (AP Staff). These are the states a preparer
  // owns: drafts they haven't submitted, bills the FM returned for fixes, and
  // exceptions Klay couldn't auto-process.
  const drafts = bills.filter((b) => workflowStatus(b) === "DRAFT");
  const draftsTotal = drafts.reduce((s, b) => s + b.total, 0);
  const returned = bills.filter((b) => workflowStatus(b) === "RETURNED");
  const exceptions = bills.filter((b) => workflowStatus(b) === "EXCEPTION");

  // ── Shared analytics insights (used by operator + viewer) ───────────────
  const vendorConcentrationInsight = top3.length > 0 && totalOverdue > 0 ? {
    id: "vendorConcentration",
    node: (
      <>
        <strong className="lg-ai-strong">{top3.length} vendors</strong>{" "}
        ({top3.map((v, i) => (
          <span key={v.id}>{i > 0 ? ", " : ""}{shortName(v.name)}</span>
        ))}) account for{" "}
        <strong className="lg-ai-strong">{top3Pct}%</strong> of{" "}
        <span className="lg-ai-danger">{fmtRpShort(totalOverdue)}</span> in overdue payables.
      </>
    ),
    cta: "View",
    question: "Which vendors do we most frequently pay late?",
  } : null;

  const avgDpdInsight = overdue.length > 0 && avgDpd > 0 ? {
    id: "avgDpd",
    node: (
      <>
        Average <strong className="lg-ai-strong">{avgDpd} days overdue</strong> across{" "}
        <strong className="lg-ai-strong">{overdue.length} unpaid bills</strong>.
      </>
    ),
    cta: "View",
    question: "What is our average days-late on vendor payments?",
  } : null;

  const largestInsight = largest && largest.sisa > 0 ? {
    id: "largest",
    bill: largest,
    node: (
      <>
        Largest overdue payable:{" "}
        <span className="lg-ai-danger">{fmtRpShort(largest.sisa)}</span> to{" "}
        <strong className="lg-ai-strong">{shortName(largest.vendorName)}</strong>{" "}
        ({Math.max(0, daysSince(largest.due))} days overdue).
      </>
    ),
    cta: "View",
    question: `Show details for bill ${largest.invNo || largest.id} from ${shortName(largest.vendorName)}`,
  } : null;

  const periodLockedInsight = periodLocked.length > 0 ? {
    id: "periodLocked",
    node: (
      <>
        <strong className="lg-ai-strong">{periodLocked.length} bills</strong> worth{" "}
        <strong className="lg-ai-strong">{fmtRpShort(periodLockedTotal)}</strong> are bound for closed periods — reassign to current open period to post.
      </>
    ),
    cta: "View",
    question: "Which bills are bound for closed periods?",
  } : null;

  // ── AP Staff (preparer): their prep queue, ordered by who's waiting ─────
  if (role === "preparer") {
    const prep = [];
    if (returned.length > 0) {
      prep.push({
        id: "returned",
        node: (
          <>
            <strong className="lg-ai-strong">{returned.length} bill{returned.length === 1 ? "" : "s"}</strong> returned by your Finance Manager — fix and resubmit.
          </>
        ),
        cta: "View",
        question: "Which bills did my Finance Manager return to me?",
      });
    }
    if (exceptions.length > 0) {
      prep.push({
        id: "exceptions",
        node: (
          <>
            <strong className="lg-ai-strong">{exceptions.length} bill{exceptions.length === 1 ? "" : "s"}</strong> need manual review — Klay couldn't auto-process them.
          </>
        ),
        cta: "View",
        question: "Which bills need manual review?",
      });
    }
    if (periodLockedInsight) prep.push(periodLockedInsight);
    if (drafts.length > 0) {
      prep.push({
        id: "drafts",
        node: (
          <>
            <strong className="lg-ai-strong">{drafts.length} draft{drafts.length === 1 ? "" : "s"}</strong> worth{" "}
            <strong className="lg-ai-strong">{fmtRpShort(draftsTotal)}</strong> not yet submitted for review.
          </>
        ),
        cta: "View",
        question: "Which of my drafts are ready to submit?",
      });
    }
    if (prep.length === 0) {
      prep.push({
        id: "empty",
        node: <>Your prep queue is clear — no drafts, returns, or exceptions waiting.</>,
        cta: "View",
        question: "What's in my AP queue right now?",
      });
    }
    return prep;
  }

  // ── View Only (viewer): read-only analytics, no action framing ──────────
  if (role === "viewer") {
    const ro = [vendorConcentrationInsight, avgDpdInsight, largestInsight].filter(Boolean);
    if (ro.length === 0) {
      ro.push({
        id: "empty",
        node: <>All trade payables are within term today — nothing overdue.</>,
        cta: "View",
        question: "How is AP cash flow this week?",
      });
    }
    return ro;
  }

  // ── FM/Admin (operator): supervisory queue (default) ────────────────────
  const insights = [];

  if (periodLockedInsight) insights.push(periodLockedInsight);

  if (readyToPost.length > 0) {
    insights.push({
      id: "readyToPost",
      node: (
        <>
          <strong className="lg-ai-strong">{readyToPost.length} bills</strong> worth{" "}
          <strong className="lg-ai-strong">{fmtRpShort(readyToPostTotal)}</strong> ready to post, verified clean by Klay.
        </>
      ),
      cta: "View",
      question: "Which bills are ready to post?",
    });
  }

  if (vendorConcentrationInsight) insights.push(vendorConcentrationInsight);

  if (upcoming.length > 0) {
    insights.push({
      id: "cashflowOut",
      node: (
        <>
          <strong className="lg-ai-strong">{upcoming.length} bills</strong> worth{" "}
          <strong className="lg-ai-strong">{fmtRpShort(upcomingTotal)}</strong> coming due in the next{" "}
          <strong className="lg-ai-strong">7 days</strong>.
        </>
      ),
      cta: "View",
      question: "What cash should be prepared for this week?",
    });
  }

  if (inReview.length > 0) {
    insights.push({
      id: "inReview",
      node: (
        <>
          <strong className="lg-ai-strong">{inReview.length} bills</strong> awaiting approval, total{" "}
          <span className="lg-ai-danger">{fmtRpShort(inReviewTotal)}</span>.
        </>
      ),
      cta: "View",
      question: "Which bills are awaiting approval?",
    });
  }

  if (avgDpdInsight) insights.push(avgDpdInsight);

  if (largestInsight) insights.push(largestInsight);

  if (insights.length === 0) {
    insights.push({
      id: "empty",
      node: <>All trade payables are within term today — nothing overdue.</>,
      cta: "View",
      question: "How is AP cash flow this week?",
    });
  }

  return insights;
}

// ── AI chat context ──────────────────────────────────────────────────────

export function makeBillsAiContext(bills) {
  const overdue = bills.filter((b) => b.pay === "overdue");
  const totalOverdue = overdue.reduce((s, b) => s + b.sisa, 0);

  const byVendor = new Map();
  for (const b of overdue) {
    const prev = byVendor.get(b.vendor) || { id: b.vendor, name: b.vendorName, amount: 0, count: 0, dpdSum: 0 };
    prev.amount += b.sisa;
    prev.count += 1;
    prev.dpdSum += Math.max(0, daysSince(b.due));
    byVendor.set(b.vendor, prev);
  }
  const top = Array.from(byVendor.values())
    .map((v) => ({ ...v, avgDpd: v.count ? Math.round(v.dpdSum / v.count) : 0 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const inReview = bills.filter((b) => b.approval === "review");
  const inReviewTotal = inReview.reduce((s, b) => s + b.total, 0);

  const upcoming7 = (() => {
    const todayKey = TODAY.toISOString().slice(0, 10);
    const in7 = new Date(TODAY);
    in7.setDate(TODAY.getDate() + 7);
    const in7Key = in7.toISOString().slice(0, 10);
    return bills.filter((b) => b.pay !== "paid" && b.approval === "approved" && b.due && b.due > todayKey && b.due <= in7Key);
  })();
  const upcoming7Total = upcoming7.reduce((s, b) => s + b.sisa, 0);

  const welcome = (
    <p>Hi Sarah — I've reviewed your trade payables data. How can I help?</p>
  );

  const suggestions = [
    "Which vendors do we most frequently pay late?",
    "What cash should be prepared for this week?",
    "Which bills are awaiting approval?",
    "Compare trade payables this month vs last month",
  ];

  function makeTopVendorsResponse(send) {
    const totalShare = top.reduce((s, v) => s + v.amount, 0);
    const pct = totalOverdue ? Math.round((totalShare / totalOverdue) * 100) : 0;
    return {
      role: "ai",
      content: (
        <>
          <p>The 3 vendors we most frequently pay late:</p>
          <div className="ai-mini-table">
            {top.map((v) => {
              const vendor = VENDORS.find((x) => x.id === v.id);
              return (
                <div className="ai-mini-row" key={v.id}>
                  <div className="ai-mini-av">{initials(vendor?.name || v.name)}</div>
                  <div className="ai-mini-body">
                    <div className="ai-mini-name">{vendor?.name || v.name}</div>
                    <div className="ai-mini-meta">
                      <span className="ai-mini-meta-strong">{v.avgDpd}d</span> avg. late · {v.count} active bills
                    </div>
                  </div>
                  <div className="ai-mini-amt">{fmtRpShort(v.amount)}</div>
                </div>
              );
            })}
          </div>
          <p>
            These {top.length} vendors account for <strong>{pct}%</strong> of overdue payables. Want me to draft a priority payment schedule?
          </p>
          <div className="chat-chips">
            <ChatChip primary onClick={() => send("Yes, draft a priority payment schedule")}>Draft payment schedule</ChatChip>
            <ChatChip onClick={() => send("Show payment history")}>Show history</ChatChip>
            <ChatChip onClick={() => send("Negotiate terms first")}>Negotiate terms</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeCashflowOutResponse() {
    return {
      role: "ai",
      content: (
        <>
          <p>
            Cash out for the next 7 days: <strong>{fmtRpShort(upcoming7Total)}</strong> across{" "}
            <strong>{upcoming7.length} approved bills</strong> coming due.{" "}
            <span className="danger">3 bills at risk of being late</span> without an internal follow-up.
          </p>
          <p>Want me to create an approval reminder for the at-risk bills?</p>
          <div className="chat-chips">
            <ChatChip primary>Create approval reminder</ChatChip>
            <ChatChip>View details first</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeApprovalQueueResponse() {
    if (inReview.length === 0) {
      return {
        role: "ai",
        content: <p>No bills are currently awaiting approval.</p>,
      };
    }
    const sample = inReview.slice(0, 3);
    return {
      role: "ai",
      content: (
        <>
          <p>{inReview.length} bills totalling <strong>{fmtRpShort(inReviewTotal)}</strong> are awaiting approval. Top by amount:</p>
          <div className="ai-mini-table">
            {sample.map((b) => (
              <div className="ai-mini-row" key={b.id}>
                <div className="ai-mini-av">{initials(b.vendorName)}</div>
                <div className="ai-mini-body">
                  <div className="ai-mini-name">{b.vendorName}</div>
                  <div className="ai-mini-meta">{b.invNo} · due {b.due}</div>
                </div>
                <div className="ai-mini-amt">{fmtRpShort(b.total)}</div>
              </div>
            ))}
          </div>
          <div className="chat-chips">
            <ChatChip primary>Approve all</ChatChip>
            <ChatChip>Review one by one</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeMoMResponse() {
    return {
      role: "ai",
      content: (
        <>
          <p>
            Trade payables this month: <strong>Rp 8.4 B</strong> — down{" "}
            <span style={{ color: "var(--color-success-text)", fontWeight: 600 }}>−12%</span> vs last month (Rp 9.5 B). Regular inventory supplier payments are up 18%, while service costs are down 30%.
          </p>
          <div className="chat-chips">
            <ChatChip primary>Break down by category</ChatChip>
            <ChatChip>Break down by vendor</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeDefaultResponse(text) {
    return {
      role: "ai",
      content: (
        <>
          <p>I can't specifically answer "{text}" in this prototype, but I can help with:</p>
          <div className="chat-chips">
            <ChatChip>Vendors most often paid late</ChatChip>
            <ChatChip>Cash out this week</ChatChip>
            <ChatChip>Approval queue</ChatChip>
          </div>
        </>
      ),
    };
  }

  function respond(text, helpers) {
    const t = text.toLowerCase();
    if (t.includes("vendor") || t.includes("late paying") || t.includes("most")) {
      return makeTopVendorsResponse(helpers.send);
    }
    if (t.includes("cashflow") || t.includes("cash keluar") || t.includes("this week") || t.includes("7 days")) {
      return makeCashflowOutResponse();
    }
    if (t.includes("approval") || t.includes("approve") || t.includes("review")) {
      return makeApprovalQueueResponse();
    }
    if (t.includes("last month") || t.includes("bandingkan") || t.includes("mom")) {
      return makeMoMResponse();
    }
    return makeDefaultResponse(text);
  }

  return { welcome, suggestions, respond };
}
