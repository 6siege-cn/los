// Static weapon expectation only; broken dice contribute no damage.
const weights=Object.freeze({yellow_dice:1,orange_dice:1.5,red_dice:2,broken_yellow_dice:0,broken_orange_dice:0,broken_red_dice:0});
export function calculateExpectedDamage(operator){
  const sum=dice=>dice.reduce((total,die)=>{
    if(!Object.hasOwn(weights,die))throw new Error('Unknown damage die: '+die);
    return total+weights[die];
  },0);
  const closeExpectedDamage=sum(operator.close);
  const mediumExpectedDamage=sum(operator.medium);
  const longExpectedDamage=sum(operator.long);
  return {closeExpectedDamage,mediumExpectedDamage,longExpectedDamage,totalExpectedDamage:closeExpectedDamage+mediumExpectedDamage+longExpectedDamage};
}
