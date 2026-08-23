-- ตั้งค่าโปร "จ่ายกี่วัน จาก 7 วัน" แยกตามรุ่นรถ (NULL = ใช้ค่ากลาง 5)
ALTER TABLE bike_models ADD COLUMN IF NOT EXISTS promo_pay_days INT;
