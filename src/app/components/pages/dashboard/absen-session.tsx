import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { GlassCard } from "../../glass-card";
import { useAuth } from "../../auth-context";
import {
  ArrowLeft, ScanLine, Camera, CheckCircle2, XCircle, Send, Loader2,
  Save, AlertTriangle, Cloud, CloudOff
} from "lucide-react";
import { FormRenderer } from "../../form-builder/FormRenderer";
import type { FormField, FormSection } from "../../form-builder/types";
import jsQR from "jsqr";

type DraftStatus = "idle" | "saving" | "saved" | "error";

export function AbsenSession() {
  const { eventId, sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, profile } = useAuth();
  const sessionFromState = (location.state as any)?.session;

  const [eventName, setEventName] = useState("Memuat Kegiatan...");
  const [sessionName, setSessionName] = useState(sessionFromState?.name || `Sesi ${sessionId}`);
  const [sessionMethod, setSessionMethod] = useState<"qr" | "form">(sessionFromState?.method || "qr");
  const [qrToken, setQrToken] = useState("");
  const [loading, setLoading] = useState(true);

  // Form fields from DB
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formSections, setFormSections] = useState<FormSection[]>([]);
  const [branchingEnabled, setBranchingEnabled] = useState(false);
  const [formIdState, setFormIdState] = useState<string | null>(null);

  // Fetch event and session info
  useEffect(() => {
    async function fetchData() {
      try {
        const url = import.meta.env.VITE_SUPABASE_URL as string;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const headers: Record<string, string> = { "apikey": key };
        if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

        // Fetch event title
        const evtRes = await fetch(`${url}/rest/v1/events?id=eq.${eventId}&select=title`, { headers });
        if (evtRes.ok) {
          const evtData = await evtRes.json();
          if (evtData.length > 0) setEventName(evtData[0].title);
        }

        // Fetch session detail (including form_id)
        const sessRes = await fetch(`${url}/rest/v1/attendance_sessions?id=eq.${sessionId}&select=name,method,qr_token,form_id`, { headers });
        if (sessRes.ok) {
          const sessData = await sessRes.json();
          if (sessData.length > 0) {
            const s = sessData[0];
            setSessionName(s.name);
            setSessionMethod(s.method);
            setQrToken(s.qr_token);

            // Fetch form fields if form method and form_id exists
            if (s.method === "form" && s.form_id) {
              setFormIdState(s.form_id);

              // Fetch form metadata for branching
              const formMetaRes = await fetch(`${url}/rest/v1/forms?id=eq.${s.form_id}&select=branching_enabled`, { headers });
              if (formMetaRes.ok) {
                const formMeta = await formMetaRes.json();
                if (formMeta.length > 0) setBranchingEnabled(formMeta[0].branching_enabled || false);
              }

              // Fetch sections
              const secRes = await fetch(`${url}/rest/v1/form_sections?form_id=eq.${s.form_id}&order=order_index.asc`, { headers });
              const secData = secRes.ok ? await secRes.json() : [];
              setFormSections(secData.map((sec: any) => ({
                id: sec.id,
                title: sec.title,
                description: sec.description || "",
                goToSection: sec.go_to_section || undefined,
              })));

              // Fetch fields
              const fieldRes = await fetch(`${url}/rest/v1/form_fields?form_id=eq.${s.form_id}&order=order_index.asc`, { headers });
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
              }));
              setFormFields(mappedFields);

              // Initialize autofill values
              const initial: Record<string, any> = {};
              mappedFields.forEach((f: FormField) => {
                if (f.autofillTag === "nama") initial[f.id] = profile?.full_name || "";
                else if (f.autofillTag === "akun") initial[f.id] = profile?.email || "";
                else if (f.autofillTag === "nim") initial[f.id] = profile?.nim || "";
              });

              // Load draft from localStorage (overrides autofill)
              const draftKey = `draft-absen-${sessionId}-${profile?.email}`;
              const savedDraft = localStorage.getItem(draftKey);
              if (savedDraft) {
                try {
                  const parsed = JSON.parse(savedDraft);
                  Object.assign(initial, parsed);
                } catch {}
              }
              setFormValues(initial);
            }
          }
        }
      } catch (err) {
        console.error("Fetch info error:", err);
      }
      setLoading(false);
    }
    if (eventId && sessionId) fetchData();
  }, [eventId, sessionId, session?.access_token, profile?.full_name, profile?.email, profile?.nim]);

  // Re-apply autofill whenever profile becomes available and fields exist
  useEffect(() => {
    if (!profile || formFields.length === 0) return;
    const updates: Record<string, any> = {};
    formFields.forEach(f => {
      if (f.autofillTag === "nama" && profile.full_name) updates[f.id] = profile.full_name;
      else if (f.autofillTag === "akun" && profile.email) updates[f.id] = profile.email;
      else if (f.autofillTag === "nim" && profile.nim) updates[f.id] = profile.nim;
    });
    if (Object.keys(updates).length > 0) {
      setFormValues(prev => {
        // Only set if not already filled by user
        const merged = { ...prev };
        for (const [k, v] of Object.entries(updates)) {
          if (!merged[k] || merged[k] === "") merged[k] = v;
        }
        return merged;
      });
    }
  }, [profile, formFields]);

  // QR Scanner state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [scanResult, setScanResult] = useState<"success" | "error" | null>(null);
  const [scanning, setScanning] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);



  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [filesToUpload, setFilesToUpload] = useState<Record<string, File>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});

  // Draft auto-save state
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formValuesRef = useRef(formValues);
  formValuesRef.current = formValues;

  const saveDraftNow = useCallback((valuesToSave?: Record<string, any>) => {
    if (!profile?.email || !sessionId) return;
    const data = valuesToSave || formValuesRef.current;
    setDraftStatus("saving");
    localStorage.setItem(`draft-absen-${sessionId}-${profile.email}`, JSON.stringify(data));
    setTimeout(() => { setDraftStatus("saved"); setTimeout(() => setDraftStatus("idle"), 2000); }, 300);
  }, [sessionId, profile?.email]);

  const saveDraft = saveDraftNow;

  const handleFormChange = useCallback((fieldId: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => { saveDraftNow(); }, 1000);
  }, [saveDraftNow]);

  const handleFileUpload = useCallback(async (fieldId: string, file: File) => {
    if (!session?.user?.id) return;
    setFileNames((prev) => ({ ...prev, [fieldId]: file.name }));
    setUploadingFields((prev) => ({ ...prev, [fieldId]: true }));
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `draft-uploads/${session.user.id}/${fieldId}_${safeName}`;
      const arrayBuffer = await file.arrayBuffer();
      const upRes = await fetch(`${url}/storage/v1/object/form-uploads/${storagePath}`, {
        method: "POST",
        headers: { "apikey": key, "Authorization": `Bearer ${session.access_token}`, "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
        body: arrayBuffer,
      });
      if (upRes.ok) {
        const publicUrl = `${url}/storage/v1/object/public/form-uploads/${storagePath}`;
        setFormValues((prev) => {
          const updated = { ...prev, [fieldId]: publicUrl };
          // Save draft immediately with URL included
          saveDraftNow(updated);
          return updated;
        });
        setFilesToUpload((prev) => { const n = { ...prev }; delete n[fieldId]; return n; });
      } else {
        setFormValues((prev) => ({ ...prev, [fieldId]: file.name }));
        setFilesToUpload((prev) => ({ ...prev, [fieldId]: file }));
      }
    } catch {
      setFormValues((prev) => ({ ...prev, [fieldId]: file.name }));
      setFilesToUpload((prev) => ({ ...prev, [fieldId]: file }));
    }
    setUploadingFields((prev) => ({ ...prev, [fieldId]: false }));
  }, [session?.user?.id, session?.access_token, saveDraftNow]);

  useEffect(() => {
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, []);

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Kamera tidak didukung di browser ini (kemungkinan karena bukan HTTPS/localhost).");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCameraActive(true);
      setScanning(true);
    } catch (err: any) {
      console.warn("Gagal membuka kamera:", err);
      setCameraDenied(true);
    }
  };

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.setAttribute("playsinline", "true");
      videoRef.current.play().catch(e => console.error("Play error:", e));
    }
  }, [cameraActive]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
    setScanning(false);
  };

  const submitAttendance = async () => {
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetch(`${url}/rest/v1/attendance_records`, {
        method: "POST",
        headers: {
          "apikey": key,
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          session_id: sessionId,
          user_id: session?.user?.id,
          method: "qr_scan"
        }),
      });

      if (res.ok || res.status === 201) {
        setScanResult("success");
      } else {
        const errText = await res.text();
        if (errText.includes("duplicate") || res.status === 409) {
           setScanResult("success"); // already present
        } else {
           console.error("Scan error:", errText);
           setScanResult("error");
        }
      }
    } catch (err) {
      console.error("Scan error exception:", err);
      setScanResult("error");
    }
    setScanning(false);
    stopCamera();
  };

  useEffect(() => {
    if (!scanning || !session?.user?.id) return;
    
    let animationFrameId: number;

    const tick = () => {
      if (!videoRef.current || !canvasRef.current) return;
      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code && qrToken && code.data === qrToken) {
            submitAttendance();
            return; // stop ticking
          }
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrameId);
  }, [scanning, sessionId, session?.user?.id, session?.access_token, qrToken]);

  useEffect(() => { return () => stopCamera(); }, []);

  const handleSubmitForm = async () => {
    setSubmitting(true);
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      // 1. Insert attendance record
      const res = await fetch(`${url}/rest/v1/attendance_records`, {
        method: "POST",
        headers: {
          "apikey": key,
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          session_id: sessionId,
          user_id: session?.user?.id,
          method: "form_submit"
        }),
      });
      if (res.ok || res.status === 201) {
        const recData = await res.json();
        const recordId = recData?.[0]?.id;

        // 2. Upload files to Supabase Storage & replace filenames with public URLs
        if (formIdState && session?.user?.id) {
          const finalAnswers = { ...formValues };
          console.log("[Absen] Files to upload:", Object.keys(filesToUpload).length);
          for (const [fieldId, file] of Object.entries(filesToUpload)) {
            try {
              const timestamp = Date.now();
              const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
              const storagePath = `attendance/${sessionId}/${session.user.id}/${timestamp}_${safeName}`;
              console.log("[Absen] Uploading:", storagePath, "type:", file.type, "size:", file.size);

              // Read file as ArrayBuffer for reliable binary upload
              const arrayBuffer = await file.arrayBuffer();

              const uploadRes = await fetch(`${url}/storage/v1/object/form-uploads/${storagePath}`, {
                method: "POST",
                headers: {
                  "apikey": key,
                  "Authorization": `Bearer ${session.access_token}`,
                  "Content-Type": file.type || "application/octet-stream",
                  "x-upsert": "true",
                },
                body: arrayBuffer,
              });
              if (uploadRes.ok) {
                const publicUrl = `${url}/storage/v1/object/public/form-uploads/${storagePath}`;
                finalAnswers[fieldId] = publicUrl;
                console.log("[Absen] ✅ Upload OK:", publicUrl);
              } else {
                const errText = await uploadRes.text();
                console.error("[Absen] ❌ Upload failed:", uploadRes.status, errText);
              }
            } catch (uploadErr) {
              console.error("[Absen] ❌ Upload exception:", uploadErr);
            }
          }

          await fetch(`${url}/rest/v1/form_responses`, {
            method: "POST",
            headers: {
              "apikey": key,
              "Authorization": `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
              "Prefer": "return=minimal"
            },
            body: JSON.stringify({
              form_id: formIdState,
              user_id: session.user.id,
              attendance_record_id: recordId || null,
              answers: finalAnswers,
            }),
          });
        }
        setSubmitted(true);
        // Clear draft after successful submit
        if (profile?.email && sessionId) {
          localStorage.removeItem(`draft-absen-${sessionId}-${profile.email}`);
        }
      } else {
        const errText = await res.text();
        if (errText.includes("duplicate") || errText.includes("23505") || res.status === 409) {
          // User already attended — treat as success
          setSubmitted(true);
          if (profile?.email && sessionId) {
            localStorage.removeItem(`draft-absen-${sessionId}-${profile.email}`);
          }
        } else {
          console.error("Form submit error:", errText);
          alert("Gagal melakukan presensi. Silakan coba lagi.");
        }
      }
    } catch (err) {
      console.error("Form submit error:", err);
    }
    setSubmitting(false);
  };

  const allRequiredFilled = formFields.every(
    (f) => !f.required || (formValues[f.id] && String(formValues[f.id]).trim() !== "")
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff6900]" />
        <p className="text-sm">Memuat sesi...</p>
      </div>
    );
  }

  const DraftIndicator = () => {
    if (sessionMethod !== "form" || submitted) return null;
    const hasAnyData = Object.values(formValues).some((v) => v && String(v).trim() !== "");
    if (!hasAnyData && draftStatus === "idle") return null;

    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-300 ${
        draftStatus === "saving"
          ? "bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400"
          : draftStatus === "saved"
          ? "bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
          : draftStatus === "error"
          ? "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-500"
          : "bg-muted border border-border text-muted-foreground"
      }`}>
        {draftStatus === "saving" && <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Menyimpan draft...</span></>}
        {draftStatus === "saved" && <><Cloud className="w-3.5 h-3.5" /><span>Draft tersimpan</span></>}
        {draftStatus === "error" && <><CloudOff className="w-3.5 h-3.5" /><span>Gagal menyimpan — mencoba ulang...</span></>}
        {draftStatus === "idle" && hasAnyData && <><Save className="w-3.5 h-3.5" /><span>Draft tersedia</span></>}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm transition">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </button>

      <div className="mb-6">
        <p className="text-xs text-muted-foreground mb-1">{eventName}</p>
        <h1 className="text-xl font-bold text-foreground">{sessionName}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {sessionMethod === "qr" ? "Scan QR Code untuk melakukan presensi" : "Isi form berikut untuk melakukan presensi"}
        </p>
      </div>

      {sessionMethod === "qr" ? (
        <div className="space-y-4">
          {scanResult === "success" ? (
            <GlassCard className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-1">Presensi Berhasil!</h2>
              <p className="text-sm text-muted-foreground mb-6">Kehadiran kamu telah tercatat untuk {sessionName}</p>
              <button onClick={() => navigate(-1)} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold text-sm hover:opacity-90 transition">
                Kembali ke Kegiatan
              </button>
            </GlassCard>
          ) : scanResult === "error" ? (
            <GlassCard className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/15 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-1">Gagal Membuka Kamera</h2>
              <p className="text-sm text-muted-foreground mb-6">Pastikan kamu sudah memberikan izin akses kamera pada browser.</p>
              <button onClick={() => { setScanResult(null); startCamera(); }} className="px-6 py-2.5 rounded-xl bg-[#ff6900] text-white font-semibold text-sm hover:opacity-90 transition">
                Coba Lagi
              </button>
            </GlassCard>
          ) : (
            <GlassCard className="p-0 overflow-hidden">
              <div className="relative bg-black aspect-square md:aspect-video max-h-[400px] md:max-h-[500px] w-full flex items-center justify-center overflow-hidden">
                {cameraActive ? (
                  <>
                    <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="absolute inset-0 bg-black/50" />
                      <div className="relative w-56 h-56">
                        <div className="absolute inset-0 rounded-2xl" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)" }} />
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-[#ff6900] rounded-tl-xl" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-[#ff6900] rounded-tr-xl" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-[#ff6900] rounded-bl-xl" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-[#ff6900] rounded-br-xl" />
                        <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#ff6900] to-transparent animate-bounce" style={{ top: "50%" }} />
                      </div>
                    </div>
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <p className="text-white text-sm font-medium backdrop-blur-sm bg-black/30 inline-block px-4 py-1.5 rounded-full">
                        <ScanLine className="w-4 h-4 inline mr-1.5 -mt-0.5" /> Arahkan kamera ke QR Code
                      </p>
                    </div>
                  </>
                ) : cameraDenied ? (
                  <div className="flex flex-col items-center gap-4 p-8 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center">
                      <Camera className="w-10 h-10 text-red-500" />
                    </div>
                    <div>
                      <p className="text-white font-semibold mb-1">Izin Kamera Ditolak</p>
                      <p className="text-xs text-white/60">Aktifkan izin kamera di pengaturan browser untuk scan QR</p>
                    </div>
                    <button onClick={() => { setCameraDenied(false); startCamera(); }}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold text-sm hover:opacity-90 transition shadow-lg shadow-[#ff6900]/20 flex items-center gap-2">
                      <Camera className="w-4 h-4" /> Coba Lagi
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 p-8 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-[#ff6900]/10 flex items-center justify-center">
                      <Camera className="w-10 h-10 text-[#ff6900]" />
                    </div>
                    <div>
                      <p className="text-white font-semibold mb-1">Scanner QR Code</p>
                      <p className="text-xs text-white/60">Buka kamera untuk scan QR presensi</p>
                    </div>
                    <button onClick={startCamera}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold text-sm hover:opacity-90 transition shadow-lg shadow-[#ff6900]/20 flex items-center gap-2">
                      <Camera className="w-4 h-4" /> Buka Kamera
                    </button>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
              {cameraActive && (
                <div className="p-4 text-center">
                  <button onClick={stopCamera} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition">
                    Tutup Kamera
                  </button>
                </div>
              )}
            </GlassCard>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {submitted ? (
            <GlassCard className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-1">Presensi Berhasil!</h2>
              <p className="text-sm text-muted-foreground mb-6">Form presensi kamu telah dikirim untuk {sessionName}</p>
              <button onClick={() => navigate(-1)} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold text-sm hover:opacity-90 transition">
                Kembali ke Kegiatan
              </button>
            </GlassCard>
          ) : (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-bold text-foreground">Form Presensi</h2>
              </div>
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs text-muted-foreground">Isi semua pertanyaan yang diperlukan</p>
                <DraftIndicator />
              </div>

              <FormRenderer
                fields={formFields}
                sections={formSections}
                values={formValues}
                onChange={handleFormChange}
                fileNames={fileNames}
                onFileUpload={(fieldId, file) => handleFileUpload(fieldId, file)}
                uploadingFields={uploadingFields}
                branchingEnabled={branchingEnabled}
                onSubmit={handleSubmitForm}
                submitting={submitting}
                submitLabel="Kirim Presensi"
              />

              {draftStatus === "error" && (
                <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-red-600 dark:text-red-400">Gagal menyimpan draft</p>
                    <p className="text-[10px] text-red-500/70 mt-0.5">Jawabanmu tetap tersimpan di perangkat ini. Akan dicoba ulang otomatis.</p>
                  </div>
                </div>
              )}


            </GlassCard>
          )}
        </div>
      )}
    </div>
  );
}
