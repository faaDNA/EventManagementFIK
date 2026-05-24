import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { GlassCard } from "../../glass-card";
import { Search, MapPin, Calendar, Users, ArrowRight, Filter, CalendarX } from "lucide-react";
import { EventCardSkeletonGrid } from "../../loading-skeleton";
import { ImageWithFallback } from "../../figma/ImageWithFallback";
import { useAuth } from "../../auth-context";
import { SimplePagination } from "../../simple-pagination";
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

interface EventWithOrmawa extends Event {
  ormawa?: { name: string; full_name: string } | null;
  registrations_count?: number;
}

export function DashboardKegiatan() {
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["Semua"]);
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const [events, setEvents] = useState<EventWithOrmawa[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

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
          `${supabaseUrl}/rest/v1/events?status=in.(published,ongoing)&order=created_at.desc&select=*,ormawa:ormawa_id(name,full_name)`,
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
    const matchCat = selectedCategories.includes("Semua") || (e.category && selectedCategories.includes(e.category));
    // Hide completed events from active list
    if (e.status === "completed") return false;
    // Filter by target audience based on user role
    const ta = (e as any).target_audience || "semua";
    if (profile?.role === "umum" && ta === "mahasiswa") return false;
    return matchSearch && matchCat;
  }).sort((a, b) => {
    // Closed/full events go to the bottom
    const today = new Date(new Date().setHours(0,0,0,0));
    const aIsClosed = (a.registration_close_date && today > new Date(a.registration_close_date)) || (a.quota !== null && (a.registrations_count || 0) >= a.quota);
    const bIsClosed = (b.registration_close_date && today > new Date(b.registration_close_date)) || (b.quota !== null && (b.registrations_count || 0) >= b.quota);
    if (aIsClosed && !bIsClosed) return 1;
    if (!aIsClosed && bIsClosed) return -1;
    return 0;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filter changes
  const filterKey = search + selectedCategories.join(",");
  useEffect(() => { setPage(1); }, [filterKey]);

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
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategories.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => {
                  if (cat === "Semua") {
                    setSelectedCategories(["Semua"]);
                  } else {
                    let next = selectedCategories.filter(c => c !== "Semua");
                    if (next.includes(cat)) {
                      next = next.filter(c => c !== cat);
                      if (next.length === 0) next = ["Semua"];
                    } else {
                      next.push(cat);
                    }
                    setSelectedCategories(next);
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                  isSelected
                    ? "bg-[#ff6900] text-white shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-accent border border-border"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <EventCardSkeletonGrid count={6} />
      ) : (
        <>
          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {paginated.map((event) => (
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
                    {(() => {
                      let isOngoingDate = false;
                      if (event.date) {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const start = new Date(event.date);
                        start.setHours(0, 0, 0, 0);
                        const end = event.end_date ? new Date(event.end_date) : new Date(start);
                        end.setHours(0, 0, 0, 0);
                        if (today >= start && today <= end) {
                          isOngoingDate = true;
                        }
                      }
                      const isActuallyOngoing = isOngoingDate && event.status !== "completed" && event.status !== "draft" && event.status !== "cancelled";

                      const isClosed = (event.registration_close_date && new Date(new Date().setHours(0,0,0,0)) > new Date(event.registration_close_date)) || (event.quota !== null && (event.registrations_count || 0) >= event.quota);
                      
                      let text = event.status;
                      let bg = "bg-black/50";
                      
                      const isOprec = event.category === "Oprec";
                      
                      if (isActuallyOngoing && !isOprec) {
                        text = "Berlangsung";
                        bg = "bg-emerald-500/80";
                      } else if (isClosed && event.status === "published") {
                        text = "Ditutup";
                        bg = "bg-red-500/80";
                      } else if (event.status === "published") {
                        text = "Dibuka";
                        bg = "bg-[#ff6900]/80";
                      } else if (event.status === "ongoing" && !isOprec) {
                        text = "Berlangsung";
                        bg = "bg-emerald-500/80";
                      } else if (event.status === "completed") {
                        text = "Selesai";
                        bg = "bg-zinc-500/80";
                      }
                      
                      return (
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold backdrop-blur-md text-white ${bg}`}>
                          {text}
                        </span>
                      );
                    })()}
                    {event.category && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/95 text-zinc-900 shadow-sm">{event.category}</span>
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
                    {event.category !== "Oprec" && (
                      <>
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
                      </>
                    )}
                    {event.registration_close_date && (
                      <div className="flex items-center gap-2 text-xs">
                        <CalendarX className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-red-400">Ditutup: {new Date(event.registration_close_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                          (event as any).target_audience === "mahasiswa"
                            ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20"
                            : "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20"
                        }`}>
                          {(event as any).target_audience === "mahasiswa" ? "Mahasiswa" : "Umum & Mahasiswa"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {event.quota != null ? `Kuota: ${event.registrations_count || 0}/${event.quota}` : `Tidak Terbatas · ${event.registrations_count || 0} pendaftar`}
                        </span>
                      </div>
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
          <SimplePagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}