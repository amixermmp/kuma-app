CREATE TABLE IF NOT EXISTS branch_oil_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  oil_type TEXT NOT NULL CHECK (oil_type IN ('engine', 'gear')),
  quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, oil_type)
);

ALTER TABLE branch_oil_stock ENABLE ROW LEVEL SECURITY;

-- สร้างแถวเริ่มต้น (0 ขวด) ให้ทุกสาขา x ทุกชนิดน้ำมัน กันต้องมาเช็ค null ทีหลัง
INSERT INTO branch_oil_stock (branch_id, oil_type, quantity)
SELECT b.id, t.oil_type, 0
FROM branches b
CROSS JOIN (VALUES ('engine'), ('gear')) AS t(oil_type)
ON CONFLICT (branch_id, oil_type) DO NOTHING;
