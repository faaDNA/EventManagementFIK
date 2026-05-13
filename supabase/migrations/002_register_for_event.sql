-- ============================================================
-- Atomic Registration: cek kuota + insert dalam 1 transaction
-- Jalankan di: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

CREATE OR REPLACE FUNCTION register_for_event(p_event_id UUID, p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_quota INTEGER;
  v_count INTEGER;
  v_reg_id UUID;
  v_close_date DATE;
  v_status TEXT;
BEGIN
  -- 1. Ambil data event
  SELECT quota, registration_close_date, status
  INTO v_quota, v_close_date, v_status
  FROM events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event tidak ditemukan' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Cek status event
  IF v_status NOT IN ('published', 'ongoing') THEN
    RAISE EXCEPTION 'Event tidak menerima pendaftaran' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Cek deadline
  IF v_close_date IS NOT NULL AND CURRENT_DATE > v_close_date THEN
    RAISE EXCEPTION 'Masa pendaftaran sudah ditutup' USING ERRCODE = 'P0003';
  END IF;

  -- 4. Cek kuota (atomic — dalam 1 transaction, mencegah race condition)
  IF v_quota IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM event_registrations
    WHERE event_id = p_event_id AND status != 'cancelled';

    IF v_count >= v_quota THEN
      RAISE EXCEPTION 'Kuota pendaftaran sudah penuh' USING ERRCODE = 'P0004';
    END IF;
  END IF;

  -- 5. Insert registration
  INSERT INTO event_registrations (event_id, user_id, status)
  VALUES (p_event_id, p_user_id, 'confirmed')
  RETURNING id INTO v_reg_id;

  RETURN v_reg_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
