-- LINE Chatbot: conversation history per user per branch
CREATE TABLE IF NOT EXISTS line_chat_sessions (
  line_user_id  TEXT        NOT NULL,
  branch_id     UUID        NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  messages      JSONB       NOT NULL DEFAULT '[]',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (line_user_id, branch_id)
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_line_chat_sessions_branch ON line_chat_sessions(branch_id);
