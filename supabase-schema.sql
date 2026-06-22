-- =============================================
-- Kuma App — Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- BRANCHES (สาขา)
-- =============================================
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- STAFF (พนักงาน)
-- =============================================
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES branches(id),
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'staff', -- 'owner' | 'staff'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- BIKES (รถมอเตอร์ไซค์)
-- =============================================
CREATE TABLE bikes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),
  license_plate TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  color TEXT,
  year INT,
  daily_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  monthly_rate NUMERIC(10,2) DEFAULT 0,
  deposit_amount NUMERIC(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available', -- 'available' | 'rented' | 'maintenance' | 'monthly'
  odometer INT DEFAULT 0,
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CUSTOMERS (ลูกค้า)
-- =============================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  id_card TEXT,
  address TEXT,
  workplace TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  is_blacklisted BOOLEAN DEFAULT FALSE,
  blacklist_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- RENTALS (การเช่ารายวัน)
-- =============================================
CREATE TABLE rentals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),
  bike_id UUID NOT NULL REFERENCES bikes(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  staff_id UUID REFERENCES staff(id),

  -- วันเวลา
  start_datetime TIMESTAMPTZ NOT NULL,
  expected_end_datetime TIMESTAMPTZ NOT NULL,
  actual_end_datetime TIMESTAMPTZ,

  -- เงิน
  daily_rate NUMERIC(10,2) NOT NULL,
  total_days INT,
  total_amount NUMERIC(10,2),
  deposit_amount NUMERIC(10,2) DEFAULT 0,
  deposit_returned BOOLEAN DEFAULT FALSE,
  discount NUMERIC(10,2) DEFAULT 0,
  extra_charge NUMERIC(10,2) DEFAULT 0,
  extra_charge_reason TEXT,
  payment_method TEXT DEFAULT 'cash', -- 'cash' | 'transfer' | 'mixed'
  paid_amount NUMERIC(10,2) DEFAULT 0,

  -- สถานะ
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'extended' | 'returned' | 'overdue'
  is_overdue_notified BOOLEAN DEFAULT FALSE,

  -- รูปภาพตอนส่งรถ (ลบเมื่อรับรถคืน)
  send_photos JSONB DEFAULT '[]', -- [{url, label}]
  -- รูปภาพตอนรับรถคืน (ลบหลัง 30 วัน)
  return_photos JSONB DEFAULT '[]',

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- RENTAL EXTENSIONS (การต่อเวลา)
-- =============================================
CREATE TABLE rental_extensions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rental_id UUID NOT NULL REFERENCES rentals(id),
  extended_until TIMESTAMPTZ NOT NULL,
  extra_days INT NOT NULL,
  extra_amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- MONTHLY RENTALS (เช่ารายเดือน)
-- =============================================
CREATE TABLE monthly_rentals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),
  bike_id UUID NOT NULL REFERENCES bikes(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  staff_id UUID REFERENCES staff(id),

  start_date DATE NOT NULL,
  monthly_rate NUMERIC(10,2) NOT NULL,
  deposit_amount NUMERIC(10,2) DEFAULT 0,
  deposit_returned BOOLEAN DEFAULT FALSE,
  payment_day INT DEFAULT 1, -- วันที่ต้องจ่ายทุกเดือน (1-31)

  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'ended'
  end_date DATE,

  -- รูปภาพ
  send_photos JSONB DEFAULT '[]',
  return_photos JSONB DEFAULT '[]',

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- MONTHLY PAYMENTS (การจ่ายเงินรายเดือน)
-- =============================================
CREATE TABLE monthly_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  monthly_rental_id UUID NOT NULL REFERENCES monthly_rentals(id),
  due_date DATE NOT NULL,
  paid_date DATE,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  status TEXT DEFAULT 'pending', -- 'pending' | 'paid' | 'overdue'
  is_overdue_notified BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- REPAIRS (งานซ่อม)
-- =============================================
CREATE TABLE repairs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),
  bike_id UUID NOT NULL REFERENCES bikes(id),
  reported_by UUID REFERENCES staff(id),

  title TEXT NOT NULL,
  description TEXT,
  repair_cost NUMERIC(10,2) DEFAULT 0,
  parts_cost NUMERIC(10,2) DEFAULT 0,
  shop_name TEXT,

  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'in_progress' | 'done'
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- รูปซ่อม (ลบเมื่อซ่อมเสร็จ)
  repair_photos JSONB DEFAULT '[]',

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- EXPENSES (ค่าใช้จ่าย)
-- =============================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),
  recorded_by UUID REFERENCES staff(id),

  category TEXT NOT NULL, -- 'salary' | 'rent' | 'utility' | 'maintenance' | 'other'
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'cash',
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INVOICES (ใบกำกับภาษี)
-- =============================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),
  rental_id UUID REFERENCES rentals(id),
  monthly_rental_id UUID REFERENCES monthly_rentals(id),
  customer_id UUID NOT NULL REFERENCES customers(id),

  invoice_number TEXT NOT NULL UNIQUE, -- INV-2026-0001
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,

  subtotal NUMERIC(10,2) NOT NULL,
  vat_rate NUMERIC(5,2) DEFAULT 7.00,
  vat_amount NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,

  customer_name TEXT NOT NULL,
  customer_address TEXT,
  customer_tax_id TEXT,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- APP SETTINGS (ตั้งค่าแอป / ข้อมูลร้าน)
