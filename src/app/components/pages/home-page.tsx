import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { GlassCard } from "../glass-card";
import { Search, Calendar, MapPin, Users, ArrowRight, Sparkles, Star, TrendingUp, CalendarX, Filter, Loader2 } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { formatDateRange } from "../utils";

const CATEGORIES = ["Semua", "Seminar", "Workshop", "Kompetisi", "Oprec", "Pelatihan"];

export function HomePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Semua");
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      try {
        const url = import.meta.env.VITE_SUPABASE_URL as string;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        // Fetch published and ongoing events
        const res = await fetch(`${url}/rest/v1/events?status=in.(published,ongoing)&select=*,ormawa(name)&order=created_at.desc`, {
          headers: { "apikey": key, "Authorization": `Bearer ${key}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          
          const eventsWithCounts = await Promise.all(data.map(async (e: any) => {
            const countRes = await fetch(`${url}/rest/v1/rpc/get_event_registrations_count`, {
              method: 'POST',
              headers: { "apikey": key, "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
              body: JSON.stringify({ p_event_id: e.id })
            });
            const count = countRes.ok ? await countRes.json() : 0;
            
            let uiStatus = e.status;
            if (e.status === "published") {
              uiStatus = "upcoming";
              if (e.registration_close_date && new Date(e.registration_close_date) < new Date()) {
                uiStatus = "closed";
              }
            }
            
            return {
              id: e.id,
              title: e.title,
              category: e.category,
              date: e.date,
              endDate: e.end_date,
              time: (e.time_start && e.time_end) ? `${e.time_start.slice(0,5)} - ${e.time_end.slice(0,5)} WIB` : "",
              location: e.location,
              quota: e.quota,
              registered: count,
              ormawa: e.ormawa?.name || "Unknown Ormawa",
              cover: e.cover_url,
              status: uiStatus,
              registrationCloseDate: e.registration_close_date
            };
          }));
          
          setEvents(eventsWithCounts);
        }
      } catch (err) {
        console.error("Home events error:", err);
      }
      setLoading(false);
    }
    fetchEvents();
  }, []);

  const filtered = events.filter((e) => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase()) || e.ormawa.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "Semua" || e.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-16 md:py-24">
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-[#ff6900]/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[#ff6900]/5 rounded-full blur-[120px]" />
        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ff6900]/10 border border-[#ff6900]/20 mb-6">
            <Sparkles className="w-4 h-4 text-[#ff6900]" />
            <span className="text-sm text-[#ff6900] font-medium">Platform Event FIK UPNVJ</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4 leading-tight">
            Temukan & Ikuti<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6900] to-[#ff8c3a]">Event Seru</span> di FIK
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
            Jelajahi seminar, workshop, kompetisi, dan kegiatan menarik dari berbagai organisasi mahasiswa FIK UPNVJ.
          </p>

          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari event atau ormawa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#ff6900]/50 focus:ring-2 focus:ring-[#ff6900]/10 transition"
            />
          </div>
        </div>
      </section>

      {/* Category filter */}
      <section className="max-w-7xl mx-auto px-4 mb-8">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                category === cat
                  ? "bg-[#ff6900] text-white shadow-md shadow-[#ff6900]/25"
                  : "bg-muted text-muted-foreground hover:bg-accent border border-border"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Events Grid */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#ff6900]" />
            <p className="text-sm">Memuat event FIK...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((event) => (
            <GlassCard key={event.id} onClick={() => navigate(`/event/${event.id}`)} className="overflow-hidden group">
              <div className="relative h-48 overflow-hidden">
                <ImageWithFallback src={event.cover} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute top-3 left-3 flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md ${
                    event.status === "upcoming" ? "bg-[#ff6900]/80 text-white" :
                    event.status === "closed" ? "bg-red-500/80 text-white" :
                    "bg-emerald-500/80 text-white"
                  }`}>
                    {event.status === "upcoming" ? "Akan Datang" : event.status === "closed" ? "Ditutup" : "Berlangsung"}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white/80 backdrop-blur-md">
                    {event.category}
                  </span>
                </div>
                <div className="absolute bottom-3 left-3">
                  <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-black/40 text-[#ff6900] backdrop-blur-md border border-[#ff6900]/20">
                    {event.ormawa}
                  </span>
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-base font-bold text-foreground mb-2 line-clamp-2 group-hover:text-[#ff6900] transition">{event.title}</h3>
                <div className="space-y-1.5 mb-4">
                  {(event.date || event.time) && (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>{event.date ? formatDateRange(event.date, event.endDate) : ""}{event.date && event.time ? " | " : ""}{event.time}</span>
                    </div>
                  )}
                  {event.location && (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>{event.location}</span>
                    </div>
                  )}
                  {event.registrationCloseDate && (
                    <div className="flex items-center gap-2 text-xs">
                      <CalendarX className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-red-400">Ditutup: {new Date(event.registrationCloseDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{event.registered}/{event.quota}</span>
                    <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#ff6900] to-[#ff8c3a]" style={{ width: `${(event.registered / event.quota) * 100}%` }} />
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#ff6900] group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">Tidak ada event ditemukan</p>
          </div>
        )}
      </section>
    </div>
  );
}