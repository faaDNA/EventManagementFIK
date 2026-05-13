-- ============================================================
-- OrmawaEvent FIK — Database Schema v1.1
-- Jalankan di: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- HELPER: update updated_at otomatis
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. ORMAWA (buat dulu karena profiles references ke sini)
-- ============================================================
CREATE TABLE IF NOT EXISTS ormawa (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,           -- "HIMTI"
  full_name   TEXT NOT NULL,           -- "Himpunan Mahasiswa Teknik Informatika"
  email       TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. PROFILES
-- Extends auth.users dengan data tambahan
-- ormawa_id langsung di sini (tanpa tabel ormawa_members)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'umum'
                CHECK (role IN ('mahasiswa', 'umum', 'ormawa', 'admin')),
  nim         TEXT,                    -- hanya untuk role mahasiswa
  ormawa_id   UUID REFERENCES ormawa(id) ON DELETE SET NULL,  -- hanya untuk role ormawa
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger: otomatis buat profil saat user baru register
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, nim, ormawa_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'umum'),
    NEW.raw_user_meta_data->>'nim',
    CASE
      WHEN NEW.raw_user_meta_data->>'ormawa_id' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'ormawa_id')::UUID
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 3. EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ormawa_id               UUID NOT NULL REFERENCES ormawa(id),
  created_by              UUID NOT NULL REFERENCES profiles(id),
  title                   TEXT NOT NULL,
  description             TEXT,
  category                TEXT CHECK (category IN (
                            'Seminar','Workshop','Kompetisi',
                            'Oprec','Pelatihan','Lainnya'
                          )),
  cover_url               TEXT,        -- path di Supabase Storage bucket event-covers
  date                    DATE NOT NULL,
  end_date                DATE,        -- null = 1 hari
  time_start              TIME,
  time_end                TIME,
  location                TEXT,
  quota                   INTEGER,     -- null = tidak terbatas
  registration_close_date DATE,
  registration_message    TEXT,        -- pesan setelah berhasil daftar
  status                  TEXT DEFAULT 'draft' CHECK (status IN (
                            'draft','published','ongoing',
                            'completed','cancelled'
                          )),
  has_presensi            BOOLEAN DEFAULT FALSE,
  target_audience         TEXT DEFAULT 'semua' CHECK (target_audience IN ('semua', 'mahasiswa')),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. FORMS
-- Setiap event WAJIB punya 1 form pendaftaran (form_type='registration')
-- Setiap sesi presensi (method='form') punya 1 form (form_type='attendance')
-- ============================================================
CREATE TABLE IF NOT EXISTS forms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  form_type         TEXT NOT NULL CHECK (form_type IN ('registration', 'attendance')),
  quiz_mode         BOOLEAN DEFAULT FALSE,
  branching_enabled BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. FORM SECTIONS
-- Halaman/bagian dalam form (untuk form multi-halaman)
-- ============================================================
CREATE TABLE IF NOT EXISTS form_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id     UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  go_to_section TEXT              -- UUID target section atau '__end__' untuk kirim form
);

-- ============================================================
-- 6. FORM FIELDS
-- Setiap pertanyaan dalam form (tanpa tipe 'grid')
-- ============================================================
CREATE TABLE IF NOT EXISTS form_fields (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id        UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  section_id     UUID REFERENCES form_sections(id) ON DELETE SET NULL,
  type           TEXT NOT NULL CHECK (type IN (
                   'text','textarea','multiple_choice',
                   'checkbox','dropdown','linear_scale','file'
                 )),
  label          TEXT NOT NULL,
  description    TEXT,
  required       BOOLEAN DEFAULT FALSE,
  autofill_tag   TEXT CHECK (autofill_tag IN ('nama', 'nim', 'akun')),
  order_index    INTEGER DEFAULT 0,

  -- Konfigurasi khusus per tipe field (JSONB = fleksibel)
  options        JSONB,   -- [{id, label, goToSection?}]  untuk MC/checkbox/dropdown
  scale_config   JSONB,   -- {min, max, minLabel, maxLabel}  untuk linear_scale
  file_config    JSONB,   -- {types:['image','pdf'], maxSizeMb: 10}

  -- Validasi input
  validation     JSONB,   -- [{type:'min_length'|'max_length'|'email'|'regex', value, message}]

  -- Quiz mode
  correct_answer JSONB,   -- string | string[] sesuai tipe soal
  points         INTEGER  -- poin untuk quiz mode
);

