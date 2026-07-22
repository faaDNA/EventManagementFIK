/**
 * @file kegiatan-kami-detail.tsx
 * @description Halaman detail & manajemen kegiatan untuk ormawa (file terbesar dalam proyek).
 *
 * Fitur utama:
 * - Tampilkan detail kegiatan lengkap dengan status badge dinamis
 * - Edit inline: judul, deskripsi, tanggal, lokasi, kuota, cover image, kategori
 * - Tandai kegiatan selesai (status → completed)
 * - Kelola sesi presensi: tambah/hapus sesi (QR atau form)
 * - Export data pendaftar ke CSV (termasuk jawaban form)
 * - Rekap presensi ke PDF (daftar hadir semua sesi via jsPDF)
 * - Generate QR code untuk sesi presensi via qrcode.react
 * - Optimistic concurrency control via updated_at check saat save
 */
import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { GlassCard } from "../../glass-card";
import { ImageWithFallback } from "../../figma/ImageWithFallback";
import { useAuth } from "../../auth-context";
import type { Event } from "../../../../lib/database.types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ArrowLeft, Calendar, MapPin, Users, CalendarX, Edit3, Save, X, Upload,
  Download, PlusCircle, QrCode, FileText, Trash2, CheckCircle2, Eye, Clock, Loader2, ChevronDown, ChevronUp, FileDown, XCircle, FileSpreadsheet
} from "lucide-react";
import { FormRenderer } from "../../form-builder/FormRenderer";
import type { FormField, FormSection } from "../../form-builder/types";
import { addPengesahanBlock, addFooterTimestamp } from "../../../../lib/pdf-utils";

/** Format rentang tanggal ke Bahasa Indonesia. */
function formatDateRange(date: string, endDate?: string | null) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  const start = new Date(date).toLocaleDateString("id-ID", opts);
  if (!endDate || endDate === date) return start;
  return `${start} – ${new Date(endDate).toLocaleDateString("id-ID", opts)}`;
}

