-- ประวัติการย้ายที่อยู่รถระหว่างซ่อม (อยู่ร้าน <-> นอกร้าน) — กันแจ้งซ่อมซ้ำเพื่อบันทึกการย้าย
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS location_log JSONB DEFAULT '[]';
