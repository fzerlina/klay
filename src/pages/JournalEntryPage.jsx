import { useState, useMemo } from "react";
import { generateJournalEntries } from "../data/klayData";
import { formatRupiah } from "../lib/format";

const PAGE_SIZE_DEFAULT = 20;

function StatusBadge({ status }) {
  const cls = { Posted: "posted", Draft: "draft", Void: "void", Pending: "pending" }[status] || "draft";
  return <span className={`je-status ${cls}`}>{status}</span>;
}

function SortIcon({ active, dir }) {
  if (!active) return <span style={{ opacity: 0.3, marginLeft: 3, fontSize: 9 }}>↕</span>;
  return <span style={{ marginLeft: 3, fontSize: 9 }}>{dir === "asc" ? "↑" : "↓"}</span>;
}

function rowCls(status) {
  return { Draft: "row-draft", Pending: "row-pending", Void: "row-void" }[status] || "";
}

function sumDebit(rows) {
  return rows.reduce((s, r) => s + Number(r.debit.replace(/,/g, "")), 0);
}

const CHECKLIST = [
  { icon: "ci-bad", title: "Draft belum di-post", sub: "Beberapa jurnal draft menunggu posting", cta: "Buka draft →", ctaCls: "cl-cta-bad", filter: "Draft" },
  { icon: "ci-bad", title: "Pending belum diputuskan", sub: "Menunggu persetujuan atasan", cta: "Buka pending →", ctaCls: "cl-cta-bad", filter: "Pending" },
  { icon: "ci-warn", title: "Perlu review manual", sub: "Beberapa entri AI draft aktif", cta: "Tinjau →", ctaCls: "cl-cta-warn", filter: "Draft" },
  { icon: "ci-ok", title: "GL seimbang", sub: "Total debit = kredit Apr 2025", cta: "Trial balance →", ctaCls: "cl-cta-ok", filter: null },
];

const AI_LOG = [
  { dot: "var(--success-text)", text: "Klasifikasi otomatis — 21 entri baru diklasifikasi, model v2.1, akurasi 96%", time: "08:14" },
  { dot: "var(--success-text)", text: "Auto-tag dimensi — 18 baris jurnal di-tag otomatis (Dept + Lokasi), 2 di-override manual", time: "08:15" },
  { dot: "var(--success-text)", text: "Draft dibuat otomatis — akrual gaji Rp 45jt (91%), penyusutan Rp 8.5jt (88%)", time: "09:00" },
  { dot: "var(--warning-text)", text: "Anomali terdeteksi — satu entri memiliki pasangan akun tidak wajar, perlu review", time: "11:22" },
  { dot: "var(--success-text)", text: "Running balance diperbarui setelah 7 entri baru di-post oleh Sarah Wijaya", time: "15:43" },
];

