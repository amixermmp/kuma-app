-- น้ำมันตอนส่ง (เต็ม/ไม่เต็ม) — ใช้ตัดสินว่าตอนคืนต้องเช็คน้ำมันไหม
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS send_fuel_full BOOLEAN;
-- น้ำมันตอนคืน + ลูกค้ายืนยันว่าเติมมาเองไหม (เฉพาะกรณีตอนส่งเต็ม)
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS return_fuel_full BOOLEAN;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS return_fuel_refueled_by_customer BOOLEAN;
-- รูปกำกับราคาน้ำมันต่อรุ่น/สาขา (ทำเองแปะราคาต่อขีดไว้ในรูป)
ALTER TABLE branch_model_pricing ADD COLUMN IF NOT EXISTS fuel_reference_photo_url TEXT;
