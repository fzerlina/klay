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
  const tokens = name.split(/\s+/).filter((t) => t && !/^(PT|CV|UD|Toko|Koperasi)$/i.test(t));
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
          ))}) menyumbang{" "}
          <strong className="lg-ai-strong">{top3Pct}%</strong> dari{" "}
          <span className="lg-ai-danger">{fmtRpShort(totalOverdue)}</span> utang yang sudah jatuh tempo.
        </>
      ),
      question: "Vendor mana yang paling banyak kita telat bayar?",
    });
  }

  if (upcoming.length > 0) {
    insights.push({
      id: "cashflowOut",
      node: (
        <>
          <strong className="lg-ai-strong">{upcoming.length} bill</strong> senilai{" "}
          <strong className="lg-ai-strong">{fmtRpShort(upcomingTotal)}</strong> akan jatuh tempo dalam{" "}
          <strong className="lg-ai-strong">7 hari</strong> ke depan.
        </>
      ),
      question: "Berapa kas yang harus disiapkan untuk minggu ini?",
    });
  }

  if (inReview.length > 0) {
    insights.push({
      id: "inReview",
      node: (
        <>
          <strong className="lg-ai-strong">{inReview.length} bill</strong> menunggu approval, total{" "}
          <span className="lg-ai-danger">{fmtRpShort(inReviewTotal)}</span>.
        </>
      ),
      question: "Bill apa saja yang menunggu approval?",
    });
  }

  if (overdue.length > 0 && avgDpd > 0) {
    insights.push({
      id: "avgDpd",
      node: (
        <>
          Rata-rata <strong className="lg-ai-strong">{avgDpd} hari telat</strong> untuk{" "}
          <strong className="lg-ai-strong">{overdue.length} bill</strong> yang belum kita bayar.
        </>
      ),
      question: "Berapa rata-rata hari kita telat bayar vendor?",
    });
  }

  if (largest && largest.sisa > 0) {
    insights.push({
      id: "largest",
      node: (
        <>
          Utang terbesar yang telat:{" "}
          <span className="lg-ai-danger">{fmtRpShort(largest.sisa)}</span> ke{" "}
          <strong className="lg-ai-strong">{shortName(largest.vendorName)}</strong>{" "}
          ({Math.max(0, daysSince(largest.due))} hari telat).
        </>
      ),
      question: `Detail bill ${largest.invNo || largest.id} dari ${shortName(largest.vendorName)}`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "empty",
      node: <>Semua utang dagang kita dalam term hari ini — tidak ada yang telat bayar.</>,
      question: "Bagaimana ringkasan AP minggu ini?",
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
    <p>Halo Sarah — saya sudah membaca data utang dagang Anda. Mau saya bantu apa?</p>
  );

  const suggestions = [
    "Vendor mana yang paling banyak kita telat bayar?",
    "Berapa kas yang harus disiapkan untuk minggu ini?",
    "Bill mana yang menunggu approval?",
    "Bandingkan utang dagang bulan ini vs bulan lalu",
  ];

  function makeTopVendorsResponse(send) {
    const totalShare = top.reduce((s, v) => s + v.amount, 0);
    const pct = totalOverdue ? Math.round((totalShare / totalOverdue) * 100) : 0;
    return {
      role: "ai",
      content: (
        <>
          <p>3 vendor yang paling banyak kita telat bayar:</p>
          <div className="ai-mini-table">
            {top.map((v) => {
              const vendor = VENDORS.find((x) => x.id === v.id);
              return (
                <div className="ai-mini-row" key={v.id}>
                  <div className="ai-mini-av">{initials(vendor?.name || v.name)}</div>
                  <div className="ai-mini-body">
                    <div className="ai-mini-name">{vendor?.name || v.name}</div>
                    <div className="ai-mini-meta">
                      rata-rata <span className="ai-mini-meta-strong">{v.avgDpd}d</span> telat · {v.count} bill aktif
                    </div>
                  </div>
                  <div className="ai-mini-amt">{fmtRpShort(v.amount)}</div>
                </div>
              );
            })}
          </div>
          <p>
            Total <strong>{pct}%</strong> dari utang yang telat ada di {top.length} vendor ini. Mau saya susun jadwal pembayaran prioritas?
          </p>
          <div className="chat-chips">
            <ChatChip primary onClick={() => send("Ya, susun jadwal pembayaran prioritas")}>Susun jadwal pembayaran</ChatChip>
            <ChatChip onClick={() => send("Tampilkan riwayat pembayaran")}>Tampilkan riwayat</ChatChip>
            <ChatChip onClick={() => send("Saya negosiasi term dulu")}>Negosiasi term</ChatChip>
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
            Kas keluar 7 hari ke depan: <strong>{fmtRpShort(upcoming7Total)}</strong> untuk{" "}
            <strong>{upcoming7.length} bill</strong> yang sudah approved dan akan jatuh tempo.{" "}
            <span className="danger">3 bill berisiko terlambat</span> jika tidak ada follow-up internal.
          </p>
          <p>Mau saya buatkan reminder approval untuk yang berisiko?</p>
          <div className="chat-chips">
            <ChatChip primary>Buat reminder approval</ChatChip>
            <ChatChip>Lihat detailnya dulu</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeApprovalQueueResponse() {
    if (inReview.length === 0) {
      return {
        role: "ai",
        content: <p>Tidak ada bill yang menunggu approval saat ini.</p>,
      };
    }
    const sample = inReview.slice(0, 3);
    return {
      role: "ai",
      content: (
        <>
          <p>{inReview.length} bill total senilai <strong>{fmtRpShort(inReviewTotal)}</strong> sedang menunggu approval. Beberapa yang paling besar:</p>
          <div className="ai-mini-table">
            {sample.map((b) => (
              <div className="ai-mini-row" key={b.id}>
                <div className="ai-mini-av">{initials(b.vendorName)}</div>
                <div className="ai-mini-body">
                  <div className="ai-mini-name">{b.vendorName}</div>
                  <div className="ai-mini-meta">{b.invNo} · jatuh tempo {b.due}</div>
                </div>
                <div className="ai-mini-amt">{fmtRpShort(b.total)}</div>
              </div>
            ))}
          </div>
          <div className="chat-chips">
            <ChatChip primary>Approve semua</ChatChip>
            <ChatChip>Review satu per satu</ChatChip>
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
            Utang dagang bulan ini <strong>Rp 8,4 M</strong> — turun{" "}
            <span style={{ color: "var(--color-success-text)", fontWeight: 600 }}>−12%</span> dari bulan lalu (Rp 9,5 M). Pembayaran rutin ke supplier inventory naik 18%, sementara biaya jasa turun 30%.
          </p>
          <div className="chat-chips">
            <ChatChip primary>Per kategori</ChatChip>
            <ChatChip>Per vendor</ChatChip>
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
          <p>Saya belum bisa menjawab "{text}" secara spesifik di prototipe ini, tapi saya bisa bantu hal-hal berikut:</p>
          <div className="chat-chips">
            <ChatChip>Vendor paling sering telat bayar</ChatChip>
            <ChatChip>Cashflow keluar minggu ini</ChatChip>
            <ChatChip>Antrian approval</ChatChip>
          </div>
        </>
      ),
    };
  }

  function respond(text, helpers) {
    const t = text.toLowerCase();
    if (t.includes("vendor") || t.includes("telat bayar") || t.includes("paling banyak")) {
      return makeTopVendorsResponse(helpers.send);
    }
    if (t.includes("cashflow") || t.includes("kas keluar") || t.includes("minggu ini") || t.includes("7 hari")) {
      return makeCashflowOutResponse();
    }
    if (t.includes("approval") || t.includes("approve") || t.includes("review")) {
      return makeApprovalQueueResponse();
    }
    if (t.includes("bulan lalu") || t.includes("bandingkan") || t.includes("mom")) {
      return makeMoMResponse();
    }
    return makeDefaultResponse(text);
  }

  return { welcome, suggestions, respond };
}
