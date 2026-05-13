import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { GlassCard } from "../../glass-card";
import { useAuth } from "../../auth-context";
import { Calendar, MapPin, Users, Search, Filter, X, Clock, ArrowRight } from "lucide-react";
import { SimplePagination } from "../../simple-pagination";
import { EventListSkeletonList } from "../../loading-skeleton";

function formatDateRange(date: string, endDate?: string | null) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  const start = new Date(date).toLocaleDateString("id-ID", opts);
  if (!endDate || endDate === date) return start;
  const end = new Date(endDate).toLocaleDateString("id-ID", opts);
  return `${start} – ${end}`;
}

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

export function DashboardRiwayat() {
  const { profile, session } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [completedEvents, setCompletedEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  useEffect(() => {
    async function fetchHistory() {
      if (!session?.access_token || !profile) return;
      setLoading(true);
      try {
        const url = import.meta.env.VITE_SUPABASE_URL as string;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const headers = { "apikey": key, "Authorization": `Bearer ${session.access_token}` };

        let data: any[] = [];
        if (profile.role === "admin") {
          const res = await fetch(`${url}/rest/v1/events?status=eq.completed&order=created_at.desc&select=*,ormawa:ormawa_id(name)`, { headers });
          if (res.ok) {
            const raw = await res.json();
            data = raw.map((r: any) => ({ ...r, ormawa_name: r.ormawa?.name }));
          }
        } else if (profile.role === "ormawa" && profile.ormawa_id) {
          const res = await fetch(`${url}/rest/v1/events?ormawa_id=eq.${profile.ormawa_id}&status=eq.completed&order=created_at.desc`, { headers });
          if (res.ok) {
            data = await res.json();
          }
        } else {
          const res = await fetch(`${url}/rest/v1/event_registrations?user_id=eq.${session.user.id}&select=*,event:event_id(*,ormawa:ormawa_id(name))`, { headers });
          if (res.ok) {
            const raw = await res.json();
            data = raw.filter((r: any) => r.event && r.event.status === "completed").map((r: any) => ({ ...r.event, ormawa_name: r.event.ormawa?.name }));
          }
        }

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
          setCompletedEvents(mapped);
        } else {
          setCompletedEvents([]);
        }
      } catch (err) {
        console.error("Fetch history error:", err);
      }
      setLoading(false);
    }
    fetchHistory();
  }, [profile, session]);

  const filtered = completedEvents.filter((e) => {
    const ormawaName = e.ormawa_name || (profile as any)?.ormawa_name || "";
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || ormawaName.toLowerCase().includes(search.toLowerCase());
    
    let matchDate = true;
    if (dateFrom || dateTo) {
      // Start of day for From, End of day for To
      const dFrom = dateFrom ? new Date(dateFrom).setHours(0,0,0,0) : -Infinity;
      const dTo = dateTo ? new Date(dateTo).setHours(23,59,59,999) : Infinity;
      
      const evtStart = new Date(e.date).getTime();
      const evtEnd = e.end_date ? new Date(e.end_date).getTime() : evtStart;
      const evtClose = e.registration_close_date ? new Date(e.registration_close_date).getTime() : evtStart;
      
      // An event matches if any of its dates (start, end, or close) fall within the selected range
      const fallsInRange = (time: number) => time >= dFrom && time <= dTo;
      matchDate = fallsInRange(evtStart) || fallsInRange(evtEnd) || fallsInRange(evtClose);
    }
    
    return matchSearch && matchDate;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo]);

  const hasFilters = dateFrom || dateTo;

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-1">Riwayat Kegiatan</h1>
      <p className="text-muted-foreground text-sm mb-6">Kegiatan yang telah selesai</p>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari kegiatan atau ormawa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-input-background border border-border text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#ff6900]/50 focus:ring-2 focus:ring-[#ff6900]/10 transition"
          />
        </div>
        <button
          onClick={() => setShowDateFilter(!showDateFilter)}
          className={`px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2 transition shrink-0 ${
            hasFilters
              ? "bg-[#ff6900]/10 border-[#ff6900]/20 text-[#ff6900]"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Filter className="w-4 h-4" />
          Filter Tanggal
          {hasFilters && (
            <span className="w-2 h-2 rounded-full bg-[#ff6900]" />
          )}
        </button>
      </div>

      {/* Date Filter Panel */}
      {showDateFilter && (
        <GlassCard className="p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Dari Tanggal</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none transition"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Sampai Tanggal</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom || undefined}
                className="w-full px-3 py-2 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none transition"
              />
            </div>
            {hasFilters && (
              <button onClick={clearFilters}
                className="px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition flex items-center gap-1.5 shrink-0">
                <X className="w-3.5 h-3.5" /> Reset
              </button>
            )}
          </div>
        </GlassCard>
      )}

      {loading ? (
        <EventListSkeletonList count={6} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>{completedEvents.length === 0 ? "Belum ada kegiatan yang selesai" : "Tidak ada kegiatan ditemukan"}</p>
        </div>
      ) : (
        <>
        <div className="space-y-4">
          {paginated.map((event) => (
            <GlassCard key={event.id} onClick={() => navigate(profile?.role === "ormawa" ? `/dashboard/kegiatan-kami/${event.id}` : `/dashboard/event/${event.id}`)} className="p-5 cursor-pointer group hover:border-[#ff6900]/40 hover:shadow-lg hover:shadow-[#ff6900]/5 transition-all duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex gap-4 flex-1">
                  {event.cover_url && (
                    <img src={event.cover_url} alt="" className="w-20 h-14 rounded-xl object-cover shrink-0 hidden sm:block" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-muted text-muted-foreground">
                        Selesai
                      </span>
                      {event.category && (
                        <span className="px-2 py-0.5 rounded text-[11px] bg-muted text-muted-foreground">
                          {event.category}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                        (event as any).target_audience === "mahasiswa"
                          ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20"
                          : "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20"
                      }`}>
                        {(event as any).target_audience === "mahasiswa" ? "Mahasiswa" : "Umum & Mahasiswa"}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-foreground group-hover:text-[#ff6900] transition truncate">{event.title}</h3>
                    <div className="flex flex-col gap-1.5 text-xs text-muted-foreground mt-1.5">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        {event.date && <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{formatDateRange(event.date, event.end_date)}</div>}
                        {event.location && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{event.location}</div>}
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          {event.registrations_count}{event.quota ? `/${event.quota}` : ""} peserta
                        </div>
                      </div>
                      {event.time_start && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {formatTimeAMPM(event.time_start, event.time_end)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#ff6900] group-hover:translate-x-1 transition-all" />
                </div>
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
