import {el} from './match-card.js?v=winner-theme-1';
import {mapLabel,sideLabels} from './match-records.js?v=community-1';
export const publicDateLabel=record=>record.source?.kind==='xlsx'?(record.source.playedOn||'日期未记录'):new Date(record.savedAt).toLocaleString('zh-CN');
export function renderHistoricalCard(record,assets){
  const card=el('article','match-card');card.setAttribute('aria-label','历史对局卡片');card.dataset.winner=record.winner;
  const header=el('header','match-card-header');header.append(el('span','match-kicker','SIX SIEGE · 表格历史对局'),el('h2','',sideLabels[record.winner]+'获胜'),el('span','',publicDateLabel(record)));card.append(header);
  const meta=el('div','match-meta');for(const label of [mapLabel(record),record.mode,record.rule.name,'干员范围未记录','结束方式、回合未记录'])meta.append(el('span','',label));card.append(meta);
  if(record.source.ruleInferred)card.append(el('p','match-muted','规则根据原表双方禁用数量识别。'));
  const teams=el('div','match-teams');
  for(const side of ['attack','defense']){
    const team=el('section','match-team');team.style.setProperty('--team-color',`var(--${side})`);team.append(el('h3','',sideLabels[side]));
    for(const kind of ['picks','bans']){
      if(kind==='bans')team.append(el('h4','','禁用敌方'));
      const group=el('div',kind==='picks'?'match-picks':'match-bans');
      for(const id of record[kind][side]){const op=record.operators.find(o=>o.id===id),box=el('div','match-portrait'),face=el('span','match-face');
        if(op.avatar){const img=el('img');img.src=assets.avatarURL(op.avatar);img.alt=op.name;face.append(img);}else face.append(el('span','historical-initials',op.name.slice(0,3)));
        if(op.version!=='off')face.append(el('span','match-version',op.version==='legacy'?'历史':op.version.toUpperCase()));box.append(face,el('span','match-name',op.name));group.append(box);
      }
      if(kind==='bans'&&!record.source.bansRecorded)group.append(el('span','match-muted','禁用未记录'));
      team.append(group);
    }
    teams.append(team);
  }
  card.append(teams,el('p','match-muted','来源：'+record.source.label+' · '+record.source.sheet+'第 '+record.source.row+' 行。原表未提供选禁先后顺序，阵容按原表列顺序展示。'));return card;
}
