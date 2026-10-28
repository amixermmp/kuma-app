-- ลิมิตการซ่อนรายการด้วย "นัดวันที่" ในเควส (เจ้าของปรับได้ในหน้าตั้งค่าเควส)
ALTER TABLE quest_settings ADD COLUMN IF NOT EXISTS max_appointment_days INTEGER NOT NULL DEFAULT 7;  -- นัดไกลสุดกี่วันจากวันที่ทัก (ทุกชนิดงาน)
ALTER TABLE quest_settings ADD COLUMN IF NOT EXISTS max_snooze_followups INTEGER NOT NULL DEFAULT 2;  -- ทักกี่ครั้งแล้วเลิกให้นัดซ่อน (ทักครั้งที่ 1-2 ซ่อนได้ ครั้งที่ 3 ขึ้นไปซ่อนไม่ได้)