/** Format string waktu (HH:MM atau HH:MM-HH:MM) ke format 12-jam (AM/PM). */
function formatTimeStringToAMPM(timeStr?: string) {
  if (!timeStr) return "";
  const parts = timeStr.split("-").map(p => p.trim());
  const format = (t: string) => {
    if (!t) return "";
    const split = t.split(":");
    if (split.length < 2) return t;
    let hour = parseInt(split[0], 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12;
    return `${hour.toString().padStart(2, '0')}:${split[1].slice(0, 2)} ${ampm}`;
  };
  if (parts.length === 1) return format(parts[0]);
  return `${format(parts[0])} - ${format(parts[1])}`;
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
  const { session, profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [event, setEvent] = useState<Event | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [registrantCount, setRegistrantCount] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

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
          if (data.length > 0) {
            setEvent(data[0]);
            setLastUpdatedAt(data[0].updated_at || null);
          }
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
  const [editTimeStart, setEditTimeStart] = useState("");
  const [editTimeEnd, setEditTimeEnd] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editQuota, setEditQuota] = useState("");
  const [editCloseDate, setEditCloseDate] = useState("");
  const [editCover, setEditCover] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editTargetAudience, setEditTargetAudience] = useState("");
  const [saved, setSaved] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Certificate Modal State
  const [showCertModal, setShowCertModal] = useState(false);
  const [certInput, setCertInput] = useState("");
  const [savingCert, setSavingCert] = useState(false);

  // Registrants Modal State
  const [showRegistrantsModal, setShowRegistrantsModal] = useState(false);
  const [registrantsList, setRegistrantsList] = useState<any[]>([]);
  const [loadingRegistrants, setLoadingRegistrants] = useState(false);
  
  // View answers state for registration
  const [viewingAnswers, setViewingAnswers] = useState<string | null>(null);
  const [registrationFormFields, setRegistrationFormFields] = useState<FormField[]>([]);
  const [registrationFormSections, setRegistrationFormSections] = useState<FormSection[]>([]);
  const [registrationAnswersMap, setRegistrationAnswersMap] = useState<Record<string, Record<string, any>>>({});

  // Rekap Presensi Modal State
  const [showRekapModal, setShowRekapModal] = useState(false);
  const [rekapData, setRekapData] = useState<any[]>([]);
  const [loadingRekap, setLoadingRekap] = useState(false);

  // Init edit fields from event
  useEffect(() => {
    if (!event) return;
    setEditTitle(event.title);
    setEditDescription(event.description || "");
    setEditDate(event.date);
    setEditEndDate(event.end_date || "");
    setEditTimeStart(event.time_start || "");
    setEditTimeEnd(event.time_end || "");
    setEditLocation(event.location || "");
    setEditQuota(event.quota?.toString() || "");
    setEditCloseDate(event.registration_close_date || "");
    setEditCover(event.cover_url || "");
    setEditCategory(event.category || "");
    setEditTargetAudience((event as any).target_audience || "semua");
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

  /**
   * Simpan perubahan edit kegiatan ke database.
   * Upload cover baru jika ada, lalu PATCH event.
   * Menggunakan optimistic concurrency control (cek updated_at).
   */
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

      const timeStart = editTimeStart || null;
      const timeEnd = editTimeEnd || null;

      const payload: Record<string, any> = {
        title: editTitle,
        description: editDescription,
        date: editCategory === "Oprec" && editCloseDate ? editCloseDate : editDate,
        end_date: editCategory === "Oprec" ? null : (editEndDate || null),
        time_start: editCategory === "Oprec" ? null : timeStart,
        time_end: editCategory === "Oprec" ? null : timeEnd,
        location: editCategory === "Oprec" ? null : editLocation,
        quota: editQuota ? parseInt(editQuota) : null,
        registration_close_date: editCloseDate || null,
        category: editCategory,
        target_audience: editTargetAudience,
        cover_url: finalCoverUrl
      };

      const res = await fetch(`${url}/rest/v1/events?id=eq.${id}${lastUpdatedAt ? `&updated_at=eq.${encodeURIComponent(lastUpdatedAt)}` : ''}`, {
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
        if (data.length === 0) {
          alert("Data sudah diubah oleh pengguna lain. Halaman akan di-refresh.");
          window.location.reload();
          return;
        }
        setEvent(data[0]);
        setLastUpdatedAt(data[0].updated_at);
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

  /**
   * Simpan link sertifikat ke database
   */
  const handleSaveCert = async () => {
    if (!id || !session?.access_token) return;
    setSavingCert(true);
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
        body: JSON.stringify({ certificate_url: certInput || null })
      });
      if (res.ok) {
        const data = await res.json();
        setEvent(data[0]);
        setShowCertModal(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        alert("Gagal menyimpan sertifikat.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saat menyimpan sertifikat.");
    }
    setSavingCert(false);
  };

  /** Tandai kegiatan sebagai selesai (status → completed). */
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

  /** Batalkan mode edit dan kembalikan semua field ke nilai asli. */
  const handleCancel = () => {
    setIsEditing(false);
    setEditTitle(event.title);
    setEditDescription(event.description || "");
    setEditDate(event.date);
    setEditEndDate(event.end_date || "");
    setEditTimeStart(event.time_start || "");
    setEditTimeEnd(event.time_end || "");
    setEditLocation(event.location || "");
    setEditQuota(event.quota?.toString() || "");
    setEditCloseDate(event.registration_close_date || "");
    setEditCover(event.cover_url || "");
    setEditCategory(event.category || "");
    setCoverFile(null);
  };

  /** Handler upload cover image baru saat mode edit. */
  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setEditCover(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  /** Tambah sesi presensi baru (QR atau form) untuk kegiatan ini. */
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

  /** Hapus sesi presensi dari kegiatan ini. */
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

  /** Membuka modal daftar pendaftar dan memuat data (profil + jawaban pendaftaran) */
  const handleOpenRegistrantsModal = async () => {
    setShowRegistrantsModal(true);
    if (registrantsList.length > 0) return; // already loaded
    
    setLoadingRegistrants(true);
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const headers: Record<string, string> = { "apikey": key };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      // Fetch registrants
      const res = await fetch(`${url}/rest/v1/event_registrations?event_id=eq.${id}&select=user_id,status,registered_at,profiles:user_id(full_name,nim,email)`, { headers });
      if (res.ok) {
        const regs = await res.json();
        setRegistrantsList(regs.map((r: any) => ({
          id: r.user_id,
          name: r.profiles?.full_name || "Unknown",
          nim: r.profiles?.nim || null,
          email: r.profiles?.email || "Unknown",
          status: r.status
        })));
      }

      // Fetch registration form metadata & answers
      const formRes = await fetch(`${url}/rest/v1/forms?event_id=eq.${id}&form_type=eq.registration&select=id`, { headers });
      if (formRes.ok) {
        const forms = await formRes.json();
        if (forms.length > 0) {
          const formId = forms[0].id;
          // Fetch fields
          const fieldRes = await fetch(`${url}/rest/v1/form_fields?form_id=eq.${formId}&order=order_index.asc`, { headers });
          if (fieldRes.ok) {
            const fieldData = await fieldRes.json();
            setRegistrationFormFields(fieldData.map((f: any) => ({
              id: f.id, type: f.type, label: f.label, options: f.options, required: f.required
            })));
          }
          // Fetch sections
          const secRes = await fetch(`${url}/rest/v1/form_sections?form_id=eq.${formId}&order=order_index.asc`, { headers });
          if (secRes.ok) {
            const secData = await secRes.json();
            setRegistrationFormSections(secData.map((s: any) => ({ id: s.id, title: s.title, description: s.description })));
          }
          // Fetch answers
          const respRes = await fetch(`${url}/rest/v1/form_responses?form_id=eq.${formId}&select=user_id,answers`, { headers });
          if (respRes.ok) {
            const respData = await respRes.json();
            const ansMap: Record<string, Record<string, any>> = {};
            respData.forEach((r: any) => { ansMap[r.user_id] = r.answers || {}; });
            setRegistrationAnswersMap(ansMap);
          }
        }
      }
    } catch (err) {
      console.error("Fetch registrants error:", err);
    }
    setLoadingRegistrants(false);
  };

  /**
   * Export data pendaftar ke file CSV.
   * Mengambil data registrasi, profil, form fields, dan jawaban form.
   * Memetakan option ID ke label teks untuk field MC/checkbox/dropdown.
   */
  const handleExport = async () => {
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const headers: Record<string, string> = { "apikey": key };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      // 1. Fetch registrations with profiles + user_id for mapping
      const res = await fetch(
        `${url}/rest/v1/event_registrations?event_id=eq.${id}&select=user_id,status,registered_at,profiles:user_id(full_name,nim,email,fakultas,jurusan)`,
        { headers, signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) { console.error("Export fetch error:", res.status); return; }
      const data = await res.json();

      // 2. Fetch form fields for this event (registration form)
      let formFieldLabels: { id: string; label: string; type?: string; options?: any[] }[] = [];
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
            `${url}/rest/v1/form_fields?form_id=eq.${formId}&order=order_index.asc&select=id,label,type,options`,
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
      const csvHeaders = ["Nama", "NIM", "Email", "Kategori", "Fakultas", "Jurusan", "Tanggal Daftar"];
      formFieldLabels.forEach(f => csvHeaders.push(f.label));

      const csvRows = (data || []).map((r: any) => {
        const row = [
          r.profiles?.full_name || "Unknown",
          r.profiles?.nim || "-",
          r.profiles?.email || "-",
          r.profiles?.nim ? "Mahasiswa" : "Umum",
          r.profiles?.fakultas || "-",
          r.profiles?.jurusan || "-",
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

      const csv = [csvHeaders, ...csvRows].map((row) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
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

  /**
   * Export data pendaftar ke file PDF sederhana.
   * Hanya kolom: No, Nama, NIM, Email, Fakultas, Jurusan.
   */
  const handleExportPendaftarPDF = async () => {
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const headers: Record<string, string> = { "apikey": key };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      // 1. Ambil data pendaftar
      const res = await fetch(
        `${url}/rest/v1/event_registrations?event_id=eq.${id}&select=profiles:user_id(full_name,nim,email,fakultas,jurusan)`,
        { headers, signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) { console.error("Export fetch error"); return; }
      const data = await res.json();

      // 2. Ambil nama ormawa untuk pengesahan
      let ormawaName = "";
      if (profile?.ormawa_id) {
        const ormawaRes = await fetch(`${url}/rest/v1/ormawa?id=eq.${profile.ormawa_id}&select=name`, { headers });
        if (ormawaRes.ok) {
          const oData = await ormawaRes.json();
          if (oData.length > 0) ormawaName = oData[0].name;
        }
      }

      // 3. Sort data berdasarkan nama
      const sortedRegs = [...data].sort((a: any, b: any) => {
        const nameA = (a.profiles?.full_name || "").toLowerCase();
        const nameB = (b.profiles?.full_name || "").toLowerCase();
        return nameA.localeCompare(nameB, "id");
      });

      // 4. Generate PDF
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();

      // Judul
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("DAFTAR PENDAFTAR", pageWidth / 2, 20, { align: "center" });
      doc.text((event?.title || "").toUpperCase(), pageWidth / 2, 27, { align: "center" });

      // Info Kegiatan
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      let infoY = 36;
      const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const formatFullDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${dayNames[d.getDay()]}, ${d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;
      };
      
      let tanggalText = "-";
      if (event?.date) {
        tanggalText = formatFullDate(event.date);
        if (event.end_date && event.end_date !== event.date) tanggalText += ` - ${formatFullDate(event.end_date)}`;
      }
      
      const infoItems = [
        ["Tanggal Kegiatan", tanggalText],
        ["Nama Kegiatan", event?.title || "-"],
        ["Tempat", event?.location || "-"],
      ];

      infoItems.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.text(`${label}`, 14, infoY);
        doc.setFont("helvetica", "normal");
        doc.text(`: ${value}`, 50, infoY);
        infoY += 6;
      });

      // Tabel
      const tableHeaders = ["No", "Nama", "NIM", "Email", "Fakultas", "Jurusan"];
      const tableBody = sortedRegs.map((r: any, i: number) => {
        const p = r.profiles || {};
        return [
          String(i + 1),
          p.full_name || "-",
          p.nim || "-",
          p.email || "-",
          p.fakultas || "-",
          p.jurusan || "-",
        ];
      });

      autoTable(doc, {
        startY: infoY + 4,
        head: [tableHeaders],
        body: tableBody,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2, font: "helvetica" },
        headStyles: { fillColor: [255, 105, 0], textColor: 255, fontStyle: "bold", halign: "center" },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 50 },
          2: { cellWidth: 25, halign: "center" },
          3: { cellWidth: 40 },
          4: { cellWidth: 30 },
          5: { cellWidth: 30 },
        },
      });

      // Total pendaftar
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFont("helvetica", "bold");
      doc.text(`Total Pendaftar: ${sortedRegs.length} orang`, 14, finalY);

      // Footer & Pengesahan
      addPengesahanBlock(doc, ormawaName, false);
      addFooterTimestamp(doc, false);

      doc.save(`Daftar Pendaftar - ${event?.title || "Kegiatan"}.pdf`);
    } catch (err) {
      console.error("PDF Export error:", err);
      alert("Gagal mengekspor PDF.");
    }
  };


  /** Membuka modal rekap presensi dan memuat data kehadiran. */
  const handleOpenRekapModal = async () => {
    if (!event || sessions.length === 0) return;
    setShowRekapModal(true);
    if (rekapData.length > 0) return; // already loaded

    setLoadingRekap(true);
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const headers: Record<string, string> = { "apikey": key };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      const regRes = await fetch(
        `${url}/rest/v1/event_registrations?event_id=eq.${id}&select=user_id,profiles:user_id(full_name,nim,email)`,
        { headers, signal: AbortSignal.timeout(15000) }
      );
      if (regRes.ok) {
        const regData = await regRes.json();
        
        const sessionIds = sessions.map(s => s.id);
        const recRes = await fetch(
          `${url}/rest/v1/attendance_records?session_id=in.(${sessionIds.join(",")})&select=session_id,user_id`,
          { headers, signal: AbortSignal.timeout(15000) }
        );
        const recData = recRes.ok ? await recRes.json() : [];
        const attendanceSet = new Set<string>();
        recData.forEach((r: any) => attendanceSet.add(`${r.session_id}-${r.user_id}`));

        const sortedRegs = [...regData].sort((a: any, b: any) => {
          const nameA = (a.profiles?.full_name || "").toLowerCase();
          const nameB = (b.profiles?.full_name || "").toLowerCase();
          return nameA.localeCompare(nameB, "id");
        }).map(reg => {
          const p = reg.profiles || {};
          const attendance: Record<string, boolean> = {};
          sessions.forEach(s => {
            attendance[s.id] = attendanceSet.has(`${s.id}-${reg.user_id}`);
          });
          return {
            id: reg.user_id,
            name: p.full_name || "-",
            nim: p.nim || "-",
            email: p.email || "-",
            attendance
          };
        });
        setRekapData(sortedRegs);
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingRekap(false);
  };

  /**
   * Export rekap presensi semua sesi ke PDF (Daftar Hadir).
   * Layout: Judul → Info Kegiatan → Tabel (No, Nama, NIM, Email, Sesi1, Sesi2, ...)
   * Orientasi otomatis: portrait (≤4 sesi) / landscape (≥5 sesi).
   */
  const handleExportRekapPDF = async () => {
    if (!event || sessions.length === 0) return;
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const headers: Record<string, string> = { "apikey": key };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      // 1. Fetch pendaftar + profil
      const regRes = await fetch(
        `${url}/rest/v1/event_registrations?event_id=eq.${id}&select=user_id,profiles:user_id(full_name,nim,email)`,
        { headers, signal: AbortSignal.timeout(15000) }
      );
      if (!regRes.ok) { console.error("Fetch registrants failed"); return; }
      const regData = await regRes.json();

      // 2. Fetch attendance_records untuk semua sesi
      const sessionIds = sessions.map(s => s.id);
      const recRes = await fetch(
        `${url}/rest/v1/attendance_records?session_id=in.(${sessionIds.join(",")})&select=session_id,user_id`,
        { headers, signal: AbortSignal.timeout(15000) }
      );
      const recData = recRes.ok ? await recRes.json() : [];

      // Build set lookup: "sessionId-userId" → true
      const attendanceSet = new Set<string>();
      recData.forEach((r: any) => attendanceSet.add(`${r.session_id}-${r.user_id}`));

      // 3. Sort peserta berdasarkan nama (abjad A-Z)
      const sortedRegs = [...regData].sort((a: any, b: any) => {
        const nameA = (a.profiles?.full_name || "").toLowerCase();
        const nameB = (b.profiles?.full_name || "").toLowerCase();
        return nameA.localeCompare(nameB, "id");
      });

      // 4. Tentukan orientasi
      const isLandscape = sessions.length >= 5;
      const orientation = isLandscape ? "landscape" : "portrait";

      // 5. Generate PDF
      const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();

      // — Judul —
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      const titleLine1 = "DAFTAR HADIR";
      const titleLine2 = (event.title || "").toUpperCase();
      doc.text(titleLine1, pageWidth / 2, 20, { align: "center" });
      doc.text(titleLine2, pageWidth / 2, 27, { align: "center" });

      // — Info Kegiatan —
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      let infoY = 36;

      // Format tanggal dengan hari
      const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const formatFullDate = (dateStr: string) => {
        const d = new Date(dateStr);
        const day = dayNames[d.getDay()];
        return `${day}, ${d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;
      };

      let tanggalText = "-";
      if (event.date) {
        tanggalText = formatFullDate(event.date);
        if (event.end_date && event.end_date !== event.date) {
          tanggalText += ` - ${formatFullDate(event.end_date)}`;
        }
      }

      // Format waktu
      let waktuText = "-";
      if (event.time_start) {
        waktuText = formatTimeStringToAMPM(event.time_start);
        if (event.time_end) {
          waktuText += ` - ${formatTimeStringToAMPM(event.time_end)}`;
        }
      }

      const infoItems = [
        ["Tanggal Kegiatan", tanggalText],
        ["Nama Kegiatan", event.title || "-"],
        ["Waktu Kegiatan", waktuText],
        ["Tempat", event.location || "-"],
      ];

      infoItems.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.text(`${label}`, 14, infoY);
        doc.setFont("helvetica", "normal");
        doc.text(`: ${value}`, 55, infoY);
        infoY += 6;
      });

      // — Tabel —
      const tableHeaders = ["No", "Nama", "NIM", "Email", ...sessions.map(s => s.name)];

      const tableBody = sortedRegs.map((reg: any, idx: number) => {
        const p = reg.profiles || {};
        const row: string[] = [
          String(idx + 1),
          p.full_name || "-",
          p.nim || "-",
          p.email || "-",
        ];
        sessions.forEach(s => {
          const key = `${s.id}-${reg.user_id}`;
          row.push(attendanceSet.has(key) ? "Hadir" : "-");
        });
        return row;
      });

      autoTable(doc, {
        startY: infoY + 4,
        head: [tableHeaders],
        body: tableBody,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2, halign: "center", font: "helvetica" },
        headStyles: { fillColor: [255, 105, 0], textColor: 255, fontStyle: "bold", halign: "center" },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { halign: "left", cellWidth: isLandscape ? 45 : 40 },
          2: { halign: "center", cellWidth: isLandscape ? 25 : 22 },
          3: { halign: "left", cellWidth: isLandscape ? 50 : 42 },
        },
      });

      // Ambil nama ormawa untuk pengesahan
      let ormawaName = "";
      if (profile?.ormawa_id) {
        const ormawaRes = await fetch(`${url}/rest/v1/ormawa?id=eq.${profile.ormawa_id}&select=name`, { headers });
        if (ormawaRes.ok) {
          const oData = await ormawaRes.json();
          if (oData.length > 0) ormawaName = oData[0].name;
        }
      }

      // Footer & Pengesahan
      addPengesahanBlock(doc, ormawaName, isLandscape);
      addFooterTimestamp(doc, isLandscape);

      // Save
      const fileName = `Daftar Hadir - ${event.title || "Kegiatan"}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error("PDF export error:", err);
      alert("Gagal mengekspor PDF. Silakan coba lagi.");
    }
  };

  const inputClass = "w-full px-3 py-2 rounded-xl bg-input-background border border-[#ff6900]/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6900]/10 transition [color-scheme:light] dark:[color-scheme:dark]";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button onClick={() => navigate("/dashboard/kegiatan-kami")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm transition">
        <ArrowLeft className="w-4 h-4" /> Kembali ke Kegiatan Kami
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Cover */}
          <div className="relative rounded-2xl overflow-hidden aspect-video w-full md:aspect-auto md:h-72">
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

                  let text: string = event.status;
                  let bg = "bg-[#ff6900]/80 text-white";

                  const isClosed = event.registration_close_date && new Date(new Date().setHours(0, 0, 0, 0)) > new Date(event.registration_close_date);

                  if (isActuallyOngoing) {
                    text = "Berlangsung";
                    bg = "bg-emerald-500/80 text-white";
                  } else if (isClosed && event.status === "published") {
                    text = "Ditutup";
                    bg = "bg-red-500/80 text-white";
                  } else if (event.status === "published") {
                    text = "Dibuka";
                    bg = "bg-[#ff6900]/80 text-white";
                  } else if (event.status === "ongoing") {
                    text = "Berlangsung";
                    bg = "bg-emerald-500/80 text-white";
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
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/95 text-zinc-900 shadow-sm">{editCategory}</span>
                )}
                {isEditing ? (
                  <select value={editTargetAudience} onChange={(e) => setEditTargetAudience(e.target.value)} className="px-2.5 py-0.5 rounded-full text-[11px] bg-black/40 text-white backdrop-blur-md border border-white/20 focus:outline-none w-28">
                    <option value="semua" className="bg-black text-white">Umum & Mhs</option>
                    <option value="mahasiswa" className="bg-black text-white">Mahasiswa</option>
                  </select>
                ) : (
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold backdrop-blur-md border ${editTargetAudience === "mahasiswa"
                      ? "bg-blue-500/80 text-white border-blue-400/30"
                      : "bg-purple-500/80 text-white border-purple-400/30"
                    }`}>
                    {editTargetAudience === "mahasiswa" ? "Mahasiswa" : "Umum & Mahasiswa"}
                  </span>
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
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
                  <button onClick={() => navigate(`/dashboard/tambah-kegiatan?edit=${id}`)} className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 text-sm font-semibold hover:bg-blue-100 dark:hover:bg-blue-500/20 transition flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4" /> Edit Form & Pesan
                  </button>
                  <button onClick={() => setIsEditing(true)} className="px-4 py-2 rounded-xl bg-muted border border-border text-sm text-muted-foreground hover:text-foreground transition flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4" /> Edit Kegiatan
                  </button>
                </>
              ) : null}
              {!isEditing && (
                <button onClick={() => { setCertInput(event?.certificate_url || ""); setShowCertModal(true); }} className="px-4 py-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 text-sm font-semibold hover:bg-purple-100 dark:hover:bg-purple-500/20 transition flex items-center gap-1.5">
                  <Upload className="w-4 h-4" /> Sertifikat
                </button>
              )}
            </div>
            {saved && (
              <span className="flex items-center gap-1 text-xs text-emerald-500">
                <CheckCircle2 className="w-3.5 h-3.5" /> Perubahan tersimpan
              </span>
            )}
          </div>
          {/* Detail Kegiatan */}
          <GlassCard className="p-5">
            <h2 className="text-base font-bold text-foreground mb-4">Detail Kegiatan</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {editCategory !== "Oprec" && (
                <>
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
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10px] text-muted-foreground/60 mb-0.5">Mulai</p>
                            <input type="time" value={editTimeStart} onChange={(e) => setEditTimeStart(e.target.value)} className={inputClass} />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground/60 mb-0.5">Selesai</p>
                            <input type="time" value={editTimeEnd} onChange={(e) => setEditTimeEnd(e.target.value)} className={inputClass} />
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-foreground">{editTimeStart || editTimeEnd ? formatTimeStringToAMPM([editTimeStart, editTimeEnd].filter(Boolean).join(" - ")) : "-"}</p>
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
                        <p className="text-sm font-medium text-foreground">{editLocation || "—"}</p>
                      )}
                    </div>
                  </div>
                </>
              )}
              <div className="flex items-start gap-3">
                <Users className="w-4 h-4 text-[#ff6900] mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] text-muted-foreground mb-0.5">Kuota Peserta</p>
                  {isEditing ? (
                    <input type="number" value={editQuota} onChange={(e) => setEditQuota(e.target.value)} placeholder="Kosongkan jika tak terbatas" className={inputClass} />
                  ) : (
                    <p className="text-sm font-medium text-foreground">{event.quota ? `${registrantCount} / ${event.quota}` : "Tidak Terbatas"}</p>
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
                <ExpandableText text={editDescription} />
              )}
            </div>
          </GlassCard>

        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <GlassCard className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground">Ringkasan</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Status</span>
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

                  let text: string = event.status;
                  let bg = "bg-[#ff6900]/10 text-[#ff6900]";

                  const isClosed = event.registration_close_date && new Date(new Date().setHours(0, 0, 0, 0)) > new Date(event.registration_close_date);

                  if (isActuallyOngoing) {
                    text = "Berlangsung";
                    bg = "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
                  } else if (isClosed && event.status === "published") {
                    text = "Ditutup";
                    bg = "bg-red-50 dark:bg-red-500/10 text-red-500";
                  } else if (event.status === "published") {
                    text = "Dibuka";
                    bg = "bg-[#ff6900]/10 text-[#ff6900]";
                  } else if (event.status === "ongoing") {
                    text = "Berlangsung";
                    bg = "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
                  } else if (event.status === "completed") {
                    text = "Selesai";
                    bg = "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400";
                  }

                  return (
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${bg}`}>
                      {text}
                    </span>
                  );
                })()}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Pendaftar</span>
                <span className="text-sm font-semibold text-foreground">{registrantCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Kuota</span>
                <span className="text-sm font-semibold text-foreground">{event.quota || "Tak Terbatas"}</span>
              </div>
              {event.quota ? (
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#ff6900] to-[#ff8c3a]"
                    style={{ width: `${Math.min((registrantCount / event.quota) * 100, 100)}%` }} />
                </div>
              ) : null}
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Sesi Presensi</span>
                <span className="text-sm font-semibold text-foreground">{sessions.length}</span>
              </div>
            </div>
          </GlassCard>

          {/* Data Pendaftar - simplified */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#ff6900]/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-[#ff6900]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Pendaftar</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-semibold text-foreground">{registrantCount}</span> orang terdaftar
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleExport}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition flex items-center gap-1.5 shrink-0">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
                </button>
                <button onClick={handleExportPendaftarPDF}
                  className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-[11px] font-medium hover:bg-red-100 dark:hover:bg-red-500/20 transition flex items-center gap-1.5 shrink-0">
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <button onClick={handleOpenRegistrantsModal}
                className="w-full py-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-500/20 transition flex items-center justify-center gap-2">
                <Users className="w-4 h-4" /> Lihat Daftar Pendaftar
              </button>
            </div>
          </GlassCard>

          {/* Sesi Presensi */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-foreground">Sesi Presensi</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{sessions.length} sesi</p>
              </div>
              {event.status !== "completed" && (
                <button onClick={() => setShowPresensiModal(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#ff6900]/10 border border-[#ff6900]/20 text-[11px] text-[#ff6900] font-medium hover:bg-[#ff6900]/20 transition flex items-center gap-1">
                  <PlusCircle className="w-3.5 h-3.5" /> Tambah
                </button>
              )}
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs">
                <p>Belum ada sesi presensi.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {sessions.map((session, index) => (
                  <div
                    key={session.id}
                    className="flex flex-col gap-2 p-3 rounded-xl bg-muted/50 border border-border group cursor-pointer hover:border-[#ff6900]/20 transition"
                    onClick={() => navigate(`/dashboard/kegiatan-kami/${id}/presensi/${session.id}`, { state: { session } })}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <span className="w-6 h-6 rounded-md bg-[#ff6900]/10 flex items-center justify-center text-[#ff6900] text-[10px] font-bold shrink-0">{index + 1}</span>
                        <p className="text-sm font-medium text-foreground truncate">{session.name}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/kegiatan-kami/${id}/presensi/${session.id}`, { state: { session } }); }}
                          className="p-1 rounded-md text-muted-foreground hover:text-[#ff6900] hover:bg-[#ff6900]/10 transition">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleRemoveSession(session.id); }}
                          className="p-1 rounded-md text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition border border-red-200 dark:border-red-500/20">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between ml-8.5 pl-1 border-t border-border/50 pt-2">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        {session.method === "qr" ? <QrCode className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                        <span className="text-[10px]">{session.method === "qr" ? "QR Code" : "Custom Form"}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider ${session.isOpen ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-red-100 dark:bg-red-500/15 text-red-500"}`}>
                        {session.isOpen ? "Dibuka" : "Ditutup"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Tombol Rekap Presensi — di bawah card sesi */}
          {sessions.length > 0 && (
            <div className="space-y-3 mt-4">
              <button
                onClick={handleOpenRekapModal}
                className="w-full py-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold text-sm hover:bg-blue-100 dark:hover:bg-blue-500/20 transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Users className="w-4 h-4" /> Lihat Rekap Presensi
              </button>
              <button
                onClick={handleExportRekapPDF}
                className="w-full py-2.5 rounded-xl border border-[#ff6900]/30 bg-[#ff6900]/5 text-[#ff6900] text-sm font-semibold hover:bg-[#ff6900]/10 transition flex items-center justify-center gap-2 shadow-sm"
              >
                <FileDown className="w-4 h-4" /> Rekap Presensi PDF
              </button>
            </div>
          )}
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

      {/* Certificate Modal */}
      {showCertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-md p-6 bg-card border border-border">
            <h2 className="text-lg font-bold text-foreground mb-1">Upload Sertifikat</h2>
            <p className="text-xs text-muted-foreground mb-5">Masukan link drive sertifikat untuk peserta</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Link Google Drive</label>
                <input
                  type="url"
                  value={certInput}
                  onChange={(e) => setCertInput(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none transition placeholder:text-muted-foreground/40"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCertModal(false)} className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-muted transition font-medium">Batal</button>
              <button onClick={handleSaveCert} disabled={savingCert} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-2">
                {savingCert ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan"}
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Registrants Modal */}
      {showRegistrantsModal && !viewingAnswers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-2xl max-h-[80vh] flex flex-col bg-card border border-border">
            <div className="p-5 border-b border-border shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Daftar Pendaftar — {event?.title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {registrantsList.length} orang terdaftar
                  </p>
                </div>
                <button onClick={() => setShowRegistrantsModal(false)} className="p-2 rounded-lg hover:bg-muted transition">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loadingRegistrants ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#ff6900]" />
                </div>
              ) : registrantsList.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground text-sm">Belum ada pendaftar</p>
              ) : (
                <div className="space-y-2">
                  {registrantsList.map((reg) => (
                    <div key={reg.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ff6900]/20 to-[#ff8c3a]/10 flex items-center justify-center text-[#ff6900] text-xs font-bold shrink-0">
                          {reg.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{reg.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-muted-foreground truncate">{reg.email}</span>
                            {reg.nim ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">{reg.nim}</span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">Umum</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setViewingAnswers(reg.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition">
                          <FileText className="w-3.5 h-3.5" /> Lihat Form
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border shrink-0 flex justify-end gap-3">
              <button onClick={() => setShowRegistrantsModal(false)} className="px-4 py-2 rounded-xl bg-muted border border-border text-sm text-muted-foreground hover:text-foreground transition">
                Tutup
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* View Answers Modal */}
      {viewingAnswers && (() => {
        const viewingReg = registrantsList.find(r => r.id === viewingAnswers);
        if (!viewingReg) return null;

        const regAnswers = registrationAnswersMap[viewingAnswers] || {};

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-lg max-h-[80vh] flex flex-col bg-card border border-border">
            <div className="p-5 border-b border-border shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff6900]/20 to-[#ff8c3a]/10 flex items-center justify-center text-[#ff6900] text-sm font-bold">
                    {viewingReg.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">{viewingReg.name}</h2>
                    <p className="text-xs text-muted-foreground">{viewingReg.email}</p>
                  </div>
                </div>
                <button onClick={() => setViewingAnswers(null)} className="p-2 rounded-lg hover:bg-muted transition">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loadingRegistrants ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#ff6900]" />
                </div>
              ) : Object.keys(regAnswers).length === 0 && registrationFormFields.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data jawaban form pendaftaran</p>
              ) : (
                <FormRenderer
                  fields={registrationFormFields}
                  sections={registrationFormSections}
                  values={regAnswers}
                  onChange={() => {}}
                  readOnly={true}
                />
              )}
            </div>

            <div className="p-4 border-t border-border shrink-0 flex justify-end">
              <button onClick={() => setViewingAnswers(null)} className="px-4 py-2 rounded-xl bg-muted border border-border text-sm text-muted-foreground hover:text-foreground transition">
                Tutup
              </button>
            </div>
          </GlassCard>
        </div>
        );
      })()}

      {/* Rekap Presensi Modal */}
      {showRekapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-5xl max-h-[85vh] flex flex-col bg-card border border-border">
            <div className="p-5 border-b border-border shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Rekap Presensi — {event?.title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {rekapData.length} peserta terdaftar
                  </p>
                </div>
                <button onClick={() => setShowRekapModal(false)} className="p-2 rounded-lg hover:bg-muted transition">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-5 relative">
              {loadingRekap ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#ff6900]" />
                </div>
              ) : rekapData.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground text-sm">Belum ada data pendaftar</p>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-muted text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium whitespace-nowrap">No</th>
                        <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[200px]">Nama</th>
                        {sessions.map((s, i) => (
                          <th key={s.id} className="px-4 py-3 font-medium whitespace-nowrap text-center">
                            Sesi {i + 1}
                            <div className="text-[9px] font-normal mt-0.5 max-w-[80px] truncate">{s.name}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-border">
                      {rekapData.map((reg, idx) => (
                        <tr key={reg.id} className="hover:bg-muted/50 transition">
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{reg.name}</p>
                            <p className="text-xs text-muted-foreground">{reg.nim !== "-" ? reg.nim : "Umum"}</p>
                          </td>
                          {sessions.map(s => (
                            <td key={s.id} className="px-4 py-3 text-center whitespace-nowrap">
                              {reg.attendance[s.id] ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Hadir
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-muted-foreground/50">
                                  -
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border shrink-0 flex justify-end gap-3">
              <button onClick={() => setShowRekapModal(false)} className="px-4 py-2 rounded-xl bg-muted border border-border text-sm text-muted-foreground hover:text-foreground transition">
                Tutup
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}