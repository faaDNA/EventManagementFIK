import React, { useState, useRef } from "react";
import {
  Type, AlignLeft, CircleDot, CheckSquare, ChevronDown,
  Upload, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, Loader2
} from "lucide-react";
import type { FormField, FormSection, ValidationRule } from "./types";

interface FormRendererProps {
  fields: FormField[];
  sections: FormSection[];
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
  fileNames?: Record<string, string>;
  onFileUpload?: (fieldId: string, file: File) => void;
  uploadingFields?: Record<string, boolean>;
  readOnly?: boolean;
  quizMode?: boolean;
  showResults?: boolean;
  onSubmit?: () => void;
  submitting?: boolean;
  submitLabel?: string;
  branchingEnabled?: boolean;
}

function validateField(value: any, rules: ValidationRule[]): string | null {
  for (const rule of rules) {
    const strVal = String(value || "");
    switch (rule.type) {
      case "min_length":
        if (strVal.length < Number(rule.value)) return rule.message;
        break;
      case "max_length":
        if (strVal.length > Number(rule.value)) return rule.message;
        break;
      case "number":
        if (strVal && isNaN(Number(strVal))) return rule.message;
        break;
      case "email":
        if (strVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) return rule.message;
        break;
      case "url":
        if (strVal && !/^https?:\/\/.+/.test(strVal)) return rule.message;
        break;
      case "text":
        if (strVal && /\d/.test(strVal)) return rule.message;
        break;
      case "min_select": {
        const arr = Array.isArray(value) ? value : [];
        if (arr.length < Number(rule.value)) return rule.message;
        break;
      }
      case "max_select": {
        const arr = Array.isArray(value) ? value : [];
        if (arr.length > Number(rule.value)) return rule.message;
        break;
      }
      case "exact_select": {
        const arr = Array.isArray(value) ? value : [];
        if (arr.length !== Number(rule.value)) return rule.message;
        break;
      }
      case "regex":
        try {
          if (strVal && !new RegExp(String(rule.value)).test(strVal)) return rule.message;
        } catch {
          return "Regex tidak valid";
        }
        break;
    }
  }
  return null;
}

