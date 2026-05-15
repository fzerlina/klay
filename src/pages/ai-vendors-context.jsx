import { BILLS } from "../data/seed/bills";
import { CAT_LABELS } from "../data/labels";
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

// AP balance per vendor (sum of unpaid bill `sisa`)
function computeApBalance() {
  const m = {};
  for (const b of BILLS) {
    if (b.pay === "paid") continue;
    m[b.vendor] = (m[b.vendor] || 0) + b.sisa;
  }
  return m;
}

// ── Insights ──────────────────────────────────────────────────────────────

export function computeVendorsInsights(vendors) {
  const apBalance = computeApBalance();
  const apVendors = vendors.filter((v) => (apBalance[v.id] || 0) > 0);
  const totalAp = Object.values(apBalance).reduce((s, n) => s + n, 0);

  // Top vendors by AP balance
  const top3 = apVendors
    .map((v) => ({ id: v.id, name: v.name, amount: apBalance[v.id] || 0 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);
  const top3Sum = top3.reduce((s, c) => s + c.amount, 0);
  const top3Pct = totalAp ? Math.round((top3Sum / totalAp) * 100) : 0;

  // Stale vendors (last transaction > 60 days, still active)
  const stale = vendors.filter((v) => v.status === "active" && daysSince(v.lastTx) > 60);

  // Category concentration of AP
  const byCat = {};
  for (const v of apVendors) {
    byCat[v.category] = (byCat[v.category] || 0) + (apBalance[v.id] || 0);
  }
  const sortedCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const topCat = sortedCats[0];
  const topCatPct = totalAp && topCat ? Math.round((topCat[1] / totalAp) * 100) : 0;

  // Inactive vendors still holding AP balance
  const inactiveWithAp = vendors.filter((v) => v.status === "inactive" && (apBalance[v.id] || 0) > 0);

  // Single largest AP vendor
  const largest = top3[0];

  const insights = [];

  if (top3.length > 0 && totalAp > 0) {
    insights.push({
      id: "topApVendors",
      node: (
        <>
          <strong className="lg-ai-strong">{top3.length} vendor</strong>{" "}
          ({top3.map((v, i) => (
            <span key={v.id}>{i > 0 ? ", " : ""}{shortName(v.name)}</span>
          ))}) menahan{" "}
          <strong className="lg-ai-strong">{top3Pct}%</strong> dari{" "}
          <span className="lg-ai-danger">{fmtRpShort(totalAp)}</span> total utang dagang.
        </>
      ),
      question: "Vendor mana yang paling banyak utang kita?",
    });
  }

  if (stale.length > 0) {
    insights.push({
      id: "stale",
      node: (
        <>
          <strong className="lg-ai-strong">{stale.length} vendor</strong> aktif tidak punya transaksi lebih dari{" "}
          <strong className="lg-ai-strong">60 hari</strong> — kandidat untuk di-arsipkan atau di-review.
        </>
      ),
      question: "Vendor mana yang sudah lama tidak transaksi?",
    });
  }

  if (topCat && topCatPct > 0) {
    insights.push({
      id: "categoryConcentration",
      node: (
        <>
          <strong className="lg-ai-strong">{topCatPct}%</strong> utang dagang ada di kategori{" "}
          <strong className="lg-ai-strong">{CAT_LABELS[topCat[0]] || topCat[0]}</strong> ({fmtRpShort(topCat[1])}).
        </>
      ),
      question: "Breakdown vendor per kategori bagaimana?",
    });
  }

  if (inactiveWithAp.length > 0) {
    const sum = inactiveWithAp.reduce((s, v) => s + (apBalance[v.id] || 0), 0);
    insights.push({
      id: "inactiveAp",
      node: (
        <>
          <strong className="lg-ai-strong">{inactiveWithAp.length} vendor non-aktif</strong> masih memiliki saldo utang{" "}
          <span className="lg-ai-danger">{fmtRpShort(sum)}</span> — perlu di-review.
        </>
      ),
      question: "Vendor non-aktif mana yang masih punya saldo?",
    });
  }

  if (largest) {
    insights.push({
      id: "largestVendor",
      node: (
        <>
          Saldo terbesar: <strong className="lg-ai-strong">{shortName(largest.name)}</strong> dengan{" "}
          <span className="lg-ai-danger">{fmtRpShort(largest.amount)}</span> outstanding AP.
        </>
      ),
      question: `Detail tagihan ke ${shortName(largest.name)}`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "empty",
      node: <>Tidak ada saldo utang dagang yang aktif — master vendor bersih.</>,
      question: "Ringkasan vendor secara umum",
    });
  }

  return insights;
}

// ── AI chat context ──────────────────────────────────────────────────────

export function makeVendorsAiContext(vendors) {
  const apBalance = computeApBalance();
  const apVendors = vendors.filter((v) => (apBalance[v.id] || 0) > 0);
  const totalAp = Object.values(apBalance).reduce((s, n) => s + n, 0);

  const top = apVendors
    .map((v) => ({ id: v.id, name: v.name, amount: apBalance[v.id] || 0, category: v.category, lastTx: v.lastTx }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const stale = vendors.filter((v) => v.status === "active" && daysSince(v.lastTx) > 60);
  const inactiveWithAp = vendors.filter((v) => v.status === "inactive" && (apBalance[v.id] || 0) > 0);

  const byCat = {};
  for (const v of apVendors) {
    byCat[v.category] = (byCat[v.category] || 0) + (apBalance[v.id] || 0);
  }
  const sortedCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  const welcome = (
    <p>Halo Sarah — saya sudah membaca master vendor Anda. Mau saya bantu apa?</p>
  );

  const suggestions = [
    "Vendor mana yang paling banyak utang kita?",
    "Vendor mana yang sudah lama tidak transaksi?",
    "Breakdown vendor per kategori bagaimana?",
    "Vendor non-aktif mana yang masih punya saldo?",
  ];

  function makeTopApVendorsResponse(send) {
    const sum = top.reduce((s, v) => s + v.amount, 0);
    const pct = totalAp ? Math.round((sum / totalAp) * 100) : 0;
    return {
      role: "ai",
      content: (
        <>
          <p>3 vendor dengan utang dagang terbesar:</p>
          <div className="ai-mini-table">
            {top.map((v) => (
              <div className="ai-mini-row" key={v.id}>
                <div className="ai-mini-av">{initials(v.name)}</div>
                <div className="ai-mini-body">
                  <div className="ai-mini-name">{v.name}</div>
                  <div className="ai-mini-meta">{CAT_LABELS[v.category] || v.category} · terakhir transaksi {v.lastTx}</div>
                </div>
                <div className="ai-mini-amt">{fmtRpShort(v.amount)}</div>
              </div>
            ))}
          </div>
          <p>Bersama mereka <strong>{pct}%</strong> dari total utang dagang. Mau saya susun jadwal pembayaran?</p>
          <div className="chat-chips">
            <ChatChip primary onClick={() => send("Ya, susun jadwal pembayaran prioritas")}>Susun jadwal pembayaran</ChatChip>
            <ChatChip onClick={() => send("Lihat detail bill per vendor")}>Lihat detail</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeStaleResponse() {
    if (stale.length === 0) {
      return { role: "ai", content: <p>Tidak ada vendor yang dorman saat ini.</p> };
    }
    const sample = stale.slice(0, 5);
    return {
      role: "ai",
      content: (
        <>
          <p>
            <strong>{stale.length} vendor</strong> aktif tapi tidak ada transaksi lebih dari 60 hari. Sample:
          </p>
          <div className="ai-mini-table">
            {sample.map((v) => (
              <div className="ai-mini-row" key={v.id}>
                <div className="ai-mini-av">{initials(v.name)}</div>
                <div className="ai-mini-body">
                  <div className="ai-mini-name">{v.name}</div>
                  <div className="ai-mini-meta">terakhir transaksi {v.lastTx} · {daysSince(v.lastTx)} hari lalu</div>
                </div>
              </div>
            ))}
          </div>
          <div className="chat-chips">
            <ChatChip primary>Arsipkan semua</ChatChip>
            <ChatChip>Review satu-satu</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeCategoryResponse() {
    if (sortedCats.length === 0) {
      return { role: "ai", content: <p>Belum ada saldo utang aktif untuk dipecah per kategori.</p> };
    }
    return {
      role: "ai",
      content: (
        <>
          <p>Breakdown utang dagang per kategori:</p>
          <div className="ai-mini-table">
            {sortedCats.map(([cat, amount]) => {
              const pct = totalAp ? Math.round((amount / totalAp) * 100) : 0;
              return (
                <div className="ai-mini-row" key={cat}>
                  <div className="ai-mini-av" style={{ background: "var(--color-brand)" }}>{(CAT_LABELS[cat] || cat).slice(0, 2).toUpperCase()}</div>
                  <div className="ai-mini-body">
                    <div className="ai-mini-name">{CAT_LABELS[cat] || cat}</div>
                    <div className="ai-mini-meta">{pct}% dari total utang dagang</div>
                  </div>
                  <div className="ai-mini-amt">{fmtRpShort(amount)}</div>
                </div>
              );
            })}
          </div>
        </>
      ),
    };
  }

  function makeInactiveResponse() {
    if (inactiveWithAp.length === 0) {
      return { role: "ai", content: <p>Tidak ada vendor non-aktif yang masih memiliki saldo.</p> };
    }
    const sum = inactiveWithAp.reduce((s, v) => s + (apBalance[v.id] || 0), 0);
    return {
      role: "ai",
      content: (
        <>
          <p>
            <strong>{inactiveWithAp.length} vendor non-aktif</strong> masih punya saldo utang total{" "}
            <span className="danger">{fmtRpShort(sum)}</span>.
          </p>
          <div className="ai-mini-table">
            {inactiveWithAp.slice(0, 5).map((v) => (
              <div className="ai-mini-row" key={v.id}>
                <div className="ai-mini-av">{initials(v.name)}</div>
                <div className="ai-mini-body">
                  <div className="ai-mini-name">{v.name}</div>
                  <div className="ai-mini-meta">non-aktif sejak {v.lastTx || "—"}</div>
                </div>
                <div className="ai-mini-amt">{fmtRpShort(apBalance[v.id] || 0)}</div>
              </div>
            ))}
          </div>
          <div className="chat-chips">
            <ChatChip primary>Aktifkan kembali</ChatChip>
            <ChatChip>Lunasi sekarang</ChatChip>
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
          <p>Saya belum bisa menjawab "{text}" di prototipe ini, tapi saya bisa bantu hal-hal berikut:</p>
          <div className="chat-chips">
            <ChatChip>Top vendor utang</ChatChip>
            <ChatChip>Vendor dorman</ChatChip>
            <ChatChip>Breakdown per kategori</ChatChip>
          </div>
        </>
      ),
    };
  }

  function respond(text, helpers) {
    const t = text.toLowerCase();
    if (t.includes("paling banyak") || t.includes("utang kita") || t.includes("top vendor")) {
      return makeTopApVendorsResponse(helpers.send);
    }
    if (t.includes("lama tidak") || t.includes("dorman") || t.includes("stale")) {
      return makeStaleResponse();
    }
    if (t.includes("kategori") || t.includes("breakdown")) {
      return makeCategoryResponse();
    }
    if (t.includes("non-aktif") || t.includes("inaktif")) {
      return makeInactiveResponse();
    }
    return makeDefaultResponse(text);
  }

  return { welcome, suggestions, respond };
}
