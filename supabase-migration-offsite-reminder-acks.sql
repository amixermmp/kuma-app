CREATE TABLE IF NOT EXISTS offsite_reminder_acks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_type TEXT NOT NULL CHECK (source_type IN ('send', 'return')),
  source_id UUID NOT NULL,
  staff_id UUID NOT NULL REFERENCES staff(id),
  acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_type, source_id, staff_id)
);

ALTER TABLE offsite_reminder_acks ENABLE ROW LEVEL SECURITY;
