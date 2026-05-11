import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { GlassCard } from "../../glass-card";
import { useAuth } from "../../auth-context";
import { ImageWithFallback } from "../../figma/ImageWithFallback";
import { Calendar, MapPin, Users, CheckCircle2, Search, Filter, X, Loader2 } from "lucide-react";

function formatDateRange(date: string, endDate?: string | null) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  const start = new Date(date).toLocaleDateString("id-ID", opts);
  if (!endDate || endDate === date) return start;
  const end = new Date(endDate).toLocaleDateString("id-ID", opts);
  return `${start} – ${end}`;
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
    const ormawaName = e.ormawa_name || profile?.ormawa_name || "";
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
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff6900]" />
          <p className="text-sm">Memuat riwayat kegiatan...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>{completedEvents.length === 0 ? "Belum ada kegiatan yang selesai" : "Tidak ada kegiatan ditemukan"}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((event) => (
            <GlassCard key={event.id} onClick={() => navigate(profile?.role === "ormawa" ? `/dashboard/kegiatan-kami/${event.id}` : `/dashboard/event/${event.id}`)} className="p-0 overflow-hidden cursor-pointer group hover:border-[#ff6900]/40 hover:shadow-lg hover:shadow-[#ff6900]/5 transition-all duration-300">
              <div className="flex flex-col md:flex-row">
                <div className="w-full md:w-44 h-28 md:h-auto shrink-0 relative overflow-hidden">
                  <ImageWithFallback src={event.cover_url} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold mb-1.5 bg-muted text-muted-foreground">
                        Selesai
                      </span>
                      <h3 className="text-sm font-bold text-foreground group-hover:text-[#ff6900] transition-colors duration-200">{event.title}</h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1.5">
                        <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{formatDateRange(event.date, event.end_date)}</div>
                        {event.location && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{event.location}</div>}
                        <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{event.registrations_count}{event.quota ? `/${event.quota}` : ""} peserta</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground font-medium">Selesai</span>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
