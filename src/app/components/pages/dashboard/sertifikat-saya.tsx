/**
 * @file sertifikat-saya.tsx
 * @description Halaman "Sertifikat Saya" di dashboard — menampilkan sertifikat kegiatan yang pernah diikuti.
 *
 * Fitur:
 * - Fetch kegiatan dari event_registrations yang memiliki certificate_url.
 * - Pencarian berdasarkan judul.
 * - Tombol langsung untuk unduh sertifikat (buka link di tab baru).
 * - Paginasi dengan SimplePagination.
 */
import { useState, useEffect } from "react";
import { GlassCard } from "../../glass-card";
import { useAuth } from "../../auth-context";
import { Search, Calendar, MapPin, Users, Clock, Award, Download } from "lucide-react";
import { SimplePagination } from "../../simple-pagination";
import { EventListSkeletonList } from "../../loading-skeleton";

/** Format rentang tanggal ke Bahasa Indonesia. */
function formatDateRange(date: string, endDate?: string | null) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  const start = new Date(date).toLocaleDateString("id-ID", opts);
  if (!endDate || endDate === date) return start;
  const end = new Date(endDate).toLocaleDateString("id-ID", opts);
  return `${start} – ${end}`;
}

/** Format waktu dari HH:MM ke format 12-jam (AM/PM). */
function formatTimeAMPM(start?: string | null, end?: string | null) {
  const format = (t: string) => {
    const [h, m] = t.split(":");
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12; 
    return `${hour.toString().padStart(2, '0')}:${m} ${ampm}`;
  };
  if (!start) return "";
  const s = format(start);
  if (!end) return s;
  return `${s} - ${format(end)}`;
}

export function DashboardSertifikatSaya() {
  const { profile, session } = useAuth();
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  useEffect(() => {
    async function fetchCertificates() {
      if (!session?.access_token || !session?.user?.id) return;
      setLoading(true);
      try {
        const url = import.meta.env.VITE_SUPABASE_URL as string;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const headers = { "apikey": key, "Authorization": `Bearer ${session.access_token}` };

        // Fetch my registrations where the event has a certificate
        const res = await fetch(`${url}/rest/v1/event_registrations?user_id=eq.${session.user.id}&select=*,event:event_id(*,ormawa:ormawa_id(name))`, { headers });
        if (res.ok) {
          const raw = await res.json();
          // Filter out events that don't have a certificate_url
          let data = raw
            .filter((r: any) => r.event && r.event.certificate_url !== null && r.event.certificate_url !== "")
            .map((r: any) => ({ ...r.event, ormawa_name: r.event.ormawa?.name }));
            
          // Get registrations count for these events (optional, for UI consistency)
          if (data.length > 0) {
            const mapped = await Promise.all(data.map(async (ev: any) => {
              const cRes = await fetch(`${url}/rest/v1/rpc/get_event_registrations_count`, {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify({ p_event_id: ev.id }),
              });
              const count = cRes.ok ? await cRes.json() : 0;
              return { ...ev, registrations_count: typeof count === "number" ? count : 0 };
            }));
            setEvents(mapped);
          } else {
            setEvents([]);
          }
        }
      } catch (err) {
        console.error("Fetch certificates error:", err);
      }
      setLoading(false);
    }
    fetchCertificates();
  }, [session]);

  const filtered = events.filter((e) => {
    const ormawaName = e.ormawa_name || "";
    return !search || e.title.toLowerCase().includes(search.toLowerCase()) || ormawaName.toLowerCase().includes(search.toLowerCase());
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Award className="w-8 h-8 text-[#ff6900]" />
        <h1 className="text-2xl font-bold text-foreground">Sertifikat Saya</h1>
      </div>
      <p className="text-muted-foreground text-sm mb-6">Kumpulan sertifikat dari kegiatan yang telah Anda ikuti.</p>

      {/* Search */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Cari kegiatan atau ormawa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-input-background border border-border text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#ff6900]/50 focus:ring-2 focus:ring-[#ff6900]/10 transition"
        />
      </div>

      {loading ? (
        <EventListSkeletonList count={4} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Award className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p>{events.length === 0 ? "Belum ada sertifikat yang tersedia untuk Anda." : "Sertifikat tidak ditemukan."}</p>
        </div>
      ) : (
        <>
        <div className="space-y-4">
          {paginated.map((event) => (
            <GlassCard key={event.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-[#ff6900]/40 transition-all duration-300">
              <div className="flex gap-4 flex-1">
                {event.cover_url && (
                  <img src={event.cover_url} alt="" className="w-20 h-14 rounded-xl object-cover shrink-0 hidden sm:block" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
                      Sertifikat Tersedia
                    </span>
                    {event.ormawa_name && (
                      <span className="px-2 py-0.5 rounded text-[11px] bg-muted text-muted-foreground">
                        {event.ormawa_name}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-foreground truncate">{event.title}</h3>
                  <div className="flex flex-col gap-1.5 text-xs text-muted-foreground mt-1.5">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      {event.date && <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{formatDateRange(event.date, event.end_date)}</div>}
                      {event.location && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{event.location}</div>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
                <button 
                  onClick={() => window.open(event.certificate_url as string, '_blank')} 
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ff6900] text-white text-sm font-semibold hover:bg-[#e65f00] transition shadow-sm"
                >
                  <Download className="w-4 h-4" /> Unduh
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
        <SimplePagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
