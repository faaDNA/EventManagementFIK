import React, { useRef, useState } from "react";
import {
  Type, AlignLeft, CircleDot, CheckSquare, ChevronDown, BarChart3,
  Upload, Trash2, GripVertical, Plus, X, Award, ShieldCheck, Copy,
  MoreVertical, ImagePlus, Tag, User, Hash, AtSign
} from "lucide-react";
import type { FormField, FormSection, FieldType, FieldOption, ValidationRule, AutofillTag } from "./types";
import { FIELD_TYPE_META, TEXT_VALIDATION_OPTIONS, PARAGRAPH_VALIDATION_OPTIONS, CHECKBOX_VALIDATION_OPTIONS } from "./types";

const AUTOFILL_TAGS: { value: AutofillTag; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "nama", label: "Nama", icon: <User className="w-3.5 h-3.5" />, desc: "Otomatis terisi nama akun" },
  { value: "nim", label: "NIM", icon: <Hash className="w-3.5 h-3.5" />, desc: "Otomatis terisi NIM mahasiswa" },
  { value: "akun", label: "Email", icon: <AtSign className="w-3.5 h-3.5" />, desc: "Otomatis terisi email akun" },
];

const FIELD_TYPE_ICONS: Record<FieldType, React.ReactNode> = {
  text: <Type className="w-4 h-4" />,
  textarea: <AlignLeft className="w-4 h-4" />,
  multiple_choice: <CircleDot className="w-4 h-4" />,
  checkbox: <CheckSquare className="w-4 h-4" />,
  dropdown: <ChevronDown className="w-4 h-4" />,
  linear_scale: <BarChart3 className="w-4 h-4" />,
  file: <Upload className="w-4 h-4" />,
};

