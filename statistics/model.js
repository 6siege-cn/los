const familyKey=op=>op.familyId??`${op.side}:${op.name.trim().toUpperCase()}`;
const rate=(n,d)=>d?n/d:null;
export function aggregateSnapshot(snapshot,{mapId='',ruleId='',mode='',matchType='normal',version='',family=false}={}){
  const catalog=snapshot.catalog.filter(op=>!version||op.version===version),byId=new Map(catalog.map(op=>[op.id,op]));
  const rows=new Map(),maps=new Map();let total=0,attackWins=0,historicalTotal=0,missingBans=0;
  for(const op of catalog){const key=family?familyKey(op):op.id;if(!rows.has(key))rows.set(key,{...op,id:key,version:family?'family':op.version,picks:0,wins:0,bans:0,eligible:0,banEligible:0});}
  for(const bucket of snapshot.buckets){
    const [map,rule,gameMode,type,alt,diy,historical=0,bansRecorded=1]=bucket.key;
    if((mapId&&map!==mapId)||(ruleId&&rule!==ruleId)||(mode&&gameMode!==mode)||(matchType!=='all'&&type!==matchType))continue;
    total+=bucket.total;attackWins+=bucket.attackWins;if(historical)historicalTotal+=bucket.total;if(!bansRecorded)missingBans+=bucket.total;
    const mapRow=maps.get(map)??{id:map,total:0,attackWins:0};mapRow.total+=bucket.total;mapRow.attackWins+=bucket.attackWins;maps.set(map,mapRow);
    // Historical pools were not recorded. Their frequency denominator is all selected historical matches.
    const eligible=new Set(catalog.filter(op=>historical||op.version==='off'||(op.version==='alt'&&alt)||(op.version==='diy'&&diy)).map(op=>family?familyKey(op):op.id));
    for(const key of eligible){rows.get(key).eligible+=bucket.total;if(bansRecorded)rows.get(key).banEligible+=bucket.total;}
    for(const [id,[picks,wins,bans]] of Object.entries(bucket.operators)){
      const op=byId.get(id);if(!op)continue;const row=rows.get(family?familyKey(op):id);row.picks+=picks;row.wins+=wins;row.bans+=bans;
    }
  }
  return {total,attackWins,historicalTotal,missingBans,defenseWins:total-attackWins,attackWinRate:rate(attackWins,total),
    operators:[...rows.values()].map(r=>({...r,winRate:rate(r.wins,r.picks),pickRate:rate(r.picks,r.eligible),banRate:rate(r.bans,r.banEligible),bpRate:r.banEligible===r.eligible?rate(r.picks+r.bans,r.eligible):null})),
    maps:[...maps.values()].map(m=>({...m,defenseWins:m.total-m.attackWins,attackWinRate:rate(m.attackWins,m.total),share:rate(m.total,total)}))};
}
export function chartSummary(rows){const visible=rows.filter(r=>r.picks>0&&r.pickRate!==null&&r.winRate!==null);return {rows:visible,meanPick:visible.length?visible.reduce((n,r)=>n+r.pickRate,0)/visible.length:null,meanWin:visible.length?visible.reduce((n,r)=>n+r.winRate,0)/visible.length:null};}
