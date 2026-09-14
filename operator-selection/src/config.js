const base = new URL('../', import.meta.url);
import manifest from './asset-manifest.js?v=314fc524c626546c';
const resolve=path=>new URL(path,base).href;
export const assets = {
  avatarBase: new URL('assets/operators/badges/', base),
  panelBase: new URL('assets/operators/中文干员面板26.9.4/', base),
  avatarURL: file=>resolve(manifest.avatars[file]),
  panelURL: file=>resolve(manifest.panels[file]),
  tokens: Object.fromEntries(Object.entries(manifest.tokens).map(([key,path])=>[key,resolve(path)])),
  icons: Object.fromEntries(Object.entries({
    attack:['crossed-pickaxes.png',180], defense:['ribbon-badge.png',180],
    pick:['medal-round-solid-alt.png',180], ban:['prohibited-large.png',180],
    undo:['refresh-clockwise.png',180]
  }).map(([key,[file,rotation]])=>[key,{url:resolve(manifest.icons[file]),rotation}]))
};
export const settings = { rule: 'standard', colors: {attack:'#d2a83c',defense:'#589dd1'} };
