-- ติดต่อไม่ได้เกินกำหนด → ธงแดง "ทักหาพี่เจ้าของร้าน" + เควสปิดร้านอัตโนมัติ "บันทึกผลรายการต้องทักให้ครบ"
ALTER TABLE quest_settings ADD COLUMN IF NOT EXISTS escalate_unreachable_days INTEGER NOT NULL DEFAULT 2;         -- ติดต่อไม่ได้คนละวันกี่วันแล้วขึ้นธงแดง (ทั่วไป)
ALTER TABLE quest_settings ADD COLUMN IF NOT EXISTS escalate_unreachable_days_return INTEGER NOT NULL DEFAULT 1;  -- เกินกำหนดคืนรถรายวัน ติดต่อไม่ได้กี่วันแล้วขึ้นธงแดง

INSERT INTO daily_quest_templates (title, slot, kind, auto_source, sort_order)
SELECT 'บันทึกผลรายการต้องทักให้ครบ', 'close', 'auto', 'followups', 65
WHERE NOT EXISTS (SELECT 1 FROM daily_quest_templates WHERE auto_source = 'followups');