-- =============================================
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),

  shop_name TEXT,
  shop_address TEXT,
  shop_phone TEXT,
  shop_tax_id TEXT,
  logo_url TEXT,

  -- สีแอป
  primary_color TEXT DEFAULT '#f59e0b',

  -- LINE Notification
  line_token TEXT,
  line_group_id TEXT,
  notify_overdue BOOLEAN DEFAULT TRUE,
  notify_return_soon BOOLEAN DEFAULT TRUE,
  overdue_alert_hours INT DEFAULT 2, -- แจ้งเตือนหลังเกินกำหนด N ชั่วโมง

  -- Search buffer
  availability_buffer_hours INT DEFAULT 3, -- หน่วงเวลา N ชั่วโมงก่อนแสดงรถว่าง

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PROMOTIONS (โปรโมชั่น)
-- =============================================
CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT DEFAULT 'fixed', -- 'fixed' | 'percent'
  discount_value NUMERIC(10,2) NOT NULL,
  valid_from DATE,
  valid_until DATE,
  max_uses INT,
  used_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES (สำหรับ performance)
-- =============================================
CREATE INDEX idx_rentals_bike_id ON rentals(bike_id);
CREATE INDEX idx_rentals_customer_id ON rentals(customer_id);
CREATE INDEX idx_rentals_status ON rentals(status);
CREATE INDEX idx_rentals_expected_end ON rentals(expected_end_datetime);
CREATE INDEX idx_bikes_status ON bikes(status);
CREATE INDEX idx_bikes_branch ON bikes(branch_id);
CREATE INDEX idx_monthly_rentals_bike ON monthly_rentals(bike_id);
CREATE INDEX idx_monthly_rentals_status ON monthly_rentals(status);
CREATE INDEX idx_expenses_branch_date ON expenses(branch_id, expense_date);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE bikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read/write their own data
-- (ตอนนี้เปิดกว้างก่อน — จะ lock down ตามสาขาทีหลัง)
CREATE POLICY "authenticated_all" ON branches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON staff FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON bikes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON rentals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON rental_extensions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON monthly_rentals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON monthly_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON repairs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON promotions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- STORAGE BUCKETS (สำหรับรูปภาพ)
-- =============================================
-- Run these separately in Supabase Dashboard → Storage

-- INSERT INTO storage.buckets (id, name, public) VALUES ('rental-photos', 'rental-photos', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('bike-photos', 'bike-photos', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);

-- =============================================
-- SEED: Default branch + settings
-- =============================================
INSERT INTO branches (id, name, address) VALUES
  ('00000000-0000-0000-0000-000000000001', 'สาขาหลัก', '');

INSERT INTO app_settings (branch_id, shop_name, primary_color) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Kuma Rental', '#f59e0b');
