/**
 * @file utils.ts
 * @description Berisi fungsi-fungsi utilitas untuk memformat data di seluruh aplikasi.
 */

/**
 * Memformat rentang tanggal untuk ditampilkan di UI.
 * Jika start dan end berada di bulan dan tahun yang sama, akan digabung (contoh: "1 - 3 Jan 2026").
 * Jika end kosong atau sama dengan start, hanya menampilkan start (contoh: "1 Jan 2026").
 */
export function formatDateRange(start: string, end?: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const startDate = new Date(start);
  const startStr = startDate.toLocaleDateString("id-ID", opts);
  if (!end || end === start || end === "") return startStr;
  const endDate = new Date(end);
  // Same month & year
  if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
    return `${startDate.getDate()} - ${endDate.toLocaleDateString("id-ID", opts)}`;
  }
  return `${startStr} - ${endDate.toLocaleDateString("id-ID", opts)}`;
}
