import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { GlassCard } from "../../glass-card";
import { useAuth } from "../../auth-context";
import { ImageWithFallback } from "../../figma/ImageWithFallback";
import { Calendar, MapPin, Users, ArrowLeft, CheckCircle2, Clock, Tag, CalendarX, Loader2, QrCode, FileText, ScanLine, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { Event } from "../../../../lib/database.types";

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

const DESC_MAX = 300;
function DescriptionCard({ text }: { text: string | null }) {
  const [expanded, setExpanded] = React.useState(false);
  const desc = text || "Belum ada deskripsi.";
  const isLong = desc.length > DESC_MAX;
  return (
    <GlassCard className="p-5">
      <h2 className="text-base font-bold text-foreground mb-2">Deskripsi</h2>
      <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
        {isLong && !expanded ? desc.slice(0, DESC_MAX) + "..." : desc}
      </p>
      {isLong && (
        <button onClick={() => setExpanded(!expanded)} className="mt-2 text-xs font-semibold text-[#ff6900] hover:underline flex items-center gap-1">
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Sembunyikan</> : <><ChevronDown className="w-3.5 h-3.5" /> Selengkapnya</>}
        </button>
      )}
    </GlassCard>
  );
}

interface EventWithOrmawa extends Event {
  ormawa?: { name: string; full_name: string } | null;
}

