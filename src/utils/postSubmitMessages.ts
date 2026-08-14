const MESSAGES = [
  'Udah gas maksimal, sisanya biar semesta yang atur. ✨',
  'Selesai! Waktunya rebahan, kamu pantas dapetin itu.',
  'Effort udah keluar semua, hasil mah belakangan.',
  'Gaskeun terus, progress kecil tetap progress.',
  'Kadang usaha terbaik kita aja belum tentu cukup — dan gapapa.',
  'Semoga hari ini worth it ya, walau capek.',
  'Kamu udah nyoba, itu yang penting. Sisanya nanti dilihat bareng-bareng.',
  'Selesai satu babak, lanjut lagi besok. Santai dulu.',
  'Overthinking soal hasil? Mending ngemil dulu deh.',
  'Kerja keras gak pernah bohong, tunggu aja waktunya.',
  'Kalau capek, istirahat. Bukan berhenti.',
  'Selesai mengerjakan = udah menang lawan rasa males tadi.',
  'Gapapa kalau deg-degan, itu artinya kamu peduli.',
  'Satu langkah kecil hari ini, satu cerita buat nanti.',
  'Real talk: kamu keren udah sampai sini.',
];

/** One random post-submit line, different every render so it doesn't feel scripted. */
export function getRandomPostSubmitMessage(): string {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}
