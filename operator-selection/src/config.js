const base = new URL('../', import.meta.url);
import manifest from './asset-manifest.js?v=d035f7e5720d0198';
const resolve=path=>new URL(path,base).href;
export const assets = {
  recordMarks:Object.fromEntries(['thumbs-up','thumbs-down','skull','crosshair'].map(key=>[key,resolve('assets/icons/record-'+key+'.svg?v=1')])),
  avatarBase: new URL('assets/operators/badges/', base),
  panelBase: new URL('assets/operators/中文干员面板26.9.4/', base),
  avatarURL: file=>resolve(manifest.avatars[file]),
  panelURL: file=>resolve(manifest.panels[file]),
  tokens: Object.fromEntries(Object.entries(manifest.tokens).map(([key,path])=>[key,resolve(path)])),
  icons: Object.fromEntries(Object.entries({
    attack:['crossed-pickaxes.png',180], defense:['ribbon-badge.png',180],
    pick:['medal-round-solid-alt.png',180], ban:['prohibited-large.png',180],
    reset:['refresh-clockwise.png',180], undo:['undo-return.svg',0],
    rules:['rules-menu.svg',0], settings:['settings-gear.svg',0]
  }).map(([key,[file,rotation]])=>[key,{url:resolve(manifest.icons[file]),rotation}]))
};
// Use the same theme tokens for scripted markers and stylesheet decorations.
export const settings = { rule: 'standard', colors: {attack:'var(--attack)',defense:'var(--defense)'} };
