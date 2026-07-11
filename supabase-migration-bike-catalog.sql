-- =============================================
-- Migration: คลังยี่ห้อ/รุ่นรถ (bike catalog)
-- ทำให้ owner เพิ่ม/แก้ ยี่ห้อ-รุ่น เองได้ + dropdown ในหน้าเพิ่ม/แก้รถ
-- รันใน Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS bike_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bike_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL,   -- ชื่อยี่ห้อ (ตรงกับ bikes.brand)
  name TEXT NOT NULL,    -- ชื่อรุ่น
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand, name)
);

-- seed ชื่อมาตรฐาน (ตามที่เจ้าของกำหนด)
INSERT INTO bike_brands (name) VALUES ('Honda'), ('Yamaha'), ('GPX')
  ON CONFLICT (name) DO NOTHING;

INSERT INTO bike_models (brand, name) VALUES
  ('Yamaha', 'Fino'),
  ('Yamaha', 'GT'),
  ('Yamaha', 'Qbix'),
  ('Yamaha', 'Grand Filano'),
  ('Yamaha', 'Grand Filano Hybrid'),
  ('Yamaha', 'Aerox'),
  ('Yamaha', 'NMAX'),
  ('Honda', 'Zoomer-x'),
  ('Honda', 'Zoomer-x Digital'),
  ('Honda', 'Scoopy-i'),
  ('Honda', 'Scoopy-i Gen3'),
  ('Honda', 'Scoopy-i Gen4'),
  ('Honda', 'PCX'),
  ('GPX', 'Tuscany')
  ON CONFLICT (brand, name) DO NOTHING;

ALTER TABLE bike_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE bike_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON bike_brands FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON bike_models FOR ALL TO authenticated USING (true) WITH CHECK (true);
