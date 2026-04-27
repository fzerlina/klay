import { generateJournalEntries } from "../data/klayData";

export default function JournalEntryPage() {
  const rows = generateJournalEntries(320);

  return (
    <section>
      <div className="cc-band">
        <div className="cc-top">
          <div>
            <div className="cc-page-title">Journal Entry</div>
            <div className="cc-page-sub">
              PT Sejahtera Makmur · Apr 2025 · {rows.length} entries
            </div>
          </div>
          <div className="cc-spacer" />
          <div className="cc-actions">
            <button className="btn">Export</button>
            <button className="btn btn-primary">Buat Jurnal Baru</button>
          </div>
        </div>
      </div>

      <div className="table-wrap mt-16">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Referensi</th>
              <th>Keterangan</th>
              <th>Baris</th>
              <th>Debit (Rp)</th>
              <th>Kredit (Rp)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.reference}>
                <td>{row.date}</td>
                <td className="mono">{row.reference}</td>
                <td>{row.memo}</td>
                <td>{row.lines}</td>
                <td>{row.debit}</td>
                <td>{row.credit}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
