-- เพิ่มตัวเลือก "รับหน้าร้าน" / "ส่งนอกสถานที่" ให้การจองคิว
-- รันใน Supabase SQL Editor

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_type TEXT NOT NULL DEFAULT 'shop'; -- 'shop' | 'offsite'
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_address TEXT; -- ที่อยู่ ใช้เมื่อ delivery_type = 'offsite'
