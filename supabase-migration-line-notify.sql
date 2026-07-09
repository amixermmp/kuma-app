-- =============================================
-- Migration: LINE Customer Notification System (per-branch)
-- รองรับหลายสาขา — แต่ละสาขามี LINE OA / LIFF / PromptPay ของตัวเอง
-- รันใน Supabase SQL Editor
-- =============================================

-- 1) ตั้งค่า LINE ลูกค้า รายสาขา
ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS line_token TEXT;              -- Channel access token ของ OA สาขานั้น
ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS line_liff_id TEXT;            -- LIFF ID ของสาขานั้น
ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS promptpay_id TEXT;            -- เบอร์/เลขบัตร PromptPay ของสาขานั้น
ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS line_notify_customer BOOLEAN DEFAULT TRUE;

-- แจ้งเตือนงานรูทีน (น้ำมันเครื่อง/เฟืองท้าย ฯลฯ) เข้าไลน์เจ้าของ
ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS line_notify_routine BOOLEAN DEFAULT TRUE;

-- 2) ผูก LINE userId ของลูกค้า แยกตามสาขา
--    (userId ของ LINE ต่างกันในแต่ละ OA — ลูกค้าคนเดียวเช่าหลายสาขาต้องผูกแยก)
CREATE TABLE IF NOT EXISTS customer_line_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  line_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (customer_id, branch_id)
);

ALTER TABLE customer_line_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON customer_line_links FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3) log กันส่งข้อความซ้ำ (1 เรื่อง + 1 รายการ + 1 รอบกำหนด = ส่งครั้งเดียว)
--    kind: 'rental_due_soon' | 'rental_overdue' | 'rental_overdue_daily'
--          | 'monthly_due' | 'routine_due' | 'doc_expiry'
--    ref_id: id ของ rental / monthly_rental / bike_routine / bike_document แล้วแต่ kind
CREATE TABLE IF NOT EXISTS line_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  ref_id UUID NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (kind, ref_id, due_at)
);

ALTER TABLE line_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON line_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 4) ตั้งเวลาเรียก cron ทุก 10 นาที (pg_cron + pg_net)
--    ก่อนรัน: แก้ YOUR-DOMAIN.vercel.app และ YOUR-CRON-SECRET ให้ตรงของจริง
--    (YOUR-CRON-SECRET ต้องตรงกับ env CRON_SECRET บน Vercel)
-- =============================================
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- SELECT cron.schedule(
--   'line-notify-customers',
--   '*/10 * * * *',
--   $$
--   SELECT net.http_get(
--     url := 'https://YOUR-DOMAIN.vercel.app/api/cron/line-notify?secret=YOUR-CRON-SECRET'
--   );
--   $$
-- );
--
-- ยกเลิกทีหลังได้ด้วย: SELECT cron.unschedule('line-notify-customers');
