-- รองรับ 1 ตำแหน่งบนโปสเตอร์ผูกได้หลายรุ่น (เช่นราคาเท่ากัน ใช้จุดเดียวกัน) — กากบาทเมื่อทุกรุ่นในจุดนั้นหมดพร้อมกัน
CREATE TABLE IF NOT EXISTS poster_hotspot_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotspot_id UUID NOT NULL REFERENCES poster_hotspots(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL
);

ALTER TABLE poster_hotspot_models ENABLE ROW LEVEL SECURITY;

INSERT INTO poster_hotspot_models (hotspot_id, brand, model)
SELECT id, brand, model FROM poster_hotspots WHERE brand IS NOT NULL AND model IS NOT NULL;

ALTER TABLE poster_hotspots DROP COLUMN IF EXISTS brand;
ALTER TABLE poster_hotspots DROP COLUMN IF EXISTS model;
