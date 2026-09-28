export const opposite = side => side === 'attack' ? 'defense' : 'attack';
// Action semantics are independent of the order in which a rule schedules them.
export const actions = {
  pick: { target: side => side, label: '选择' },
  ban: { target: opposite, label: '禁用' }
};
export const rules = {
  standard: { name:'标准规则', teamSize:5, rounds:[
    {side:'attack', actions:[['pick',1],['ban',1]]},
    {side:'defense',actions:[['pick',1],['ban',1]]},
    {side:'attack', actions:[['pick',2]]},
    {side:'defense',actions:[['pick',2],['ban',1]]},
    {side:'attack', actions:[['pick',2],['ban',1]]},
    {side:'defense',actions:[['pick',2]]}
  ]},
  fiveBan: { name:'5ban', teamSize:5, rounds:[
    {side:'defense',actions:[['ban',1]]},
    {side:'attack',actions:[['pick',1]]},
    {side:'attack',actions:[['ban',1]]},
    {side:'defense',actions:[['pick',1]]},
    {side:'defense',actions:[['ban',2]]},
    {side:'attack',actions:[['pick',2]]},
    {side:'attack',actions:[['ban',2]]},
    {side:'defense',actions:[['pick',2]]},
    {side:'defense',actions:[['ban',2]]},
    {side:'attack',actions:[['pick',2]]},
    {side:'attack',actions:[['ban',2]]},
    {side:'defense',actions:[['pick',2]]}
  ]},
  free: {name:'自由BP',teamSize:5,free:true,banLimit:10,rounds:[]}
};
export function compileRule(rule) {
  if(rule.free){
    if(!Number.isInteger(rule.teamSize)||rule.teamSize<1||!Number.isInteger(rule.banLimit)||rule.banLimit<1)throw Error('无效规则');
    return ['attack','defense'].flatMap(side=>[
      ...Array.from({length:rule.teamSize},()=>({type:'pick',side,target:side,round:side==='attack'?1:2})),
      ...Array.from({length:rule.banLimit},()=>({type:'ban',side,target:opposite(side),round:side==='attack'?1:2}))
    ]);
  }
  return rule.rounds.flatMap((round,index)=>round.actions.flatMap(([type,count])=>{
    if(!actions[type] || !['attack','defense'].includes(round.side) || !Number.isInteger(count) || count<1) throw Error('无效规则');
    return Array.from({length:count},()=>({type,side:round.side,target:actions[type].target(round.side),round:index+1}));
  }));
}
