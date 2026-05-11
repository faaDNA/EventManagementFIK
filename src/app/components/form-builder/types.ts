export type FieldType =
  | "text"
  | "textarea"
  | "multiple_choice"
  | "checkbox"
  | "dropdown"
  | "linear_scale"
  | "file";

export type AutofillTag = "nama" | "nim" | "akun" | null;

export interface ValidationRule {
  type:
    | "min_length"
    | "max_length"
    | "number"
    | "text"
    | "email"
    | "url"
    | "regex"
    | "min_select"
    | "max_select"
    | "exact_select";
  value: string | number;
  message: string;
}

export interface FieldOption {
  id: string;
  label: string;
  goToSection?: string | null; // branching logic
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  description?: string;
  required: boolean;
  autofillTag: AutofillTag;
  // Options for multiple_choice, checkbox, dropdown
  options?: FieldOption[];
  // Linear scale
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  // File
  fileTypes?: ("image" | "pdf")[];
  // Validation
  validation?: ValidationRule[];
  // Quiz mode
  correctAnswer?: string | string[];
  points?: number;
  // Section
  sectionId?: string;
  // Image attachment for the question itself (base64 data URL)
  imageUrl?: string;
  // UI state: show description field
  showDescription?: boolean;
  // UI state: show validation panel
  showValidation?: boolean;
  // UI state: show branching per option (for MC & dropdown)
  showBranching?: boolean;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  goToSection?: string | null; // navigation after this section
}

export interface FormConfig {
  sections: FormSection[];
  fields: FormField[];
  quizMode?: boolean;
  branchingEnabled?: boolean;
}

// Field type metadata for the UI
export const FIELD_TYPE_META: Record<FieldType, { label: string; color: string; bgColor: string; borderColor: string }> = {
  text: { label: "Teks Singkat", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-500/10", borderColor: "border-blue-200 dark:border-blue-500/20" },
  textarea: { label: "Paragraf", color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-50 dark:bg-purple-500/10", borderColor: "border-purple-200 dark:border-purple-500/20" },
  multiple_choice: { label: "Pilihan Ganda", color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-50 dark:bg-emerald-500/10", borderColor: "border-emerald-200 dark:border-emerald-500/20" },
  checkbox: { label: "Checkbox", color: "text-teal-600 dark:text-teal-400", bgColor: "bg-teal-50 dark:bg-teal-500/10", borderColor: "border-teal-200 dark:border-teal-500/20" },
  dropdown: { label: "Dropdown", color: "text-cyan-600 dark:text-cyan-400", bgColor: "bg-cyan-50 dark:bg-cyan-500/10", borderColor: "border-cyan-200 dark:border-cyan-500/20" },
  linear_scale: { label: "Skala Linier", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-500/10", borderColor: "border-amber-200 dark:border-amber-500/20" },
  file: { label: "Upload File", color: "text-red-600 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-500/10", borderColor: "border-red-200 dark:border-red-500/20" },
};

// Validation type options per field type
export const TEXT_VALIDATION_OPTIONS = [
  { value: "number", label: "Angka" },
  { value: "text", label: "Teks" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
] as const;

export const PARAGRAPH_VALIDATION_OPTIONS = [
  { value: "max_length", label: "Jumlah karakter maksimum" },
  { value: "min_length", label: "Jumlah karakter minimum" },
] as const;

export const CHECKBOX_VALIDATION_OPTIONS = [
  { value: "min_select", label: "Pilihan paling sedikit" },
  { value: "max_select", label: "Pilihan paling banyak" },
  { value: "exact_select", label: "Pilih persis" },
] as const;
