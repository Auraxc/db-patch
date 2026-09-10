CREATE TABLE analytics_events (
  day TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('page_view', 'article_click', 'read_50', 'read_complete')),
  path TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  visitor_hash TEXT NOT NULL CHECK (length(visitor_hash) = 32),
  created_at TEXT NOT NULL,
  PRIMARY KEY (day, event, path, target, visitor_hash)
) WITHOUT ROWID;

CREATE INDEX idx_analytics_events_day_event_path
ON analytics_events(day, event, path);

PRAGMA optimize;