-- ============================================================
-- 7. ATTENDANCE SESSIONS
-- Sesi presensi per event — bisa banyak sesi per event
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  form_id        UUID REFERENCES forms(id) ON DELETE SET NULL,  -- diisi jika method='form'
  name           TEXT NOT NULL,       -- "Sesi 1 - Pembukaan"
  method         TEXT NOT NULL CHECK (method IN ('qr', 'form')),
  is_open        BOOLEAN DEFAULT FALSE,
  auto_open_at   TIMESTAMPTZ,         -- jadwal buka otomatis
  auto_close_at  TIMESTAMPTZ,         -- jadwal tutup otomatis
  qr_token       TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,  -- token verifikasi QR
  order_index    INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. EVENT REGISTRATIONS
-- Siapa saja yang mendaftar event
-- ============================================================
CREATE TABLE IF NOT EXISTS event_registrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status        TEXT DEFAULT 'confirmed'
                  CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, user_id)   -- 1 user hanya bisa daftar 1x per event
);

-- Function to securely count registrations bypassing RLS
CREATE OR REPLACE FUNCTION get_event_registrations_count(p_event_id UUID)
RETURNS INTEGER AS $$
DECLARE
  count_val INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_val FROM event_registrations WHERE event_id = p_event_id;
  RETURN count_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. ATTENDANCE RECORDS
-- Data siapa yang hadir di sesi presensi mana
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  method      TEXT CHECK (method IN ('qr_scan', 'form_submit', 'manual')),
  attended_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, user_id)   -- 1x presensi per sesi per user
);

-- ============================================================
-- 10. FORM RESPONSES
-- Jawaban user terhadap form (pendaftaran atau presensi)
-- ============================================================
CREATE TABLE IF NOT EXISTS form_responses (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id              UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  registration_id      UUID REFERENCES event_registrations(id) ON DELETE CASCADE,
  attendance_record_id UUID REFERENCES attendance_records(id) ON DELETE CASCADE,
  -- Jawaban: { "field_id": value, ... }
  answers              JSONB NOT NULL DEFAULT '{}',
  score                INTEGER,       -- total poin jika quiz_mode
  submitted_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (form_id, user_id)           -- 1x submit per form per user
);

