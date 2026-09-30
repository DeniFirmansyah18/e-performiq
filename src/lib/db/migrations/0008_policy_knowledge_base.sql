-- 0008: policy knowledge base untuk chatbot governance (Kotak 6), idempoten.
CREATE TABLE IF NOT EXISTS policy_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic VARCHAR(100) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT NOT NULL,
  category VARCHAR(50),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