export function DashboardEventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const [searchParams] = useSearchParams();
  const fromKegiatanSaya = searchParams.get("from") === "kegiatan-saya";

  const [event, setEvent] = useState<EventWithOrmawa | null>(null);
  const [loading, setLoading] = useState(true);
  const [registered, setRegistered] = useState(fromKegiatanSaya);
  const [registrantCount, setRegistrantCount] = useState(0);
  const [registrationsCount, setRegistrationsCount] = useState(0);
  const [sessions, setSessions] = useState<any[]>([]);
  const [myAttendedSessions, setMyAttendedSessions] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchEvent() {
      setLoading(true);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const headers: Record<string, string> = {
          "apikey": supabaseKey,
          "Accept": "application/json",
        };
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }

        const res = await fetch(
          `${supabaseUrl}/rest/v1/events?id=eq.${id}&select=*,ormawa:ormawa_id(name,full_name)`,
          { headers, signal: AbortSignal.timeout(15000) }
        );

        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) {
            setEvent(data[0]);
          }
        }

        // Fetch registrant count via RPC (bypasses RLS)
        const regRes = await fetch(
          `${supabaseUrl}/rest/v1/rpc/get_event_registrations_count`,
          {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ p_event_id: id }),
            signal: AbortSignal.timeout(15000)
          }
        );
        if (regRes.ok) {
          const count = await regRes.json();
          setRegistrantCount(count);
          setRegistrationsCount(count);
        }

        // Fetch attendance sessions for this event
        const sessRes = await fetch(
          `${supabaseUrl}/rest/v1/attendance_sessions?event_id=eq.${id}&order=order_index.asc`,
          { headers, signal: AbortSignal.timeout(15000) }
        );
        if (sessRes.ok) {
          const sessData = await sessRes.json();
          setSessions(sessData || []);
        }

        // Fetch user's attendance records and registration if logged in
        if (session?.user?.id) {
          const regStatusRes = await fetch(
            `${supabaseUrl}/rest/v1/event_registrations?event_id=eq.${id}&user_id=eq.${session.user.id}`,
            { headers, signal: AbortSignal.timeout(15000) }
          );
          if (regStatusRes.ok) {
            const regData = await regStatusRes.json();
            if (regData.length > 0) {
              setRegistered(true);
            }
          }

          const recRes = await fetch(
            `${supabaseUrl}/rest/v1/attendance_records?user_id=eq.${session.user.id}&select=session_id`,
            { headers, signal: AbortSignal.timeout(15000) }
          );
          if (recRes.ok) {
            const recData = await recRes.json();
            setMyAttendedSessions(new Set((recData || []).map((r: any) => r.session_id)));
          }
        }
      } catch (err) {
        console.error("Fetch event error:", err);
      }
      setLoading(false);
    }
    if (id) fetchEvent();
  }, [id, session?.access_token]);

  const handleDelete = async () => {
    if (!id || !session?.access_token || profile?.role !== "admin") return;
    setDeleting(true);
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetch(`${url}/rest/v1/events?id=eq.${id}`, {
        method: "DELETE",
        headers: {
          "apikey": key,
          "Authorization": `Bearer ${session.access_token}`
        }
      });
      if (res.ok) {
        navigate(-1);
      } else {
        alert("Gagal menghapus kegiatan: " + await res.text());
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Error saat menghapus kegiatan.");
    }
    setDeleting(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff6900]" />
        <p className="text-sm">Memuat event...</p>
      </div>
    );
  }

  if (!event) return <div className="p-6 text-center text-muted-foreground">Event tidak ditemukan</div>;

  const isStudentOrPublic = profile?.role === "mahasiswa" || profile?.role === "umum";
  const timeStr = formatTimeAMPM(event.time_start, event.time_end);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        {profile?.role === "admin" && (
          <button onClick={() => setShowDeleteModal(true)} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-500/20 transition flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Hapus Kegiatan
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="relative rounded-2xl overflow-hidden aspect-video w-full md:aspect-auto md:h-72">
            {event.cover_url ? (
              <ImageWithFallback src={event.cover_url} alt={event.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#ff6900]/20 to-[#ff8c3a]/10 flex items-center justify-center">
                <Calendar className="w-16 h-16 text-[#ff6900]/30" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex gap-2 mb-2">
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

                  const isOprec = event.category === "Oprec";
                  const isClosed = (event.registration_close_date && new Date(new Date().setHours(0,0,0,0)) > new Date(event.registration_close_date)) || (event.quota !== null && registrationsCount >= event.quota);
                  
                  let text = event.status;
                  let bg = "bg-white/20 text-white/70";
                  
                  if (isActuallyOngoing && !isOprec) {
                    text = "Berlangsung";
                    bg = "bg-emerald-500/80 text-white";
                  } else if (isClosed && event.status === "published") {
                    text = "Ditutup";
                    bg = "bg-red-500/80 text-white";
                  } else if (event.status === "published") {
                    text = "Dibuka";
                    bg = "bg-[#ff6900]/80 text-white";
                  } else if (event.status === "ongoing") {
                    text = isOprec ? "Dibuka" : "Berlangsung";
                    bg = isOprec ? "bg-[#ff6900]/80 text-white" : "bg-emerald-500/80 text-white";
                  } else if (event.status === "completed") {
                    text = "Selesai";
                    bg = "bg-zinc-500/80 text-white";
                  }
                  
                  return (
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${bg}`}>
                      {text}
                    </span>
                  );
                })()}
                {event.category && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/95 text-zinc-900 shadow-sm">{event.category}</span>
                )}
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-white">{event.title}</h1>
            </div>
          </div>

          <DescriptionCard text={event.description} />
        </div>

        <div className="space-y-4">
          <GlassCard className="p-5 space-y-4">
            {[
              { icon: <Tag className="w-4 h-4 text-[#ff6900]" />, label: "Penyelenggara", value: event.ormawa?.name || "—" },
              ...(event.category !== "Oprec" ? [{ icon: <Calendar className="w-4 h-4 text-[#ff6900]" />, label: "Tanggal", value: formatDateRange(event.date, event.end_date), sub: timeStr || undefined }] : []),
              ...(event.category !== "Oprec" && event.location ? [{ icon: <MapPin className="w-4 h-4 text-[#ff6900]" />, label: "Lokasi", value: event.location }] : []),
              { icon: <CalendarX className="w-4 h-4 text-red-400" />, label: "Pendaftaran Ditutup", value: event.registration_close_date ? new Date(event.registration_close_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                {item.icon}
                <div>
                  <p className="text-[11px] text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium text-foreground">{item.value}</p>
                  {item.sub && <p className="text-[11px] text-muted-foreground">{item.sub}</p>}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-[#ff6900]" />
              <div>
                <p className="text-[11px] text-muted-foreground">Target Peserta</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                  (event as any).target_audience === "mahasiswa"
                    ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20"
                    : "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20"
                }`}>
                  {(event as any).target_audience === "mahasiswa" ? "Mahasiswa" : "Umum & Mahasiswa"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-[#ff6900]" />
              <div>
                <p className="text-[11px] text-muted-foreground">Kuota</p>
                <p className="text-sm font-medium text-foreground">{event.quota != null ? `${registrationsCount}/${event.quota}` : "Tidak Terbatas"}</p>
                {event.quota == null && <p className="text-[11px] text-muted-foreground">{registrationsCount} pendaftar</p>}
              </div>
            </div>

            {registered ? (
              <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5" /> Terdaftar
              </div>
            ) : isStudentOrPublic ? (
              (event.registration_close_date && new Date(new Date().setHours(0,0,0,0)) > new Date(event.registration_close_date)) ? (
                <div className="py-3 text-center rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-500 dark:text-red-400 font-semibold text-sm">
                  Pendaftaran Ditutup
                </div>
              ) : (event.quota !== null && registrationsCount >= event.quota) ? (
                <div className="py-3 text-center rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-500 dark:text-red-400 font-semibold text-sm">
                  Pendaftaran Ditutup
                </div>
              ) : (
                <button onClick={() => navigate(`/dashboard/event/${event.id}/daftar`)} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold hover:opacity-90 transition shadow-md shadow-[#ff6900]/20">
                  Daftar Event
                </button>
              )
            ) : null}
          </GlassCard>

          {fromKegiatanSaya && (
            <>
            {sessions.length === 0 ? (
            <GlassCard className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Clock className="w-4 h-4" />
                <span>Tidak ada sesi presensi</span>
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="p-5 space-y-3">
              <h2 className="text-sm font-bold text-foreground mb-2">Sesi Presensi</h2>
              {sessions.map((s: any) => {
                const attended = myAttendedSessions.has(s.id);
                return (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
                    <div className="flex items-center gap-2.5">
                      {s.method === "form" ? <FileText className="w-4 h-4 text-muted-foreground" /> : <QrCode className="w-4 h-4 text-muted-foreground" />}
                      <div>
                        <p className="text-xs font-medium text-foreground">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground">{s.method === "form" ? "Presensi Form" : "Presensi QR"}</p>
                      </div>
                    </div>
                    {attended ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Hadir
                      </div>
                    ) : s.is_open && registered ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/kegiatan-saya/${event.id}/absen/${s.id}`, { state: { session: s } }); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white text-[11px] font-semibold hover:opacity-90 transition"
                      >
                        {s.method === "form" ? <><FileText className="w-3.5 h-3.5" /> Isi Form</> : <><ScanLine className="w-3.5 h-3.5" /> Scan</>}
                      </button>
                    ) : (
                      <span className={`text-[10px] px-2 py-1 rounded-md border ${s.is_open ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-muted border-border text-muted-foreground"}`}>
                        {s.is_open ? "Dibuka" : "Ditutup"}
                      </span>
                    )}
                  </div>
                );
              })}
            </GlassCard>
          )}
            </>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-sm p-6 bg-card border border-border">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-4 mx-auto">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2 text-center">Hapus Kegiatan?</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Apakah Anda yakin ingin menghapus kegiatan ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-muted transition font-medium">Batal</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition flex items-center justify-center gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ya, Hapus"}
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
