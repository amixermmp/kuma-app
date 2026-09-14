ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS line_channel_secret TEXT;
ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS staff_line_group_id TEXT;
