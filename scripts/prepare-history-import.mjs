// Produces a reviewable, idempotent import. This script has no remote write capability.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,basename,sep} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {prepareHistoricalImport,historicalImportSQL,historicalRollbackSQL} from '../cloud/historical-import.js';
const [workbook,input,destination]=process.argv.slice(2);if(!workbook||!input||!destination)throw Error('Usage: node scripts/prepare-history-import.mjs workbook.xlsx extracted.json .wrangler/import-folder');
const out=resolve(destination),privateRoot=resolve(import.meta.dirname,'../.wrangler');if(!out.startsWith(privateRoot+sep))throw Error('Import material must stay inside the ignored .wrangler directory');
const digest=value=>createHash('sha256').update(value).digest('hex'),sourceHash=digest(readFileSync(workbook));
const sheets=JSON.parse(readFileSync(input,'utf8')),sheet=sheets.find(s=>s.sheet==='日志');
if(!sheet||sheet.rows[0].cells.D1!=='地图'||sheet.rows[0].cells.O1!=='获胜方(进攻/防守)'||sheet.rows[0].cells.P1!=='ban进攻方1')throw Error('Unexpected workbook layout; review mapping before importing');
mkdirSync(out,{recursive:true});const credentialPath=resolve(out,'credentials.json');
const credentials=existsSync(credentialPath)?JSON.parse(readFileSync(credentialPath,'utf8')):{sourceHash,token:randomBytes(32).toString('hex')};if(credentials.sourceHash!==sourceHash)throw Error('Use a new destination for a changed workbook');
writeFileSync(credentialPath,JSON.stringify(credentials),{mode:0o600});const options={ownerHash:digest(credentials.token),sourceHash};
const plan=prepareHistoricalImport(sheet.rows.slice(1),{source:basename(workbook)}),all=[...plan.accepted,...plan.excluded].sort((a,b)=>a.row-b.row);
writeFileSync(resolve(out,'plan.json'),JSON.stringify(plan,null,2));
writeFileSync(resolve(out,'import.sql'),historicalImportSQL(plan,options));writeFileSync(resolve(out,'rollback.sql'),historicalRollbackSQL(options));
const summary={sourceRows:sheet.rows.length-1,accepted:plan.accepted.length,excluded:plan.excluded.length,rules:Object.fromEntries(['standard','fiveBan','historical'].map(rule=>[rule,plan.accepted.filter(i=>i.record.ruleId===rule).length])),missingDates:plan.accepted.filter(i=>!i.record.source.playedOn).length,missingBans:plan.accepted.filter(i=>!i.record.source.bansRecorded).length,attackWins:plan.accepted.filter(i=>i.record.winner==='attack').length};
const escape=value=>String(value).replaceAll('|','／').replaceAll('\n','；');
const report=['# 历史对局导入核对',`来源：${basename(workbook)} / 日志，第 2～${sheet.rows.at(-1).row} 行。`,
  `共 ${summary.sourceRows} 条，保留 ${summary.accepted} 条，排除 ${summary.excluded} 条。标准规则 ${summary.rules.standard} 条，5ban ${summary.rules.fiveBan} 条，历史规则未确认 ${summary.rules.historical} 条。`,
  `进攻胜 ${summary.attackWins} 局，防守胜 ${summary.accepted-summary.attackWins} 局。${summary.missingDates} 局日期未记录，${summary.missingBans} 局禁用未记录。`,
  '5b / 5ban 统一为 5ban；没有明确标注时，双方各 5 个禁用识别为 5ban，各 2 个识别为标准规则，其余保留为历史规则未确认。禁用列按被禁干员阵营转换。',
  '日期、模式、结束方式、结束回合、选禁顺序没有依据时不补造。普通失误、运气、经验不足、计时、人质与正常 2v2 不自动判为异常。',
  '历史干员范围未记录，出场率采用所选历史对局数作为分母。没有禁用记录的对局不参与禁用率分母；涉及缺失禁用时不提供 BP率。历史独立干员不自动合并到现有 ALT/OFF。',
  '昵称与备注仅进入私人字段，不出现在公开页面。原始工作簿未修改。',
  '', '| 原表行 | 处理 | 日期 | 规则 | 原因 / 缺失说明 |','| --- | --- | --- | --- | --- |',
  ...all.map(i=>`| ${i.row} | ${i.reasons.length?'排除':'导入'} | ${i.record.source.playedOn||'未记录'} | ${i.record.rule.name} | ${escape(i.reasons.length?i.reasons.join('；'):i.warnings.join('；')||'通过')} |`)];
writeFileSync(resolve(out,'audit.md'),report.join('\n')+'\n');writeFileSync(resolve(out,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