export default function JournalEntryPage() {
  const allRows = useMemo(() => generateJournalEntries(320), []);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [expanded, setExpanded] = useState(false);

  // counts for tiles
  const counts = useMemo(() => {
    const c = { Posted: 0, Draft: 0, Pending: 0, Void: 0 };
    allRows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [allRows]);

  // filter + search
  const filtered = useMemo(() => {
    let r = allRows;
    if (statusFilter) r = r.filter((x) => x.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((x) => x.reference.toLowerCase().includes(q) || x.memo.toLowerCase().includes(q));
    }
    return r;
  }, [allRows, statusFilter, search]);

  // sort
  const sorted = useMemo(() => {
    const s = [...filtered];
    s.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (sortKey === "debit" || sortKey === "credit") {
        va = Number(a.debit.replace(/,/g, ""));
        vb = Number(b.debit.replace(/,/g, ""));
      }
      if (sortKey === "lines") { va = a.lines; vb = b.lines; }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return s;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  const debitTotal = useMemo(() => sumDebit(filtered), [filtered]);

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  }

  function toggleRow(ref) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(ref) ? next.delete(ref) : next.add(ref);
      return next;
    });
  }

  function toggleAll(checked) {
    setSelected(checked ? new Set(pageRows.map((r) => r.reference)) : new Set());
  }

  function setFilter(v) { setStatusFilter(v); setPage(1); setSelected(new Set()); }

  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.reference));

  return (
    <div className="je-view">

      {/* ── COMMAND CENTER BAND ─────────────────────────────────── */}
      <div className="cc-band">
        {/* Top row */}
        <div className="cc-top">
          <div>
            <div className="cc-page-title">Journal Entry</div>
            <div className="cc-page-sub">PT Sejahtera Makmur · Apr 2025 · {allRows.length} entries</div>
          </div>
          <div className="cc-spacer" />
          <div className="cc-actions">
            <button className="btn-klayai">
              <span className="ai-btn-dot" />
              Klay AI
              <span className="ai-btn-badge">4</span>
            </button>
            <button className="btn-cc-export">
              <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
            <button className="btn btn-primary" style={{ borderRadius: "var(--radius-sm)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: "#fff", fill: "none", strokeWidth: 2.5 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Buat Jurnal Baru
            </button>
          </div>
        </div>

        {/* Summary tiles */}
        <div className="cc-tiles">
          <div className="cc-tile" onClick={() => setFilter("Draft")}>
            <div className="ct-count ctc-r">{counts.Draft}</div>
            <div className="ct-title">Draft</div>
            <div className="ct-desc">Belum di-post ke GL</div>
            <div className="ct-cta ctcta-r">Lihat draft →</div>
          </div>
          <div className="cc-tile" onClick={() => setFilter("Pending")}>
            <div className="ct-count ctc-a">{counts.Pending}</div>
            <div className="ct-title">Pending approval</div>
            <div className="ct-desc">Menunggu keputusan</div>
            <div className="ct-cta ctcta-a">Lihat pending →</div>
          </div>
          <div className="cc-tile" onClick={() => setFilter("Posted")}>
            <div className="ct-count ctc-b">{counts.Posted}</div>
            <div className="ct-title">Posted</div>
            <div className="ct-desc">Sudah di-post ke GL</div>
            <div className="ct-cta ctcta-b">Lihat posted →</div>
          </div>
          <div className="cc-tile" onClick={() => setFilter("Void")}>
            <div className="ct-count ctc-n">{counts.Void}</div>
            <div className="ct-title">Void</div>
            <div className="ct-desc">Dibatalkan</div>
          </div>
        </div>

        {/* Expand toggle */}
        <div className="cc-expand" onClick={() => setExpanded((e) => !e)}>
          <span className="cc-exp-lbl">
            {expanded ? "Sembunyikan checklist & AI log" : "Lihat checklist & AI log"}
          </span>
          <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, stroke: "var(--color-text-tertiary)", fill: "none", strokeWidth: 2, transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>

        {/* Expandable checklist + AI log */}
        {expanded && (
          <div className="cc-exp-inner">
            <div>
              <div className="exp-col-label">To-do · Apr 2025</div>
              {CHECKLIST.map((item, i) => (
                <div key={i} className="cl-item">
                  <div className={`cl-icon ${item.icon}`}>{item.icon === "ci-ok" ? "✓" : item.icon === "ci-warn" ? "!" : "✕"}</div>
                  <div className="cl-body">
                    <div className="cl-title">{item.title}</div>
                    <div className="cl-sub">{item.sub}</div>
                  </div>
                  {item.cta && (
                    <button className={`cl-cta ${item.ctaCls}`} onClick={() => item.filter && setFilter(item.filter)}>
                      {item.cta}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div>
              <div className="exp-col-label">Yang dilakukan AI hari ini</div>
              {AI_LOG.map((item, i) => (
                <div key={i} className="al-item">
                  <div className="al-dot" style={{ background: item.dot }} />
                  <div className="al-text">{item.text}</div>
                  <div className="al-time">{item.time}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── SCROLL AREA ──────────────────────────────────────────── */}
      <div className="je-scroll">

        {/* Filter bar */}
        <div className="filter-bar" style={{ marginBottom: 10 }}>
          <div className="f-search">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Cari no. jurnal, memo…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="fsep" />
          <div className="chip-grp">
            {[["", "Semua"], ["Pending", "Pending"], ["Draft", "Draft"], ["Posted", "Posted"], ["Void", "Void"]].map(([v, label]) => (
              <div key={v} className={`chip${statusFilter === v ? " on" : ""}`} onClick={() => setFilter(v)}>
                {label}
                {v && counts[v] ? <span style={{ marginLeft: 4, opacity: .7 }}>{counts[v]}</span> : null}
              </div>
            ))}
          </div>
          <div className="fsep" />
          <div className="chip-grp">
            <div className="chip">Bulan ini</div>
            <div className="chip">Q1 2025</div>
          </div>
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="bulk-bar" style={{ marginBottom: 10 }}>
            <span className="bulk-count">{selected.size} dipilih</span>
            <button className="bulk-btn">Post semua</button>
            <button className="bulk-btn">Kirim approval</button>
            <button className="bulk-btn">Export dipilih</button>
            <button className="bulk-close" onClick={() => setSelected(new Set())}>
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        {/* Table */}
        <div className="je-table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36, padding: "9px 0 9px 14px" }}>
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                    style={{ width: 13, height: 13, cursor: "pointer", accentColor: "var(--color-action)" }}
                  />
                </th>
                <th style={{ width: 100 }} className="sortable" onClick={() => handleSort("date")}>
                  Tanggal <SortIcon active={sortKey === "date"} dir={sortDir} />
                </th>
                <th style={{ width: 130 }} className="sortable" onClick={() => handleSort("reference")}>
                  Referensi <SortIcon active={sortKey === "reference"} dir={sortDir} />
                </th>
                <th>Keterangan</th>
                <th style={{ width: 50 }} className="r sortable" onClick={() => handleSort("lines")}>
                  Baris <SortIcon active={sortKey === "lines"} dir={sortDir} />
                </th>
                <th style={{ width: 140 }} className="r sortable" onClick={() => handleSort("debit")}>
                  Debit (Rp) <SortIcon active={sortKey === "debit"} dir={sortDir} />
                </th>
                <th style={{ width: 140 }} className="r">Kredit (Rp)</th>
                <th style={{ width: 100 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "40px 14px", color: "var(--color-text-tertiary)", fontSize: 13 }}>
                    Tidak ada data untuk filter ini
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr
                    key={row.reference}
                    className={rowCls(row.status)}
                    onClick={() => toggleRow(row.reference)}
                    style={selected.has(row.reference) ? { background: "var(--ai-surface)" } : undefined}
                  >
                    <td style={{ paddingLeft: 14, paddingRight: 6 }}>
                      <input
                        type="checkbox"
                        checked={selected.has(row.reference)}
                        onChange={() => {}}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: 13, height: 13, cursor: "pointer", accentColor: "var(--color-action)" }}
                      />
                    </td>
                    <td className="td-date">{row.date}</td>
                    <td className="td-ref">{row.reference}</td>
                    <td className="td-memo">{row.memo}</td>
                    <td className="td-lines">{row.lines}</td>
                    <td className="td-num">{row.debit}</td>
                    <td className="td-num">{row.credit}</td>
                    <td><StatusBadge status={row.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DARK STATUS BAR ──────────────────────────────────────── */}
      <div className="je-bar">
        <div className="je-bar-stat">
          <span className="je-bar-lbl">Total</span>
          <span className="je-bar-val">{allRows.length}</span>
        </div>
        <div className="je-bar-sep" />
        <div className="je-bar-stat">
          <span className="je-bar-lbl">Tampil</span>
          <span className="je-bar-val">{filtered.length}</span>
        </div>
        <div className="je-bar-sep" />
        <div className="je-bar-stat">
          <span className="je-bar-lbl">Debit</span>
          <span className="je-bar-val debit">{formatRupiah(debitTotal)}</span>
        </div>
        <div className="je-bar-sep" />
        <div className="je-bar-stat">
          <span className="je-bar-lbl">Kredit</span>
          <span className="je-bar-val credit">{formatRupiah(debitTotal)}</span>
        </div>
        <div className="je-bar-right">
          <div className="je-bar-stat" style={{ gap: 5 }}>
            <span className="je-bar-lbl">Per hal.</span>
            <select
              className="je-pg-sel"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="je-bar-sep" />
          <div className="je-bar-stat" style={{ gap: 4 }}>
            <button className="je-pg-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            <span className="je-bar-val" style={{ minWidth: 36, textAlign: "center" }}>{page}/{totalPages}</span>
            <button className="je-pg-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
          </div>
        </div>
      </div>

    </div>
  );
}
