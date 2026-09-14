const base = new URL('../', import.meta.url);
const tokenRevision = '20260914.3';
export const assets = {
  avatarBase: new URL('assets/operators/badges/', base),
  panelBase: new URL('assets/operators/中文干员面板26.9.4/', base),
  tokens: Object.fromEntries(['health_4','health_5','health_6','yellow_dice','orange_dice','red_dice','broken_yellow_dice','broken_orange_dice','broken_red_dice','shield_dice','yellow_destruction','orange_destruction','red_destruction'].map(key=>[key,new URL('assets/tokens/'+key+'.png?v='+tokenRevision,base).href])),
  icons: Object.fromEntries(Object.entries({
    attack:['crossed-pickaxes.png',180], defense:['ribbon-badge.png',180],
    pick:['medal-round-solid-alt.png',180], ban:['prohibited-large.png',180],
    undo:['refresh-clockwise.png',180]
  }).map(([key,[file,rotation]])=>[key,{url:new URL('assets/icons/'+file,base).href,rotation}]))
};
export const settings = { rule: 'standard', colors: {attack:'#d2a83c',defense:'#589dd1'} };
