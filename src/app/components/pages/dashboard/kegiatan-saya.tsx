import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { GlassCard } from "../../glass-card";
import { useAuth } from "../../auth-context";
import { Calendar, CheckCircle2, Clock, QrCode, ScanLine, FileText, ChevronDown, ChevronUp, MapPin, Users, ArrowRight } from "lucide-react";
import { SimplePagination } from "../../simple-pagination";
import { EventListSkeletonList } from "../../loading-skeleton";
import type { Event } from "../../../../lib/database.types";

interface RegisteredEvent extends Event {
  ormawa?: { name: string } | null;
  registration_status?: string;
  sessions?: any[];
  registrations_count?: number;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
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

export function DashboardKegiatanSaya() {
  const { profile, session } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<RegisteredEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

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

            // attach sessions and counts to mapped
            mapped = await Promise.all(mapped.map(async (evt) => {
              const evtSessions = sessionsData.filter((s: any) => s.event_id === evt.id).map((s: any) => ({
                 ...s,
                 attended: attendedSessionIds.has(s.id)
              }));
              
              const countRes = await fetch(`${supabaseUrl}/rest/v1/rpc/get_event_registrations_count`, {
                method: 'POST',
                headers: { "apikey": supabaseKey, "Authorization": `Bearer ${session!.access_token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ p_event_id: evt.id })
              });
              const count = countRes.ok ? await countRes.json() : 0;
              
              return { ...evt, sessions: evtSessions, registrations_count: count };
            }));
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
        <EventListSkeletonList count={4} />
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
        <>
        <div className="space-y-4">
          {events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((event) => {
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

            const isClosed = event.registration_close_date && new Date(new Date().setHours(0,0,0,0)) > new Date(event.registration_close_date);
            const isOprec = event.category === "Oprec";
            const isActuallyOngoing = isOngoingDate && event.status !== "completed" && event.status !== "draft" && event.status !== "cancelled" && !isOprec;

            let statusLabel: string = event.status || "";
            let statusCls = "bg-muted text-muted-foreground";

            if (isActuallyOngoing) {
              statusLabel = "Berlangsung";
              statusCls = "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
            } else if (isClosed && event.status === "published") {
              statusLabel = "Ditutup";
              statusCls = "bg-red-50 dark:bg-red-500/10 text-red-500";
            } else if (event.status === "published") {
              statusLabel = "Dibuka";
              statusCls = "bg-[#ff6900]/10 text-[#ff6900]";
            } else if (event.status === "ongoing") {
              statusLabel = isOprec ? "Dibuka" : "Berlangsung";
              statusCls = isOprec ? "bg-[#ff6900]/10 text-[#ff6900]" : "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
            } else if (event.status === "completed") {
              statusLabel = "Selesai";
              statusCls = "bg-muted text-muted-foreground";
            }

            return (
              <GlassCard
                key={event.id}
                className="p-5 overflow-hidden group hover:border-[#ff6900]/40 hover:shadow-lg hover:shadow-[#ff6900]/5 transition-all duration-300"
              >
                <div 
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                  onClick={() => navigate(`/dashboard/event/${event.id}?from=kegiatan-saya`)}
                >
                  <div className="flex gap-4 flex-1">
                    {event.cover_url && (
                      <img src={event.cover_url} alt="" className="w-20 h-14 rounded-xl object-cover shrink-0 hidden sm:block" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${statusCls}`}>
                          {statusLabel}
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
                          {event.category !== "Oprec" && event.date && <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{formatDate(event.date)} {event.ormawa?.name ? `| ${event.ormawa.name}` : ""}</div>}
                          {event.category !== "Oprec" && event.location && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{event.location}</div>}
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            {event.registrations_count || 0}{event.quota ? `/${event.quota}` : ""} peserta
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
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Terdaftar</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#ff6900] group-hover:translate-x-1 transition-all hidden sm:block" />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedEventId(expandedEventId === event.id ? null : event.id);
                    }}
                    className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span>Sesi Presensi ({event.sessions?.length || 0})</span>
                    {expandedEventId === event.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {expandedEventId === event.id && (
                    <div className="mt-3">
                      {!event.sessions || event.sessions.length === 0 ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
                          <Clock className="w-3.5 h-3.5" />
                          Tidak ada sesi presensi
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {event.sessions.map((s: any) => (
                             <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border border-border">
                               <div className="flex items-center gap-2">
                                 {s.method === "form" ? <FileText className="w-3.5 h-3.5 text-muted-foreground" /> : <QrCode className="w-3.5 h-3.5 text-muted-foreground" />}
                                 <span className="text-xs font-medium text-foreground">{s.name}</span>
                               </div>
                               {s.attended ? (
                                 <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-200 dark:border-emerald-500/20">
                                   <CheckCircle2 className="w-3 h-3" /> Hadir
                                 </div>
                               ) : s.is_open ? (
                                 <button onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/kegiatan-saya/${event.id}/absen/${s.id}`, { state: { session: s }}); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white text-[11px] font-semibold hover:opacity-90 transition shadow-sm">
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
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
        <SimplePagination currentPage={page} totalPages={Math.ceil(events.length / PAGE_SIZE)} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
