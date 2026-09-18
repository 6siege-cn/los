CREATE TABLE stats_state(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
INSERT INTO stats_state VALUES(1,1);
CREATE TABLE stats_meta(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, generated_at TEXT NOT NULL, checked_at TEXT NOT NULL);
INSERT INTO stats_meta VALUES(1,0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
CREATE TABLE stats_buckets(key TEXT PRIMARY KEY, total INTEGER NOT NULL, attack_wins INTEGER NOT NULL, operators TEXT NOT NULL);
CREATE TRIGGER stats_insert AFTER INSERT ON matches WHEN NEW.deleted=0 BEGIN
  UPDATE stats_state SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER stats_delete AFTER UPDATE OF deleted ON matches WHEN NEW.deleted!=OLD.deleted BEGIN
  UPDATE stats_state SET revision=revision+1 WHERE id=1;
END;
-- The view is evaluated only by the scheduled publisher, never by a page request.
CREATE VIEW stats_source_buckets AS
WITH active AS MATERIALIZED (
  SELECT public_json AS data,
    json_array(json_extract(public_json,'$.mapId'),json_extract(public_json,'$.ruleId'),
      json_extract(public_json,'$.mode'),json_extract(public_json,'$.matchType'),
      json_extract(public_json,'$.scope.alt'),json_extract(public_json,'$.scope.diy')) AS key,
    json_extract(public_json,'$.winner') AS winner
  FROM matches WHERE deleted=0
), groups AS (
  SELECT key,COUNT(*) AS total,SUM(winner='attack') AS attack_wins FROM active GROUP BY key
), events AS (
  SELECT active.key,j.value AS op,1 AS picks,(winner='attack') AS wins,0 AS bans FROM active,json_each(data,'$.picks.attack') j
  UNION ALL SELECT active.key,j.value,1,(winner='defense'),0 FROM active,json_each(data,'$.picks.defense') j
  UNION ALL SELECT active.key,j.value,0,0,1 FROM active,json_each(data,'$.bans.attack') j
  UNION ALL SELECT active.key,j.value,0,0,1 FROM active,json_each(data,'$.bans.defense') j
), counts AS (
  SELECT key,op,SUM(picks) AS picks,SUM(wins) AS wins,SUM(bans) AS bans FROM events GROUP BY key,op
), rosters AS (
  SELECT key,json_group_object(op,json_array(picks,wins,bans)) AS operators FROM counts GROUP BY key
)
SELECT groups.key,total,attack_wins,COALESCE(operators,'{}') AS operators FROM groups LEFT JOIN rosters ON rosters.key=groups.key;
-- Bootstrap the first snapshot as part of the migration, including existing matches.
INSERT INTO stats_buckets SELECT * FROM stats_source_buckets;
UPDATE stats_meta SET revision=(SELECT revision FROM stats_state WHERE id=1) WHERE id=1;
