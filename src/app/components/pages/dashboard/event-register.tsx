import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { GlassCard } from "../../glass-card";
import { useAuth } from "../../auth-context";
import {
  ArrowLeft, CheckCircle2, Save, Loader2, MessageSquare, ExternalLink, ArrowRight, Calendar
} from "lucide-react";
import { FormRenderer } from "../../form-builder/FormRenderer";
import type { FormField, FormSection } from "../../form-builder/types";
import type { Event } from "../../../../lib/database.types";

interface EventWithOrmawa extends Event {
  ormawa?: { name: string } | null;
}

export function DashboardEventRegister() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, session } = useAuth();

  const [event, setEvent] = useState<EventWithOrmawa | null>(null);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formSections, setFormSections] = useState<FormSection[]>([]);
  const [branchingEnabled, setBranchingEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [filesToUpload, setFilesToUpload] = useState<Record<string, File>>({});
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const headers: Record<string, string> = { "apikey": supabaseKey };
  if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

  // Fetch event + form data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // Fetch event
        const eventRes = await fetch(
          `${supabaseUrl}/rest/v1/events?id=eq.${id}&select=*,ormawa:ormawa_id(name)`,
          { headers, signal: AbortSignal.timeout(15000) }
        );
        if (!eventRes.ok) { setLoading(false); return; }
        const events = await eventRes.json();
        if (events.length === 0) { setLoading(false); return; }
        setEvent(events[0]);

        // Fetch form
        const formRes = await fetch(
          `${supabaseUrl}/rest/v1/forms?event_id=eq.${id}&form_type=eq.registration&select=id,branching_enabled`,
          { headers, signal: AbortSignal.timeout(15000) }
        );
        if (!formRes.ok) { setLoading(false); return; }
        const forms = await formRes.json();
        if (forms.length === 0) { setLoading(false); return; }
        const formId = forms[0].id;
        setBranchingEnabled(forms[0].branching_enabled ?? false);
        setFormIdState(formId);

        // Fetch sections
        const secRes = await fetch(
          `${supabaseUrl}/rest/v1/form_sections?form_id=eq.${formId}&order=order_index.asc&select=*`,
          { headers, signal: AbortSignal.timeout(15000) }
        );
        const secData = secRes.ok ? await secRes.json() : [];
        setFormSections(secData.map((s: any) => ({ id: s.id, title: s.title, description: s.description, goToSection: s.go_to_section || undefined })));

        // Fetch fields
        const fieldRes = await fetch(
          `${supabaseUrl}/rest/v1/form_fields?form_id=eq.${formId}&order=order_index.asc&select=*`,
          { headers, signal: AbortSignal.timeout(15000) }
        );
        const fieldData = fieldRes.ok ? await fieldRes.json() : [];
        const mapped: FormField[] = fieldData.map((f: any) => ({
          id: f.id,
          sectionId: f.section_id || undefined,
          type: f.type,
          label: f.label,
          description: f.description || undefined,
          required: f.required,
          autofillTag: f.autofill_tag || null,
          options: f.options || undefined,
          scaleMin: f.scale_config?.min,
          scaleMax: f.scale_config?.max,
          scaleMinLabel: f.scale_config?.minLabel,
          scaleMaxLabel: f.scale_config?.maxLabel,
          fileTypes: f.file_config?.types,
          validation: f.validation || undefined,
        }));
        setFormFields(mapped);

        // Init values
        const initial: Record<string, any> = {};
        mapped.forEach((f) => {
          if (f.autofillTag === "nama") initial[f.id] = profile?.full_name || "";
          else if (f.autofillTag === "akun") initial[f.id] = profile?.email || "";
          else if (f.autofillTag === "nim") initial[f.id] = profile?.nim || "";
          else initial[f.id] = "";
        });

        // Load draft if exists
        const draftKey = `draft-${id}-${profile?.email}`;
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) {
          try { Object.assign(initial, JSON.parse(savedDraft)); } catch {}
        }
        setFormValues(initial);
      } catch (err) { console.error("Fetch form error:", err); }
      setLoading(false);
    }
    if (id) fetchData();
  }, [id, session?.access_token]);

  const [formIdState, setFormIdState] = useState<string | null>(null);

  // Auto-save draft
  const saveDraft = useCallback(() => {
    if (!profile?.email || !id) return;
    setDraftSaving(true);
    localStorage.setItem(`draft-${id}-${profile.email}`, JSON.stringify(formValues));
    setTimeout(() => { setDraftSaving(false); setDraftSaved(true); setTimeout(() => setDraftSaved(false), 2000); }, 300);
  }, [formValues, id, profile]);

  useEffect(() => {
    if (Object.keys(formValues).length === 0) return;
    const timer = setTimeout(() => { saveDraft(); }, 1000);
    return () => clearTimeout(timer);
  }, [formValues, saveDraft]);

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleFileUpload = async (fieldId: string, file: File) => {
    if (!session?.user?.id) return;
    setFileNames((prev) => ({ ...prev, [fieldId]: file.name }));
    setUploadingFields((prev) => ({ ...prev, [fieldId]: true }));
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `draft-uploads/${session.user.id}/${fieldId}_${safeName}`;
      const arrayBuffer = await file.arrayBuffer();
      const upRes = await fetch(`${supabaseUrl}/storage/v1/object/form-uploads/${storagePath}`, {
        method: "POST",
        headers: { "apikey": supabaseKey, "Authorization": `Bearer ${session.access_token}`, "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
        body: arrayBuffer,
      });
      if (upRes.ok) {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/form-uploads/${storagePath}`;
        setFormValues((prev) => {
          const updated = { ...prev, [fieldId]: publicUrl };
          // Save draft immediately with URL
          if (profile?.email && id) {
            localStorage.setItem(`draft-${id}-${profile.email}`, JSON.stringify(updated));
          }
          return updated;
        });
        // Remove from filesToUpload since already uploaded
        setFilesToUpload((prev) => { const n = { ...prev }; delete n[fieldId]; return n; });
      } else {
        console.error("Draft file upload failed:", await upRes.text());
        // Fallback: keep in filesToUpload for submit-time upload
        setFormValues((prev) => ({ ...prev, [fieldId]: file.name }));
        setFilesToUpload((prev) => ({ ...prev, [fieldId]: file }));
      }
    } catch (err) {
      console.error("Draft file upload error:", err);
      setFormValues((prev) => ({ ...prev, [fieldId]: file.name }));
      setFilesToUpload((prev) => ({ ...prev, [fieldId]: file }));
    }
    setUploadingFields((prev) => ({ ...prev, [fieldId]: false }));
  };

  const handleSubmit = async () => {
    if (!session?.user?.id || !id) return;
    setSubmitting(true);
    try {
      // 0. Check deadline and quota first
      if (event?.registration_close_date && new Date() > new Date(event.registration_close_date)) {
        throw new Error("Maaf, masa pendaftaran untuk kegiatan ini sudah ditutup.");
      }
      
      if (event?.quota !== null) {
        const countRes = await fetch(`${supabaseUrl}/rest/v1/rpc/get_event_registrations_count`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ p_event_id: id }),
          signal: AbortSignal.timeout(15000),
        });
        if (countRes.ok) {
          const count = await countRes.json();
          if (count >= event!.quota) {
            throw new Error("Maaf, kuota untuk kegiatan ini sudah penuh.");
          }
        }
      }

      // 1. Submit Registration
      const regRes = await fetch(`${supabaseUrl}/rest/v1/event_registrations`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", "Prefer": "return=representation" },
        body: JSON.stringify({
          event_id: id,
          user_id: session.user.id
          // intentionally omit status to rely on DB default, which avoids constraint issues if schema differs
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!regRes.ok) {
        const errBody = await regRes.json();
        if (errBody.code === "23505") {
          // Unique constraint violation -> user already registered
          throw new Error("Kamu sudah mendaftar untuk kegiatan ini sebelumnya.");
        }
        throw new Error(errBody.message || "Gagal mendaftar ke kegiatan.");
      }
      
      const regData = await regRes.json();
      const registrationId = regData[0].id;

      // 2. Upload files to Supabase Storage & replace filenames with public URLs
      const finalAnswers = { ...formValues };
      const fileFieldIds = Object.keys(filesToUpload);
      console.log("[Register] Files to upload:", fileFieldIds.length);
      for (const [fieldId, file] of Object.entries(filesToUpload)) {
        try {
          const timestamp = Date.now();
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const storagePath = `registration/${id}/${session.user.id}/${timestamp}_${safeName}`;
          console.log("[Register] Uploading:", storagePath, "type:", file.type, "size:", file.size);

          // Read file as ArrayBuffer for reliable binary upload
          const arrayBuffer = await file.arrayBuffer();

          const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/form-uploads/${storagePath}`, {
            method: "POST",
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${session.access_token}`,
              "Content-Type": file.type || "application/octet-stream",
              "x-upsert": "true",
            },
            body: arrayBuffer,
          });
          
          if (uploadRes.ok) {
            const publicUrl = `${supabaseUrl}/storage/v1/object/public/form-uploads/${storagePath}`;
            finalAnswers[fieldId] = publicUrl;
            console.log("[Register] ✅ Upload OK:", publicUrl);
          } else {
            const errText = await uploadRes.text();
            console.error("[Register] ❌ Upload failed:", uploadRes.status, errText);
            // Keep filename as fallback
          }
        } catch (uploadErr) {
          console.error("[Register] ❌ Upload exception:", uploadErr);
        }
      }

      // 3. Submit Form Responses
      if (formIdState) {
        const resRes = await fetch(`${supabaseUrl}/rest/v1/form_responses`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json", "Prefer": "return=minimal" },
          body: JSON.stringify({
            form_id: formIdState,
            user_id: session.user.id,
            registration_id: registrationId,
            answers: finalAnswers
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!resRes.ok) {
          console.warn("Gagal menyimpan jawaban form:", await resRes.text());
        }
      }

      console.log("[Register] ✅ Registration success!");
      if (profile?.email) localStorage.removeItem(`draft-${id}-${profile.email}`);
      setSubmitted(true);
    } catch (err: any) {
      console.error("Submit error:", err);
      alert(err.message || "Terjadi kesalahan saat mendaftar. Silakan coba lagi.");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff6900]" />
        <p className="text-sm">Memuat formulir pendaftaran...</p>
      </div>
    );
  }

  if (!event) return <div className="p-6 text-center text-muted-foreground">Event tidak ditemukan</div>;

  const isClosed = event?.registration_close_date && new Date() > new Date(event.registration_close_date);

  if (isClosed) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-20">
        <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-6 mx-auto">
          <Calendar className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Pendaftaran Ditutup</h1>
        <p className="text-muted-foreground">Maaf, masa pendaftaran untuk kegiatan <span className="font-semibold text-foreground">{event.title}</span> telah berakhir.</p>
        <button onClick={() => navigate("/dashboard/kegiatan")} className="mt-8 px-6 py-2.5 rounded-xl bg-muted border border-border text-foreground font-medium hover:bg-muted/80 transition">
          Kembali ke Kegiatan
        </button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex flex-col items-center text-center py-8">
          <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Pendaftaran Berhasil!</h1>
          <p className="text-muted-foreground text-sm mb-8">Kamu telah terdaftar di <span className="font-semibold text-foreground">{event.title}</span></p>

          {event.registration_message && (
            <GlassCard className="w-full p-6 text-left mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-[#ff6900]/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4.5 h-4.5 text-[#ff6900]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Pesan dari Penyelenggara</h2>
                  <p className="text-[11px] text-muted-foreground">{event.ormawa?.name || ""}</p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {event.registration_message.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                  part.match(/^https?:\/\//) ? (
                    <a key={i} href={part} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#ff6900] underline hover:opacity-80 break-all">
                      {part} <ExternalLink className="w-3 h-3 inline shrink-0" />
                    </a>
                  ) : (<span key={i}>{part}</span>)
                )}
              </div>
            </GlassCard>
          )}

          <div className="flex gap-3 w-full max-w-sm">
            <button onClick={() => navigate("/dashboard/kegiatan")} className="flex-1 py-3 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted transition">
              Kembali ke Kegiatan
            </button>
            <button onClick={() => navigate("/dashboard/kegiatan-saya")} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-2">
              Kegiatan Saya <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-muted transition text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Form Pendaftaran</h1>
          <p className="text-muted-foreground text-sm">{event.title}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {draftSaving ? (
            <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan...</span>
          ) : draftSaved ? (
            <span className="flex items-center gap-1.5 text-emerald-500"><Save className="w-3.5 h-3.5" /> Tersimpan sebagai draft</span>
          ) : null}
        </div>
      </div>

      <GlassCard className="p-4 mb-6">
        <div className="flex items-center gap-4">
          {event.cover_url ? (
            <img src={event.cover_url} alt="" className="w-16 h-12 rounded-lg object-cover" />
          ) : (
            <div className="w-16 h-12 rounded-lg bg-gradient-to-br from-[#ff6900]/20 to-[#ff8c3a]/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-[#ff6900]/30" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
            <p className="text-xs text-muted-foreground">{event.ormawa?.name || ""} &bull; {new Date(event.date).toLocaleDateString("id-ID")}</p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 bg-[#ff6900]/10 text-[#ff6900]">
            {event.status === "published" ? "Dibuka" : event.status}
          </span>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <FormRenderer
          fields={formFields}
          sections={formSections}
          values={formValues}
          onChange={handleFieldChange}
          fileNames={fileNames}
          onFileUpload={handleFileUpload}
          uploadingFields={uploadingFields}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel="Submit Pendaftaran"
          branchingEnabled={branchingEnabled}
        />

        {/* Cancel button always visible */}
        <div className="mt-4">
          <button onClick={() => navigate(-1)} className="w-full py-2.5 rounded-xl border border-border text-muted-foreground text-sm font-medium hover:bg-muted transition">
            Batal
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
