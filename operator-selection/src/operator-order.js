import {timeOrder} from '../data/operator-time-order.js';
export const orderModes=Object.freeze({speedWeapon:'速度/枪械',time:'时间'});
export const defaultOrder='speedWeapon';
export const normalizeOperatorName=name=>String(name??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[øØ]/g,'o').toUpperCase().replace(/[^A-Z0-9]/g,'');
const ranks=Object.fromEntries(Object.entries(timeOrder).map(([side,names])=>[side,new Map(names.map((name,i)=>[normalizeOperatorName(name),i]))]));
const versionRank=op=>({off:0,alt:1,diy:2}[String(op.version??'off').toLowerCase()]??3);
const health=op=>Number(String(op.hp).replace(/^health_/,''));
const isRecruit=op=>/^recruit(?:_|$)/i.test(op.id)||/^recruit$/i.test(op.name);

// Equal entries keep their source order (stable Array.sort). Never mutate the roster.
export function sortOperators(operators,mode=defaultOrder){
  if(!Object.hasOwn(orderModes,mode))throw new Error('Unknown operator order: '+mode);
  if(mode==='time'){
    const key=op=>op.side+':'+normalizeOperatorName(op.name);
    const groups=new Map();
    for(const op of operators)if(!groups.has(key(op)))groups.set(key(op),groups.size);
    const rank=op=>ranks[op.side]?.get(normalizeOperatorName(op.name))??Number.MAX_SAFE_INTEGER;
    return [...operators].sort((a,b)=>rank(a)-rank(b)||groups.get(key(a))-groups.get(key(b))||versionRank(a)-versionRank(b));
  }
  return [...operators].sort((a,b)=>
    health(a)-health(b)||
    Number(isRecruit(a))-Number(isRecruit(b))||
    b.totalExpectedDamage-a.totalExpectedDamage||
    b.closeExpectedDamage-a.closeExpectedDamage||
    b.mediumExpectedDamage-a.mediumExpectedDamage||
    b.longExpectedDamage-a.longExpectedDamage
  );
}