export function FormRenderer({
  fields,
  sections,
  values,
  onChange,
  fileNames = {},
  onFileUpload,
  uploadingFields = {},
  readOnly = false,
  quizMode = false,
  showResults = false,
  onSubmit,
  submitting = false,
  submitLabel = "Submit",
  branchingEnabled: branchingEnabledProp = false,
}: FormRendererProps) {
  // Auto-detect branching: if any section/option has goToSection, enable it
  const branchingEnabled = branchingEnabledProp || 
    sections.some(s => !!s.goToSection) ||
    fields.some(f => f.options?.some(o => !!o.goToSection));

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [sectionHistory, setSectionHistory] = useState<number[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [sectionErrors, setSectionErrors] = useState<string[]>([]);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const hasSections = sections.length > 0;
  const currentSection = hasSections ? sections[currentSectionIndex] : null;
  const visibleFields = hasSections
    ? fields.filter((f) => f.sectionId === currentSection?.id)
    : fields;

  const handleBlur = (fieldId: string) => {
    setTouched((prev) => ({ ...prev, [fieldId]: true }));
  };

  // Validate all visible fields and submit only if valid
  const handleSubmitWithValidation = () => {
    const fieldsToValidate = hasSections
      ? fields.filter(f => f.sectionId === currentSection?.id)
      : fields;
    const newTouched: Record<string, boolean> = {};
    let hasError = false;
    for (const field of fieldsToValidate) {
      newTouched[field.id] = true;
      if (getRawError(field)) hasError = true;
    }
    // For no-sections or last-section, also validate ALL fields
    if (!hasSections || currentSectionIndex >= sections.length) {
      for (const field of fields) {
        newTouched[field.id] = true;
        if (getRawError(field)) hasError = true;
      }
    }
    setTouched(prev => ({ ...prev, ...newTouched }));
    if (hasError) return;
    onSubmit?.();
  };

  const getRawError = (field: FormField): string | null => {
    if (field.required) {
      if (field.type === "checkbox") {
        const arr = values[field.id];
        if (!arr || arr.length === 0) return "Pertanyaan ini wajib diisi.";
      } else if (field.type === "file") {
        if (!fileNames[field.id] && !(typeof values[field.id] === "string" && values[field.id]?.startsWith("http"))) return "File wajib diunggah.";
      } else {
        const val = values[field.id];
        if (val === undefined || val === null || val === "") return "Pertanyaan ini wajib diisi.";
      }
    }
    if (field.validation && field.validation.length > 0) {
      return validateField(values[field.id], field.validation);
    }
    return null;
  };

  const getError = (field: FormField): string | null => {
    if (!touched[field.id] && !readOnly) return null;
    return getRawError(field);
  };

  const handlePreviousSection = () => {
    if (sectionHistory.length > 0) {
      const prevIndex = sectionHistory[sectionHistory.length - 1];
      setSectionHistory(sectionHistory.slice(0, -1));
      setCurrentSectionIndex(prevIndex);
    } else if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
    }
  };

  const handleNextSection = () => {
    const sectionFields = fields.filter((f) => f.sectionId === currentSection?.id);

    // 1. Validate all fields in this section first
    const newTouched: Record<string, boolean> = {};
    const errors: string[] = [];
    for (const field of sectionFields) {
      newTouched[field.id] = true;
      const err = getRawError(field);
      if (err) errors.push(err);
    }
    setTouched((prev) => ({ ...prev, ...newTouched }));

    if (errors.length > 0) {
      setSectionErrors(errors);
      return; // Block navigation
    }
    setSectionErrors([]);

    const nextHistory = [...sectionHistory, currentSectionIndex];

    // 2. Check field-level branching (multiple_choice or dropdown fields)
    if (branchingEnabled) {
      for (const field of sectionFields) {
        if ((field.type === "multiple_choice" || field.type === "dropdown") && field.options) {
          const selectedOptId = values[field.id];
          const selectedOpt = field.options.find((o) => o.id === selectedOptId);
          if (selectedOpt?.goToSection) {
            if (selectedOpt.goToSection === "__end__") {
              setSectionHistory(nextHistory);
              setCurrentSectionIndex(sections.length);
              return;
            }
            const targetIdx = sections.findIndex((s) => s.id === selectedOpt.goToSection);
            if (targetIdx >= 0) {
              setSectionHistory(nextHistory);
              setCurrentSectionIndex(targetIdx);
              return;
            }
          }
        }
      }
    }

    // 3. Check section-level branching (Setelah mengisi section x akan menuju...)
    if (branchingEnabled && currentSection?.goToSection) {
      if (currentSection.goToSection === "__end__") {
        setSectionHistory(nextHistory);
        setCurrentSectionIndex(sections.length);
        return;
      }
      const targetIdx = sections.findIndex((s) => s.id === currentSection.goToSection);
      if (targetIdx >= 0) {
        setSectionHistory(nextHistory);
        setCurrentSectionIndex(targetIdx);
        return;
      }
    }

    // 4. Default: go to next section
    if (currentSectionIndex < sections.length - 1) {
      setSectionHistory(nextHistory);
      setCurrentSectionIndex(currentSectionIndex + 1);
    }
  };

  // Determine if this is the last section in the user's flow
  const isLastSection = (() => {
    // Standard: last section by index
    if (currentSectionIndex >= sections.length - 1) return true;
    
    if (!branchingEnabled) return false;

    // Section-level: current section points to __end__
    if (currentSection?.goToSection === "__end__") return true;

    // Field-level: a selected option in this section points to __end__
    const sectionFields = fields.filter(f => f.sectionId === currentSection?.id);
    for (const field of sectionFields) {
      if ((field.type === "multiple_choice" || field.type === "dropdown") && field.options) {
        const selectedOptId = values[field.id];
        const selectedOpt = field.options.find(o => o.id === selectedOptId);
        if (selectedOpt?.goToSection === "__end__") return true;
      }
    }

    return false;
  })();

  const inputClass = "w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none transition placeholder:text-muted-foreground/40";
  const errorInputClass = "w-full px-4 py-2.5 rounded-xl bg-input-background border border-red-300 dark:border-red-500/40 text-foreground text-sm focus:border-red-400 focus:outline-none transition";

  const renderField = (field: FormField) => {
    const error = getError(field);
    const isCorrect = quizMode && showResults && field.correctAnswer === values[field.id];
    const isWrong = quizMode && showResults && field.correctAnswer && field.correctAnswer !== values[field.id];

    return (
      <div key={field.id} className="space-y-1.5">
        {/* Label */}
        <label className="text-sm font-medium text-foreground flex items-center gap-1.5 flex-wrap">
          {field.label}
          {field.required && <span className="text-red-400 text-xs">*</span>}
          {quizMode && field.points !== undefined && field.points > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
              {field.points} poin
            </span>
          )}
        </label>
        {field.description && <p className="text-xs text-muted-foreground -mt-0.5">{field.description}</p>}
        {field.imageUrl && (
          <div className="rounded-xl overflow-hidden border border-border mt-1">
            <img src={field.imageUrl} alt="" className="w-full max-h-64 object-contain bg-muted/30" />
          </div>
        )}

        {/* Text input */}
        {field.type === "text" && (
          <input
            type="text"
            value={values[field.id] || ""}
            onChange={(e) => onChange(field.id, e.target.value)}
            onBlur={() => handleBlur(field.id)}
            readOnly={readOnly}
            placeholder="Jawaban singkat"
            className={error ? errorInputClass : inputClass}
          />
        )}

        {/* Textarea */}
        {field.type === "textarea" && (
          <textarea
            value={values[field.id] || ""}
            onChange={(e) => onChange(field.id, e.target.value)}
            onBlur={() => handleBlur(field.id)}
            readOnly={readOnly}
            rows={3}
            placeholder="Jawaban paragraf"
            className={`${error ? errorInputClass : inputClass} resize-none`}
          />
        )}

        {/* Multiple choice */}
        {field.type === "multiple_choice" && field.options && (
          <div className="space-y-2 pt-1">
            {field.options.map((opt) => {
              const selected = values[field.id] === opt.id;
              const isCorrectOpt = quizMode && showResults && field.correctAnswer === opt.id;
              return (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition group ${
                    selected
                      ? isWrong && opt.id === values[field.id]
                        ? "border-red-300 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5"
                        : "border-[#ff6900]/30 bg-[#ff6900]/5"
                      : isCorrectOpt && showResults
                      ? "border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5"
                      : "border-border hover:border-[#ff6900]/20 hover:bg-muted/50"
                  } ${readOnly ? "pointer-events-none" : ""}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                    selected ? "border-[#ff6900]" : "border-border group-hover:border-[#ff6900]/40"
                  }`}>
                    {selected && <div className="w-2.5 h-2.5 rounded-full bg-[#ff6900]" />}
                  </div>
                  <span className={`text-sm flex-1 ${selected ? "text-foreground font-medium" : "text-muted-foreground"}`}>{opt.label}</span>
                  {isCorrectOpt && showResults && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                  <input type="radio" name={field.id} value={opt.id} checked={selected}
                    onChange={() => onChange(field.id, opt.id)} className="hidden" />
                </label>
              );
            })}
          </div>
        )}

        {/* Checkbox */}
        {field.type === "checkbox" && field.options && (
          <div className="space-y-2 pt-1">
            {field.options.map((opt) => {
              const selectedArr: string[] = values[field.id] || [];
              const checked = selectedArr.includes(opt.id);
              return (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition group ${
                    checked ? "border-[#ff6900]/30 bg-[#ff6900]/5" : "border-border hover:border-[#ff6900]/20 hover:bg-muted/50"
                  } ${readOnly ? "pointer-events-none" : ""}`}
                >
                  <div className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 transition ${
                    checked ? "border-[#ff6900] bg-[#ff6900]" : "border-border group-hover:border-[#ff6900]/40"
                  }`}>
                    {checked && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6l2.5 2.5 4.5-5" /></svg>}
                  </div>
                  <span className={`text-sm flex-1 ${checked ? "text-foreground font-medium" : "text-muted-foreground"}`}>{opt.label}</span>
                  <input type="checkbox" checked={checked}
                    onChange={() => {
                      const newArr = checked ? selectedArr.filter((id) => id !== opt.id) : [...selectedArr, opt.id];
                      onChange(field.id, newArr);
                    }} className="hidden" />
                </label>
              );
            })}
          </div>
        )}

        {/* Dropdown */}
        {field.type === "dropdown" && field.options && (
          <div className="relative">
            <button
              type="button"
              onClick={() => !readOnly && setOpenDropdowns((prev) => ({ ...prev, [field.id]: !prev[field.id] }))}
              className={`${inputClass} flex items-center justify-between text-left ${!values[field.id] ? "text-muted-foreground/40" : ""}`}
            >
              <span>{field.options.find((o) => o.id === values[field.id])?.label || "Pilih salah satu..."}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
            {openDropdowns[field.id] && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpenDropdowns((prev) => ({ ...prev, [field.id]: false }))} />
                <div className="absolute left-0 right-0 top-full mt-1 rounded-xl bg-popover border border-border shadow-xl p-1.5 z-50 max-h-48 overflow-y-auto">
                  {field.options.map((opt) => (
                    <button key={opt.id}
                      onClick={() => { onChange(field.id, opt.id); setOpenDropdowns((prev) => ({ ...prev, [field.id]: false })); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${values[field.id] === opt.id ? "bg-[#ff6900]/10 text-[#ff6900]" : "text-foreground hover:bg-muted"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Linear scale */}
        {field.type === "linear_scale" && (
          <div className="pt-1">
            <div className="flex items-center justify-center gap-0 flex-wrap">
              {field.scaleMinLabel && <span className="text-xs text-muted-foreground mr-3 mb-1">{field.scaleMinLabel}</span>}
              {Array.from({ length: (field.scaleMax || 5) - (field.scaleMin || 1) + 1 }, (_, i) => i + (field.scaleMin || 1)).map((n) => {
                const selected = values[field.id] === n;
                return (
                  <button key={n}
                    onClick={() => !readOnly && onChange(field.id, n)}
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-medium transition mx-0.5 mb-1 ${
                      selected
                        ? "border-[#ff6900] bg-[#ff6900] text-white shadow-md shadow-[#ff6900]/20"
                        : "border-border text-muted-foreground hover:border-[#ff6900]/40 hover:text-foreground"
                    } ${readOnly ? "pointer-events-none" : ""}`}>
                    {n}
                  </button>
                );
              })}
              {field.scaleMaxLabel && <span className="text-xs text-muted-foreground ml-3 mb-1">{field.scaleMaxLabel}</span>}
            </div>
          </div>
        )}

        {/* File upload */}
        {field.type === "file" && (
          <div className="relative">
            <input
              ref={(el) => { fileInputRefs.current[field.id] = el; }}
              type="file"
              accept={field.fileTypes?.map((t) => t === "image" ? "image/*" : ".pdf").join(",") || "*"}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && onFileUpload) onFileUpload(field.id, file);
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => !readOnly && !uploadingFields[field.id] && fileInputRefs.current[field.id]?.click()}
              className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-dashed transition ${
                uploadingFields[field.id]
                  ? "border-blue-300 dark:border-blue-500/30 bg-blue-50/30 dark:bg-blue-500/5"
                  : (fileNames[field.id] || (typeof values[field.id] === "string" && values[field.id]?.startsWith("http")))
                  ? "border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-500/5"
                  : "border-border hover:border-[#ff6900]/30 bg-muted/30"
              } ${readOnly ? "pointer-events-none" : ""}`}
            >
              {uploadingFields[field.id] ? (
                <>
                  <Loader2 className="w-5 h-5 text-blue-500 shrink-0 animate-spin" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm text-foreground font-medium">Mengupload file...</p>
                    <p className="text-[10px] text-blue-500">Mohon tunggu</p>
                  </div>
                </>
              ) : fileNames[field.id] ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">{fileNames[field.id]}</p>
                    <p className="text-[10px] text-emerald-500">File terpilih — klik untuk ganti</p>
                  </div>
                </>
              ) : typeof values[field.id] === "string" && values[field.id]?.startsWith("http") ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">{values[field.id].split("/").pop()}</p>
                    <p className="text-[10px] text-emerald-500">File tersimpan (draft) — klik untuk ganti</p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 text-left">
                    <p className="text-sm text-muted-foreground">Klik untuk upload file</p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {field.fileTypes?.map((t) => t === "image" ? "JPG, PNG" : "PDF").join(", ") || "Semua format"}
                    </p>
                  </div>
                </>
              )}
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-1.5 text-red-500 text-xs">
            <AlertCircle className="w-3 h-3" />
            <span>{error}</span>
          </div>
        )}

        {/* Quiz result */}
        {quizMode && showResults && field.correctAnswer && (
          <div className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg ${
            isCorrect ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-50 dark:bg-red-500/10 text-red-500"
          }`}>
            {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {isCorrect ? `Benar! +${field.points || 0} poin` : "Jawaban salah"}
          </div>
        )}
      </div>
    );
  };

  // If no sections, render all fields + submit
  if (!hasSections) {
    return (
      <div className="space-y-5">
        {visibleFields.map(renderField)}
        {onSubmit && (
          <div className="pt-2">
            <button
              onClick={handleSubmitWithValidation}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold hover:opacity-90 transition shadow-md shadow-[#ff6900]/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {submitting ? "Mengirim..." : submitLabel}
            </button>
          </div>
        )}
      </div>
    );
  }

  // With sections - paginated
  if (currentSectionIndex >= sections.length) {
    // Past the last section (branching jumped to __end__)
    // Show submit button if onSubmit provided
    return (
      <div className="space-y-6">
        <div className="text-center py-4 text-muted-foreground text-sm">
          Semua bagian telah selesai diisi.
        </div>
        {onSubmit && (
          <button
            onClick={handleSubmitWithValidation}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold hover:opacity-90 transition shadow-md shadow-[#ff6900]/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitting ? "Mengirim..." : submitLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400 text-xs font-bold">
          {currentSectionIndex + 1}
        </span>
        <div>
          <h3 className="text-base font-bold text-foreground">{currentSection?.title}</h3>
          {currentSection?.description && <p className="text-xs text-muted-foreground">{currentSection.description}</p>}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">Bagian {currentSectionIndex + 1} / {sections.length}</span>
      </div>

      {/* Fields */}
      <div className="space-y-5">{visibleFields.map(renderField)}</div>

      {/* Section validation error banner */}
      {sectionErrors.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Harap lengkapi semua field yang wajib diisi dan perbaiki kesalahan sebelum melanjutkan.</span>
        </div>
      )}
      {/* Section navigation */}
      <div className="flex gap-3 pt-2">
        {(currentSectionIndex > 0 || sectionHistory.length > 0) && (
          <button onClick={handlePreviousSection}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground font-medium hover:bg-muted transition flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Sebelumnya
          </button>
        )}
        {!isLastSection && (
          <button onClick={handleNextSection}
            className="flex-1 py-2.5 rounded-xl bg-[#ff6900]/10 border border-[#ff6900]/20 text-[#ff6900] text-sm font-semibold hover:bg-[#ff6900]/20 transition flex items-center justify-center gap-2">
            Selanjutnya <ArrowRight className="w-4 h-4" />
          </button>
        )}
        {isLastSection && onSubmit && (
          <button
            onClick={() => {
              // Validate current section fields before submit
              const sectionFields = fields.filter(f => f.sectionId === currentSection?.id);
              const newTouched: Record<string, boolean> = {};
              let hasError = false;
              for (const field of sectionFields) {
                newTouched[field.id] = true;
                if (getRawError(field)) hasError = true;
              }
              setTouched(prev => ({ ...prev, ...newTouched }));
              if (hasError) {
                setSectionErrors(["Harap lengkapi semua field yang wajib diisi."]);
                return;
              }
              setSectionErrors([]);
              onSubmit?.();
            }}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold hover:opacity-90 transition shadow-md shadow-[#ff6900]/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitting ? "Mengirim..." : submitLabel}
          </button>
        )}
      </div>
    </div>
  );
}
