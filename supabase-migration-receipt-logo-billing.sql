ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS receipt_logo_url TEXT;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS billing_name TEXT;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS billing_id TEXT;
ALTER TABLE monthly_rentals ADD COLUMN IF NOT EXISTS billing_name TEXT;
ALTER TABLE monthly_rentals ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE monthly_rentals ADD COLUMN IF NOT EXISTS billing_id TEXT;
