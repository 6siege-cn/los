import {compileRule} from './rules.js';
import {operatorFamily} from './identity.js';
export function createDraft(rule, operators) {
  const steps=compileRule(rule), byId=new Map(operators.map(op=>[op.id,op]));
  let history=[],stopped=false;
  const remainingSteps=()=>{
    const remaining=steps.map(step=>({...step}));
    for(const event of history){
      const index=remaining.findIndex(step=>step.round===event.round&&step.type===event.type);
      remaining.splice(index,1);
    }
    return remaining;
  };
  const snapshot=()=> {
    const picks={attack:[],defense:[]}, bans={attack:[],defense:[]};
    for(const event of history) (event.type==='pick'?picks:bans)[event.side].push(event.operatorId);
    if(rule.free){
      const side=history.length%2?'defense':'attack',round=side==='attack'?1:2;
      const available=stopped?[]:[
        ...(picks[side].length<rule.teamSize?[{type:'pick',side,target:side,round}]:[]),
        ...(bans[side].length<rule.banLimit?[{type:'ban',side,target:side==='attack'?'defense':'attack',round}]:[])
      ];
      const step=available[0]??null;
      return {history:history.map(e=>({...e})),picks,bans,step,available,steps,
        timeline:[...history.map(e=>({...e})),...available],complete:stopped||!step,stopped};
    }
    const remaining=remainingSteps(), step=remaining[0]??null;
    const available=remaining.filter(item=>item.round===step?.round);
    return {history:history.map(e=>({...e})),picks,bans,step,available,steps,
      timeline:[...history.map(e=>({...e})),...remaining],complete:!step,stopped:false};
  };
  return {
    snapshot,
    canChoose(id) {const op=byId.get(id); return !!op && snapshot().available.some(step=>op.side===step.target) && !history.some(e=>operatorFamily(byId.get(e.operatorId))===operatorFamily(op));},
    choose(id) { if(!this.canChoose(id)) return false; const step=snapshot().available.find(step=>step.target===byId.get(id).side);history=[...history,{...step,operatorId:id}];if(rule.free&&history.length===2*(rule.teamSize+rule.banLimit))stopped=true;return true; },
    undo() {if(!history.length)return false;history=history.slice(0,-1);return true;},
    stop() {if(!rule.free||stopped)return false;stopped=true;return true;},
    resume() {if(!rule.free||!stopped)return false;stopped=false;return true;}
  };
}
