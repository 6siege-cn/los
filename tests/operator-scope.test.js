import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultScope,inScope} from '../operator-selection/src/operator-scope.js';
import {createDraft} from '../operator-selection/src/engine.js';
import {rules} from '../operator-selection/src/rules.js';
test('ALT and DIY toggle independently; official operators remain available',()=>{
  for(const alt of [false,true])for(const diy of [false,true]){
    const scope={alt,diy};
    assert.equal(inScope({version:'alt'},scope),alt);
    assert.equal(inScope({version:'DIY'},scope),diy);
    assert.equal(inScope({version:'off'},scope),true);
  }
  assert.deepEqual(defaultScope,{alt:true,diy:true});
});
test('excluded variants cannot be drafted even when their IDs are known',()=>{
  const ops=[{id:'official',name:'A',side:'attack',version:'off'},{id:'alt',name:'A',side:'attack',version:'alt'},{id:'diy',name:'B',side:'defense',version:'diy'}];
  const draft=createDraft(rules.standard,ops.filter(op=>inScope(op,{alt:false,diy:false})));
  assert.equal(draft.canChoose('alt'),false);assert.equal(draft.choose('diy'),false);
  assert.equal(draft.choose('official'),true);
});
