ALTER TABLE rentals ADD COLUMN IF NOT EXISTS send_type TEXT;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS send_address TEXT;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS send_fee NUMERIC DEFAULT 0;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS return_fee NUMERIC DEFAULT 0;
ALTER TABLE monthly_rentals ADD COLUMN IF NOT EXISTS send_type TEXT;
ALTER TABLE monthly_rentals ADD COLUMN IF NOT EXISTS send_address TEXT;
ALTER TABLE monthly_rentals ADD COLUMN IF NOT EXISTS send_fee NUMERIC DEFAULT 0;
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name FROM pg_constraint
    WHERE conrelid = 'rental_payments'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%kind%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE rental_payments DROP CONSTRAINT %I', con_name);
  END IF;
END $$;
ALTER TABLE rental_payments ADD CONSTRAINT rental_payments_kind_check
  CHECK (kind IN ('rental', 'extend', 'overtime', 'early_return_refund', 'return_fee'));
