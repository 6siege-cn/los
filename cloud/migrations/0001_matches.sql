CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  match_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  received_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  public_json TEXT,
  private_json TEXT,
  UNIQUE(day, fingerprint)
);
CREATE INDEX IF NOT EXISTS matches_public ON matches(deleted, received_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS daily_quota (
  day TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  used INTEGER NOT NULL,
  PRIMARY KEY(day, ip_hash)
);
CREATE TRIGGER IF NOT EXISTS match_quota AFTER INSERT ON matches BEGIN
  INSERT INTO daily_quota(day,ip_hash,used) VALUES(NEW.day,NEW.ip_hash,1)
  ON CONFLICT(day,ip_hash) DO UPDATE SET used=used+1;
END;
