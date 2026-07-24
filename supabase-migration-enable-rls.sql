-- =============================================
-- SECURITY FIX: เปิด RLS ตารางที่หลุด (ตามเมลแจ้งเตือน Supabase 12 ก.ค. 2026)
-- 4 ตารางนี้ใครมี anon key (ฝังในหน้าเว็บ) อ่าน/แก้/ลบได้ตรงๆ
-- อันตรายสุด: shop_settings / branch_settings เก็บ LINE token + พร้อมเพย์
-- แอปไม่กระทบ — ทุก query วิ่งผ่าน service role ฝั่ง server ซึ่งข้าม RLS
-- =============================================

ALTER TABLE bike_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bike_routines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_settings   ENABLE ROW LEVEL SECURITY;
