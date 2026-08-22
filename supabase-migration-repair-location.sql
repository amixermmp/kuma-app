-- =============================================
-- REPAIR LOCATION (แจ้งรถเสีย — ต้องระบุตำแหน่งรถ)
-- บังคับเลือกว่ารถอยู่ที่ร้าน หรือ นอกร้าน (ถ้านอกร้านบังคับระบุว่าที่ไหน)
-- กันพนักงานคนอื่นไปตามหารถไม่เจอ
-- =============================================

ALTER TABLE repairs ADD COLUMN IF NOT EXISTS location_type TEXT;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS location_address TEXT;
