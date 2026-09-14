import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {parseCSV} from './build-operators.mjs';
import {normalizeSkillText} from './normalize-skill-text.mjs';

const require=createRequire(import.meta.url);
const WordExtractor=require('word-extractor');
const data=new URL('../operator-selection/data/',import.meta.url);
const source=new URL('sources/r6-operator-skills.doc',data);
const document=await new WordExtractor().extract(readFileSync(source));
const raw=document.getBody().replace(/\r\n?/g,'\n');
const roster=parseCSV(readFileSync(new URL('operators.csv',data),'utf8'));
const originals=new Map(roster.filter(op=>op.version==='off'&&op.name!=='RECRUIT').map(op=>[op.name.toLowerCase(),op]));
const aliases={kapcan:'kapkan',mirror:'mira'};
const sections=[];let section;
for(const [i,line] of raw.split('\n').entries()){
  const trimmed=line.trim(),prefix=/^([a-z]+)/i.exec(trimmed)?.[1];
  const name=prefix?.toLowerCase(),canonical=aliases[name]??name,op=originals.get(canonical);
  // This document has one section per original operator. Subsequent sentences
  // beginning with the same operator name remain inside the current description.
  if(op&&(!section||section.operatorId!==op.id)){
    if(sections.some(s=>s.operatorId===op.id))throw Error('Duplicate or ambiguous heading at line '+(i+1)+': '+trimmed);
    const suffix=trimmed.slice(prefix.length).replace(/^\s*[:：]?\s*/,'');
    section={operatorId:op.id,heading:suffix,paragraphs:[]};
    sections.push(section);
  }else if(trimmed){
    if(!section)throw Error('Unmapped opening text at line '+(i+1));
    section.paragraphs.push(trimmed);
  }
}
for(const s of sections)if(!s.paragraphs.length)throw Error('Empty description: '+s.operatorId);
const result=Object.fromEntries(sections.map(s=>[s.operatorId,normalizeSkillText([s.heading,...s.paragraphs].join('\n'))]));
writeFileSync(new URL('operator-skills.json',data),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({skills:sections.length,paragraphs:sections.reduce((n,s)=>n+s.paragraphs.length,0)}));
