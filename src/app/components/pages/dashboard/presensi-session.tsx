import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { QRCodeSVG } from "qrcode.react";
import { GlassCard } from "../../glass-card";
import { useAuth } from "../../auth-context";
import {
  ArrowLeft, QrCode, FileText, Clock, Users, Download,
  X, CheckCircle2, XCircle, ToggleLeft, Eye, EyeOff, Loader2, Save
} from "lucide-react";
import { FormBuilder } from "../../form-builder/FormBuilder";
import { FormRenderer } from "../../form-builder/FormRenderer";
import type { FormField, FormSection } from "../../form-builder/types";

interface Attendee {
  id: string; // user_id
  name: string;
  nim: string | null;
  email: string;
  hadir: boolean;
}

export function PresensiSession() {
  const { id, sessionId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [sessionName, setSessionName] = useState("");
  const [sessionMethod, setSessionMethod] = useState<"qr" | "form">("qr");
  const [isOpen, setIsOpen] = useState(false);
  const [qrToken, setQrToken] = useState("");

  const [useAutoSchedule, setUseAutoSchedule] = useState(false);
  const [autoOpenDate, setAutoOpenDate] = useState("");
  const [autoOpenTime, setAutoOpenTime] = useState("");
  const [autoCloseDate, setAutoCloseDate] = useState("");
  const [autoCloseTime, setAutoCloseTime] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);

  // Form builder state (for custom form method)
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formSections, setFormSections] = useState<FormSection[]>([]);
  const [quizMode, setQuizMode] = useState(false);
  const [branchingEnabled, setBranchingEnabled] = useState(false);
  const [formId, setFormId] = useState<string | null>(null);
  const [savingForm, setSavingForm] = useState(false);
  const [formSaved, setFormSaved] = useState(false);

  // Attendee list
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [viewingAnswers, setViewingAnswers] = useState<string | null>(null);
  const [answersMap, setAnswersMap] = useState<Record<string, Record<string, any>>>({});
  const [loadingAnswers, setLoadingAnswers] = useState(false);

  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  // Fetch answers when viewingAnswers changes
  useEffect(() => {
    if (!viewingAnswers || answersMap[viewingAnswers] || !formId || loadingAnswers) return;
    setLoadingAnswers(true);
    const fetchHeaders: Record<string, string> = { "apikey": key };
    if (session?.access_token) fetchHeaders["Authorization"] = `Bearer ${session.access_token}`;
    fetch(`${url}/rest/v1/form_responses?form_id=eq.${formId}&user_id=eq.${viewingAnswers}&select=answers`, { headers: fetchHeaders })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const ans = data.length > 0 ? (data[0].answers || {}) : {};
        setAnswersMap(prev => ({ ...prev, [viewingAnswers]: ans }));
        setLoadingAnswers(false);
      })
      .catch(() => setLoadingAnswers(false));
  }, [viewingAnswers, formId]);


  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const headers: Record<string, string> = { "apikey": key };
        if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

        // 1. Fetch Session Detail
        const sessRes = await fetch(`${url}/rest/v1/attendance_sessions?id=eq.${sessionId}`, { headers, signal: AbortSignal.timeout(15000) });
        if (sessRes.ok) {
          const sessData = await sessRes.json();
          if (sessData.length > 0) {
            const s = sessData[0];
            setSessionName(s.name);
            setSessionMethod(s.method);
            setIsOpen(s.is_open);
            setQrToken(s.qr_token);
            // Load auto schedule
            if (s.auto_open_at || s.auto_close_at) {
              setUseAutoSchedule(true);
              if (s.auto_open_at) {
                const d = new Date(s.auto_open_at);
                const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                const localTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                setAutoOpenDate(localDate);
                setAutoOpenTime(localTime);
              }
              if (s.auto_close_at) {
                const d = new Date(s.auto_close_at);
                const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                const localTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                setAutoCloseDate(localDate);
                setAutoCloseTime(localTime);
              }
            }

            // Load form if form_id exists
            if (s.form_id) {
              setFormId(s.form_id);
              // Fetch form metadata
              const formMetaRes = await fetch(`${url}/rest/v1/forms?id=eq.${s.form_id}`, { headers, signal: AbortSignal.timeout(15000) });
              if (formMetaRes.ok) {
                const formMeta = await formMetaRes.json();
                if (formMeta.length > 0) {
                  setQuizMode(formMeta[0].quiz_mode || false);
                  setBranchingEnabled(formMeta[0].branching_enabled || false);
                }
              }
              // Fetch sections
              const secRes = await fetch(`${url}/rest/v1/form_sections?form_id=eq.${s.form_id}&order=order_index.asc`, { headers, signal: AbortSignal.timeout(15000) });
              const secData = secRes.ok ? await secRes.json() : [];
              const mappedSections: FormSection[] = secData.map((sec: any) => ({
                id: sec.id,
                title: sec.title,
                description: sec.description || "",
                goToSection: sec.go_to_section || undefined,
              }));
              setFormSections(mappedSections);
              // Fetch fields
              const fieldRes = await fetch(`${url}/rest/v1/form_fields?form_id=eq.${s.form_id}&order=order_index.asc`, { headers, signal: AbortSignal.timeout(15000) });
              const fieldData = fieldRes.ok ? await fieldRes.json() : [];
              const mappedFields: FormField[] = fieldData.map((f: any) => ({
                id: f.id,
                type: f.type,
                label: f.label,
                description: f.description || undefined,
                required: f.required || false,
                sectionId: f.section_id || undefined,
                autofillTag: f.autofill_tag || undefined,
                options: f.options || undefined,
                scaleMin: f.scale_config?.min,
                scaleMax: f.scale_config?.max,
                scaleMinLabel: f.scale_config?.minLabel,
                scaleMaxLabel: f.scale_config?.maxLabel,
                fileTypes: f.file_config?.types,
                validation: f.validation || undefined,
                correctAnswer: f.correct_answer || undefined,
                points: f.points ?? undefined,
              }));
              setFormFields(mappedFields);
            }
          }
        }

        // 2. Fetch all registered users for this event
        const regRes = await fetch(`${url}/rest/v1/event_registrations?event_id=eq.${id}&select=user_id,profiles:user_id(full_name,nim,email)`, { headers, signal: AbortSignal.timeout(15000) });
        const regs = regRes.ok ? await regRes.json() : [];

        // 3. Fetch attendance records for this session
        const recRes = await fetch(`${url}/rest/v1/attendance_records?session_id=eq.${sessionId}&select=user_id`, { headers, signal: AbortSignal.timeout(15000) });
        const recs = recRes.ok ? await recRes.json() : [];
        const attendedUserIds = new Set(recs.map((r: any) => r.user_id));

        const mappedAttendees: Attendee[] = regs.map((r: any) => ({
          id: r.user_id,
          name: r.profiles?.full_name || "Unknown",
          nim: r.profiles?.nim || null,
          email: r.profiles?.email || "Unknown",
          hadir: attendedUserIds.has(r.user_id)
        }));
        setAttendees(mappedAttendees);
      } catch (err) {
        console.error("Fetch presensi error:", err);
      }
      setLoading(false);
    }
    if (sessionId) fetchData();
  }, [sessionId, id, session?.access_token, url, key]);

  // Auto open/close timer — determine desired state, only act if different
  useEffect(() => {
    if (!useAutoSchedule) return;
    const interval = setInterval(() => {
      const now = new Date();
      const openAt = (autoOpenDate && autoOpenTime) ? new Date(`${autoOpenDate}T${autoOpenTime}`) : null;
      const closeAt = (autoCloseDate && autoCloseTime) ? new Date(`${autoCloseDate}T${autoCloseTime}`) : null;

      // Determine what state SHOULD be
      let shouldBeOpen: boolean | null = null; // null = no opinion
      if (openAt && closeAt) {
        // Both set: open if between open and close time
        shouldBeOpen = now >= openAt && now < closeAt;
      } else if (openAt && !closeAt) {
        // Only open set: open after openAt
        shouldBeOpen = now >= openAt;
      } else if (!openAt && closeAt) {
        // Only close set: close after closeAt
        if (now >= closeAt) shouldBeOpen = false;
      }

      // Only toggle if state needs change
      if (shouldBeOpen !== null && shouldBeOpen !== isOpen) {
        handleToggleOpen();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [useAutoSchedule, autoOpenDate, autoOpenTime, autoCloseDate, autoCloseTime, isOpen]);

  const handleSaveSchedule = async () => {
    if (!session?.access_token) return;
    setSavingSchedule(true);
    setScheduleSaved(false);
    try {
      const autoOpenAt = autoOpenDate && autoOpenTime ? new Date(`${autoOpenDate}T${autoOpenTime}`).toISOString() : null;
      const autoCloseAt = autoCloseDate && autoCloseTime ? new Date(`${autoCloseDate}T${autoCloseTime}`).toISOString() : null;
      await fetch(`${url}/rest/v1/attendance_sessions?id=eq.${sessionId}`, {
        method: "PATCH",
        headers: {
          "apikey": key,
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          auto_open_at: useAutoSchedule ? autoOpenAt : null,
          auto_close_at: useAutoSchedule ? autoCloseAt : null
        }),
      });
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 3000);
    } catch (err) {
      console.error("Save schedule error:", err);
    }
    setSavingSchedule(false);
  };

  const qrValue = qrToken;

  // Save form to DB
  const handleSaveForm = async () => {
    if (!session?.access_token) return;
    setSavingForm(true);
    setFormSaved(false);
    try {
      const authHeaders = {
        "apikey": key,
        "Authorization": `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      };

      let currentFormId = formId;

      // 1. Create or get form
      if (!currentFormId) {
        const formRes = await fetch(`${url}/rest/v1/forms`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            event_id: id,
            form_type: "attendance",
            quiz_mode: quizMode,
            branching_enabled: branchingEnabled,
          }),
        });
        if (!formRes.ok) throw new Error("Failed to create form");
        const formData = await formRes.json();
        currentFormId = formData[0].id;
        setFormId(currentFormId);

        // Link form to session
        await fetch(`${url}/rest/v1/attendance_sessions?id=eq.${sessionId}`, {
          method: "PATCH",
          headers: { ...authHeaders, "Prefer": "return=minimal" },
          body: JSON.stringify({ form_id: currentFormId }),
        });
      } else {
        // Update form metadata
        await fetch(`${url}/rest/v1/forms?id=eq.${currentFormId}`, {
          method: "PATCH",
          headers: { ...authHeaders, "Prefer": "return=minimal" },
          body: JSON.stringify({
            quiz_mode: quizMode,
            branching_enabled: branchingEnabled,
          }),
        });
      }

      // 2. Delete old sections + fields (cascade via form_id)
      await fetch(`${url}/rest/v1/form_fields?form_id=eq.${currentFormId}`, {
        method: "DELETE",
        headers: { "apikey": key, "Authorization": `Bearer ${session.access_token}` },
      });
      await fetch(`${url}/rest/v1/form_sections?form_id=eq.${currentFormId}`, {
        method: "DELETE",
        headers: { "apikey": key, "Authorization": `Bearer ${session.access_token}` },
      });

      // 3. Insert sections
      const sectionIdMap: Record<string, string> = {};
      for (let i = 0; i < formSections.length; i++) {
        const sec = formSections[i];
        const secRes = await fetch(`${url}/rest/v1/form_sections`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            form_id: currentFormId,
            title: sec.title,
            description: sec.description || null,
            order_index: i,
          }),
        });
        if (secRes.ok) {
          const secData = await secRes.json();
          sectionIdMap[sec.id] = secData[0].id;
        }
      }

      // 3b. Update goToSection with remapped IDs
      for (const sec of formSections) {
        if (sec.goToSection) {
          const dbSecId = sectionIdMap[sec.id];
          const remappedGoTo = sec.goToSection === "__end__"
            ? "__end__"
            : sectionIdMap[sec.goToSection] || sec.goToSection;
          await fetch(`${url}/rest/v1/form_sections?id=eq.${dbSecId}`, {
            method: "PATCH",
            headers: { ...authHeaders, "Prefer": "return=minimal" },
            body: JSON.stringify({ go_to_section: remappedGoTo }),
          });
        }
      }

      // 4. Insert fields
      for (let i = 0; i < formFields.length; i++) {
        const f = formFields[i];
        const dbSectionId = f.sectionId ? sectionIdMap[f.sectionId] || null : null;
        const scaleConfig = f.type === "linear_scale" ? {
          min: f.scaleMin ?? 1, max: f.scaleMax ?? 5,
          minLabel: f.scaleMinLabel || undefined,
          maxLabel: f.scaleMaxLabel || undefined,
        } : null;
        const fileConfig = f.type === "file" ? { types: f.fileTypes || ["image", "pdf"] } : null;
        const remappedOptions = f.options
          ? f.options.map(opt => ({
              ...opt,
              goToSection: opt.goToSection
                ? (opt.goToSection === "__end__" ? "__end__" : sectionIdMap[opt.goToSection] || opt.goToSection)
                : opt.goToSection,
            }))
          : null;

        await fetch(`${url}/rest/v1/form_fields`, {
          method: "POST",
          headers: { ...authHeaders, "Prefer": "return=minimal" },
          body: JSON.stringify({
            form_id: currentFormId,
            section_id: dbSectionId,
            type: f.type,
            label: f.label,
            description: f.description || null,
            required: f.required,
            autofill_tag: f.autofillTag || null,
            order_index: i,
            options: remappedOptions,
            scale_config: scaleConfig,
            file_config: fileConfig,
            validation: f.validation || null,
            correct_answer: f.correctAnswer || null,
            points: f.points ?? null,
          }),
        });
      }

      setFormSaved(true);
      setTimeout(() => setFormSaved(false), 3000);
    } catch (err) {
      console.error("Save form error:", err);
    }
    setSavingForm(false);
  };

  const attendanceCount = attendees.filter((a) => a.hadir).length;
  const totalRegistrants = attendees.length;

  const handleToggleOpen = async () => {
    if (!session?.access_token) return;
    const newStatus = !isOpen;
    setIsOpen(newStatus); // optimistic update
    try {
      await fetch(`${url}/rest/v1/attendance_sessions?id=eq.${sessionId}`, {
        method: "PATCH",
        headers: {
          "apikey": key,
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({ is_open: newStatus }),
        signal: AbortSignal.timeout(15000)
      });
    } catch (err) {
      console.error("Toggle session error:", err);
      setIsOpen(!newStatus); // revert
    }
  };

  const handleToggleAttendance = async (attendeeId: string) => {
    if (sessionMethod !== "qr" || !session?.access_token) return;
    
    const attendee = attendees.find(a => a.id === attendeeId);
    if (!attendee) return;
    const isNowHadir = !attendee.hadir;

    // Optimistic UI update
    setAttendees(attendees.map((a) => (a.id === attendeeId ? { ...a, hadir: isNowHadir } : a)));

    try {
      const headers = {
        "apikey": key,
        "Authorization": `Bearer ${session.access_token}`,
        "Content-Type": "application/json"
      };

      if (isNowHadir) {
        await fetch(`${url}/rest/v1/attendance_records`, {
          method: "POST",
          headers: { ...headers, "Prefer": "return=minimal" },
          body: JSON.stringify({
            session_id: sessionId,
            user_id: attendeeId,
            method: "manual"
          })
        });
      } else {
        await fetch(`${url}/rest/v1/attendance_records?session_id=eq.${sessionId}&user_id=eq.${attendeeId}`, {
          method: "DELETE",
          headers
        });
      }
    } catch (err) {
      console.error("Toggle attendance error:", err);
      // Revert on error
      setAttendees(attendees.map((a) => (a.id === attendeeId ? { ...a, hadir: !isNowHadir } : a)));
    }
  };

  const handleExportPresensi = async () => {
    // Base columns
    const csvHeaders = ["Nama", "NIM", "Email", "Kategori", "Status Presensi"];
    if (quizMode && sessionMethod === "form") csvHeaders.push("Skor");

    // If form method, add form field labels as extra columns + fetch answers
    let formAnswersMap: Record<string, Record<string, any>> = {};
    if (sessionMethod === "form" && formId && formFields.length > 0) {
      formFields.forEach(f => csvHeaders.push(f.label));
      try {
        const headers: Record<string, string> = { "apikey": key };
        if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
        const respRes = await fetch(`${url}/rest/v1/form_responses?form_id=eq.${formId}&select=user_id,answers`, { headers, signal: AbortSignal.timeout(15000) });
        if (respRes.ok) {
          const respData = await respRes.json();
          respData.forEach((r: any) => { formAnswersMap[r.user_id] = r.answers || {}; });
        }
      } catch (err) { console.error("Fetch form responses error:", err); }
    }

    // Build option ID→label map per field
    const optionMaps: Record<string, Record<string, string>> = {};
    formFields.forEach(f => {
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
        return val.map(v => oMap?.[v] || String(v)).join(", ");
      }
      if (oMap && oMap[val]) return oMap[val];
      return String(val).replace(/,/g, ";");
    };

    const rows = attendees.map((a) => {
      const baseRow: any[] = [a.name, a.nim || "-", a.email, a.nim ? "Mahasiswa" : "Umum", a.hadir ? "Hadir" : "Tidak Hadir"];
      
      const answers = formAnswersMap[a.id] || {};

      if (quizMode && sessionMethod === "form") {
        let score = 0;
        formFields.forEach(f => {
          if (f.correctAnswer != null && f.points) {
            const correct = Array.isArray(f.correctAnswer) ? f.correctAnswer : [f.correctAnswer];
            const rawAns = answers[f.id];
            const ans = Array.isArray(rawAns) ? rawAns : rawAns != null ? [rawAns] : [];
            
            if (correct.length > 0 && ans.length === correct.length && correct.every((c: any) => ans.includes(c))) {
              score += f.points;
            }
          }
        });
        baseRow.push(score.toString());
      }

      if (sessionMethod === "form" && formFields.length > 0) {
        formFields.forEach(f => {
          baseRow.push(resolveAnswer(f.id, answers[f.id]));
        });
      }
      return baseRow;
    });

    const csv = [csvHeaders, ...rows].map((row) => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const urlBlob = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = urlBlob;
    a.download = `presensi-${sessionName.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(urlBlob);
  };

  const inputClass = "w-full px-3 py-2 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none transition";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff6900]" />
        <p className="text-sm">Memuat sesi presensi...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => navigate(`/dashboard/kegiatan-kami/${id}`)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm transition">
        <ArrowLeft className="w-4 h-4" /> Kembali ke Detail Kegiatan
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ff6900]/10 flex items-center justify-center">
            {sessionMethod === "qr" ? <QrCode className="w-5 h-5 text-[#ff6900]" /> : <FileText className="w-5 h-5 text-[#ff6900]" />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{sessionName}</h1>
            <p className="text-xs text-muted-foreground">{sessionMethod === "qr" ? "Presensi QR Code" : "Presensi Custom Form"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowAttendeeModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border hover:border-[#ff6900]/30 hover:bg-[#ff6900]/5 transition cursor-pointer group">
            <Users className="w-3.5 h-3.5 text-muted-foreground group-hover:text-[#ff6900] transition" />
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition">
              <span className="font-semibold text-foreground">{attendanceCount}</span> / {totalRegistrants} hadir
            </span>
          </button>
          <button onClick={handleExportPresensi}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Controls */}
        <GlassCard className="p-5">
          <h2 className="text-base font-bold text-foreground mb-4">Kontrol Presensi</h2>
          <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/50">
            <div>
              <p className="text-sm font-medium text-foreground">Status Presensi</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isOpen ? "Peserta bisa melakukan presensi sekarang" : "Presensi saat ini ditutup"}
              </p>
            </div>
            <button onClick={handleToggleOpen}
              className={`relative w-14 h-7 rounded-full transition-all duration-300 ${isOpen ? "bg-emerald-500" : "bg-muted-foreground/30"}`}>
              <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${isOpen ? "left-7.5" : "left-0.5"}`} />
            </button>
          </div>
          <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${isOpen ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-50 dark:bg-red-500/10 text-red-500"}`}>
            <div className={`w-2 h-2 rounded-full ${isOpen ? "bg-emerald-500 animate-pulse" : "bg-red-400"}`} />
            {isOpen ? "Presensi DIBUKA" : "Presensi DITUTUP"}
          </div>
        </GlassCard>

        {/* Right: Schedule */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Jadwal Otomatis</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Buka dan tutup presensi secara otomatis</p>
            </div>
            <button onClick={() => setUseAutoSchedule(!useAutoSchedule)}
              className={`relative w-12 h-6 rounded-full transition-all duration-300 ${useAutoSchedule ? "bg-[#ff6900]" : "bg-muted-foreground/30"}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${useAutoSchedule ? "left-6" : "left-0.5"}`} />
            </button>
          </div>
          {useAutoSchedule && (
            <>
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5">
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Waktu Dibuka</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[10px] text-muted-foreground mb-1 block">Tanggal</label><input type="date" value={autoOpenDate} onChange={(e) => setAutoOpenDate(e.target.value)} className={inputClass} /></div>
                    <div><label className="text-[10px] text-muted-foreground mb-1 block">Jam</label><input type="time" value={autoOpenTime} onChange={(e) => setAutoOpenTime(e.target.value)} className={inputClass} /></div>
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5">
                  <p className="text-xs font-semibold text-red-500 mb-3 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Waktu Ditutup</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[10px] text-muted-foreground mb-1 block">Tanggal</label><input type="date" value={autoCloseDate} onChange={(e) => setAutoCloseDate(e.target.value)} className={inputClass} /></div>
                    <div><label className="text-[10px] text-muted-foreground mb-1 block">Jam</label><input type="time" value={autoCloseTime} onChange={(e) => setAutoCloseTime(e.target.value)} className={inputClass} /></div>
                  </div>
                </div>
              </div>
              <button
                onClick={handleSaveSchedule}
                disabled={savingSchedule}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white text-sm font-semibold hover:opacity-90 transition shadow-md shadow-[#ff6900]/20 disabled:opacity-50"
              >
                {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {savingSchedule ? "Menyimpan..." : scheduleSaved ? "✓ Tersimpan" : "Simpan Jadwal"}
              </button>
            </>
          )}
          {!useAutoSchedule && (autoOpenDate || autoCloseDate) && (
            <button
              onClick={() => { setAutoOpenDate(""); setAutoOpenTime(""); setAutoCloseDate(""); setAutoCloseTime(""); handleSaveSchedule(); }}
              className="mt-3 w-full py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition"
            >
              Hapus Jadwal Tersimpan
            </button>
          )}
        </GlassCard>
      </div>

      {/* Full-width: QR Display or Form Builder */}
      <div className="mt-6 space-y-6">
        {sessionMethod === "qr" ? (
          <GlassCard className="p-5">
            <h2 className="text-base font-bold text-foreground mb-4">QR Code Presensi</h2>
            <p className="text-xs text-muted-foreground mb-4">Tampilkan QR ini kepada peserta untuk di-scan melalui halaman kegiatan mereka.</p>
            <div className={`flex flex-col items-center p-6 rounded-xl border-2 border-dashed transition ${isOpen ? "border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-500/5" : "border-border bg-muted/30"}`}>
              <div className={`p-4 rounded-2xl bg-white shadow-lg ${!isOpen ? "opacity-40 grayscale" : ""}`}>
                <QRCodeSVG value={qrValue} size={200} bgColor="#ffffff" fgColor="#1a1a1a" level="H" includeMargin={false} />
              </div>
              <p className={`text-xs mt-3 font-medium ${isOpen ? "text-emerald-600 dark:text-emerald-400" : "text-red-400"}`}>
                {isOpen ? "QR aktif — peserta bisa scan sekarang" : "QR tidak aktif — presensi ditutup"}
              </p>
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="p-5">
            <div className="mb-4">
              <h2 className="text-base font-bold text-foreground">Form Presensi</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Atur pertanyaan yang harus dijawab peserta</p>
            </div>
            <FormBuilder
              fields={formFields}
              sections={formSections}
              quizMode={quizMode}
              branchingEnabled={branchingEnabled}
              onFieldsChange={setFormFields}
              onSectionsChange={setFormSections}
              onQuizModeChange={setQuizMode}
              onBranchingChange={setBranchingEnabled}
              showAutofillTags={false}
            />
            <button
              onClick={handleSaveForm}
              disabled={savingForm}
              className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white text-sm font-semibold hover:opacity-90 transition shadow-md shadow-[#ff6900]/20 disabled:opacity-50"
            >
              {savingForm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingForm ? "Menyimpan Form..." : formSaved ? "✓ Form Tersimpan" : "Simpan Form"}
            </button>
          </GlassCard>
        )}

        <GlassCard className="p-4">
          <div className={`flex items-center gap-3 ${isOpen ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
            <div className={`w-3 h-3 rounded-full ${isOpen ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30"}`} />
            <div>
              <p className="text-sm font-medium">{isOpen ? "Presensi Aktif" : "Presensi Tidak Aktif"}</p>
              <p className="text-xs opacity-70 mt-0.5">
                {isOpen ? "Peserta bisa melakukan presensi dari halaman kegiatan mereka" : "Buka presensi untuk mulai menerima kehadiran"}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Attendee List Modal */}
      {showAttendeeModal && !viewingAnswers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-2xl max-h-[80vh] flex flex-col bg-card border border-border">
            <div className="p-5 border-b border-border shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Daftar Peserta — {sessionName}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {attendanceCount} dari {totalRegistrants} peserta hadir
                    {sessionMethod === "qr" && " • Klik status untuk mengubah kehadiran"}
                  </p>
                </div>
                <button onClick={() => setShowAttendeeModal(false)} className="p-2 rounded-lg hover:bg-muted transition">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{attendanceCount} Hadir</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-xs font-medium text-red-500">{totalRegistrants - attendanceCount} Tidak Hadir</span>
                </div>
                <div className="flex-1" />
                <div className="w-32 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                    style={{ width: `${totalRegistrants > 0 ? (attendanceCount / totalRegistrants) * 100 : 0}%` }} />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-2">
                {attendees.map((attendee) => (
                  <div key={attendee.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ff6900]/20 to-[#ff8c3a]/10 flex items-center justify-center text-[#ff6900] text-xs font-bold shrink-0">
                        {attendee.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{attendee.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground truncate">{attendee.email}</span>
                          {attendee.nim ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">{attendee.nim}</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">Umum</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">

                      {sessionMethod === "qr" ? (
                        <button onClick={() => handleToggleAttendance(attendee.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                            attendee.hadir
                              ? "bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100"
                              : "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-500 hover:bg-red-100"
                          }`} title="Klik untuk mengubah status">
                          {attendee.hadir ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {attendee.hadir ? "Hadir" : "Tidak Hadir"}
                          <ToggleLeft className="w-3 h-3 ml-1 opacity-50" />
                        </button>
                      ) : (
                        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                          attendee.hadir
                            ? "bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-500"
                        }`}>
                          {attendee.hadir ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {attendee.hadir ? "Hadir" : "Tidak Hadir"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-border shrink-0 flex justify-end gap-3">
              <button onClick={handleExportPresensi}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-100 transition">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
              <button onClick={() => setShowAttendeeModal(false)} className="px-4 py-2 rounded-xl bg-muted border border-border text-sm text-muted-foreground hover:text-foreground transition">
                Tutup
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* View Answers Modal */}
      {viewingAnswers && (() => {
        const viewingAttendee = attendees.find(a => a.id === viewingAnswers);
        if (!viewingAttendee) return null;

        const attendeeAnswers = answersMap[viewingAnswers] || {};

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-lg max-h-[80vh] flex flex-col bg-card border border-border">
            <div className="p-5 border-b border-border shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff6900]/20 to-[#ff8c3a]/10 flex items-center justify-center text-[#ff6900] text-sm font-bold">
                    {viewingAttendee.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">{viewingAttendee.name}</h2>
                    <p className="text-xs text-muted-foreground">{viewingAttendee.email}</p>
                  </div>
                </div>
                <button onClick={() => setViewingAnswers(null)} className="p-2 rounded-lg hover:bg-muted transition">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loadingAnswers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#ff6900]" />
                </div>
              ) : Object.keys(attendeeAnswers).length === 0 && formFields.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data jawaban</p>
              ) : (
                <FormRenderer
                  fields={formFields}
                  sections={formSections}
                  values={attendeeAnswers}
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
    </div>
  );
}
