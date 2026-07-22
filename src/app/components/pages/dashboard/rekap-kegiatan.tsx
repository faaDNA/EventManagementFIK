import { useState, useEffect } from "react";
import { GlassCard } from "../../glass-card";
import { useAuth } from "../../auth-context";
import { supabase } from "../../../../lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addPengesahanBlock, addFooterTimestamp } from "../../../../lib/pdf-utils";
import { Calendar, Download, Filter, FileText, CheckCircle2, FileDown, Copy, Check } from "lucide-react";
import type { Event } from "../../../../lib/database.types";

type FilterMode = "semester" | "relatif" | "custom";

interface EventWithStats extends Event {
  registrantCount: number;
}

export function DashboardRekapKegiatan() {
  const { profile } = useAuth();
  
  // States
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<EventWithStats[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EventWithStats[]>([]);
  
  // Filter States
  const [filterMode, setFilterMode] = useState<FilterMode>("semester");
  
  // Mode 1: Semester
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<"ganjil" | "genap">("ganjil");
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  
  // Mode 2: Relatif
  const [relativeMonths, setRelativeMonths] = useState<number>(1);
  
  // Mode 3: Custom
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // 1. Initial Fetch (All non-Oprec events for this ormawa)
  useEffect(() => {
    async function fetchAllEvents() {
      if (!profile?.ormawa_id) return;
      setLoading(true);
      
      try {
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .eq("ormawa_id", profile.ormawa_id)
          .neq("category", "Oprec")
          .order("date", { ascending: false });
          
        if (error) throw error;
        
        const eventsData = data as Event[] | null;
        
        // Build available years for semester filter
        const years = new Set<string>();
        const currentYear = new Date().getFullYear();
        
        if (eventsData && eventsData.length > 0) {
          const eventsWithStats: EventWithStats[] = [];
          
          for (const ev of eventsData) {
            // Determine academic year based on date
            if (ev.date) {
              const d = new Date(ev.date);
              const y = d.getFullYear();
              const m = d.getMonth() + 1; // 1-12
              
              // If month is Aug-Dec, it belongs to y/(y+1). If Jan-Jul, it belongs to (y-1)/y
              if (m >= 8) years.add(`${y}/${y+1}`);
              else years.add(`${y-1}/${y}`);
            }
            
            // Fetch registrant count
            const { data: countData } = await (supabase.rpc as any)("get_event_registrations_count", {
              p_event_id: ev.id
            });
            
            eventsWithStats.push({
              ...ev,
              registrantCount: typeof countData === "number" ? countData : 0
            });
          }
          
          setEvents(eventsWithStats);
          
          const yearsArray = Array.from(years).sort((a, b) => b.localeCompare(a));
          setAvailableYears(yearsArray);
          
          if (yearsArray.length > 0 && !selectedYear) {
            setSelectedYear(yearsArray[0]);
          } else if (!selectedYear) {
            setSelectedYear(`${currentYear}/${currentYear+1}`);
          }
        }
      } catch (err) {
        console.error("Error fetching events:", err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchAllEvents();
  }, [profile?.ormawa_id]);

  // 2. Apply Filters
  useEffect(() => {
    let result = [...events];
    
    if (filterMode === "semester" && selectedYear) {
      // Split year e.g. "2025/2026"
      const parts = selectedYear.split("/");
      if (parts.length === 2) {
        const y1 = parseInt(parts[0]);
        const y2 = parseInt(parts[1]);
        
        // Ganjil: 1 Agustus Y1 - 31 Januari Y2
        // Genap: 1 Februari Y2 - 31 Juli Y2
        let startDate: Date, endDate: Date;
        
        if (selectedSemester === "ganjil") {
          startDate = new Date(y1, 7, 1); // Aug 1
          endDate = new Date(y2, 0, 31, 23, 59, 59); // Jan 31
        } else {
          startDate = new Date(y2, 1, 1); // Feb 1
          endDate = new Date(y2, 6, 31, 23, 59, 59); // Jul 31
        }
        
        result = result.filter(ev => {
          if (!ev.date) return false;
          const d = new Date(ev.date);
          return d >= startDate && d <= endDate;
        });
      }
    } 
    else if (filterMode === "relatif") {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - relativeMonths);
      
      result = result.filter(ev => {
        if (!ev.date) return false;
        return new Date(ev.date) >= cutoff;
      });
    }
    else if (filterMode === "custom") {
      if (customStartDate) {
        const start = new Date(customStartDate);
        result = result.filter(ev => ev.date && new Date(ev.date) >= start);
      }
      if (customEndDate) {
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59);
        result = result.filter(ev => ev.date && new Date(ev.date) <= end);
      }
    }
    
    setFilteredEvents(result);
  }, [events, filterMode, selectedYear, selectedSemester, relativeMonths, customStartDate, customEndDate]);

  // Derived Stats
  const totalKegiatan = filteredEvents.length;
  const totalPendaftar = filteredEvents.reduce((acc, ev) => acc + ev.registrantCount, 0);
  const avgPendaftar = totalKegiatan > 0 ? Math.round(totalPendaftar / totalKegiatan) : 0;
  const kegiatanBersertifikat = filteredEvents.filter(ev => ev.certificate_url).length;
  
  const getPeriodText = () => {
    if (filterMode === "semester") return `Semester ${selectedSemester === "ganjil" ? "Ganjil" : "Genap"} ${selectedYear}`;
    if (filterMode === "relatif") return `${relativeMonths} Bulan Terakhir`;
    
    if (customStartDate && customEndDate) return `${customStartDate} s.d. ${customEndDate}`;
    if (customStartDate) return `Sejak ${customStartDate}`;
    if (customEndDate) return `Hingga ${customEndDate}`;
    return "Semua Waktu";
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(link);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleExportPDF = async () => {
    if (filteredEvents.length === 0) {
      alert("Tidak ada data untuk diekspor pada periode ini.");
      return;
    }
    
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      
      let ormawaName = "";
      if (profile?.ormawa_id) {
        const { data } = await supabase.from("ormawa").select("name").eq("id", profile.ormawa_id).single();
        if (data) ormawaName = (data as any).name;
      }
      
      // Judul
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("REKAP KEGIATAN", pageWidth / 2, 20, { align: "center" });
      doc.text((ormawaName || "ORMAWA").toUpperCase(), pageWidth / 2, 27, { align: "center" });
      
      // Subjudul (Periode)
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Periode: ${getPeriodText()}`, pageWidth / 2, 35, { align: "center" });
      
      // Tabel
      const tableHeaders = ["No", "Judul Kegiatan", "Kategori", "Tanggal", "Lokasi", "Status", "Jml Pendaftar", "Sertifikat"];
      
      const tableBody = filteredEvents.map((ev, i) => {
        let certText = "-";
        if (ev.certificate_url) {
           // Shorten URL for display
           try {
             const urlObj = new URL(ev.certificate_url);
             let shortUrl = urlObj.hostname + urlObj.pathname;
             if (shortUrl.length > 35) shortUrl = shortUrl.substring(0, 32) + "...";
             certText = shortUrl;
           } catch {
             certText = ev.certificate_url.substring(0, 35) + "...";
           }
        }
        
        return [
          String(i + 1),
          ev.title || "-",
          ev.category || "-",
          ev.date ? new Date(ev.date).toLocaleDateString("id-ID") : "-",
          ev.location || "-",
          ev.status === "completed" ? "Selesai" : ev.status === "cancelled" ? "Dibatalkan" : "Berjalan",
          String(ev.registrantCount),
          certText
        ];
      });

      autoTable(doc, {
        startY: 42,
        head: [tableHeaders],
        body: tableBody,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 2, font: "helvetica" },
        headStyles: { fillColor: [255, 105, 0], textColor: 255, fontStyle: "bold", halign: "center" },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 55 },
          2: { cellWidth: 25 },
          3: { cellWidth: 30 },
          4: { cellWidth: 40 },
          5: { cellWidth: 25, halign: "center" },
          6: { cellWidth: 30, halign: "center" },
          7: { cellWidth: 55 },
        },
        didDrawCell: (data) => {
          // Make certificate URLs clickable
          if (data.section === 'body' && data.column.index === 7) {
             const rowIndex = data.row.index;
             const rawUrl = filteredEvents[rowIndex].certificate_url;
             if (rawUrl) {
               // draw link overlay
               doc.setTextColor(0, 0, 255);
               // data.cell.raw contains the original text passed to tableBody
               const textToDraw = String(data.cell.raw);
               doc.textWithLink(textToDraw, data.cell.x + 2, data.cell.y + 5, { url: rawUrl });
               // revert color
               doc.setTextColor(0, 0, 0);
             }
          }
        },
        willDrawCell: (data) => {
           // Hide text drawing for certificate column if there's a link (we draw it manually in didDrawCell)
           if (data.section === 'body' && data.column.index === 7 && filteredEvents[data.row.index].certificate_url) {
              data.cell.text = []; 
           }
        }
      });
      
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      
      // Ringkasan
      doc.setFont("helvetica", "bold");
      doc.text("Ringkasan:", 14, finalY);
      doc.setFont("helvetica", "normal");
      doc.text(`- Total Kegiatan: ${totalKegiatan} kegiatan`, 14, finalY + 6);
      doc.text(`- Total Seluruh Pendaftar: ${totalPendaftar} orang`, 14, finalY + 12);
      doc.text(`- Rata-rata Pendaftar: ${avgPendaftar} orang/kegiatan`, 14, finalY + 18);
      doc.text(`- Kegiatan Bersertifikat: ${kegiatanBersertifikat} dari ${totalKegiatan} kegiatan`, 14, finalY + 24);

      // Footer & Pengesahan
      addPengesahanBlock(doc, ormawaName, true); // true for landscape
      addFooterTimestamp(doc, true);
      
      doc.save(`Rekap Kegiatan - ${ormawaName}.pdf`);
      
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Terjadi kesalahan saat membuat PDF.");
    }
  };

  const inputClass = "w-full px-3 py-2 rounded-xl bg-input-background border border-[#ff6900]/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6900]/10 transition [color-scheme:light] dark:[color-scheme:dark]";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Rekap Kegiatan</h1>
        <p className="text-sm text-muted-foreground mt-1">Kelola dan ekspor laporan rekapitulasi seluruh kegiatan pelaksanaan ormawa.</p>
      </div>

      {/* Filter Section */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-[#ff6900]" />
          <h2 className="text-sm font-bold text-foreground">Filter Rentang Waktu</h2>
        </div>
        
        {/* Tabs */}
        <div className="flex bg-muted/50 p-1 rounded-xl w-fit mb-5">
          <button 
            onClick={() => setFilterMode("semester")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${filterMode === "semester" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Semester Akademik
          </button>
          <button 
            onClick={() => setFilterMode("relatif")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${filterMode === "relatif" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Waktu Relatif
          </button>
          <button 
            onClick={() => setFilterMode("custom")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${filterMode === "custom" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Custom Tanggal
          </button>
        </div>

        {/* Filter Inputs */}
        <div className="flex flex-wrap items-center gap-4">
          {filterMode === "semester" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tahun Ajaran</label>
                <select 
                  className={inputClass}
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                >
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                  {availableYears.length === 0 && <option value="">Tidak ada data</option>}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Semester</label>
                <div className="flex bg-muted/50 p-1 rounded-xl">
                  <button 
                    onClick={() => setSelectedSemester("ganjil")}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition ${selectedSemester === "ganjil" ? "bg-[#ff6900] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Ganjil
                  </button>
                  <button 
                    onClick={() => setSelectedSemester("genap")}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition ${selectedSemester === "genap" ? "bg-[#ff6900] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Genap
                  </button>
                </div>
              </div>
            </>
          )}

          {filterMode === "relatif" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Rentang Waktu</label>
              <select 
                className={inputClass}
                value={relativeMonths}
                onChange={e => setRelativeMonths(Number(e.target.value))}
              >
                <option value={1}>1 Bulan Terakhir</option>
                <option value={3}>3 Bulan Terakhir</option>
                <option value={6}>6 Bulan Terakhir</option>
                <option value={12}>1 Tahun Terakhir</option>
              </select>
            </div>
          )}

          {filterMode === "custom" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Mulai Tanggal</label>
                <input 
                  type="date" 
                  className={inputClass}
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Sampai Tanggal</label>
                <input 
                  type="date" 
                  className={inputClass}
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      </GlassCard>

      {/* Stats Summary Card */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4 flex flex-col items-center text-center justify-center space-y-1">
           <FileText className="w-6 h-6 text-[#ff6900] mb-1" />
           <p className="text-2xl font-bold text-foreground">{totalKegiatan}</p>
           <p className="text-xs text-muted-foreground font-medium">Total Kegiatan</p>
        </GlassCard>
        <GlassCard className="p-4 flex flex-col items-center text-center justify-center space-y-1">
           <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-1" />
           <p className="text-2xl font-bold text-foreground">{kegiatanBersertifikat}</p>
           <p className="text-xs text-muted-foreground font-medium">Memiliki Sertifikat</p>
        </GlassCard>
        <GlassCard className="p-4 flex flex-col items-center text-center justify-center space-y-1">
           <Calendar className="w-6 h-6 text-blue-500 mb-1" />
           <p className="text-2xl font-bold text-foreground">{totalPendaftar}</p>
           <p className="text-xs text-muted-foreground font-medium">Total Pendaftar</p>
        </GlassCard>
        <GlassCard className="p-4 flex flex-col items-center text-center justify-center space-y-1">
           <Download className="w-6 h-6 text-purple-500 mb-1" />
           <p className="text-2xl font-bold text-foreground">{avgPendaftar}</p>
           <p className="text-xs text-muted-foreground font-medium">Rata-rata Pendaftar</p>
        </GlassCard>
      </div>

      {/* Table & Export Section */}
      <GlassCard className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-bold text-foreground">Preview Rekap</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Menampilkan hasil sesuai rentang waktu yang dipilih</p>
          </div>
          
          <button 
            onClick={handleExportPDF}
            disabled={filteredEvents.length === 0}
            className="px-4 py-2 rounded-xl bg-[#ff6900] text-white text-sm font-bold hover:bg-[#e65c00] transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#ff6900]/20"
          >
            <FileDown className="w-4 h-4" /> Export PDF
          </button>
        </div>

        {loading ? (
           <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
             <div className="w-8 h-8 border-4 border-[#ff6900]/20 border-t-[#ff6900] rounded-full animate-spin mb-4" />
             <p className="text-sm">Memuat data kegiatan...</p>
           </div>
        ) : filteredEvents.length === 0 ? (
           <div className="py-16 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-xl bg-muted/20">
             <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
               <FileText className="w-8 h-8 text-muted-foreground/50" />
             </div>
             <p className="text-sm font-bold text-foreground">Tidak ada kegiatan</p>
             <p className="text-xs text-muted-foreground mt-1 max-w-sm">
               Belum ada kegiatan pada periode {getPeriodText()}. Silakan ubah filter rentang waktu.
             </p>
           </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-muted/50 border-b border-border text-xs uppercase font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-center">No</th>
                  <th className="px-4 py-3">Kegiatan</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3 text-center">Pendaftar</th>
                  <th className="px-4 py-3">Sertifikat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEvents.map((ev, i) => (
                  <tr key={ev.id} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3 text-center text-muted-foreground font-medium">{i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{ev.title || "-"}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{ev.status === "completed" ? "Selesai" : ev.status === "cancelled" ? "Dibatalkan" : "Berjalan"}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{ev.category || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{ev.date ? new Date(ev.date).toLocaleDateString("id-ID") : "-"}</td>
                    <td className="px-4 py-3 text-center font-semibold text-foreground">{ev.registrantCount}</td>
                    <td className="px-4 py-3">
                      {ev.certificate_url ? (
                        <div className="flex items-center gap-2">
                           <a href={ev.certificate_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-xs truncate max-w-[200px] block">
                             {new URL(ev.certificate_url).hostname + new URL(ev.certificate_url).pathname}
                           </a>
                           <button 
                             onClick={() => handleCopyLink(ev.certificate_url!)}
                             className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition flex-shrink-0"
                             title="Salin Link"
                           >
                             {copiedLink === ev.certificate_url ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                           </button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

    </div>
  );
}
