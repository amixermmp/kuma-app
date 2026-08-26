-- แยกเบอร์โทรผู้รับบิลออกจากเลขบัตร/พาสปอร์ต/เลขผู้เสียภาษี (เดิมปนกันช่องเดียวจน label ผิด)
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS billing_phone TEXT;
ALTER TABLE monthly_rentals ADD COLUMN IF NOT EXISTS billing_phone TEXT;