-- ============================================================
-- INDEXES untuk performa query
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_ormawa     ON profiles(ormawa_id);
CREATE INDEX IF NOT EXISTS idx_events_ormawa       ON events(ormawa_id);
CREATE INDEX IF NOT EXISTS idx_events_status       ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date         ON events(date);
CREATE INDEX IF NOT EXISTS idx_forms_event         ON forms(event_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_form    ON form_fields(form_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_section ON form_fields(section_id);
CREATE INDEX IF NOT EXISTS idx_registrations_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user  ON event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session  ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user     ON attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_responses_form      ON form_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_responses_user      ON form_responses(user_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ormawa              ENABLE ROW LEVEL SECURITY;
ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms               ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_sections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_fields         ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_responses      ENABLE ROW LEVEL SECURITY;

-- Helper: cek apakah user adalah admin sistem
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: cek apakah user adalah admin suatu ormawa
-- Sekarang cek langsung di profiles.ormawa_id (tanpa ormawa_members)
CREATE OR REPLACE FUNCTION is_ormawa_admin(p_ormawa_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'ormawa'
      AND ormawa_id = p_ormawa_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ---- PROFILES POLICIES ----
CREATE POLICY "profiles: user baca profil sendiri"
  ON profiles FOR SELECT
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "profiles: user edit profil sendiri"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles: ormawa bisa lihat profil pendaftar"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM event_registrations er
      JOIN events e ON e.id = er.event_id
      WHERE er.user_id = profiles.id
        AND is_ormawa_admin(e.ormawa_id)
    )
  );

-- ---- ORMAWA POLICIES ----
CREATE POLICY "ormawa: semua bisa lihat ormawa aktif"
  ON ormawa FOR SELECT
  USING (is_active = TRUE OR is_admin());

CREATE POLICY "ormawa: admin sistem kelola ormawa"
  ON ormawa FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---- EVENTS POLICIES ----
CREATE POLICY "events: semua bisa lihat event published"
  ON events FOR SELECT
  USING (status IN ('published', 'ongoing', 'completed') OR is_admin());

CREATE POLICY "events: ormawa bisa lihat semua event sendiri (termasuk draft)"
  ON events FOR SELECT
  USING (is_ormawa_admin(ormawa_id));

CREATE POLICY "events: ormawa kelola event sendiri"
  ON events FOR INSERT
  WITH CHECK (is_ormawa_admin(ormawa_id));

CREATE POLICY "events: ormawa update event sendiri"
  ON events FOR UPDATE
  USING (is_ormawa_admin(ormawa_id));

CREATE POLICY "events: ormawa hapus event sendiri"
  ON events FOR DELETE
  USING (is_ormawa_admin(ormawa_id));

CREATE POLICY "events: admin kelola semua event"
  ON events FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---- FORMS POLICIES ----
CREATE POLICY "forms: ormawa kelola form event sendiri"
  ON forms FOR ALL
  USING (is_ormawa_admin((SELECT ormawa_id FROM events WHERE id = event_id)))
  WITH CHECK (is_ormawa_admin((SELECT ormawa_id FROM events WHERE id = event_id)));

CREATE POLICY "forms: semua bisa lihat form event published"
  ON forms FOR SELECT
  USING (
    (SELECT status FROM events WHERE id = event_id)
      IN ('published', 'ongoing', 'completed')
    OR is_admin()
  );

-- ---- FORM SECTIONS POLICIES ----
CREATE POLICY "form_sections: ormawa kelola"
  ON form_sections FOR ALL
  USING (
    is_ormawa_admin((
      SELECT e.ormawa_id FROM events e
      JOIN forms f ON f.event_id = e.id
      WHERE f.id = form_id
    )) OR is_admin()
  );

CREATE POLICY "form_sections: user baca jika event published"
  ON form_sections FOR SELECT
  USING (
    (SELECT e.status FROM events e
     JOIN forms f ON f.event_id = e.id
     WHERE f.id = form_id)
      IN ('published', 'ongoing', 'completed')
  );

-- ---- FORM FIELDS POLICIES ----
CREATE POLICY "form_fields: ormawa kelola field form sendiri"
  ON form_fields FOR ALL
  USING (
    is_ormawa_admin((
      SELECT e.ormawa_id FROM events e
      JOIN forms f ON f.event_id = e.id
      WHERE f.id = form_id
    )) OR is_admin()
  );

CREATE POLICY "form_fields: user baca field form event published"
  ON form_fields FOR SELECT
  USING (
    (SELECT e.status FROM events e
     JOIN forms f ON f.event_id = e.id
     WHERE f.id = form_id)
      IN ('published', 'ongoing', 'completed')
  );

-- ---- EVENT REGISTRATIONS POLICIES ----
CREATE POLICY "registrations: user daftar sendiri"
  ON event_registrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "registrations: user lihat pendaftaran sendiri"
  ON event_registrations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "registrations: user batalkan pendaftaran sendiri"
  ON event_registrations FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND status = 'cancelled');

CREATE POLICY "registrations: ormawa lihat pendaftar event sendiri"
  ON event_registrations FOR SELECT
  USING (is_ormawa_admin((SELECT ormawa_id FROM events WHERE id = event_id)));

CREATE POLICY "registrations: admin lihat semua"
  ON event_registrations FOR ALL
  USING (is_admin());

-- ---- ATTENDANCE SESSIONS POLICIES ----
CREATE POLICY "sessions: ormawa kelola sesi event sendiri"
  ON attendance_sessions FOR ALL
  USING (is_ormawa_admin((SELECT ormawa_id FROM events WHERE id = event_id)))
  WITH CHECK (is_ormawa_admin((SELECT ormawa_id FROM events WHERE id = event_id)));

CREATE POLICY "sessions: peserta terdaftar bisa lihat sesi"
  ON attendance_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM event_registrations
      WHERE event_id = attendance_sessions.event_id
        AND user_id = auth.uid()
        AND status = 'confirmed'
    ) OR is_admin()
  );

