import {API} from './match-sync.js';

const mirrorRoot=new URL('../../community-data/',import.meta.url);
const localHosts=new Set(['localhost','127.0.0.1']);

export function publicReadURL(path,{hostname=globalThis.location?.hostname,api=API,root=mirrorRoot}={}){
  if(localHosts.has(hostname))return api+path;
  const url=new URL(path,'https://community.invalid');
  if(url.pathname==='/api/matches'){
    const page=Math.max(1,Number.parseInt(url.searchParams.get('page'))||1);
    return new URL(`pages/${page}.json`,root).href;
  }
  const detail=url.pathname.match(/^\/api\/matches\/([0-9a-f-]+)$/i);
  if(detail)return new URL(`matches/${detail[1]}.json`,root).href;
  return api+path;
}

