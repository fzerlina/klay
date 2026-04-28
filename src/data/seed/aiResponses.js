// Canned demo responses for the GL "Klay AI" co-pilot. Cycled by message count
// for generic queries; keyed-match for the suggestion chips.

export const AI_RESPONSES = [
  "Berdasarkan data GL periode Jan–Apr 2025, total debit sebesar Rp 413.357.500 dan kredit Rp 413.357.500 — seimbang sempurna.",
  "Akun dengan aktivitas tertinggi adalah Kas & Bank (1-1100) dengan 7 transaksi senilai total Rp 200.387.500.",
  "Terdapat 1 piutang belum terlunasi (INV005 — Rp 48.400.000) dan 1 utang belum dibayar (BILL005 — Rp 13.750.000).",
  "Beban PPN Masukan (5-2200) mencatat Rp 14.420.000 untuk periode ini. Pastikan dikompensasi dengan PPN Keluaran (2-1200) sebelum pelaporan SPT masa.",
  "Margin operasional bersih terlihat positif di Feb–Mar 2025. Perlu perhatian di April karena hanya ada 1 transaksi tanpa pendapatan yang tercatat.",
];

export const SUGGESTION_RESPONSES = {
  "Apa yang perlu dilakukan hari ini? ↗": `Berdasarkan status GL Jan 2025, ada <strong>3 hal mendesak</strong> yang perlu diselesaikan sebelum closing:<br><br><strong>1. Resolve anomali JE-2025-0001</strong><br>Beban Gaji Rp 45jt — naik 16.9% dari rata-rata 3 bulan (Rp 38,5jt). Perlu konfirmasi apakah wajar.<br><br><strong>2. Dorong approval 3 JE pending</strong><br>JE menunggu persetujuan Finance Manager. Tanpa ini GL tidak bisa dikunci.<br><br><strong>3. Selesaikan rekonsiliasi bank (76% → 100%)</strong><br>12 transaksi belum matched. AI sudah auto-match 38 — sisanya butuh manual review.<br><br>Closing window tinggal <strong>7 hari</strong>. Prioritas hari ini: anomali + approval.`,
  "Bandingkan dengan bulan lalu ↗": `Perbandingan <strong>Jan 2025 vs Des 2024</strong>:<br><br>Running balance naik 28% · Total transaksi +12 entri · Beban operasional naik 19% · Rekonsiliasi turun dari 100% ke 76% · Anomali: 1 baru (Des: 0).<br><br>Kenaikan saldo signifikan didorong pendapatan lebih tinggi, tapi beban operasional juga naik — terutama dari komponen gaji yang perlu dikonfirmasi.`,
};
