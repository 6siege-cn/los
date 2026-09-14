const health=op=>Number(String(op.hp).replace(/^health_/,''));
const isRecruit=op=>/^recruit(?:_|$)/i.test(op.id)||/^recruit$/i.test(op.name);

// Equal entries keep their source order (stable Array.sort). Never mutate the roster.
export function sortOperators(operators){
  return [...operators].sort((a,b)=>
    health(a)-health(b)||
    Number(isRecruit(a))-Number(isRecruit(b))||
    b.totalExpectedDamage-a.totalExpectedDamage||
    b.closeExpectedDamage-a.closeExpectedDamage||
    b.mediumExpectedDamage-a.mediumExpectedDamage||
    b.longExpectedDamage-a.longExpectedDamage
  );
}