CREATE POLICY "sessions: public bisa lihat sesi"
  ON attendance_sessions FOR SELECT
  USING (true);

-- ---- ATTENDANCE RECORDS POLICIES ----
CREATE POLICY "attendance: user insert presensi sendiri"
  ON attendance_records FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "attendance: user lihat presensi sendiri"
  ON attendance_records FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "attendance: ormawa lihat dan kelola presensi event sendiri"
  ON attendance_records FOR ALL
  USING (
    is_ormawa_admin((
      SELECT e.ormawa_id FROM events e
      JOIN attendance_sessions s ON s.event_id = e.id
      WHERE s.id = session_id
    ))
  );

CREATE POLICY "attendance: admin lihat semua"
  ON attendance_records FOR ALL
  USING (is_admin());

-- ---- FORM RESPONSES POLICIES ----
CREATE POLICY "responses: user submit sekali"
  ON form_responses FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "responses: user lihat jawaban sendiri"
  ON form_responses FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "responses: ormawa lihat jawaban form event sendiri"
  ON form_responses FOR SELECT
  USING (
    is_ormawa_admin((
      SELECT e.ormawa_id FROM events e
      JOIN forms f ON f.event_id = e.id
      WHERE f.id = form_id
    ))
  );

CREATE POLICY "responses: admin lihat semua"
  ON form_responses FOR ALL
  USING (is_admin());

-- ============================================================
-- SEED DATA — Ormawa awal
-- ============================================================
INSERT INTO ormawa (name, full_name, email, instagram) VALUES
  ('HIMTI',      'Himpunan Mahasiswa Teknik Informatika', 'himti@upnvj.ac.id',    '@himti.upnvj'),
  ('GDSC UPNVJ', 'Google Developer Student Club UPNVJ',  'gdsc@upnvj.ac.id',     '@gdsc.upnvj'),
  ('BEM FIK',    'Badan Eksekutif Mahasiswa FIK',        'bemfik@upnvj.ac.id',   '@bemfik.upnvj'),
  ('HMSI',       'Himpunan Mahasiswa Sistem Informasi',  'hmsi@upnvj.ac.id',     '@hmsi.upnvj')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STORAGE BUCKETS — Buat manual di Supabase Dashboard > Storage
--
-- 1. "avatars"       | Public: YES | MIME: image/*                       | Max: 2MB
-- 2. "ormawa-logos"  | Public: YES | MIME: image/*                       | Max: 2MB
-- 3. "event-covers"  | Public: YES | MIME: image/*                       | Max: 5MB
-- 4. "form-uploads"  | Public: NO  | MIME: image/*, application/pdf      | Max: 10MB
--
-- Cara kerja upload gambar:
-- 1. User pilih file dari device
-- 2. Frontend upload ke Supabase Storage via supabase.storage.from('bucket').upload(path, file)
-- 3. Dapat public URL via supabase.storage.from('bucket').getPublicUrl(path)
-- 4. Simpan URL tersebut ke kolom database (avatar_url, logo_url, cover_url)
-- 5. Saat tampilkan, gunakan URL itu langsung di <img src={url} />
-- ============================================================
