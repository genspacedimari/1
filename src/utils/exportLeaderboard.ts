import * as XLSX from 'xlsx';

export interface LeaderboardExportRow {
  name: string;
  community: string;
  correctCount: number;
  wrongCount: number;
  timeUsedSeconds: number;
  score: number;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s}s`;
}

/**
 * Exports a leaderboard (teacher exam OR GSC competition) to an .xlsx file
 * with exactly the columns requested: Nama User, Sekolah/Komunitas, Soal
 * Benar, Soal Salah, Waktu, Nilai. Shared by both contexts so the sheet
 * layout stays identical everywhere it's used.
 */
export function exportLeaderboardExcel(rows: LeaderboardExportRow[], filename: string, sheetName = 'Leaderboard'): void {
  const data = rows.map((r) => ({
    'Nama User': r.name,
    'Sekolah/Komunitas': r.community || '-',
    'Soal Benar': r.correctCount,
    'Soal Salah': r.wrongCount,
    'Waktu': formatTime(r.timeUsedSeconds),
    'Nilai': r.score,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{ wch: 26 }, { wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
