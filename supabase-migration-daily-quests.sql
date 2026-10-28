-- เควสประจำวัน + ติดตามงานค้าง (ตารางใหม่ทั้งหมด ไม่แตะตารางเดิม)

-- 1) เควสที่เจ้าของตั้ง (ใช้ชุดเดียวทุกสาขา; branch_ids ว่าง = ทุกสาขา)
--    slot: open = ตอนเปิดร้าน / day = ระหว่างวัน / close = ตอนปิดร้าน
--    kind: simple = ติ๊กข้อเดียว / checklist = มีรายการย่อย (sub_items) / auto = ดึงจากข้อมูล (auto_source: fuel | closeshop)
CREATE TABLE IF NOT EXISTS daily_quest_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  slot TEXT NOT NULL DEFAULT 'day' CHECK (slot IN ('open', 'day', 'close')),
  kind TEXT NOT NULL DEFAULT 'simple' CHECK (kind IN ('simple', 'checklist', 'auto')),
  sub_items JSONB NOT NULL DEFAULT '[]',
  auto_source TEXT,
  link_url TEXT,
  link_label TEXT,
  require_photo BOOLEAN NOT NULL DEFAULT false,
  require_note BOOLEAN NOT NULL DEFAULT false,
  days_of_week INTEGER[],            -- 0=อาทิตย์ ... 6=เสาร์ ; ว่าง = ทุกวัน
  branch_ids UUID[],                 -- ว่าง = ทุกสาขา
  sort_order INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) บันทึกการติ๊กเควสประจำ (ต่อวัน/สาขา/ข้อ/รายการย่อย)
CREATE TABLE IF NOT EXISTS daily_quest_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quest_date DATE NOT NULL,
  branch_id UUID NOT NULL REFERENCES branches(id),
  template_id UUID NOT NULL REFERENCES daily_quest_templates(id) ON DELETE CASCADE,
  sub_item TEXT NOT NULL DEFAULT '',
  staff_id UUID,
  staff_name TEXT,
  note TEXT,
  photo_url TEXT,
  done_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (quest_date, branch_id, template_id, sub_item)
);
CREATE INDEX IF NOT EXISTS idx_daily_quest_logs_date ON daily_quest_logs(quest_date, branch_id);

-- 3) บันทึกการติดตามงานที่ดึงมาจากงานค้าง (ข้อความผูกกับ "งานนั้นในรอบนั้น" ข้ามวันได้)
--    item_key เช่น  rtn:<routine_id>:<ทำล่าสุด>  /  pay:<monthly_id>:<due_date>  /  ret:<rental_id>
CREATE TABLE IF NOT EXISTS quest_followups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_key TEXT NOT NULL,
  item_type TEXT NOT NULL,
  bike_id UUID,
  branch_id UUID,
  quest_date DATE NOT NULL,
  staff_id UUID,
  staff_name TEXT,
  outcome TEXT NOT NULL,             -- appointed | no_answer | postponed | refused | other
  appointment_date DATE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quest_followups_key ON quest_followups(item_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quest_followups_date ON quest_followups(quest_date, branch_id);

-- 4) ตั้งค่า (แถวเดียว): รอรถกลับกี่วัน + สาขาที่ปิดเควส (ว่าง = เปิดทุกสาขา)
CREATE TABLE IF NOT EXISTS quest_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  wait_days INTEGER NOT NULL DEFAULT 7,
  disabled_branch_ids UUID[] NOT NULL DEFAULT '{}'
);
INSERT INTO quest_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE daily_quest_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_quest_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_settings ENABLE ROW LEVEL SECURITY;

-- 5) เควสตั้งต้น 8 ข้อ (เจ้าของแก้/เพิ่ม/ปิดได้ในหน้าตั้งค่า) — ใส่เฉพาะตอนตารางยังว่าง
INSERT INTO daily_quest_templates (title, slot, kind, sub_items, auto_source, link_url, link_label, require_photo, sort_order)
SELECT * FROM (VALUES
  ('ทำความสะอาดหน้าร้าน + จัดรถหน้าร้านให้เป็นระเบียบ', 'open',  'simple',    '[]'::jsonb, NULL::text,  NULL::text,       NULL::text,         true,  10),
  ('เช็คน้ำมันรถในร้าน',                                 'open',  'auto',      '[]'::jsonb, 'fuel',      '/staff/fuel',    'ไปหน้าภาพรวมน้ำมัน', false, 20),
  ('ลงรูปโปรโมท',                                        'day',   'checklist', '["IG","เฟส","ติ๊กต๊อก"]'::jsonb, NULL, '/staff/marketing', 'ไปหน้ารูปโปรโมท', false, 30),
  ('อัปเดตโปสเตอร์รถว่างลงช่องทางต่างๆ',                  'day',   'simple',    '[]'::jsonb, NULL,        '/staff/search',  'ไปหน้าค้นหารถว่าง',  false, 40),
  ('ล้าง/เช็ดรถที่รับคืนวันนี้',                          'day',   'simple',    '[]'::jsonb, NULL,        NULL,             NULL,               false, 50),
  ('เติมน้ำเข้าตู้เย็นพนักงาน',                            'close', 'simple',    '[]'::jsonb, NULL,        NULL,             NULL,               false, 60),
  ('ทำรายการปิดร้านในแอป',                                'close', 'auto',      '[]'::jsonb, 'closeshop', '/staff/closeshop', 'ไปหน้าปิดร้าน',   false, 70),
  ('ปิดไฟ ล็อกร้าน เก็บของ',                              'close', 'simple',    '[]'::jsonb, NULL,        NULL,             NULL,               true,  80)
) AS v(title, slot, kind, sub_items, auto_source, link_url, link_label, require_photo, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM daily_quest_templates);
