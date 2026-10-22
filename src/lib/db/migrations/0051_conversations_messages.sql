-- 0051: Chat pimpinan (PRD v2.0 §5.8, §10.3 E).
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_type VARCHAR(20) NOT NULL DEFAULT 'DIRECT'
    CHECK (conversation_type IN ('DIRECT', 'GROUP')),
  title VARCHAR(200),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  attachment_url TEXT,
  is_recalled BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (NOT (is_recalled AND attachment_url IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages (conversation_id, sent_at DESC);
