import jsPDF from "jspdf";

/**
 * Menambahkan blok pengesahan di bagian bawah PDF.
 * @param doc Instance jsPDF yang sedang aktif
 * @param ormawaName Nama ormawa (misal: "Himpunan Mahasiswa Informatika")
 * @param userName Nama pengurus yang mencetak (misal: "John Doe")
 * @param isLandscape Apakah orientasi PDF landscape? (mempengaruhi posisi X)
 */
export function addPengesahanBlock(doc: jsPDF, ormawaName: string, isLandscape: boolean = false) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Posisi Y awal blok pengesahan (kira-kira di bawah tabel)
  // Untuk memastikan cukup ruang, kita ambil nilai Y terakhir jika ada
  let startY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : pageHeight - 60;
  
  // Jika sisa halaman tidak cukup untuk blok pengesahan (~40mm), buat halaman baru
  if (startY > pageHeight - 40) {
    doc.addPage();
    startY = 20;
  }

  // Posisi X untuk rata kanan
  const rightMargin = 20;
  const blockWidth = 60;
  const rightCenterX = pageWidth - rightMargin - (blockWidth / 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  // Tanggal cetak dengan format Bahasa Indonesia
  const today = new Date();
  const dateStr = today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  
  doc.text(`Jakarta, ${dateStr}`, rightCenterX, startY, { align: "center" });
  doc.text("Mengetahui,", rightCenterX, startY + 6, { align: "center" });
  
  const ketuaText = `Ketua ${ormawaName || "Ormawa"}`;
  // Split long ormawa names if needed, though usually they fit
  doc.text(ketuaText, rightCenterX, startY + 12, { align: "center" });

  // Garis tanda tangan
  doc.text("______________________", rightCenterX, startY + 35, { align: "center" });
}

/**
 * Menambahkan footer timestamp di setiap halaman PDF
 */
export function addFooterTimestamp(doc: jsPDF, isLandscape: boolean = false) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  const today = new Date();
  const dateStr = today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const timeStr = today.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Dicetak pada: ${dateStr}, ${timeStr} WIB melalui OrmawaEvent FIK`, 
      14, 
      pageHeight - 10
    );
  }
  
  // Kembalikan color ke default black
  doc.setTextColor(0, 0, 0);
}
