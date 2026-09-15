CREATE TABLE IF NOT EXISTS availability_posters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  image_url TEXT NOT NULL,
  out_of_stock_models JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE availability_posters ENABLE ROW LEVEL SECURITY;
