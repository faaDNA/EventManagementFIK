/**
 * @file kegiatan-kami.tsx
 * @description Halaman "Kegiatan Kami" — daftar semua kegiatan milik ormawa yang sedang login.
 *
 * Menampilkan kegiatan aktif (bukan completed) dengan status badge, jumlah pendaftar,
 * dan navigasi ke halaman detail/edit. Draft kegiatan diarahkan ke halaman edit.
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { GlassCard } from "../../glass-card";
import { Users, Plus, ArrowRight, Calendar, MapPin, Loader2, Clock } from "lucide-react";
import { useAuth } from "../../auth-context";
import type { Event } from "../../../../lib/database.types";

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

/**
 * Tentukan label status dan warna badge berdasarkan status event dan tanggal.
 * Mempertimbangkan: ongoing berdasarkan tanggal, pendaftaran ditutup, dan kategori Oprec.
 */
function statusLabel(event: any) {
  let isOngoingDate = false;
  const isOprec = event.category === "Oprec";
  
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

  if (isOngoingDate && event.status !== "completed" && event.status !== "draft" && event.status !== "cancelled" && !isOprec) {
    return { text: "Berlangsung", cls: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
  }

  const isClosed = event.registration_close_date && new Date(new Date().setHours(0,0,0,0)) > new Date(event.registration_close_date);
  if (isClosed && event.status === "published") {
    return { text: "Ditutup", cls: "bg-red-100 dark:bg-red-500/15 text-red-500" };
  }
  
  switch (event.status) {
    case "draft": return { text: "Draft", cls: "bg-muted text-muted-foreground" };
    case "published": return { text: "Dibuka", cls: "bg-[#ff6900]/10 text-[#ff6900]" };
    case "ongoing": return isOprec ? { text: "Dibuka", cls: "bg-[#ff6900]/10 text-[#ff6900]" } : { text: "Berlangsung", cls: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
    case "completed": return { text: "Selesai", cls: "bg-muted text-muted-foreground" };
    case "cancelled": return { text: "Dibatalkan", cls: "bg-red-100 dark:bg-red-500/15 text-red-500" };
    default: return { text: event.status, cls: "bg-muted text-muted-foreground" };
  }
}

interface EventWithCount extends Event {
  registrations_count: number;
}

export function DashboardKegiatanKami() {
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const [events, setEvents] = useState<EventWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.ormawa_id || !session?.access_token) return;

    async function fetchEvents() {
      setLoading(true);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

        // Fetch events via raw fetch (bypass supabase JS client yang hang)
        const res = await fetch(
          `${supabaseUrl}/rest/v1/events?ormawa_id=eq.${profile!.ormawa_id!}&status=neq.completed&order=created_at.desc&select=*`,
          {
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${session!.access_token}`,
            },
            signal: AbortSignal.timeout(15000),
          }
        );

        if (!res.ok) {
          console.error("Error fetching events:", res.status, await res.text());
          setLoading(false);
          return;
        }

        const data = await res.json();
        const mapped: EventWithCount[] = (data || []).map((e: any) => ({
          ...e,
          registrations_count: 0,
        }));

        // Fetch registrant count for each event
        if (mapped.length > 0) {
          const counts = await Promise.all(mapped.map(async (ev) => {
            const cRes = await fetch(`${supabaseUrl}/rest/v1/rpc/get_event_registrations_count`, {
              method: "POST",
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${session!.access_token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ p_event_id: ev.id }),
              signal: AbortSignal.timeout(15000)
            });
            if (cRes.ok) {
              const count = await cRes.json();
              return { id: ev.id, count: typeof count === "number" ? count : 0 };
            }
            return { id: ev.id, count: 0 };
          }));

          counts.forEach(c => {
            const ev = mapped.find(e => e.id === c.id);
            if (ev) ev.registrations_count = c.count;
          });
        }

        setEvents(mapped);
      } catch (err) {
        console.error("Error fetching events:", err);
      }
      setLoading(false);
    }

    fetchEvents();
  }, [profile?.ormawa_id, session?.access_token]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Kegiatan Kami</h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola event organisasi kamu</p>
        </div>
        <button
          onClick={() => navigate("/dashboard/tambah-kegiatan")}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white text-sm font-semibold hover:opacity-90 transition shadow-md shadow-[#ff6900]/20 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Buat Kegiatan
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff6900]" />
          <p className="text-sm">Memuat kegiatan...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-4">Belum ada kegiatan. Buat kegiatan pertamamu!</p>
          <button
            onClick={() => navigate("/dashboard/tambah-kegiatan")}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white text-sm font-semibold hover:opacity-90 transition"
          >
            Buat Kegiatan
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const st = statusLabel(event);
            return (
              <GlassCard
                key={event.id}
                onClick={() => event.status === "draft" ? navigate(`/dashboard/tambah-kegiatan?draft=${event.id}`) : navigate(`/dashboard/kegiatan-kami/${event.id}`)}
                className="p-5 cursor-pointer group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex gap-4 flex-1">
                    {event.cover_url && (
                      <img src={event.cover_url} alt="" className="w-20 h-14 rounded-xl object-cover shrink-0 hidden sm:block" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${st.cls}`}>
                          {st.text}
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
                          {event.category !== "Oprec" && event.date && <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{formatDateRange(event.date, event.end_date)}</div>}
                          {event.category !== "Oprec" && event.location && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{event.location}</div>}
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            {event.registrations_count}{event.quota ? `/${event.quota}` : ""} peserta
                          </div>
                        </div>
                        {event.category !== "Oprec" && event.time_start && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {formatTimeAMPM(event.time_start, event.time_end)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-[#ff6900] group-hover:translate-x-1 transition-all shrink-0" />
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
