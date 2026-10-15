-- ตั้งเวลาให้ LINE chatbot ตอบ (รายสาขา) — ใช้ร่วมกับสวิตช์เปิด/ปิดเดิม (line_bot_enabled)
-- สวิตช์ปิด = ไม่ตอบเลย / สวิตช์เปิด = ตอบตามตารางนี้ (ถ้ายังไม่ตั้งตาราง = ตอบทั้งวันเหมือนเดิม)
--
-- line_bot_schedule: ตารางประจำสัปดาห์ เช่น
--   {"mon":{"mode":"range","start":"20:00","end":"09:00"},"sat":{"mode":"all"},"sun":{"mode":"off"}}
--   mode = 'all' (ตอบทั้งวัน) | 'range' (ตอบช่วง start–end ข้ามเที่ยงคืนได้) | 'off' (ไม่ตอบทั้งวัน)
-- line_bot_today_override: ตั้งเฉพาะวันนั้น เช่น {"date":"2026-10-15","mode":"range","start":"18:00","end":"23:00"}
--   ใช้แทนตารางของวันนั้นเท่านั้น หมดอายุเองเมื่อพ้นวัน (เวลาไทย)
ALTER TABLE branch_settings
  ADD COLUMN IF NOT EXISTS line_bot_schedule JSONB,
  ADD COLUMN IF NOT EXISTS line_bot_today_override JSONB;
