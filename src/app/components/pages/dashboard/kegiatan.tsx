import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { GlassCard } from "../../glass-card";
import { Search, MapPin, Calendar, Users, ArrowRight, Filter, CalendarX, Loader2 } from "lucide-react";
import { ImageWithFallback } from "../../figma/ImageWithFallback";
import { useAuth } from "../../auth-context";
import type { Event } from "../../../../lib/database.types";

const CATEGORIES = ["Semua", "Seminar", "Workshop", "Kompetisi", "Oprec", "Pelatihan", "Lainnya"];

function formatDateRange(date: string, endDate?: string | null) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  const start = new Date(date).toLocaleDateString("id-ID", opts);
  if (!endDate || endDate === date) return start;
  const end = new Date(endDate).toLocaleDateString("id-ID", opts);
  return `${start} – ${end}`;
}

function formatTime(start?: string | null, end?: string | null) {
  if (!start) return "";
  if (!end) return start;
  return `${start} - ${end}`;
}

interface EventWithOrmawa extends Event {
  ormawa?: { name: string; full_name: string } | null;
  registrations_count?: number;
}

export function DashboardKegiatan() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Semua");
  const navigate = useNavigate();
  const { session } = useAuth();
  const [events, setEvents] = useState<EventWithOrmawa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

        const headers: Record<string, string> = { "apikey": supabaseKey };
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }

        // Fetch published events with ormawa info
        const res = await fetch(
          `${supabaseUrl}/rest/v1/events?status=eq.published&order=created_at.desc&select=*,ormawa:ormawa_id(name,full_name)`,
          { headers, signal: AbortSignal.timeout(15000) }
        );

        if (res.ok) {
          let data = await res.json();
          data = data || [];
          
          if (data.length > 0) {
            const counts = await Promise.all(data.map(async (ev: any) => {
              const cRes = await fetch(`${supabaseUrl}/rest/v1/rpc/get_event_registrations_count`, {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify({ p_event_id: ev.id }),
                signal: AbortSignal.timeout(15000)
              });
              if (cRes.ok) {
                const count = await cRes.json();
                return { id: ev.id, count };
              }
              return { id: ev.id, count: 0 };
            }));

            counts.forEach((c: any) => {
              const ev = data.find((e: any) => e.id === c.id);
              if (ev) ev.registrations_count = c.count;
            });
          }

          setEvents(data);
        } else {
          console.error("Fetch events error:", res.status);
        }
      } catch (err) {
        console.error("Fetch events error:", err);
      }
      setLoading(false);
    }
    fetchEvents();
  }, [session?.access_token]);

  const filtered = events.filter((e) => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.ormawa?.name || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "Semua" || e.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Kegiatan</h1>
        <p className="text-muted-foreground text-sm mt-1">Temukan event dan kegiatan yang sedang berlangsung</p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari event atau ormawa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-input-background border border-border text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#ff6900]/50 focus:ring-2 focus:ring-[#ff6900]/10 transition"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                category === cat
                  ? "bg-[#ff6900] text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-accent border border-border"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff6900]" />
          <p className="text-sm">Memuat kegiatan...</p>
        </div>
      ) : (
        <>
          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((event) => (
              <GlassCard key={event.id} onClick={() => navigate(`/dashboard/event/${event.id}`)} className="overflow-hidden group">
                <div className="relative h-44 overflow-hidden">
                  {event.cover_url ? (
                    <ImageWithFallback src={event.cover_url} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#ff6900]/20 to-[#ff8c3a]/10 flex items-center justify-center">
                      <Calendar className="w-12 h-12 text-[#ff6900]/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold backdrop-blur-md text-white ${
                      (event.registration_close_date && new Date(new Date().setHours(0,0,0,0)) > new Date(event.registration_close_date)) ? "bg-red-500/80" : "bg-[#ff6900]/80"
                    }`}>
                      {(event.registration_close_date && new Date(new Date().setHours(0,0,0,0)) > new Date(event.registration_close_date)) ? "Ditutup" :
                       event.status === "published" ? "Dibuka" : event.status === "ongoing" ? "Berlangsung" : event.status}
                    </span>
                    {event.category && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/15 text-white/90 backdrop-blur-md">{event.category}</span>
                    )}
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-black/40 text-[#ff6900] backdrop-blur-md border border-[#ff6900]/20">
                      {event.ormawa?.name || "Ormawa"}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-bold text-foreground mb-2 line-clamp-2 group-hover:text-[#ff6900] transition">{event.title}</h3>
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDateRange(event.date, event.end_date)}{formatTime(event.time_start, event.time_end) ? ` | ${formatTime(event.time_start, event.time_end)}` : ""}</span>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-2 text-muted-foreground text-xs">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{event.location}</span>
                      </div>
                    )}
                    {event.registration_close_date && (
                      <div className="flex items-center gap-2 text-xs">
                        <CalendarX className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-red-400">Ditutup: {new Date(event.registration_close_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {event.quota ? `${event.registrations_count || 0}/${event.quota}` : `${event.registrations_count || 0} pendaftar`}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#ff6900] group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <p>Tidak ada event ditemukan</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}