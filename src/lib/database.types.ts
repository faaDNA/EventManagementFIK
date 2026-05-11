// ============================================================
// OrmawaEvent FIK — Database TypeScript Types v1.1
// Sesuai skema database Supabase
// ============================================================

export type UserRole = "mahasiswa" | "umum" | "ormawa" | "admin";
export type EventStatus = "draft" | "published" | "ongoing" | "completed" | "cancelled";
export type EventCategory = "Seminar" | "Workshop" | "Kompetisi" | "Oprec" | "Pelatihan" | "Lainnya";
export type FormType = "registration" | "attendance";
export type AttendanceMethod = "qr" | "form";
export type AttendanceRecordMethod = "qr_scan" | "form_submit" | "manual";
export type RegistrationStatus = "pending" | "confirmed" | "cancelled";

// Form Builder types (tanpa 'grid')
export type FieldType =
  | "text"
  | "textarea"
  | "multiple_choice"
  | "checkbox"
  | "dropdown"
  | "linear_scale"
  | "file";

export type AutofillTag = "nama" | "nim" | "akun" | null;

// ============================================================
// DATABASE TYPE DEFINITIONS
// ============================================================

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      ormawa: {
        Row: Ormawa;
        Insert: OrmawaInsert;
        Update: OrmawaUpdate;
        Relationships: [];
      };
      events: {
        Row: Event;
        Insert: EventInsert;
        Update: EventUpdate;
        Relationships: [];
      };
      forms: {
        Row: Form;
        Insert: FormInsert;
        Update: FormUpdate;
        Relationships: [];
      };
      form_sections: {
        Row: FormSection;
        Insert: FormSectionInsert;
        Update: FormSectionUpdate;
        Relationships: [];
      };
      form_fields: {
        Row: FormField;
        Insert: FormFieldInsert;
        Update: FormFieldUpdate;
        Relationships: [];
      };
      attendance_sessions: {
        Row: AttendanceSession;
        Insert: AttendanceSessionInsert;
        Update: AttendanceSessionUpdate;
        Relationships: [];
      };
      event_registrations: {
        Row: EventRegistration;
        Insert: EventRegistrationInsert;
        Update: EventRegistrationUpdate;
        Relationships: [];
      };
      attendance_records: {
        Row: AttendanceRecord;
        Insert: AttendanceRecordInsert;
        Update: AttendanceRecordUpdate;
        Relationships: [];
      };
      form_responses: {
        Row: FormResponse;
        Insert: FormResponseInsert;
        Update: FormResponseUpdate;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_ormawa_admin: {
        Args: {
          p_ormawa_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ============================================================
// 1. PROFILES (dengan ormawa_id langsung, tanpa ormawa_members)
// ============================================================
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  nim: string | null;
  ormawa_id: string | null;
  created_at: string;
  updated_at: string;
}
export type ProfileInsert = Omit<Profile, "created_at" | "updated_at">;
export type ProfileUpdate = Partial<Omit<Profile, "id" | "created_at">>;

// ============================================================
// 2. ORMAWA
// ============================================================
export interface Ormawa {
  id: string;
  name: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
}
export type OrmawaInsert = Omit<Ormawa, "id" | "created_at">;
export type OrmawaUpdate = Partial<Omit<Ormawa, "id" | "created_at">>;

// ============================================================
// 3. EVENTS
// ============================================================
export interface Event {
  id: string;
  ormawa_id: string;
  created_by: string;
  title: string;
  description: string | null;
  category: EventCategory | null;
  cover_url: string | null;       // path di Supabase Storage bucket 'event-covers'
  date: string;                   // format: "YYYY-MM-DD"
  end_date: string | null;
  time_start: string | null;      // format: "HH:MM"
  time_end: string | null;
  location: string | null;
  quota: number | null;           // null = tidak terbatas
  registration_close_date: string | null;
  registration_message: string | null;
  status: EventStatus;
  has_presensi: boolean;
  created_at: string;
  updated_at: string;
}
export type EventInsert = Omit<Event, "id" | "created_at" | "updated_at">;
export type EventUpdate = Partial<Omit<Event, "id" | "created_at" | "ormawa_id" | "created_by">>;

// Event dengan relasi ormawa (untuk query JOIN)
export interface EventWithOrmawa extends Event {
  ormawa: Pick<Ormawa, "id" | "name" | "full_name">;
}

// ============================================================
// 4. FORMS
// ============================================================
export interface Form {
  id: string;
  event_id: string;
  form_type: FormType;
  quiz_mode: boolean;
  branching_enabled: boolean;
  created_at: string;
}
export type FormInsert = Omit<Form, "id" | "created_at">;
export type FormUpdate = Partial<Pick<Form, "quiz_mode" | "branching_enabled">>;

// ============================================================
// 5. FORM SECTIONS
// ============================================================
export interface FormSection {
  id: string;
  form_id: string;
  title: string;
  description: string | null;
  order_index: number;
}
export type FormSectionInsert = Omit<FormSection, "id">;
export type FormSectionUpdate = Partial<Omit<FormSection, "id" | "form_id">>;

// ============================================================
// 6. FORM FIELDS (tanpa grid)
// ============================================================

// JSONB configs
export interface FieldOption {
  id: string;
  label: string;
  goToSection?: string | null;
}
export interface ScaleConfig {
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
}
export interface FileConfig {
  types: Array<"image" | "pdf">;
  maxSizeMb?: number;
}
export interface ValidationRule {
  type: "min_length" | "max_length" | "number" | "email" | "regex";
  value: string | number;
  message: string;
}

export interface FormField {
  id: string;
  form_id: string;
  section_id: string | null;
  type: FieldType;
  label: string;
  description: string | null;
  required: boolean;
  autofill_tag: AutofillTag;
  order_index: number;
  options: FieldOption[] | null;
  scale_config: ScaleConfig | null;
  file_config: FileConfig | null;
  validation: ValidationRule[] | null;
  correct_answer: string | string[] | null;
  points: number | null;
}
export type FormFieldInsert = Omit<FormField, "id">;
export type FormFieldUpdate = Partial<Omit<FormField, "id" | "form_id">>;

// ============================================================
// 7. ATTENDANCE SESSIONS
// ============================================================
export interface AttendanceSession {
  id: string;
  event_id: string;
  form_id: string | null;
  name: string;
  method: AttendanceMethod;
  is_open: boolean;
  auto_open_at: string | null;
  auto_close_at: string | null;
  qr_token: string;
  order_index: number;
  created_at: string;
}
export type AttendanceSessionInsert = Omit<AttendanceSession, "id" | "created_at" | "qr_token">;
export type AttendanceSessionUpdate = Partial<
  Pick<AttendanceSession, "name" | "is_open" | "auto_open_at" | "auto_close_at" | "order_index" | "form_id">
>;

// ============================================================
// 8. EVENT REGISTRATIONS
// ============================================================
export interface EventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  status: RegistrationStatus;
  registered_at: string;
}
export type EventRegistrationInsert = Omit<EventRegistration, "id" | "registered_at">;
export type EventRegistrationUpdate = Partial<Pick<EventRegistration, "status">>;

// ============================================================
// 9. ATTENDANCE RECORDS
// ============================================================
export interface AttendanceRecord {
  id: string;
  session_id: string;
  user_id: string;
  method: AttendanceRecordMethod | null;
  attended_at: string;
}
export type AttendanceRecordInsert = Omit<AttendanceRecord, "id" | "attended_at">;
export type AttendanceRecordUpdate = Partial<Pick<AttendanceRecord, "method">>;

// ============================================================
// 10. FORM RESPONSES
// ============================================================
export type FormAnswers = Record<string, string | string[] | number | null>;

export interface FormResponse {
  id: string;
  form_id: string;
  user_id: string;
  registration_id: string | null;
  attendance_record_id: string | null;
  answers: FormAnswers;
  score: number | null;
  submitted_at: string;
}
export type FormResponseInsert = Omit<FormResponse, "id" | "submitted_at">;
export type FormResponseUpdate = Partial<Pick<FormResponse, "answers" | "score">>;

// ============================================================
// HELPER TYPES (untuk frontend)
// ============================================================

// Full form dengan sections + fields
export interface FullForm extends Form {
  sections: FormSection[];
  fields: FormField[];
}

// Event dengan jumlah pendaftar
export interface EventWithCount extends EventWithOrmawa {
  registrations_count: number;
}

// Sesi dengan form jika method='form'
export interface AttendanceSessionWithForm extends AttendanceSession {
  form?: FullForm | null;
}
