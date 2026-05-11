import React, { useState, useCallback } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Plus, Layers, Award, X } from "lucide-react";
import type { FormField, FormSection, FieldType } from "./types";
import { FIELD_TYPE_META } from "./types";
import { FieldCard } from "./FieldCard";
import { DraggableField, SectionDropZone, GlobalAutoScroll } from "./DraggableField";

interface FormBuilderProps {
  fields: FormField[];
  sections: FormSection[];
  quizMode: boolean;
  branchingEnabled: boolean;
  onFieldsChange: (fields: FormField[]) => void;
  onSectionsChange: (sections: FormSection[]) => void;
  onQuizModeChange: (enabled: boolean) => void;
  onBranchingChange: (enabled: boolean) => void;
  showAutofillTags?: boolean;
  showQuizMode?: boolean;
}

export function FormBuilder({
  fields, sections, quizMode, branchingEnabled,
  onFieldsChange, onSectionsChange, onQuizModeChange, onBranchingChange,
  showQuizMode = true,
}: FormBuilderProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // ── Field CRUD ──
  const addField = (type: FieldType, sectionId?: string) => {
    const id = `f${Date.now()}`;
    const newField: FormField = {
      id, type, label: "", required: false, autofillTag: null,
      sectionId: sectionId || (sections.length > 0 ? sections[0].id : undefined),
      showDescription: false, showValidation: false,
    };
    if (type === "multiple_choice" || type === "checkbox" || type === "dropdown")
      newField.options = [{ id: "o1", label: "Opsi 1" }, { id: "o2", label: "Opsi 2" }];
    if (type === "linear_scale") { newField.scaleMin = 1; newField.scaleMax = 5; }
    if (type === "file") newField.fileTypes = ["image", "pdf"];
    onFieldsChange([...fields, newField]);
  };

  const updateField = (id: string, updates: Partial<FormField>) =>
    onFieldsChange(fields.map(f => f.id === id ? { ...f, ...updates } : f));

  const removeField = (id: string) => onFieldsChange(fields.filter(f => f.id !== id));

  const duplicateField = (field: FormField) => {
    const nf = { ...field, id: `f${Date.now()}`, label: `${field.label} (salinan)` };
    if (nf.options) nf.options = nf.options.map(o => ({ ...o, id: `o${Date.now()}-${Math.random()}` }));
    const idx = fields.findIndex(f => f.id === field.id);
    const arr = [...fields]; arr.splice(idx + 1, 0, nf);
    onFieldsChange(arr);
  };

  // ID-based moveField — mendukung reorder dan pindah antar section
  const moveField = useCallback((dragId: string, hoverId: string, placeBefore: boolean) => {
    if (dragId === hoverId) return;
    const dragIdx = fields.findIndex(f => f.id === dragId);
    const hoverIdx = fields.findIndex(f => f.id === hoverId);
    if (dragIdx === -1 || hoverIdx === -1) return;

    const targetIdx = placeBefore ? hoverIdx : hoverIdx + 1;

    // Cek apakah field sudah di posisi yang benar — cegah oscillasi
    if (dragIdx === targetIdx || dragIdx + 1 === targetIdx) {
      // Tetap update sectionId jika berbeda (misal field sudah di posisi tapi section-nya belum berubah)
      if (fields[dragIdx].sectionId !== fields[hoverIdx].sectionId) {
        onFieldsChange(fields.map(f => f.id === dragId ? { ...f, sectionId: fields[hoverIdx].sectionId } : f));
      }
      return;
    }

    const arr = [...fields];
    const [removed] = arr.splice(dragIdx, 1);
    // Pindah section: inherit sectionId dari target
    removed.sectionId = fields[hoverIdx].sectionId;
    const adjustedTarget = targetIdx > dragIdx ? targetIdx - 1 : targetIdx;
    arr.splice(adjustedTarget, 0, removed);
    onFieldsChange(arr);
  }, [fields, onFieldsChange]);

  // ── Section CRUD ──
  const addSection = () => {
    const id = `sec${Date.now()}`;
    const newSections = [...sections, { id, title: `Bagian ${sections.length + 1}` }];
    onSectionsChange(newSections);
    if (sections.length === 0) {
      onFieldsChange(fields.map(f => ({ ...f, sectionId: id })));
    }
  };

  const updateSection = (id: string, updates: Partial<FormSection>) =>
    onSectionsChange(sections.map(s => s.id === id ? { ...s, ...updates } : s));

  const removeSection = (id: string) => {
    const remaining = sections.filter(s => s.id !== id);
    onSectionsChange(remaining);
    const fallback = remaining.length > 0 ? remaining[0].id : undefined;
    onFieldsChange(fields.map(f => f.sectionId === id ? { ...f, sectionId: fallback } : f));
  };

  // Group fields by section
  const getFieldsForSection = (sectionId: string) =>
    fields.filter(f => f.sectionId === sectionId);

  // Called when a field is dropped onto a section drop zone
  const handleDropField = useCallback((fieldId: string, targetSectionId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field || field.sectionId === targetSectionId) return;

    const arr = fields.filter(f => f.id !== fieldId);
    const updated = { ...field, sectionId: targetSectionId };

    let insertIndex = -1;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].sectionId === targetSectionId) {
        insertIndex = i + 1;
        break;
      }
    }
    if (insertIndex === -1) {
      const secIdx = sections.findIndex(s => s.id === targetSectionId);
      for (let i = arr.length - 1; i >= 0; i--) {
        const fSecIdx = sections.findIndex(s => s.id === arr[i].sectionId);
        if (fSecIdx < secIdx) { insertIndex = i + 1; break; }
      }
      if (insertIndex === -1) insertIndex = 0;
    }

    arr.splice(insertIndex, 0, updated);
    onFieldsChange(arr);
  }, [fields, sections, onFieldsChange]);

  const renderFieldList = (sectionFields: FormField[]) => {
    return sectionFields.map(field => (
      <DraggableField key={field.id} id={field.id} moveField={moveField}>
        <FieldCard
          field={field}
          sections={sections}
          quizMode={quizMode}
          branchingEnabled={branchingEnabled}
          onUpdate={updateField}
          onRemove={removeField}
          onDuplicate={duplicateField}
        />
      </DraggableField>
    ));
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <GlobalAutoScroll />
      <div className="space-y-4">
        {showQuizMode !== false && (
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => onQuizModeChange(!quizMode)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition ${quizMode ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20" : "bg-muted border border-border text-muted-foreground hover:text-foreground"}`}>
              <Award className="w-4 h-4" /> Mode Kuis {quizMode ? "ON" : "OFF"}
            </button>

            <span className="text-xs text-muted-foreground italic ml-2">
              Kuis hanya berlaku untuk Pilihan Ganda dan Checkbox
            </span>
          </div>
        )}

        {/* Sections + Fields */}
        {sections.length === 0 ? (
          // No sections — flat list
          <div className="space-y-3">
            {renderFieldList(fields)}
          </div>
        ) : (
          // Section-based layout
          <div className="space-y-6">
            {sections.map((sec, si) => (
              <div key={sec.id} className="relative">
                {/* Section badge */}
                <div className="mb-0">
                  <span className="inline-block px-3 py-1 rounded-t-lg bg-[#ff6900] text-white text-xs font-semibold">
                    Bagian {si + 1} dari {sections.length}
                  </span>
                </div>
                {/* Section card */}
                <div className="border border-border rounded-b-2xl rounded-tr-2xl overflow-hidden bg-card shadow-sm">
                  {/* Accent bar */}
                  <div className="h-2 bg-gradient-to-r from-[#ff6900] to-[#ff8c3a]" />
                  {/* Section header */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <input value={sec.title} onChange={e => updateSection(sec.id, { title: e.target.value })}
                          placeholder="Bagian Tanpa Judul"
                          className="w-full text-xl font-bold text-foreground bg-transparent border-b-2 border-transparent focus:border-[#ff6900] outline-none py-1 transition" />
                        <input value={sec.description || ""} onChange={e => updateSection(sec.id, { description: e.target.value })}
                          placeholder="Deskripsi (opsional)"
                          className="w-full text-sm text-muted-foreground bg-transparent border-b border-transparent focus:border-border/50 outline-none py-0.5 transition" />
                      </div>
                      <button onClick={() => removeSection(sec.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {/* Fields in this section — drop zone */}
                  <div className="px-5 pb-5">
                    <SectionDropZone sectionId={sec.id} onDropField={handleDropField} isEmpty={getFieldsForSection(sec.id).length === 0}>
                      <div className="space-y-3">
                        {renderFieldList(getFieldsForSection(sec.id))}
                      </div>
                    </SectionDropZone>
                  </div>
                </div>
                {/* Section footer: "Setelah bagian X" — tidak ditampilkan di section terakhir */}
                {sections.length > 1 && si < sections.length - 1 && (
                  <div className="flex items-center gap-3 mt-2 px-1">
                    <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                      Setelah bagian {si + 1}
                    </span>
                    <select
                      value={sec.goToSection || ""}
                      onChange={e => updateSection(sec.id, { goToSection: e.target.value || null })}
                      className="flex-1 max-w-xs px-3 py-1.5 rounded-lg bg-popover border border-border text-xs text-muted-foreground focus:outline-none focus:border-[#ff6900]/40 transition"
                    >
                      <option value="" className="bg-popover text-foreground">Lanjutkan ke bagian berikut</option>
                      {sections.map((s, ssi) => (
                        s.id !== sec.id && (
                          <option key={s.id} value={s.id} className="bg-popover text-foreground">Buka bagian {ssi + 1} ({s.title})</option>
                        )
                      ))}
                      <option value="__end__" className="bg-popover text-foreground">Kirim formulir</option>
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Floating action buttons */}
        <div className="flex items-center gap-2 pt-4 border-t border-border">
          <button onClick={() => addField("text", sections.length > 0 ? sections[sections.length - 1].id : undefined)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff6900]/10 border border-[#ff6900]/20 text-[#ff6900] text-sm font-semibold hover:bg-[#ff6900]/20 transition">
            <Plus className="w-4 h-4" /> Tambah Pertanyaan
          </button>
          <button onClick={addSection}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm font-medium hover:bg-muted/80 transition">
            <Layers className="w-4 h-4" /> Tambah Bagian
          </button>
        </div>
      </div>
    </DndProvider>
  );
}
