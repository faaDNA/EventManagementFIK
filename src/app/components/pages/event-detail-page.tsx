import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { GlassCard } from "../glass-card";
import { useAuth } from "../auth-context";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { Calendar, MapPin, Users, ArrowLeft, CheckCircle2, Clock, Tag, CalendarX, Loader2, Sparkles, FileText, QrCode, ChevronDown, ChevronUp } from "lucide-react";
import { formatDateRange } from "../utils";

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

const DESC_MAX = 300;
function ExpandableText({ text }: { text: string | null }) {
  const [expanded, setExpanded] = React.useState(false);
  const desc = text || "Belum ada deskripsi.";
  const isLong = desc.length > DESC_MAX;
  return (
    <>
      <div className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
        {isLong && !expanded ? desc.slice(0, DESC_MAX) + "..." : desc}
      </div>
      {isLong && (
        <button onClick={() => setExpanded(!expanded)} className="mt-2 text-xs font-semibold text-[#ff6900] hover:underline flex items-center gap-1">
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Sembunyikan</> : <><ChevronDown className="w-3.5 h-3.5" /> Selengkapnya</>}
        </button>
      )}
    </>
  );
}

export function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    async function fetchEvent() {
      setLoading(true);
      try {
        const url = import.meta.env.VITE_SUPABASE_URL as string;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const res = await fetch(`${url}/rest/v1/events?id=eq.${id}&select=*,ormawa(name),event_registrations(count),attendance_sessions(*)`, {
          headers: { "apikey": key, "Authorization": `Bearer ${key}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            const e = data[0];
            
            const countRes = await fetch(`${url}/rest/v1/rpc/get_event_registrations_count`, {
              method: 'POST',
              headers: { "apikey": key, "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
              body: JSON.stringify({ p_event_id: e.id })
            });
            const count = countRes.ok ? await countRes.json() : 0;

            const sessRes = await fetch(`${url}/rest/v1/attendance_sessions?event_id=eq.${id}&order=order_index.asc`, {
              headers: { "apikey": key, "Authorization": `Bearer ${key}` }
            });
            const sessionsData = sessRes.ok ? await sessRes.json() : [];

            let uiStatus = e.status;
            if (e.status === "published") {
              uiStatus = "upcoming";
              if (e.registration_close_date && new Date(e.registration_close_date) < new Date()) {
                uiStatus = "closed";
              }
            }
            
            setEvent({
              ...e,
              ormawa: e.ormawa?.name || "Unknown Ormawa",
              registered: count,
              hasPresensi: sessionsData && sessionsData.length > 0,
              sessions: sessionsData || [],
              time: formatTimeAMPM(e.time_start, e.time_end),
              status: uiStatus,
              cover: e.cover_url,
              registrationCloseDate: e.registration_close_date
            });
          }
        }
      } catch (err) {
        console.error("Fetch event error:", err);
      }
      setLoading(false);
    }
    fetchEvent();
  }, [id]);

  useEffect(() => {
    async function checkRegistered() {
      if (!profile?.id || !id || !session?.access_token) return;
      try {
        const url = import.meta.env.VITE_SUPABASE_URL as string;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const res = await fetch(`${url}/rest/v1/event_registrations?event_id=eq.${id}&user_id=eq.${profile.id}&select=id`, {
          headers: { "apikey": key, "Authorization": `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setRegistered(data.length > 0);
        }
      } catch (err) {
        console.error("Check registered error:", err);
      }
    }
    checkRegistered();
  }, [profile?.id, id, session?.access_token]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-muted-foreground gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff6900]" />
        <p className="text-sm">Memuat detail event...</p>
      </div>
    );
  }

  if (!event) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Event tidak ditemukan</div>;

  const isFull = event.registered >= event.quota;

  return (
    <div className="min-h-[calc(100vh-4rem)] max-w-5xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm transition">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="relative rounded-2xl overflow-hidden aspect-video w-full md:aspect-auto md:h-80 bg-muted/30">
            {event.cover && <ImageWithFallback src={event.cover} alt={event.title} className="w-full h-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <div className="flex gap-2 mb-3">
                {(() => {
                  const isOprec = event.category === "Oprec";
                  const isClosed = event.status === "closed" || isFull;
                  
                  let text = isClosed ? "Ditutup" : event.status === "upcoming" ? "Dibuka" : event.status === "ongoing" ? "Berlangsung" : "Selesai";
                  let bgCls = isClosed ? "bg-red-500/90 text-white shadow-lg shadow-red-500/20" :
                              event.status === "upcoming" ? "bg-[#ff6900]/90 text-white shadow-lg shadow-[#ff6900]/20" :
                              event.status === "ongoing" ? "bg-emerald-500/90 text-white shadow-lg shadow-emerald-500/20" :
                              "bg-white/20 text-white/70 backdrop-blur-md";
                              
                  if (isOprec && event.status !== "closed" && !isClosed && event.status !== "completed") {
                    text = "Dibuka";
                    bgCls = "bg-[#ff6900]/90 text-white shadow-lg shadow-[#ff6900]/20";
                  }

                  return (
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${bgCls}`}>
                      {text}
                    </span>
                  );
                })()}
                {event.category && <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/95 text-zinc-900 shadow-sm">{event.category}</span>}
              </div>
              <h1 className="text-2xl md:text-4xl font-bold text-white drop-shadow-md">{event.title}</h1>
            </div>
          </div>

          <GlassCard className="p-6 md:p-8">
            <h2 className="text-base font-bold text-foreground mb-2">Deskripsi</h2>
            <ExpandableText text={event.description} />
          </GlassCard>
        </div>

        <div className="space-y-4">
          <GlassCard className="p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#ff6900]/10 flex items-center justify-center shrink-0 mt-0.5">
                <Tag className="w-4 h-4 text-[#ff6900]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Penyelenggara</p>
                <p className="text-sm font-semibold text-foreground">{event.ormawa}</p>
              </div>
            </div>
            
            {event.category !== "Oprec" && (event.date || event.time) && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#ff6900]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Calendar className="w-4 h-4 text-[#ff6900]" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Waktu Pelaksanaan</p>
                  {event.date && <p className="text-sm font-semibold text-foreground">{formatDateRange(event.date, event.endDate)}</p>}
                  {event.time && <p className="text-xs text-muted-foreground mt-0.5">{event.time}</p>}
                </div>
              </div>
            )}
            
            {event.registrationCloseDate && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <CalendarX className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Pendaftaran Ditutup</p>
                  <p className="text-sm font-semibold text-foreground">{new Date(event.registrationCloseDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
              </div>
            )}
            
            {event.category !== "Oprec" && event.location && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#ff6900]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-[#ff6900]" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Lokasi</p>
                  <p className="text-sm font-semibold text-foreground">{event.location}</p>
                </div>
              </div>
            )}
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#ff6900]/10 flex items-center justify-center shrink-0 mt-0.5">
                <Users className="w-4 h-4 text-[#ff6900]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Target Peserta</p>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                  event.target_audience === "mahasiswa"
                    ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20"
                    : "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20"
                }`}>
                  {event.target_audience === "mahasiswa" ? "Mahasiswa" : "Umum & Mahasiswa"}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#ff6900]/10 flex items-center justify-center shrink-0 mt-0.5">
                <Users className="w-4 h-4 text-[#ff6900]" />
              </div>
              <div className="w-full">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-muted-foreground">Kuota Peserta</p>
                  <span className="text-xs font-medium text-foreground bg-muted px-2 py-0.5 rounded-md">{event.registered} / {event.quota}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] transition-all duration-1000" style={{ width: `${Math.min((event.registered / event.quota) * 100, 100)}%` }} />
                </div>
              </div>
            </div>

            <div className="pt-2">
              {!profile ? (
                <button onClick={() => navigate("/login")} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold hover:shadow-lg hover:shadow-[#ff6900]/25 hover:-translate-y-0.5 transition-all duration-200">
                  Login untuk Mendaftar
                </button>
              ) : profile.role === "admin" || profile.role === "ormawa" ? null : registered ? (
                <div className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5" /> Terdaftar
                </div>
              ) : isFull ? (
                <div className="py-3.5 text-center rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-500 dark:text-red-400 font-medium text-sm">Pendaftaran Ditutup</div>
              ) : event.status === "closed" || (event.registrationCloseDate && new Date(new Date().setHours(0,0,0,0)) > new Date(event.registrationCloseDate)) ? (
                <div className="py-3.5 text-center rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-500 dark:text-red-400 font-medium text-sm">Pendaftaran Ditutup</div>
              ) : (
                <button onClick={() => navigate(`/dashboard/event/${event.id}/daftar`)} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold hover:shadow-lg hover:shadow-[#ff6900]/25 hover:-translate-y-0.5 transition-all duration-200">
                  Daftar Event
                </button>
              )}
            </div>
          </GlassCard>


        </div>
      </div>
    </div>
  );
}