-- เลิกใช้แนวทางคลังรูปสำเร็จรูป (availability_posters) แล้ว เปลี่ยนมาใช้กากบาททับรูปต้นฉบับอัตโนมัติแทน
DROP TABLE IF EXISTS availability_posters;

ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS poster_template_url TEXT;

CREATE TABLE IF NOT EXISTS poster_hotspots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  x_pct NUMERIC NOT NULL,
  y_pct NUMERIC NOT NULL,
  width_pct NUMERIC NOT NULL,
  height_pct NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE poster_hotspots ENABLE ROW LEVEL SECURITY;
