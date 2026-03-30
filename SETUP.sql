-- CSU VALUE LIST — Supabase Setup
-- Run this entire file in the Supabase SQL Editor before first deploy

CREATE TABLE IF NOT EXISTS pets (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  category     TEXT DEFAULT 'standard',
  image_url    TEXT DEFAULT '',
  existence_rate TEXT DEFAULT 'Unknown',
  normal_value BIGINT DEFAULT 0,
  gold_value   BIGINT DEFAULT 0,
  rainbow_value BIGINT DEFAULT 0,
  has_gold     BOOLEAN DEFAULT true,
  has_rainbow  BOOLEAN DEFAULT true,
  notes        TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admins (
  username      TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  role          TEXT DEFAULT 'admin',
  display_name  TEXT,
  token         TEXT UNIQUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credits (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT DEFAULT '',
  discord    TEXT DEFAULT '',
  order_num  INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE pets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins  ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;

-- Allow all operations via anon key (server handles its own auth)
CREATE POLICY "allow_all_pets"    ON pets    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_admins"  ON admins  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_credits" ON credits FOR ALL USING (true) WITH CHECK (true);
