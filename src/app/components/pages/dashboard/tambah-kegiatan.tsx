import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { GlassCard } from "../../glass-card";
import {
  ArrowLeft, ArrowRight, Upload, X, MessageSquare, Link2, CheckCircle2, Loader2, Save
} from "lucide-react";
import { FormBuilder } from "../../form-builder/FormBuilder";
import type { FormField, FormSection } from "../../form-builder/types";
import { useAuth } from "../../auth-context";
import type { EventCategory } from "../../../../lib/database.types";

const CATEGORIES: EventCategory[] = ["Seminar", "Workshop", "Kompetisi", "Oprec", "Pelatihan", "Lainnya"];

export function DashboardTambahKegiatan() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, profile } = useAuth();
  const [draftId, setDraftId] = useState<string | null>(searchParams.get("draft"));
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 1 fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<EventCategory>("Seminar");
  const [closeDate, setCloseDate] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [eventDate, setEventDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventTimeStart, setEventTimeStart] = useState("");
  const [eventTimeEnd, setEventTimeEnd] = useState("");
  const [location, setLocation] = useState("");
  const [quota, setQuota] = useState("");

  // Step 2 - form builder
  const [formFields, setFormFields] = useState<FormField[]>([
    { id: "f1", type: "text", label: "Nama Lengkap", required: true, autofillTag: "nama" },
    { id: "f2", type: "text", label: "Email", required: true, autofillTag: "akun" },
  ]);
  const [formSections, setFormSections] = useState<FormSection[]>([]);
  const [quizMode, setQuizMode] = useState(false);
  const [branchingEnabled, setBranchingEnabled] = useState(false);

  // Step 3 - pesan untuk pendaftar
  const [registrationMessage, setRegistrationMessage] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(!!searchParams.get("draft"));

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const reader = new FileReader();
      reader.onload = () => setCoverPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Load draft from DB if ?draft=ID
  useEffect(() => {
    if (!draftId || !session?.access_token) return;
    async function loadDraft() {
      setLoadingDraft(true);
      try {
        const url = import.meta.env.VITE_SUPABASE_URL as string;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const res = await fetch(`${url}/rest/v1/events?id=eq.${draftId}&select=*`, {
          headers: { "apikey": key, "Authorization": `Bearer ${session!.access_token}` },
        });
        if (!res.ok) { setLoadingDraft(false); return; }
        const rows = await res.json();
        if (!rows.length) { setLoadingDraft(false); return; }
        const e = rows[0];
        setTitle(e.title || "");
        setDescription(e.description || "");
        setCategory(e.category || "Seminar");
        setCloseDate(e.registration_close_date || "");
        setEventDate(e.date || "");
        setEventEndDate(e.end_date || "");
        setEventTimeStart(e.time_start || "");
        setEventTimeEnd(e.time_end || "");
        setLocation(e.location || "");
        setQuota(e.quota ? String(e.quota) : "");
        setRegistrationMessage(e.registration_message || "");
        if (e.cover_url) setCoverPreview(e.cover_url);

        // Load form fields if form exists
        const fRes = await fetch(`${url}/rest/v1/forms?event_id=eq.${draftId}&select=*`, {
          headers: { "apikey": key, "Authorization": `Bearer ${session!.access_token}` },
        });
        if (fRes.ok) {
          const forms = await fRes.json();
          if (forms.length) {
            const formId = forms[0].id;
            setQuizMode(forms[0].quiz_mode || false);
            setBranchingEnabled(forms[0].branching_enabled || false);
            // Load sections
            const sRes = await fetch(`${url}/rest/v1/form_sections?form_id=eq.${formId}&order=order_index.asc&select=*`, {
              headers: { "apikey": key, "Authorization": `Bearer ${session!.access_token}` },
            });
            if (sRes.ok) {
              const secs = await sRes.json();
              setFormSections(secs.map((s: any) => ({ id: s.id, title: s.title, description: s.description || "", goToSection: s.go_to_section || "" })));
            }
            // Load fields
            const ffRes = await fetch(`${url}/rest/v1/form_fields?form_id=eq.${formId}&order=order_index.asc&select=*`, {
              headers: { "apikey": key, "Authorization": `Bearer ${session!.access_token}` },
            });
            if (ffRes.ok) {
              const fields = await ffRes.json();
              if (fields.length) {
                setFormFields(fields.map((f: any) => ({
                  id: f.id, type: f.type, label: f.label, description: f.description || "",
                  required: f.required, autofillTag: f.autofill_tag || undefined,
                  options: f.options || undefined, sectionId: f.section_id || undefined,
                  scaleMin: f.scale_config?.min, scaleMax: f.scale_config?.max,
                  scaleMinLabel: f.scale_config?.minLabel, scaleMaxLabel: f.scale_config?.maxLabel,
                  fileTypes: f.file_config?.types, validation: f.validation || undefined,
                  correctAnswer: f.correct_answer || undefined, points: f.points ?? undefined,
                })));
              }
            }
          }
        }
      } catch (err) {
        console.error("Load draft error:", err);
      }
      setLoadingDraft(false);
    }
    loadDraft();
  }, [draftId, session?.access_token]);

  // Save as draft (event only, minimal validation)
  const handleSaveDraft = async () => {
    if (!session?.user?.id || !profile?.ormawa_id) {
      setError("Login sebagai ormawa diperlukan.");
      return;
    }
    if (!title.trim()) { setError("Minimal isi judul untuk menyimpan draft."); return; }

    setSavingDraft(true);
    setError("");
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const token = session.access_token;

    try {
      const eventBody: Record<string, any> = {
        title: title.trim(),
        description: description.trim() || null,
        category,
        date: eventDate || null,
        end_date: eventEndDate || null,
        time_start: eventTimeStart || null,
        time_end: eventTimeEnd || null,
        location: location.trim() || null,
        quota: quota ? parseInt(quota) : null,
        registration_close_date: closeDate || null,
        registration_message: registrationMessage.trim() || null,
        status: "draft",
        has_presensi: false,
      };

      let eventId = draftId;

      if (draftId) {
        // Update existing draft
        const res = await fetch(`${supabaseUrl}/rest/v1/events?id=eq.${draftId}`, {
          method: "PATCH",
          headers: { "apikey": supabaseKey, "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Prefer": "return=representation" },
          body: JSON.stringify(eventBody),
        });
        if (!res.ok) throw new Error("Gagal update draft: " + (await res.text()));
      } else {
        // Insert new draft
        eventBody.ormawa_id = profile.ormawa_id;
        eventBody.created_by = session.user.id;
        eventBody.cover_url = null;
        const res = await fetch(`${supabaseUrl}/rest/v1/events`, {
          method: "POST",
          headers: { "apikey": supabaseKey, "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Prefer": "return=representation" },
          body: JSON.stringify(eventBody),
        });
        if (!res.ok) throw new Error("Gagal simpan draft: " + (await res.text()));
        const rows = await res.json();
        eventId = rows[0].id;
        setDraftId(eventId);
      }

      // Upload cover if new file selected
      if (coverFile && eventId) {
        const ext = coverFile.name.split(".").pop() || "jpg";
        const storagePath = `${eventId}.${ext}`;
        const upRes = await fetch(`${supabaseUrl}/storage/v1/object/event-covers/${storagePath}`, {
          method: "POST",
          headers: { "apikey": supabaseKey, "Authorization": `Bearer ${token}`, "Content-Type": coverFile.type, "x-upsert": "true" },
          body: coverFile,
        });
        if (upRes.ok) {
          const coverUrl = `${supabaseUrl}/storage/v1/object/public/event-covers/${storagePath}`;
          await fetch(`${supabaseUrl}/rest/v1/events?id=eq.${eventId}`, {
            method: "PATCH",
            headers: { "apikey": supabaseKey, "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ cover_url: coverUrl }),
          });
        }
      }

      // Save form fields if step >= 2
      if (step >= 2 && eventId) {
        // Delete old form + fields (cascade) then re-insert
        await fetch(`${supabaseUrl}/rest/v1/forms?event_id=eq.${eventId}`, {
          method: "DELETE",
          headers: { "apikey": supabaseKey, "Authorization": `Bearer ${token}` },
        });

        const hasBranching = formFields.some(f => f.options?.some(o => o.goToSection && o.goToSection !== ""));
        const fRes = await fetch(`${supabaseUrl}/rest/v1/forms`, {
          method: "POST",
          headers: { "apikey": supabaseKey, "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Prefer": "return=representation" },
          body: JSON.stringify({ event_id: eventId, form_type: "registration", quiz_mode: quizMode, branching_enabled: hasBranching }),
        });
        if (fRes.ok) {
          const formRows = await fRes.json();
          const formId = formRows[0].id;
          // Insert sections
          const sectionIdMap: Record<string, string> = {};
          for (let i = 0; i < formSections.length; i++) {
            const sec = formSections[i];
            const sRes = await fetch(`${supabaseUrl}/rest/v1/form_sections`, {
              method: "POST",
              headers: { "apikey": supabaseKey, "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Prefer": "return=representation" },
              body: JSON.stringify({ form_id: formId, title: sec.title, description: sec.description || null, order_index: i }),
            });
            if (sRes.ok) { const r = await sRes.json(); sectionIdMap[sec.id] = r[0].id; }
          }
          // Insert fields
          for (let i = 0; i < formFields.length; i++) {
            const f = formFields[i];
            const dbSectionId = f.sectionId ? sectionIdMap[f.sectionId] || null : null;
            await fetch(`${supabaseUrl}/rest/v1/form_fields`, {
              method: "POST",
              headers: { "apikey": supabaseKey, "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Prefer": "return=representation" },
              body: JSON.stringify({
                form_id: formId, section_id: dbSectionId, type: f.type, label: f.label,
                description: f.description || null, required: f.required, autofill_tag: f.autofillTag || null,
                order_index: i, options: f.options || null,
                scale_config: f.type === "linear_scale" ? { min: f.scaleMin ?? 1, max: f.scaleMax ?? 5, minLabel: f.scaleMinLabel, maxLabel: f.scaleMaxLabel } : null,
                file_config: f.type === "file" ? { types: f.fileTypes || ["image", "pdf"] } : null,
                validation: f.validation || null, correct_answer: f.correctAnswer || null, points: f.points ?? null,
              }),
            });
          }
        }
      }

      navigate("/dashboard/kegiatan-kami");
    } catch (err: any) {
      console.error("Save draft error:", err);
      setError(err.message || "Gagal menyimpan draft.");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleStep1Next = () => {
    setError("");
    if (!title.trim()) { setError("Judul kegiatan wajib diisi"); return; }
    if (!description.trim()) { setError("Deskripsi wajib diisi"); return; }
    if (!closeDate) { setError("Tanggal penutupan pendaftaran wajib diisi"); return; }
    if (!coverPreview) { setError("Cover kegiatan wajib diupload"); return; }
    setStep(2);
  };

  const handleSubmit = async () => {
    console.log("[TambahKegiatan] handleSubmit called");
    console.log("[TambahKegiatan] session:", session?.user?.id);
    console.log("[TambahKegiatan] profile:", profile?.id, "ormawa_id:", profile?.ormawa_id);

    if (!session?.user?.id || !profile?.ormawa_id) {
      setError("Anda harus login sebagai ormawa untuk membuat kegiatan. (ormawa_id: " + (profile?.ormawa_id ?? "null") + ")");
      return;
    }

    setSubmitting(true);
    setError("");

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const token = session.access_token;

    // Helper: raw fetch ke Supabase REST API — bypass JS client yang hang
    async function dbInsert(table: string, body: Record<string, any>): Promise<any[]> {
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        const errBody = await res.text();
        console.error(`[DB] INSERT ${table} failed:`, res.status, errBody);
        throw new Error(`Gagal insert ke ${table}: ${res.status} — ${errBody}`);
      }
      return res.json();
    }

    async function dbUpdate(table: string, id: string, body: Record<string, any>) {
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
        method: "PATCH",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const errBody = await res.text();
        console.warn(`[DB] UPDATE ${table} failed:`, res.status, errBody);
      }
    }

    try {
      let eventId: string;
      const eventData = {
        title: title.trim(),
        description: description.trim(),
        category,
        date: eventDate || closeDate,
        end_date: eventEndDate || null,
        time_start: eventTimeStart || null,
        time_end: eventTimeEnd || null,
        location: location.trim() || null,
        quota: quota ? parseInt(quota) : null,
        registration_close_date: closeDate,
        registration_message: registrationMessage.trim() || null,
        status: "published",
        has_presensi: false,
      };

      if (draftId) {
        // Update existing draft → published
        console.log("[TambahKegiatan] Updating draft to published:", draftId);
        await dbUpdate("events", draftId, eventData);
        eventId = draftId;
        // Delete old form data (will be re-inserted below)
        await fetch(`${supabaseUrl}/rest/v1/forms?event_id=eq.${draftId}`, {
          method: "DELETE",
          headers: { "apikey": supabaseKey, "Authorization": `Bearer ${token}` },
        });
      } else {
        // Insert new event
        console.log("[TambahKegiatan] Step 1: Inserting event...");
        const eventRows = await dbInsert("events", {
          ...eventData,
          ormawa_id: profile.ormawa_id,
          created_by: session.user.id,
          cover_url: null,
        });
        eventId = eventRows[0].id;
      }
      console.log("[TambahKegiatan] Event ID:", eventId);

      // 2. Upload cover image via Storage REST API
      if (coverFile) {
        console.log("[TambahKegiatan] Step 2: Uploading cover...");
        try {
          const ext = coverFile.name.split(".").pop() || "jpg";
          const storagePath = `${eventId}.${ext}`;
          const uploadRes = await fetch(
            `${supabaseUrl}/storage/v1/object/event-covers/${storagePath}`,
            {
              method: "POST",
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${token}`,
                "Content-Type": coverFile.type,
                "x-upsert": "true",
              },
              body: coverFile,
              signal: AbortSignal.timeout(30000),
            }
          );
          if (uploadRes.ok) {
            const coverUrl = `${supabaseUrl}/storage/v1/object/public/event-covers/${storagePath}`;
            await dbUpdate("events", eventId, { cover_url: coverUrl });
            console.log("[TambahKegiatan] Cover uploaded:", coverUrl);
          } else {
            const errText = await uploadRes.text();
            console.warn("[TambahKegiatan] Cover upload failed:", uploadRes.status, errText);
          }
        } catch (uploadErr) {
          console.warn("[TambahKegiatan] Cover upload error (non-fatal):", uploadErr);
        }
      }

      // 3. Insert registration form
      // Auto-detect branching: check if any field option or section has goToSection set
      const hasBranching = formFields.some(f =>
        f.options?.some(o => o.goToSection && o.goToSection !== "")
      ) || formSections.some(s => s.goToSection && s.goToSection !== "");
      console.log("[TambahKegiatan] Step 3: Inserting form... (branching auto-detected:", hasBranching, ")");
      const formRows = await dbInsert("forms", {
        event_id: eventId,
        form_type: "registration",
        quiz_mode: quizMode,
        branching_enabled: hasBranching,
      });
      const formId = formRows[0].id;
      console.log("[TambahKegiatan] Form created:", formId);

      // 4. Insert form sections (two passes: first insert, then update goToSection)
      const sectionIdMap: Record<string, string> = {};
      for (let i = 0; i < formSections.length; i++) {
        const sec = formSections[i];
        console.log(`[TambahKegiatan] Step 4a: Inserting section ${i}...`);
        const secRows = await dbInsert("form_sections", {
          form_id: formId,
          title: sec.title,
          description: sec.description || null,
          order_index: i,
        });
        sectionIdMap[sec.id] = secRows[0].id;
      }

      // 4b. Update sections with goToSection (remap local IDs to DB UUIDs)
      for (const sec of formSections) {
        if (sec.goToSection) {
          const dbSecId = sectionIdMap[sec.id];
          const remappedGoTo = sec.goToSection === "__end__"
            ? "__end__"
            : sectionIdMap[sec.goToSection] || sec.goToSection;
          console.log(`[TambahKegiatan] Step 4b: Updating section goToSection: ${sec.goToSection} -> ${remappedGoTo}`);
          await fetch(
            `${supabaseUrl}/rest/v1/form_sections?id=eq.${dbSecId}`,
            {
              method: "PATCH",
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
              },
              body: JSON.stringify({ go_to_section: remappedGoTo }),
            }
          );
        }
      }

      // 5. Insert form fields
      for (let i = 0; i < formFields.length; i++) {
        const f = formFields[i];
        const dbSectionId = f.sectionId ? sectionIdMap[f.sectionId] || null : null;
        console.log(`[TambahKegiatan] Step 5: Inserting field ${i} (${f.label})...`);

        const scaleConfig = f.type === "linear_scale" ? {
          min: f.scaleMin ?? 1,
          max: f.scaleMax ?? 5,
          minLabel: f.scaleMinLabel || undefined,
          maxLabel: f.scaleMaxLabel || undefined,
        } : null;

        const fileConfig = f.type === "file" ? {
          types: f.fileTypes || ["image", "pdf"],
        } : null;

        // Remap goToSection inside options from local IDs to DB UUIDs
        const remappedOptions = f.options
          ? f.options.map(opt => ({
              ...opt,
              goToSection: opt.goToSection
                ? (opt.goToSection === "__end__" ? "__end__" : sectionIdMap[opt.goToSection] || opt.goToSection)
                : opt.goToSection,
            }))
          : null;

        await dbInsert("form_fields", {
          form_id: formId,
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
        });
      }

      console.log("[TambahKegiatan] ✅ All done! Navigating...");
      navigate("/dashboard/kegiatan-kami");
    } catch (err: any) {
      console.error("[TambahKegiatan] ❌ Error:", err);
      setError(err.message || "Terjadi kesalahan saat menyimpan kegiatan.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 1) navigate(-1);
    else if (step === 2) setStep(1);
    else setStep(2);
  };

  const inputClass = "w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none focus:ring-2 focus:ring-[#ff6900]/10 transition placeholder:text-muted-foreground/40";

  if (loadingDraft) {
    return (
      <div className="p-6 max-w-3xl mx-auto flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff6900]" />
        <p className="text-sm text-muted-foreground">Memuat draft...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={handleBack} className="p-2 rounded-xl hover:bg-muted transition text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{draftId ? "Edit Draft Kegiatan" : "Buat Kegiatan Baru"}</h1>
          <p className="text-muted-foreground text-sm">Langkah {step} dari 3 — {step === 1 ? "Detail Kegiatan" : step === 2 ? "Form Pendaftaran" : "Pesan untuk Pendaftar"}</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        {[
          { num: 1, label: "Detail" },
          { num: 2, label: "Form" },
          { num: 3, label: "Pesan" },
        ].map((s, i) => (
          <React.Fragment key={s.num}>
            {i > 0 && <div className="w-8 h-0.5 bg-border rounded" />}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
              step === s.num ? "bg-[#ff6900]/10 text-[#ff6900]" :
              step > s.num ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
              "bg-muted text-muted-foreground"
            }`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s.num ? "bg-[#ff6900] text-white" :
                step > s.num ? "bg-emerald-500 text-white" :
                "bg-muted-foreground/30 text-muted-foreground"
              }`}>{step > s.num ? "✓" : s.num}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <GlassCard className="p-6">
          <div className="space-y-5">
            <div>
              <label className="text-xs text-muted-foreground mb-2 block font-semibold uppercase tracking-wider">Cover Kegiatan *</label>
              {coverPreview ? (
                <div className="relative rounded-xl overflow-hidden h-48">
                  <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                  <button onClick={() => { setCoverPreview(null); setCoverFile(null); }} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-40 rounded-xl border-2 border-dashed border-border hover:border-[#ff6900]/40 bg-muted/50 flex flex-col items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Klik untuk upload cover</span>
                  <span className="text-[10px] text-muted-foreground/60">JPG, PNG (maks 5MB)</span>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Judul Kegiatan *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Masukkan judul kegiatan" className={inputClass} />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Deskripsi *</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Jelaskan tentang kegiatan ini..." className={`${inputClass} resize-none`} />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Kategori</label>
              <select value={category} onChange={e => setCategory(e.target.value as EventCategory)} className={inputClass}>
                {CATEGORIES.map(c => <option key={c} value={c} className="bg-background text-foreground dark:bg-zinc-900">{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tanggal Pendaftaran Ditutup *</label>
              <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} className={inputClass} />
            </div>

            <div className="border-t border-border pt-5">
              <p className="text-xs text-muted-foreground mb-4 font-semibold uppercase tracking-wider">Opsional</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tanggal Mulai Kegiatan</label>
                  <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tanggal Selesai Kegiatan</label>
                  <input type="date" value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)} min={eventDate || undefined} className={inputClass} />
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Kosongkan jika sama dengan tanggal mulai</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Waktu Mulai</label>
                  <input type="time" value={eventTimeStart} onChange={(e) => setEventTimeStart(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Waktu Selesai</label>
                  <input type="time" value={eventTimeEnd} onChange={(e) => setEventTimeEnd(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Lokasi Kegiatan</label>
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Contoh: Auditorium FIK" className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Kuota Peserta</label>
                  <input type="number" value={quota} onChange={(e) => setQuota(e.target.value)} placeholder="Kosongkan jika tidak terbatas" className={inputClass} />
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3">
              <button onClick={handleSaveDraft} disabled={savingDraft} className="flex-1 py-3 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted transition flex items-center justify-center gap-2 disabled:opacity-50">
                {savingDraft ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : <><Save className="w-4 h-4" /> Simpan Draft</>}
              </button>
              <button onClick={handleStep1Next} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold hover:opacity-90 transition shadow-md shadow-[#ff6900]/20 flex items-center justify-center gap-2">
                Lanjut <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Step 2 - Form Builder */}
      {step === 2 && (
        <div className="space-y-5">
          <GlassCard className="p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-foreground">Custom Form Pendaftaran</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Atur pertanyaan yang harus diisi peserta saat mendaftar. Mendukung berbagai tipe pertanyaan, logika percabangan, mode kuis, dan validasi.</p>
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
              showAutofillTags={true}
              showQuizMode={false}
            />
          </GlassCard>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="py-3 px-4 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted transition flex items-center justify-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Kembali
            </button>
            <button onClick={handleSaveDraft} disabled={savingDraft} className="flex-1 py-3 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted transition flex items-center justify-center gap-2 disabled:opacity-50">
              {savingDraft ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : <><Save className="w-4 h-4" /> Simpan Draft</>}
            </button>
            <button onClick={() => setStep(3)} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold hover:opacity-90 transition shadow-md shadow-[#ff6900]/20 flex items-center justify-center gap-2">
              Lanjut <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3 - Pesan untuk Pendaftar */}
      {step === 3 && (
        <div className="space-y-5">
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#ff6900]/10 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-[#ff6900]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Pesan untuk Pendaftar</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Pesan ini akan ditampilkan setelah peserta berhasil mendaftar</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block font-medium">Tulis pesan, link grup WA/Line, atau informasi lainnya</label>
                <textarea
                  value={registrationMessage}
                  onChange={(e) => setRegistrationMessage(e.target.value)}
                  rows={8}
                  placeholder={"Contoh:\n\nTerima kasih telah mendaftar!\n\nSilakan bergabung ke grup WhatsApp:\nhttps://chat.whatsapp.com/xxx\n\nAtau grup LINE:\nhttps://line.me/ti/g/xxx\n\nJangan lupa bawa laptop dan charger ya!"}
                  className={`${inputClass} resize-none leading-relaxed`}
                />
              </div>

              <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-4">
                <div className="flex items-start gap-3">
                  <Link2 className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                    <p className="font-semibold">Tips:</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-amber-600 dark:text-amber-400">
                      <li>Cantumkan link grup WhatsApp atau LINE untuk koordinasi</li>
                      <li>Informasikan hal-hal yang perlu dipersiapkan peserta</li>
                      <li>Link akan otomatis bisa diklik oleh pendaftar</li>
                    </ul>
                  </div>
                </div>
              </div>

              {registrationMessage && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Preview pesan:</p>
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span className="text-sm font-semibold text-foreground">Pendaftaran Berhasil!</span>
                    </div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {registrationMessage.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                        part.match(/^https?:\/\//) ? (
                          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-[#ff6900] underline hover:opacity-80 break-all">{part}</a>
                        ) : (
                          <span key={i}>{part}</span>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} disabled={submitting || savingDraft} className="py-3 px-4 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted transition flex items-center justify-center gap-2 disabled:opacity-50">
              <ArrowLeft className="w-4 h-4" /> Kembali
            </button>
            <button onClick={handleSaveDraft} disabled={savingDraft || submitting} className="flex-1 py-3 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted transition flex items-center justify-center gap-2 disabled:opacity-50">
              {savingDraft ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : <><Save className="w-4 h-4" /> Simpan Draft</>}
            </button>
            <button onClick={handleSubmit} disabled={submitting || savingDraft} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold hover:opacity-90 transition shadow-md shadow-[#ff6900]/20 flex items-center justify-center gap-2 disabled:opacity-50">
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
              ) : (
                "Publish Kegiatan"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
