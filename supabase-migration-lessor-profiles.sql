CREATE TABLE IF NOT EXISTS lessor_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  id_card_number TEXT NOT NULL,
  signature_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lessor_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE bikes ADD COLUMN IF NOT EXISTS lessor_profile_id UUID REFERENCES lessor_profiles(id);

INSERT INTO lessor_profiles (name, id_card_number) VALUES
  ('ปิ่นปินัทธ์ ทองใบ', '1379900154571'),
  ('อนุสรณ์ ปัญญาใหม่', '1509900637121');

-- ตั้งรถทุกคันที่มีอยู่เป็นชื่อปิ่นปินัทธ์ก่อน — ค่อยไปแก้เฉพาะคันที่เป็นชื่อแฟนทีหลัง
UPDATE bikes SET lessor_profile_id = (SELECT id FROM lessor_profiles WHERE name = 'ปิ่นปินัทธ์ ทองใบ')
WHERE lessor_profile_id IS NULL;
