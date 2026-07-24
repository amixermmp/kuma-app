-- =============================================
-- BOOKING BLACKLIST WATCH (เตือนพนักงานถ้าชื่อ/เบอร์ที่จองตรงกับแบล็คลิสต์)
-- ไม่บล็อกการจอง แค่แจ้งเตือนให้พนักงานระวังไว้ก่อนลูกค้ามาถึง
-- กันเคสถ้าบล็อกทันทีจะโดนคนละคนชื่อพ้องเจ็บไปด้วย และโจรตัวจริงก็แค่เปลี่ยนชื่อจองใหม่ได้อยู่ดี
-- =============================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS blacklist_watch BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS blacklist_watch_reason TEXT;
