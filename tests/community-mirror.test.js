import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildCommunityMirror} from '../scripts/build-community-mirror.mjs';
import {publicReadURL} from '../operator-selection/src/community-source.js';

const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
const json=value=>({ok:true,json:async()=>structuredClone(value)});

test('community mirror publishes pages, details, snapshot and manifest',async()=>{
  const output=await mkdtemp(join(tmpdir(),'community-mirror-'));
  const fetcher=async url=>{
    if(url.endsWith('page=1'))return json({records:[{id:ids[0],winner:'attack'}],total:2,page:1,pageSize:1});
    if(url.endsWith('page=2'))return json({records:[{id:ids[1],winner:'defense'}],total:2,page:2,pageSize:1});
    if(url.endsWith('/api/stats-snapshot'))return json({schemaVersion:2,revision:7,buckets:[]});
    throw Error('unexpected '+url);
  };
  try{
    const manifest=await buildCommunityMirror({output,fetcher,api:'https://source.invalid',now:()=>new Date('2026-09-28T00:00:00Z')});
    assert.deepEqual(manifest,{generatedAt:'2026-09-28T00:00:00.000Z',total:2,pageSize:1,pageCount:2,snapshotRevision:7});
    assert.equal(JSON.parse(await readFile(join(output,'matches',ids[1]+'.json'))).winner,'defense');
    assert.equal(JSON.parse(await readFile(join(output,'pages','2.json'))).records[0].id,ids[1]);
    assert.equal(JSON.parse(await readFile(join(output,'stats-snapshot.json'))).revision,7);
  }finally{await rm(output,{recursive:true,force:true});}
});

test('community mirror rejects private fields',async()=>{
  const output=await mkdtemp(join(tmpdir(),'community-mirror-private-'));
  const fetcher=async url=>url.endsWith('page=1')?json({records:[{id:ids[0],players:{attack:'private'}}],total:1,page:1,pageSize:20}):json({schemaVersion:2,revision:1,buckets:[]});
  try{await assert.rejects(()=>buildCommunityMirror({output,fetcher}),/私密字段/);}finally{await rm(output,{recursive:true,force:true});}
});

test('public reads use same-origin mirror outside local development',()=>{
  const root=new URL('https://6siege-cn.github.io/los/community-data/');
  assert.equal(publicReadURL('/api/matches?page=3',{hostname:'6siege-cn.github.io',root}),'https://6siege-cn.github.io/los/community-data/pages/3.json');
  assert.equal(publicReadURL('/api/matches/'+ids[0],{hostname:'6siege-cn.github.io',root}),`https://6siege-cn.github.io/los/community-data/matches/${ids[0]}.json`);
  assert.equal(publicReadURL('/api/matches?page=2',{hostname:'localhost',api:'http://localhost:8787'}),'http://localhost:8787/api/matches?page=2');
});

