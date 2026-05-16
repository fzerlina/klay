import { VENDORS } from "../data/seed/vendors";
import { TODAY, daysSince } from "../lib/clock";
import { initials } from "../lib/format";
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

export function computeBillsInsights(bills) {
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

  const insights = [];

  if (top3.length > 0 && totalOverdue > 0) {
    insights.push({
      id: "vendorConcentration",
      node: (
        <>
          <strong className="lg-ai-strong">{top3.length} vendor</strong>{" "}
          ({top3.map((v, i) => (
            <span key={v.id}>{i > 0 ? ", " : ""}{shortName(v.name)}</span>
          ))}) account for{" "}
          <strong className="lg-ai-strong">{top3Pct}%</strong> of{" "}
          <span className="lg-ai-danger">{fmtRpShort(totalOverdue)}</span> payables that are overdue.
        </>
      ),
      question: "Which vendor that we most frequently pay late?",
    });
  }

  if (upcoming.length > 0) {
    insights.push({
      id: "cashflowOut",
      node: (
        <>
          <strong className="lg-ai-strong">{upcoming.length} bill</strong> worth{" "}
          <strong className="lg-ai-strong">{fmtRpShort(upcomingTotal)}</strong> will be due in{" "}
          <strong className="lg-ai-strong">7 days</strong> to depan.
        </>
      ),
      question: "What cash should be prepared for this week?",
    });
  }

  if (inReview.length > 0) {
    insights.push({
      id: "inReview",
      node: (
        <>
          <strong className="lg-ai-strong">{inReview.length} bill</strong> awaiting approval, total{" "}
          <span className="lg-ai-danger">{fmtRpShort(inReviewTotal)}</span>.
        </>
      ),
      question: "Which bills are awaiting approval?",
    });
  }

  if (overdue.length > 0 && avgDpd > 0) {
    insights.push({
      id: "avgDpd",
      node: (
        <>
          Average <strong className="lg-ai-strong">{avgDpd} days overdue</strong> for{" "}
          <strong className="lg-ai-strong">{overdue.length} bill</strong> that not yet we bayar.
        </>
      ),
      question: "What average days we pay vendors late?",
    });
  }

  if (largest && largest.sisa > 0) {
    insights.push({
      id: "largest",
      node: (
        <>
          Payables largest that late:{" "}
          <span className="lg-ai-danger">{fmtRpShort(largest.sisa)}</span> ke{" "}
          <strong className="lg-ai-strong">{shortName(largest.vendorName)}</strong>{" "}
          ({Math.max(0, daysSince(largest.due))} days overdue).
        </>
      ),
      question: `Detail bill ${largest.invNo || largest.id} from ${shortName(largest.vendorName)}`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "empty",
      node: <>All trade payables we in term today — none that late paying.</>,
      question: "How ringcashan AP this week?",
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
    <p>Hi Sarah — I have reviewed data trade payables your. How can I help?</p>
  );

  const suggestions = [
    "Which vendor that we most frequently pay late?",
    "What cash should be prepared for this week?",
    "Bill which that awaiting approval?",
    "Compare trade payables this month vs last month",
  ];

  function makeTopVendorsResponse(send) {
    const totalShare = top.reduce((s, v) => s + v.amount, 0);
    const pct = totalOverdue ? Math.round((totalShare / totalOverdue) * 100) : 0;
    return {
      role: "ai",
      content: (
        <>
          <p>3 vendor that we most frequently pay late:</p>
          <div className="ai-mini-table">
            {top.map((v) => {
              const vendor = VENDORS.find((x) => x.id === v.id);
              return (
                <div className="ai-mini-row" key={v.id}>
                  <div className="ai-mini-av">{initials(vendor?.name || v.name)}</div>
                  <div className="ai-mini-body">
                    <div className="ai-mini-name">{vendor?.name || v.name}</div>
                    <div className="ai-mini-meta">
                      average <span className="ai-mini-meta-strong">{v.avgDpd}d</span> late · {v.count} bill active
                    </div>
                  </div>
                  <div className="ai-mini-amt">{fmtRpShort(v.amount)}</div>
                </div>
              );
            })}
          </div>
          <p>
            Total <strong>{pct}%</strong> from payables that late is in {top.length} vendor ini. Want me to susun schedule payment prioritas?
          </p>
          <div className="chat-chips">
            <ChatChip primary onClick={() => send("Ya, susun schedule payment prioritas")}>Susun schedule payment</ChatChip>
            <ChatChip onClick={() => send("Show riwayat payment")}>Show riwayat</ChatChip>
            <ChatChip onClick={() => send("I negosiasi term dulu")}>Negosiasi term</ChatChip>
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
            Kas keluar 7 days to depan: <strong>{fmtRpShort(upcoming7Total)}</strong> for{" "}
            <strong>{upcoming7.length} bill</strong> already approved and will be due.{" "}
            <span className="danger">3 bill berisiko terlambat</span> jika none follow-up internal.
          </p>
          <p>Want me to create a reminder approval for that berisiko?</p>
          <div className="chat-chips">
            <ChatChip primary>Create reminder approval</ChatChip>
            <ChatChip>View detailnya dulu</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeApprovalQueueResponse() {
    if (inReview.length === 0) {
      return {
        role: "ai",
        content: <p>None bill that awaiting approval saat ini.</p>,
      };
    }
    const sample = inReview.slice(0, 3);
    return {
      role: "ai",
      content: (
        <>
          <p>{inReview.length} bill total worth <strong>{fmtRpShort(inReviewTotal)}</strong> sedang awaiting approval. Beberapa with the largest:</p>
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
            <ChatChip>Review satu as of satu</ChatChip>
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
            Payables dagang this month <strong>Rp 8,4 M</strong> — down{" "}
            <span style={{ color: "var(--color-success-text)", fontWeight: 600 }}>−12%</span> from last month (Rp 9,5 M). Payment regular to supplier inventory up 18%, sementara biaya jasa down 30%.
          </p>
          <div className="chat-chips">
            <ChatChip primary>As of category</ChatChip>
            <ChatChip>As of vendor</ChatChip>
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
            <ChatChip>Vendor most often late paying</ChatChip>
            <ChatChip>Cashflow keluar this week</ChatChip>
            <ChatChip>Antrian approval</ChatChip>
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
