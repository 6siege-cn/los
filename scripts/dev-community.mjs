// Local-only integration environment: real Worker handlers and SQLite schema, no production data.
import {createServer} from 'node:http';
import {readFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import worker from '../cloud/worker.js';
import {rebuildSnapshot} from '../cloud/snapshots.js';
const root=resolve(import.meta.dirname,'..');
await mkdir(resolve(root,'.wrangler'),{recursive:true});
const dbPath=resolve(root,process.argv[2]||'.wrangler/community-local.sqlite');
if(!dbPath.startsWith(resolve(root,'.wrangler')+sep))throw Error('Preview databases must stay in .wrangler');
const db=new DatabaseSync(dbPath);
db.exec('CREATE TABLE IF NOT EXISTS local_migrations(name TEXT PRIMARY KEY)');
for(const name of (await readdir(resolve(root,'cloud/migrations'))).filter(n=>n.endsWith('.sql')).sort())if(!db.prepare('SELECT 1 FROM local_migrations WHERE name=?').get(name)){
  db.exec('BEGIN');try{db.exec(await readFile(resolve(root,'cloud/migrations',name),'utf8'));db.prepare('INSERT INTO local_migrations VALUES(?)').run(name);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
}
function prepare(sql,params=[]){const run=()=>{const stmt=db.prepare(sql);return stmt.columns().length?stmt.all(...params):((stmt.run(...params)),[]);};return {bind:(...values)=>prepare(sql,values),first:async()=>run()[0]??null,all:async()=>({results:run()}),run};}
const env={IP_HASH_SALT:'local-development-only',DB:{prepare,batch:async statements=>{db.exec('BEGIN');try{const result=statements.map(s=>({results:s.run()}));db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}}};
await rebuildSnapshot(env.DB);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};
createServer(async(req,res)=>{
  try{const url=new URL(req.url,'http://127.0.0.1:8789');
    if(url.pathname.startsWith('/api/')){
      if(url.pathname==='/api/local/rebuild'&&req.method==='POST'){await rebuildSnapshot(env.DB);res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');return;}
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const headers=new Headers(req.headers);headers.set('Origin','https://6siege-cn.github.io');headers.set('CF-Connecting-IP','192.0.2.100');
      const response=await worker.fetch(new Request(url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)}),env);
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const path=resolve(root,'.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));
    if(!path.startsWith(root+sep)||path.includes(`${sep}.`)||path.includes(`${sep}node_modules${sep}`)){res.writeHead(404);res.end();return;}
    const body=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(8789,'127.0.0.1',()=>console.log('Local community preview: http://127.0.0.1:8789/operator-selection/'));
