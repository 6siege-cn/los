import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export function parseCSV(text) {
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(cell||row.length){row.push(cell);rows.push(row);}
  if(quoted)throw Error('Unclosed CSV quote');
  const headers=rows.shift();return rows.map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]])));
}
export function readOperators() {
  return parseCSV(readFileSync(new URL('../operator-selection/data/operators.csv',import.meta.url),'utf8')).map(row=>({...row,...Object.fromEntries(['close','medium','long'].map(key=>[key,JSON.parse(row[key])]))}));
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  writeFileSync(new URL('../operator-selection/data/operators.js',import.meta.url),'// Generated from operators.csv by scripts/build-operators.mjs.\nexport default '+JSON.stringify(readOperators())+';\n');
}