interface FieldCardProps {
  field: FormField;
  sections: FormSection[];
  quizMode: boolean;
  branchingEnabled: boolean;
  dragRef?: any;
  onUpdate: (id: string, u: Partial<FormField>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (f: FormField) => void;
}

export function FieldCard({ field, sections, quizMode, branchingEnabled, dragRef, onUpdate, onRemove, onDuplicate }: FieldCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const meta = FIELD_TYPE_META[field.type];
  const isQuizCapable = field.type === "multiple_choice" || field.type === "checkbox";
  const hasBranching = field.type === "multiple_choice" || field.type === "dropdown";

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onUpdate(field.id, { imageUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const addOption = () => {
    const opts = field.options || [];
    onUpdate(field.id, { options: [...opts, { id: `o${Date.now()}`, label: `Opsi ${opts.length + 1}` }] });
  };

  const updateOption = (optId: string, label: string) => {
    onUpdate(field.id, { options: field.options?.map(o => o.id === optId ? { ...o, label } : o) });
  };

  const removeOption = (optId: string) => {
    if ((field.options?.length || 0) <= 1) return;
    onUpdate(field.id, { options: field.options?.filter(o => o.id !== optId) });
  };

  const updateOptionBranching = (optId: string, goToSection: string | null) => {
    onUpdate(field.id, { options: field.options?.map(o => o.id === optId ? { ...o, goToSection } : o) });
  };

  const changeType = (newType: FieldType) => {
    const updates: Partial<FormField> = { type: newType };
    if ((newType === "multiple_choice" || newType === "checkbox" || newType === "dropdown") && !field.options) {
      updates.options = [{ id: "o1", label: "Opsi 1" }, { id: "o2", label: "Opsi 2" }];
    }
    if (newType === "linear_scale" && !field.scaleMin) {
      updates.scaleMin = 1; updates.scaleMax = 5;
    }
    if (newType === "file" && !field.fileTypes) {
      updates.fileTypes = ["image", "pdf"];
    }
    // Clear quiz data if switching to non-quiz type
    if (newType !== "multiple_choice" && newType !== "checkbox") {
      updates.correctAnswer = undefined; updates.points = undefined;
    }
    onUpdate(field.id, updates);
  };

  // Validation helpers
  const getValidationOptions = () => {
    if (field.type === "text") return TEXT_VALIDATION_OPTIONS;
    if (field.type === "textarea") return PARAGRAPH_VALIDATION_OPTIONS;
    if (field.type === "checkbox") return CHECKBOX_VALIDATION_OPTIONS;
    return [];
  };

  const addValidation = () => {
    // Only allow exactly 1 validation rule — replace, never stack
    if (field.type === "text") onUpdate(field.id, { showValidation: true, validation: [{ type: "number", value: "", message: "Format tidak valid" }] });
    else if (field.type === "textarea") onUpdate(field.id, { showValidation: true, validation: [{ type: "max_length", value: 500, message: "Melebihi batas karakter" }] });
    else if (field.type === "checkbox") onUpdate(field.id, { showValidation: true, validation: [{ type: "min_select", value: 1, message: "Pilihan kurang" }] });
  };

  const updateValidation = (idx: number, updates: Partial<ValidationRule>) => {
    const newV = [...(field.validation || [])];
    newV[idx] = { ...newV[idx], ...updates };
    onUpdate(field.id, { validation: newV });
  };

  const removeValidation = (_idx: number) => {
    // Clear all validation and hide panel
    onUpdate(field.id, { validation: [], showValidation: false });
  };

  const hasValidation = field.type === "text" || field.type === "textarea" || field.type === "checkbox";

  return (
    <div className="relative z-0 hover:z-10 focus-within:z-20 border border-border rounded-2xl bg-card shadow-sm hover:shadow-md transition-all duration-200">
      {/* Drag handle */}
      <div ref={dragRef} className="flex justify-center py-1.5 cursor-grab active:cursor-grabbing hover:bg-muted/50 transition rounded-t-2xl">
        <GripVertical className="w-5 h-5 text-muted-foreground/40" />
      </div>

      <div className="px-5 pb-5 space-y-4">
        {/* Top row: question label + image btn + type selector */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <input
              value={field.label}
              onChange={e => onUpdate(field.id, { label: e.target.value })}
              placeholder="Pertanyaan"
              className="w-full text-base font-medium text-foreground bg-transparent border-b-2 border-transparent focus:border-[#ff6900] outline-none py-1.5 transition placeholder:text-muted-foreground/50"
            />
          </div>
          <button onClick={() => imgInputRef.current?.click()} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition shrink-0" title="Upload gambar">
            <ImagePlus className="w-5 h-5" />
          </button>
          <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <div className="shrink-0">
            <select value={field.type} onChange={e => changeType(e.target.value as FieldType)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-popover text-sm text-foreground focus:outline-none focus:border-[#ff6900]/50 cursor-pointer">
              {(Object.keys(FIELD_TYPE_META) as FieldType[]).map(t => (
                <option key={t} value={t} className="bg-popover text-foreground">{FIELD_TYPE_META[t].label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Image preview */}
        {field.imageUrl && (
          <div className="relative rounded-xl overflow-hidden border border-border">
            <img src={field.imageUrl} alt="" className="w-full max-h-48 object-contain bg-muted/30" />
            <button onClick={() => onUpdate(field.id, { imageUrl: undefined })}
              className="absolute top-2 right-2 p-1 rounded-lg bg-black/50 text-white hover:bg-black/70 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Description */}
        {(field.showDescription || field.description) && (
          <input
            value={field.description || ""}
            onChange={e => onUpdate(field.id, { description: e.target.value })}
            placeholder="Deskripsi"
            className="w-full text-sm text-muted-foreground bg-transparent border-b border-border/50 focus:border-[#ff6900]/40 outline-none py-1 transition"
          />
        )}

        {/* Field-specific content */}
        {field.type === "text" && (
          <div className="opacity-50 pointer-events-none">
            <input placeholder="Teks jawaban singkat" className="w-full px-0 py-2 border-b border-border/50 text-sm text-muted-foreground bg-transparent" />
          </div>
        )}
        {field.type === "textarea" && (
          <div className="opacity-50 pointer-events-none">
            <input placeholder="Teks jawaban panjang" className="w-full px-0 py-2 border-b border-border/50 text-sm text-muted-foreground bg-transparent" />
          </div>
        )}

        {/* Options: MC / Checkbox / Dropdown */}
        {(field.type === "multiple_choice" || field.type === "checkbox" || field.type === "dropdown") && field.options && (
          <div className="space-y-2">
            {field.options.map((opt, oi) => (
              <div key={opt.id} className="flex items-center gap-2">
                {field.type === "multiple_choice" ? <div className="w-5 h-5 rounded-full border-2 border-border shrink-0" /> :
                 field.type === "checkbox" ? <div className="w-5 h-5 rounded border-2 border-border shrink-0" /> :
                 <span className="text-sm text-muted-foreground w-6 text-center shrink-0">{oi + 1}.</span>}
                <input value={opt.label} onChange={e => updateOption(opt.id, e.target.value)}
                  className="flex-1 px-0 py-1.5 bg-transparent border-b border-border/50 text-sm text-foreground focus:border-[#ff6900]/40 outline-none transition" />
                <button onClick={() => removeOption(opt.id)} disabled={(field.options?.length || 0) <= 1}
                  className="p-1 text-muted-foreground hover:text-red-500 disabled:opacity-30 transition"><X className="w-4 h-4" /></button>
                {/* Branching per option */}
                {field.showBranching && hasBranching && sections.length > 0 && (
                  <select value={opt.goToSection || ""} onChange={e => updateOptionBranching(opt.id, e.target.value || null)}
                    className="px-2 py-1.5 rounded-lg bg-popover border border-border text-xs text-muted-foreground focus:outline-none min-w-[180px]">
                    <option value="" className="bg-popover text-foreground">Lanjutkan ke bagian berikut</option>
                    {sections.map((s, si) => <option key={s.id} value={s.id} className="bg-popover text-foreground">Buka bagian {si + 1} ({s.title})</option>)}
                    <option value="__end__" className="bg-popover text-foreground">Kirim formulir</option>
                  </select>
                )}
                {/* Quiz correct answer */}
                {quizMode && isQuizCapable && (
                  <button onClick={() => {
                    if (field.type === "multiple_choice") onUpdate(field.id, { correctAnswer: opt.id });
                    else {
                      const arr = Array.isArray(field.correctAnswer) ? [...field.correctAnswer] : [];
                      onUpdate(field.id, { correctAnswer: arr.includes(opt.id) ? arr.filter(x => x !== opt.id) : [...arr, opt.id] });
                    }
                  }}
                    className={`p-1 rounded-lg transition ${(field.type === "multiple_choice" ? field.correctAnswer === opt.id : Array.isArray(field.correctAnswer) && field.correctAnswer.includes(opt.id)) ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "text-muted-foreground/40 hover:text-emerald-500"}`}
                    title="Tandai sebagai jawaban benar">
                    <ShieldCheck className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button onClick={addOption} className="flex items-center gap-1.5 text-sm text-[#ff6900] font-medium hover:underline mt-1">
              <Plus className="w-4 h-4" /> Tambah opsi
            </button>
          </div>
        )}

        {/* Linear scale */}
        {field.type === "linear_scale" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Minimum</label>
                <div className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground cursor-not-allowed">1</div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Maksimum</label>
                <select value={field.scaleMax || 5} onChange={e => onUpdate(field.id, { scaleMax: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none">
                  {[2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n} className="bg-popover text-foreground">{n}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input value={field.scaleMinLabel || ""} onChange={e => onUpdate(field.id, { scaleMinLabel: e.target.value })}
                placeholder="Label min (opsional)" className="px-3 py-2 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none placeholder:text-muted-foreground/50" />
              <input value={field.scaleMaxLabel || ""} onChange={e => onUpdate(field.id, { scaleMaxLabel: e.target.value })}
                placeholder="Label max (opsional)" className="px-3 py-2 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none placeholder:text-muted-foreground/50" />
            </div>
          </div>
        )}

        {/* File type */}
        {field.type === "file" && (
          <div>
            <label className="text-xs text-muted-foreground mb-2 block font-semibold">Tipe File</label>
            <div className="flex gap-2">
              {(["image", "pdf"] as const).map(ft => (
                <button key={ft} onClick={() => {
                  const types = field.fileTypes || [];
                  onUpdate(field.id, { fileTypes: types.includes(ft) ? types.filter(t => t !== ft) : [...types, ft] });
                }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${field.fileTypes?.includes(ft) ? "bg-[#ff6900]/10 text-[#ff6900] border border-[#ff6900]/20" : "bg-muted border border-border text-muted-foreground"}`}>
                  {ft === "image" ? "Gambar" : "PDF"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Validation panel */}
        {field.showValidation && hasValidation && field.validation && field.validation.length > 0 && (
          <div className="space-y-2 p-3 rounded-xl bg-sky-50/50 dark:bg-sky-500/5 border border-sky-200 dark:border-sky-500/20">
            <p className="text-xs text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Validasi jawaban
            </p>
            {field.validation.map((rule, ri) => (
              <div key={ri} className="flex items-center gap-2 flex-wrap">
                <select value={rule.type} onChange={e => updateValidation(ri, { type: e.target.value as any })}
                  className="px-2 py-1.5 rounded-lg bg-popover border border-border text-xs focus:outline-none">
                  {getValidationOptions().map(o => <option key={o.value} value={o.value} className="bg-popover text-foreground">{o.label}</option>)}
                </select>
                {(rule.type === "min_length" || rule.type === "max_length" || rule.type === "min_select" || rule.type === "max_select" || rule.type === "exact_select") && (
                  <input type="number" value={rule.value} onChange={e => updateValidation(ri, { value: Number(e.target.value) })} min={0}
                    className="w-20 px-2 py-1.5 rounded-lg bg-card border border-border text-xs focus:outline-none" placeholder="Angka" />
                )}
                <input value={rule.message} onChange={e => updateValidation(ri, { message: e.target.value })} placeholder="Teks kesalahan khusus"
                  className="flex-1 min-w-24 px-2 py-1.5 rounded-lg bg-card border border-border text-xs text-muted-foreground focus:outline-none" />
                <button onClick={() => removeValidation(ri)} className="p-1 text-muted-foreground hover:text-red-500"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}

        {/* Bottom toolbar */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
          <button onClick={() => onDuplicate(field)} className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition" title="Duplikat">
            <Copy className="w-4 h-4" />
          </button>
          <button onClick={() => onRemove(field.id)} className="p-2 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 transition" title="Hapus">
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          {/* Autofill tag for text fields */}
          {field.type === "text" && (
            <div className="relative">
              <button onClick={() => setShowTagDropdown(!showTagDropdown)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition ${field.autofillTag ? "bg-[#ff6900]/10 text-[#ff6900] border border-[#ff6900]/20" : "bg-muted text-muted-foreground border border-border hover:border-[#ff6900]/30"}`}>
                <Tag className="w-3 h-3" />
                {field.autofillTag ? AUTOFILL_TAGS.find(t => t.value === field.autofillTag)?.label : "Autofill"}
              </button>
              {showTagDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowTagDropdown(false)} />
                  <div className="absolute left-0 bottom-full mb-1 w-52 rounded-xl bg-popover border border-border shadow-xl p-1.5 z-50">
                    <button onClick={() => { onUpdate(field.id, { autofillTag: null }); setShowTagDropdown(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition ${!field.autofillTag ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                      Tidak ada autofill
                    </button>
                    {AUTOFILL_TAGS.map(tag => (
                      <button key={tag.value} onClick={() => { onUpdate(field.id, { autofillTag: tag.value }); setShowTagDropdown(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition flex items-center gap-2 ${field.autofillTag === tag.value ? "bg-[#ff6900]/10 text-[#ff6900]" : "text-muted-foreground hover:bg-muted"}`}>
                        {tag.icon}
                        <div><span className="font-medium">{tag.label}</span><p className="text-[10px] opacity-70">{tag.desc}</p></div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="w-px h-5 bg-border mx-1" />
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-muted-foreground">Wajib diisi</span>
            <button onClick={() => onUpdate(field.id, { required: !field.required })}
              className={`relative w-10 h-5 rounded-full transition-all ${field.required ? "bg-[#ff6900]" : "bg-muted-foreground/30"}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${field.required ? "left-5.5" : "left-0.5"}`} />
            </button>
          </label>
          {/* 3-dot menu */}
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition">
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 bottom-full mb-1 w-48 rounded-xl bg-popover border border-border shadow-xl p-1.5 z-50">
                  <p className="text-[10px] text-muted-foreground px-3 py-1 uppercase tracking-wider font-semibold">Tampilkan</p>
                  <button onClick={() => { onUpdate(field.id, { showDescription: !field.showDescription }); setMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition flex items-center gap-2 ${field.showDescription || field.description ? "text-[#ff6900]" : "text-foreground hover:bg-muted"}`}>
                    {(field.showDescription || field.description) && <span>✓</span>} Deskripsi
                  </button>
                  {hasValidation && (
                    <button onClick={() => {
                      if (!field.showValidation) addValidation();
                      else onUpdate(field.id, { showValidation: false });
                      setMenuOpen(false);
                    }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition flex items-center gap-2 ${field.showValidation ? "text-[#ff6900]" : "text-foreground hover:bg-muted"}`}>
                      {field.showValidation && <span>✓</span>} Validasi jawaban
                    </button>
                  )}
                  {hasBranching && sections.length > 0 && (
                    <button onClick={() => { onUpdate(field.id, { showBranching: !field.showBranching }); setMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition flex items-center gap-2 ${field.showBranching ? "text-[#ff6900]" : "text-foreground hover:bg-muted"}`}>
                      {field.showBranching && <span>✓</span>} Buka bagian berdasarkan jawaban
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          {/* Quiz points */}
          {quizMode && isQuizCapable && (
            <div className="flex items-center gap-1.5 ml-2">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <input type="number" value={field.points ?? 0} onChange={e => onUpdate(field.id, { points: Number(e.target.value) })} min={0}
                className="w-14 px-2 py-1 rounded-lg bg-card border border-border text-xs focus:outline-none" />
              <span className="text-[10px] text-muted-foreground">poin</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
