const health=op=>Number(String(op.hp).replace(/^health_/,''));

// Equal entries keep their source order (stable Array.sort). Never mutate the roster.
export function sortOperators(operators){
  return [...operators].sort((a,b)=>
    health(a)-health(b)||
    b.totalExpectedDamage-a.totalExpectedDamage||
    b.closeExpectedDamage-a.closeExpectedDamage||
    b.mediumExpectedDamage-a.mediumExpectedDamage||
    b.longExpectedDamage-a.longExpectedDamage
  );
}
