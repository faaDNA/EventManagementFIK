import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { GlassCard } from "../../glass-card";
import { useAuth } from "../../auth-context";
import { ImageWithFallback } from "../../figma/ImageWithFallback";
import { Calendar, CheckCircle2, Clock, ChevronRight, Loader2, QrCode, ScanLine, FileText } from "lucide-react";
import type { Event } from "../../../../lib/database.types";

interface RegisteredEvent extends Event {
  ormawa?: { name: string } | null;
  registration_status?: string;
  sessions?: any[];
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function DashboardKegiatanSaya() {
  const { profile, session } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<RegisteredEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token || !session?.user?.id) return;

    async function fetchMyEvents() {
      setLoading(true);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

        // Fetch registrations with event data joined
        const res = await fetch(
          `${supabaseUrl}/rest/v1/event_registrations?user_id=eq.${session!.user.id}&select=status,event:event_id(*,ormawa:ormawa_id(name))`,
          {
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${session!.access_token}`,
            },
            signal: AbortSignal.timeout(15000),
          }
        );

        if (res.ok) {
          const data = await res.json();
          let mapped: RegisteredEvent[] = (data || [])
            .filter((r: any) => r.event && r.event.status !== "completed")
            .map((r: any) => ({
              ...r.event,
              registration_status: r.status,
              sessions: []
            }));

          if (mapped.length > 0) {
            const eventIds = mapped.map(e => e.id);
            const evtIdList = `(${eventIds.join(",")})`;

            // fetch sessions
            const sessRes = await fetch(`${supabaseUrl}/rest/v1/attendance_sessions?event_id=in.${evtIdList}&order=order_index.asc`, {
              headers: { "apikey": supabaseKey, "Authorization": `Bearer ${session!.access_token}` },
              signal: AbortSignal.timeout(15000)
            });
            const sessionsData = sessRes.ok ? await sessRes.json() : [];

            // fetch my attendance records
            const recRes = await fetch(`${supabaseUrl}/rest/v1/attendance_records?user_id=eq.${session!.user.id}`, {
               headers: { "apikey": supabaseKey, "Authorization": `Bearer ${session!.access_token}` },
               signal: AbortSignal.timeout(15000)
            });
            const recsData = recRes.ok ? await recRes.json() : [];
            const attendedSessionIds = new Set(recsData.map((r: any) => r.session_id));

            // attach sessions to mapped
            mapped = mapped.map(evt => {
              const evtSessions = sessionsData.filter((s: any) => s.event_id === evt.id).map((s: any) => ({
                 ...s,
                 attended: attendedSessionIds.has(s.id)
              }));
              return { ...evt, sessions: evtSessions };
            });
          }

          setEvents(mapped);
        } else {
          console.error("Fetch my events error:", res.status, await res.text());
        }
      } catch (err) {
        console.error("Fetch my events error:", err);
      }
      setLoading(false);
    }

    fetchMyEvents();
  }, [session?.access_token, session?.user?.id]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-1">Kegiatan Saya</h1>
      <p className="text-muted-foreground text-sm mb-6">Event yang telah kamu daftarkan</p>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff6900]" />
          <p className="text-sm">Memuat kegiatan...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-muted-foreground" />
          </div>
          <p>Belum ada kegiatan yang didaftarkan</p>
          <button
            onClick={() => navigate("/dashboard/kegiatan")}
            className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white text-sm font-semibold hover:opacity-90 transition"
          >
            Cari Kegiatan
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const isClosed = event.registration_close_date && new Date(new Date().setHours(0,0,0,0)) > new Date(event.registration_close_date);
            const statusLabel = isClosed ? "Ditutup" : event.status === "published" ? "Dibuka" : event.status === "ongoing" ? "Berlangsung" : event.status === "completed" ? "Selesai" : event.status;
            const statusCls = isClosed ? "bg-red-50 dark:bg-red-500/10 text-red-500" : event.status === "published" ? "bg-[#ff6900]/10 text-[#ff6900]" : event.status === "ongoing" ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground";

            return (
              <GlassCard
                key={event.id}
                className="p-0 overflow-hidden cursor-pointer group hover:border-[#ff6900]/40 hover:shadow-lg hover:shadow-[#ff6900]/5 transition-all duration-300"
                onClick={() => navigate(`/dashboard/event/${event.id}?from=kegiatan-saya`)}
              >
                <div className="flex flex-col md:flex-row">
                  <div className="w-full md:w-48 h-32 md:h-auto shrink-0 relative overflow-hidden">
                    {event.cover_url ? (
                      <ImageWithFallback
                        src={event.cover_url}
                        alt={event.title}
                        className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#ff6900]/20 to-[#ff8c3a]/10 flex items-center justify-center">
                        <Calendar className="w-10 h-10 text-[#ff6900]/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>

                  <div className="flex-1 p-4 relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#ff6900]/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    <div className="relative">
                      <div className="flex items-start justify-between mb-2 gap-3">
                        <div>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold mb-1.5 ${statusCls}`}>
                            {statusLabel}
                          </span>
                          <h3 className="text-sm font-bold text-foreground group-hover:text-[#ff6900] transition-colors duration-200">{event.title}</h3>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{formatDate(event.date)} {event.ormawa?.name ? `| ${event.ormawa.name}` : ""}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Terdaftar</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-[#ff6900] group-hover:translate-x-0.5 transition-all duration-200" />
                        </div>
                      </div>

                      {!event.sessions || event.sessions.length === 0 ? (
                        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          Tidak ada sesi presensi
                        </div>
                      ) : (
                        <div className="mt-3 flex flex-col gap-2">
                          {event.sessions.map((s: any) => (
                             <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
                               <div className="flex items-center gap-2">
                                 {s.method === "form" ? <FileText className="w-3.5 h-3.5 text-muted-foreground" /> : <QrCode className="w-3.5 h-3.5 text-muted-foreground" />}
                                 <span className="text-xs font-medium text-foreground">{s.name}</span>
                               </div>
                               {s.attended ? (
                                 <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-200 dark:border-emerald-500/20">
                                   <CheckCircle2 className="w-3 h-3" /> Hadir
                                 </div>
                               ) : s.is_open ? (
                                 <button onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/kegiatan-saya/${event.id}/absen/${s.id}`, { state: { session: s }}); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white text-[11px] font-semibold hover:opacity-90 transition">
                                   {s.method === "form" ? <><FileText className="w-3.5 h-3.5" /> Isi Form</> : <><ScanLine className="w-3.5 h-3.5" /> Scan Presensi</>}
                                 </button>
                               ) : (
                                 <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-md border border-border">Ditutup</span>
                               )}
                             </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
