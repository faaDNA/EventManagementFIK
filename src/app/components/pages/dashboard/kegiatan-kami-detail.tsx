import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { GlassCard } from "../../glass-card";
import { ImageWithFallback } from "../../figma/ImageWithFallback";
import { useAuth } from "../../auth-context";
import type { Event } from "../../../../lib/database.types";
import {
  ArrowLeft, Calendar, MapPin, Users, CalendarX, Edit3, Save, X, Upload,
  Download, PlusCircle, QrCode, FileText, Trash2, CheckCircle2, Eye, Clock, Loader2
} from "lucide-react";

function formatDateRange(date: string, endDate?: string | null) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  const start = new Date(date).toLocaleDateString("id-ID", opts);
  if (!endDate || endDate === date) return start;
  return `${start} – ${new Date(endDate).toLocaleDateString("id-ID", opts)}`;
}

interface SessionData {
  id: string;
  name: string;
  method: "qr" | "form";
  isOpen?: boolean;
  autoOpen?: string;
  autoClose?: string;
}

export function DashboardKegiatanKamiDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [event, setEvent] = useState<Event | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [registrantCount, setRegistrantCount] = useState(0);

  useEffect(() => {
    async function fetchEvent() {
      setPageLoading(true);
      try {
        const url = import.meta.env.VITE_SUPABASE_URL as string;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const headers: Record<string, string> = { "apikey": key };
        if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

        const res = await fetch(`${url}/rest/v1/events?id=eq.${id}&select=*`, { headers, signal: AbortSignal.timeout(15000) });
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) setEvent(data[0]);
        }

        // Fetch sessions
        const sessRes = await fetch(`${url}/rest/v1/attendance_sessions?event_id=eq.${id}&order=order_index.asc`, { headers, signal: AbortSignal.timeout(15000) });
        if (sessRes.ok) {
          const sessData = await sessRes.json();
          setSessions(sessData.map((s: any) => ({
            id: s.id,
            name: s.name,
            method: s.method,
            isOpen: s.is_open,
          })));
        }

        // Fetch registrant count via RPC
        const regRes = await fetch(`${url}/rest/v1/rpc/get_event_registrations_count`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ p_event_id: id }),
          signal: AbortSignal.timeout(15000)
        });
        if (regRes.ok) {
          const count = await regRes.json();
          setRegistrantCount(typeof count === "number" ? count : 0);
        }
      } catch (err) { console.error("Fetch event error:", err); }
      setPageLoading(false);
    }
    if (id) fetchEvent();
  }, [id, session?.access_token]);

  // All editable fields
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editQuota, setEditQuota] = useState("");
  const [editCloseDate, setEditCloseDate] = useState("");
  const [editCover, setEditCover] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [saved, setSaved] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Init edit fields from event
  useEffect(() => {
    if (!event) return;
    setEditTitle(event.title);
    setEditDescription(event.description || "");
    setEditDate(event.date);
    setEditEndDate(event.end_date || "");
    setEditTime([event.time_start, event.time_end].filter(Boolean).join(" - "));
    setEditLocation(event.location || "");
    setEditQuota(event.quota?.toString() || "");
    setEditCloseDate(event.registration_close_date || "");
    setEditCover(event.cover_url || "");
    setEditCategory(event.category || "");
  }, [event]);

  // Presensi
  const [showPresensiModal, setShowPresensiModal] = useState(false);
  const [presensiName, setPresensiName] = useState("");
  const [presensiMethod, setPresensiMethod] = useState<"qr" | "form">("qr");

  if (pageLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff6900]" />
        <p className="text-sm">Memuat kegiatan...</p>
      </div>
    );
  }

  if (!event) return <div className="p-6 text-center text-muted-foreground">Event tidak ditemukan</div>;

  const handleSave = async () => {
    if (!id || !session?.access_token) return;
    setPageLoading(true);
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      
      let finalCoverUrl = editCover;

      if (coverFile) {
        const ext = coverFile.name.split(".").pop() || "jpg";
        const storagePath = `${id}_${Date.now()}.${ext}`;
        const arrayBuffer = await coverFile.arrayBuffer();

        const uploadRes = await fetch(`${url}/storage/v1/object/event-covers/${storagePath}`, {
          method: "POST",
          headers: {
            "apikey": key,
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": coverFile.type || "image/jpeg",
            "x-upsert": "true",
          },
          body: arrayBuffer,
        });

        if (uploadRes.ok) {
          finalCoverUrl = `${url}/storage/v1/object/public/event-covers/${storagePath}`;
        } else {
          console.error("Cover upload failed:", await uploadRes.text());
        }
      }

      const timeParts = editTime.split("-").map(t => t.trim());
      const timeStart = timeParts[0] || null;
      const timeEnd = timeParts[1] || null;

      const payload: Record<string, any> = {
        title: editTitle,
        description: editDescription,
        date: editDate,
        end_date: editEndDate || null,
        time_start: timeStart,
        time_end: timeEnd,
        location: editLocation,
        quota: editQuota ? parseInt(editQuota) : null,
        registration_close_date: editCloseDate || null,
        category: editCategory,
        cover_url: finalCoverUrl
      };

      const res = await fetch(`${url}/rest/v1/events?id=eq.${id}`, {
        method: "PATCH",
        headers: {
          "apikey": key,
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setEvent(data[0]);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        setIsEditing(false);
        setCoverFile(null);
      } else {
        alert("Gagal menyimpan: " + await res.text());
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Error saat menyimpan data.");
    }
    setPageLoading(false);
  };

  const handleCompleteEvent = async () => {
    if (!id || !session?.access_token) return;
    setCompleting(true);
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetch(`${url}/rest/v1/events?id=eq.${id}`, {
        method: "PATCH",
        headers: {
          "apikey": key,
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify({ status: "completed" })
      });

      if (res.ok) {
        const data = await res.json();
        setEvent(data[0]);
        setShowCompleteModal(false);
      } else {
        alert("Gagal menyelesaikan kegiatan: " + await res.text());
      }
    } catch (err) {
      console.error("Complete error:", err);
      alert("Error saat menyelesaikan kegiatan.");
    }
    setCompleting(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditTitle(event.title);
    setEditDescription(event.description || "");
    setEditDate(event.date);
    setEditEndDate(event.end_date || "");
    setEditTime([event.time_start, event.time_end].filter(Boolean).join(" - "));
    setEditLocation(event.location || "");
    setEditQuota(event.quota?.toString() || "");
    setEditCloseDate(event.registration_close_date || "");
    setEditCover(event.cover_url || "");
    setEditCategory(event.category || "");
    setCoverFile(null);
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setEditCover(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAddPresensi = async () => {
    if (!presensiName.trim() || !id || !session?.access_token) return;
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      
      const payload = {
        event_id: id,
        name: presensiName,
        method: presensiMethod,
        is_open: false,
        qr_token: crypto.randomUUID(),
        order_index: sessions.length
      };

      const res = await fetch(`${url}/rest/v1/attendance_sessions`, {
        method: "POST",
        headers: {
          "apikey": key,
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      });

      if (res.ok) {
        const data = await res.json();
        const newSession: SessionData = {
          id: data[0].id,
          name: data[0].name,
          method: data[0].method,
          isOpen: data[0].is_open,
        };
        setSessions([...sessions, newSession]);
        setPresensiName("");
        setShowPresensiModal(false);
        navigate(`/dashboard/kegiatan-kami/${id}/presensi/${newSession.id}`, { state: { session: newSession } });
      } else {
        console.error("Add presensi failed:", await res.text());
      }
    } catch (err) {
      console.error("Add presensi error:", err);
    }
  };

  const handleRemoveSession = async (sid: string) => {
    if (!session?.access_token) return;
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      
      const res = await fetch(`${url}/rest/v1/attendance_sessions?id=eq.${sid}`, {
        method: "DELETE",
        headers: {
          "apikey": key,
          "Authorization": `Bearer ${session.access_token}`,
        },
        signal: AbortSignal.timeout(15000)
      });

      if (res.ok) {
        setSessions(sessions.filter((s) => s.id !== sid));
      } else {
        console.error("Remove presensi failed:", await res.text());
      }
    } catch (err) {
      console.error("Remove presensi error:", err);
    }
  };

  const handleExport = async () => {
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const headers: Record<string, string> = { "apikey": key };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      // 1. Fetch registrations with profiles + user_id for mapping
      const res = await fetch(
        `${url}/rest/v1/event_registrations?event_id=eq.${id}&select=user_id,status,registered_at,profiles:user_id(full_name,nim,email)`,
        { headers, signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) { console.error("Export fetch error:", res.status); return; }
      const data = await res.json();

      // 2. Fetch form fields for this event (registration form)
      let formFieldLabels: { id: string; label: string }[] = [];
      let answersMap: Record<string, Record<string, any>> = {};

      const formRes = await fetch(
        `${url}/rest/v1/forms?event_id=eq.${id}&form_type=eq.registration&select=id`,
        { headers, signal: AbortSignal.timeout(15000) }
      );
      if (formRes.ok) {
        const forms = await formRes.json();
        if (forms.length > 0) {
          const formId = forms[0].id;
          // Fetch field labels
          const fieldRes = await fetch(
            `${url}/rest/v1/form_fields?form_id=eq.${formId}&order=order_index.asc&select=id,label,type`,
            { headers, signal: AbortSignal.timeout(15000) }
          );
          if (fieldRes.ok) {
            const fieldData = await fieldRes.json();
            formFieldLabels = fieldData.map((f: any) => ({ id: f.id, label: f.label, type: f.type, options: f.options }));
          }
          // Fetch responses
          const respRes = await fetch(
            `${url}/rest/v1/form_responses?form_id=eq.${formId}&select=user_id,answers`,
            { headers, signal: AbortSignal.timeout(15000) }
          );
          if (respRes.ok) {
            const respData = await respRes.json();
            respData.forEach((r: any) => { answersMap[r.user_id] = r.answers || {}; });
          }
        }
      }

      // Build option ID→label map per field
      const optionMaps: Record<string, Record<string, string>> = {};
      formFieldLabels.forEach(f => {
        if (f.options && Array.isArray(f.options)) {
          const m: Record<string, string> = {};
          f.options.forEach((opt: any) => { m[opt.id] = opt.label || opt.id; });
          optionMaps[f.id] = m;
        }
      });

      const resolveAnswer = (fieldId: string, val: any): string => {
        if (val == null) return "-";
        const oMap = optionMaps[fieldId];
        if (Array.isArray(val)) {
          // Checkbox: resolve each ID to label, join with comma
          return val.map(v => oMap?.[v] || String(v)).join(", ");
        }
        if (oMap && oMap[val]) return oMap[val];
        return String(val).replace(/,/g, ";");
      };

      // 3. Build CSV
      const csvHeaders = ["Nama", "NIM", "Email", "Kategori", "Status", "Tanggal Daftar"];
      formFieldLabels.forEach(f => csvHeaders.push(f.label));

      const csvRows = (data || []).map((r: any) => {
        const row = [
          r.profiles?.full_name || "Unknown",
          r.profiles?.nim || "-",
          r.profiles?.email || "-",
          r.profiles?.nim ? "Mahasiswa" : "Umum",
          r.status || "confirmed",
          r.registered_at ? new Date(r.registered_at).toLocaleDateString("id-ID") : "-",
        ];
        if (formFieldLabels.length > 0) {
          const answers = answersMap[r.user_id] || {};
          formFieldLabels.forEach(f => {
            row.push(resolveAnswer(f.id, answers[f.id]));
          });
        }
        return row;
      });

      const csv = [csvHeaders, ...csvRows].map((row) => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `pendaftar-${editTitle.replace(/\s+/g, "-").toLowerCase()}.csv`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Export error:", err);
    }
  };

  const inputClass = "w-full px-3 py-2 rounded-xl bg-input-background border border-[#ff6900]/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6900]/10 transition";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button onClick={() => navigate("/dashboard/kegiatan-kami")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm transition">
        <ArrowLeft className="w-4 h-4" /> Kembali ke Kegiatan Kami
      </button>

      {/* Cover */}
      <div className="relative rounded-2xl overflow-hidden h-48 md:h-64 mb-6">
        <ImageWithFallback src={editCover} alt={editTitle} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        {isEditing && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white text-xs font-medium flex items-center gap-1.5 transition backdrop-blur-sm"
          >
            <Upload className="w-3.5 h-3.5" /> Ganti Cover
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex gap-2 mb-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${event.status === "upcoming" ? "bg-[#ff6900]/80 text-white" : "bg-emerald-500/80 text-white"}`}>
              {event.status === "upcoming" ? "Akan Datang" : "Berlangsung"}
            </span>
            {isEditing ? (
              <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="px-2.5 py-0.5 rounded-full text-[11px] bg-black/40 text-white backdrop-blur-md border border-white/20 focus:outline-none w-28">
                <option value="Seminar" className="bg-black text-white">Seminar</option>
                <option value="Workshop" className="bg-black text-white">Workshop</option>
                <option value="Kompetisi" className="bg-black text-white">Kompetisi</option>
                <option value="Oprec" className="bg-black text-white">Oprec</option>
                <option value="Pelatihan" className="bg-black text-white">Pelatihan</option>
                <option value="Lainnya" className="bg-black text-white">Lainnya</option>
              </select>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/15 text-white/90 backdrop-blur-md">{editCategory}</span>
            )}
          </div>
          {isEditing ? (
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-xl md:text-2xl font-bold text-white bg-transparent border-b border-white/30 focus:outline-none focus:border-white/60 w-full" />
          ) : (
            <h1 className="text-xl md:text-2xl font-bold text-white">{editTitle}</h1>
          )}
        </div>
      </div>

      {/* Edit toolbar */}
      <div className="flex items-center justify-end gap-2 mb-6">
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-500 mr-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> Perubahan tersimpan
          </span>
        )}
        {isEditing ? (
          <>
            <button onClick={handleCancel} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition flex items-center gap-1.5">
              <X className="w-4 h-4" /> Batal
            </button>
            <button onClick={handleSave} className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white text-sm font-semibold hover:opacity-90 transition flex items-center gap-1.5 shadow-md shadow-[#ff6900]/20">
              <Save className="w-4 h-4" /> Simpan Perubahan
            </button>
          </>
        ) : event.status !== "completed" ? (
          <>
            <button onClick={() => setShowCompleteModal(true)} className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Tandai Selesai
            </button>
            <button onClick={() => setIsEditing(true)} className="px-4 py-2 rounded-xl bg-muted border border-border text-sm text-muted-foreground hover:text-foreground transition flex items-center gap-1.5">
              <Edit3 className="w-4 h-4" /> Edit Kegiatan
            </button>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Detail Kegiatan */}
          <GlassCard className="p-5">
            <h2 className="text-base font-bold text-foreground mb-4">Detail Kegiatan</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-[#ff6900] mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] text-muted-foreground mb-0.5">Tanggal Mulai</p>
                  {isEditing ? (
                    <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className={inputClass} />
                  ) : (
                    <p className="text-sm font-medium text-foreground">{formatDateRange(editDate, editEndDate)}</p>
                  )}
                </div>
              </div>
              {isEditing && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-[#ff6900] mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[11px] text-muted-foreground mb-0.5">Tanggal Selesai</p>
                    <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} min={editDate} className={inputClass} />
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">Kosongkan jika sama</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-[#ff6900] mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] text-muted-foreground mb-0.5">Waktu</p>
                  {isEditing ? (
                    <input type="text" value={editTime} onChange={(e) => setEditTime(e.target.value)} placeholder="09:00 - 12:00" className={inputClass} />
                  ) : (
                    <p className="text-sm font-medium text-foreground">{editTime}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#ff6900] mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] text-muted-foreground mb-0.5">Lokasi</p>
                  {isEditing ? (
                    <input type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className={inputClass} />
                  ) : (
                    <p className="text-sm font-medium text-foreground">{editLocation}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="w-4 h-4 text-[#ff6900] mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] text-muted-foreground mb-0.5">Kuota Peserta</p>
                  {isEditing ? (
                    <input type="number" value={editQuota} onChange={(e) => setEditQuota(e.target.value)} className={inputClass} />
                  ) : (
                    <p className="text-sm font-medium text-foreground">{registrantCount} / {editQuota || event.quota}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CalendarX className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] text-muted-foreground mb-0.5">Pendaftaran Ditutup</p>
                  {isEditing ? (
                    <input type="date" value={editCloseDate} onChange={(e) => setEditCloseDate(e.target.value)} className={inputClass} />
                  ) : (
                    <p className="text-sm font-medium text-foreground">
                      {editCloseDate ? new Date(editCloseDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mt-5 pt-5 border-t border-border">
              <p className="text-[11px] text-muted-foreground mb-1.5 font-semibold uppercase tracking-wider">Deskripsi</p>
              {isEditing ? (
                <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4}
                  className="w-full px-3 py-2 rounded-xl bg-input-background border border-[#ff6900]/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6900]/10 transition resize-none" />
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed">{editDescription}</p>
              )}
            </div>
          </GlassCard>

          {/* Data Pendaftar - simplified */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#ff6900]/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-[#ff6900]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Data Pendaftar</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    <span className="text-lg font-bold text-foreground">{registrantCount}</span> orang terdaftar
                  </p>
                </div>
              </div>
              <button onClick={handleExport}
                className="px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition flex items-center gap-2">
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>
          </GlassCard>

          {/* Sesi Presensi */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">Sesi Presensi</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{sessions.length} sesi</p>
              </div>
              {event.status !== "completed" && (
                <button onClick={() => setShowPresensiModal(true)}
                  className="px-3 py-2 rounded-xl bg-[#ff6900]/10 border border-[#ff6900]/20 text-xs text-[#ff6900] font-medium hover:bg-[#ff6900]/20 transition flex items-center gap-1.5">
                  <PlusCircle className="w-3.5 h-3.5" /> Tambah Sesi
                </button>
              )}
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <p>Belum ada sesi presensi. Klik "Tambah Sesi" untuk menambahkan.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session, index) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-muted/50 border border-border group cursor-pointer hover:border-[#ff6900]/20 transition"
                    onClick={() => navigate(`/dashboard/kegiatan-kami/${id}/presensi/${session.id}`, { state: { session } })}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-[#ff6900]/10 flex items-center justify-center text-[#ff6900] text-xs font-bold">{index + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{session.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {session.method === "qr" ? <QrCode className="w-3 h-3 text-muted-foreground" /> : <FileText className="w-3 h-3 text-muted-foreground" />}
                          <span className="text-[11px] text-muted-foreground">{session.method === "qr" ? "QR Code" : "Custom Form"}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${session.isOpen ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-red-100 dark:bg-red-500/15 text-red-500"}`}>
                            {session.isOpen ? "Dibuka" : "Ditutup"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/kegiatan-kami/${id}/presensi/${session.id}`, { state: { session } }); }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-[#ff6900] hover:bg-[#ff6900]/10 transition">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleRemoveSession(session.id); }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <GlassCard className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground">Ringkasan</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Status</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${event.status === "upcoming" ? "bg-[#ff6900]/10 text-[#ff6900]" : "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"}`}>
                  {event.status === "upcoming" ? "Akan Datang" : "Berlangsung"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Pendaftar</span>
                <span className="text-sm font-semibold text-foreground">{registrantCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Kuota</span>
                <span className="text-sm font-semibold text-foreground">{editQuota || event.quota}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Sesi Presensi</span>
                <span className="text-sm font-semibold text-foreground">{sessions.length}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#ff6900] to-[#ff8c3a]"
                  style={{ width: `${Math.min((registrantCount / (parseInt(editQuota) || event.quota)) * 100, 100)}%` }} />
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Add Presensi Modal */}
      {showPresensiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-md p-6 bg-card border border-border">
            <h2 className="text-lg font-bold text-foreground mb-1">Tambah Sesi Presensi</h2>
            <p className="text-xs text-muted-foreground mb-5">Pilih metode presensi untuk sesi baru</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nama Sesi</label>
                <input
                  value={presensiName}
                  onChange={(e) => setPresensiName(e.target.value)}
                  placeholder="Contoh: Sesi Pembukaan"
                  className="w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none transition placeholder:text-muted-foreground/40"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Metode Presensi</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setPresensiMethod("qr")}
                    className={`p-4 rounded-xl border text-center transition ${presensiMethod === "qr" ? "border-[#ff6900] bg-[#ff6900]/10" : "border-border bg-muted hover:bg-accent"}`}>
                    <QrCode className={`w-8 h-8 mx-auto mb-2 ${presensiMethod === "qr" ? "text-[#ff6900]" : "text-muted-foreground"}`} />
                    <p className={`text-sm font-semibold ${presensiMethod === "qr" ? "text-[#ff6900]" : "text-foreground"}`}>QR Code</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Scan QR untuk presensi</p>
                  </button>
                  <button onClick={() => setPresensiMethod("form")}
                    className={`p-4 rounded-xl border text-center transition ${presensiMethod === "form" ? "border-[#ff6900] bg-[#ff6900]/10" : "border-border bg-muted hover:bg-accent"}`}>
                    <FileText className={`w-8 h-8 mx-auto mb-2 ${presensiMethod === "form" ? "text-[#ff6900]" : "text-muted-foreground"}`} />
                    <p className={`text-sm font-semibold ${presensiMethod === "form" ? "text-[#ff6900]" : "text-foreground"}`}>Custom Form</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Isi form untuk presensi</p>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowPresensiModal(false); setPresensiName(""); }} className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-muted transition">Batal</button>
              <button onClick={handleAddPresensi} disabled={!presensiName.trim()} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">Tambahkan</button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Complete Event Confirmation Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-sm p-6 bg-card border border-border">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-4 mx-auto">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2 text-center">Selesaikan Kegiatan?</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Kegiatan yang sudah diselesaikan tidak dapat diedit lagi dan akan dipindahkan ke halaman Riwayat Kegiatan. Anda yakin?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowCompleteModal(false)} className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-muted transition font-medium">Batal</button>
              <button onClick={handleCompleteEvent} disabled={completing} className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition flex items-center justify-center gap-2">
                {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ya, Selesaikan"}
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}