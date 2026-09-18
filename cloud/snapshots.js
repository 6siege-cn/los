const changed='(SELECT revision FROM stats_state WHERE id=1)!=(SELECT revision FROM stats_meta WHERE id=1)';
export async function rebuildSnapshot(db,now=new Date().toISOString()){
  const state=await db.prepare('SELECT s.revision,m.revision AS published FROM stats_state s JOIN stats_meta m ON s.id=m.id WHERE s.id=1').first();
  if(state.revision===state.published){await db.prepare('UPDATE stats_meta SET checked_at=? WHERE id=1').bind(now).run();return false;}
  // Every statement shares one D1 transaction: concurrent submissions cannot be lost.
  await db.batch([
    db.prepare('DELETE FROM stats_buckets WHERE '+changed),
    db.prepare('INSERT INTO stats_buckets SELECT * FROM stats_source_buckets WHERE '+changed),
    db.prepare(`UPDATE stats_meta SET generated_at=CASE WHEN ${changed} THEN ? ELSE generated_at END,checked_at=?,revision=(SELECT revision FROM stats_state WHERE id=1) WHERE id=1`).bind(now,now)
  ]);
  return true;
}
export async function readSnapshot(db,catalog){
  const results=await db.batch([db.prepare('SELECT revision,generated_at,checked_at FROM stats_meta WHERE id=1'),db.prepare('SELECT key,total,attack_wins,operators FROM stats_buckets ORDER BY key')]);
  const meta=results[0].results[0];if(!meta)throw Error('统计结果尚未生成');
  return {schemaVersion:2,revision:meta.revision,generatedAt:meta.generated_at,checkedAt:meta.checked_at,catalog,
    buckets:results[1].results.map(row=>({key:JSON.parse(row.key),total:row.total,attackWins:row.attack_wins,operators:JSON.parse(row.operators)}))};
}
