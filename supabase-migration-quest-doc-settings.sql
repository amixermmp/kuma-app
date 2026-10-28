-- ค่าตั้งของเควสเอกสาร (ภาษี / พ.ร.บ.) — เจ้าของปรับได้ในหน้าตั้งค่าเควส
ALTER TABLE quest_settings ADD COLUMN IF NOT EXISTS pob_lead_days INTEGER NOT NULL DEFAULT 7;           -- พ.ร.บ./ภาษีรถอายุน้อย เริ่มแจ้งเจ้าของก่อนหมดกี่วัน
ALTER TABLE quest_settings ADD COLUMN IF NOT EXISTS tax_lead_days INTEGER NOT NULL DEFAULT 30;          -- ภาษีรถที่ต้องนำเข้า เริ่มเตือนล่วงหน้ากี่วัน
ALTER TABLE quest_settings ADD COLUMN IF NOT EXISTS tax_expired_wait_days INTEGER NOT NULL DEFAULT 7;   -- ภาษีหมดแล้ว รอรวมกับน้ำมันเครื่องได้ไม่เกินกี่วัน
ALTER TABLE quest_settings ADD COLUMN IF NOT EXISTS inspect_years INTEGER NOT NULL DEFAULT 5;           -- รถอายุกี่ปีขึ้นไปต้องนำเข้าตรวจสภาพ
