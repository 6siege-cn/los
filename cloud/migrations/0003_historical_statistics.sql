DROP VIEW stats_source_buckets;
CREATE VIEW stats_source_buckets AS
WITH active AS MATERIALIZED (
  SELECT public_json AS data,
    json_array(json_extract(public_json,'$.mapId'),json_extract(public_json,'$.ruleId'),
      json_extract(public_json,'$.mode'),json_extract(public_json,'$.matchType'),
      json_extract(public_json,'$.scope.alt'),json_extract(public_json,'$.scope.diy'),
      COALESCE(json_extract(public_json,'$.source.kind')='xlsx',0),
      COALESCE(json_extract(public_json,'$.source.bansRecorded'),1)) AS key,
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
UPDATE stats_state SET revision=revision+1 WHERE id=1;
DELETE FROM stats_buckets;
INSERT INTO stats_buckets SELECT * FROM stats_source_buckets;
UPDATE stats_meta SET revision=(SELECT revision FROM stats_state WHERE id=1),generated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),checked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
