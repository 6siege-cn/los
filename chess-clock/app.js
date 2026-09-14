import { createClock, formatTime } from './engine.js';

const clock = createClock();
const names = { attack: '进攻方', defense: '防守方' };
const byId = id => document.getElementById(id);
function setText(element, text) { if (element.textContent !== text) element.textContent = text; }
function render() {
  const state = clock.snapshot();
  for (const side of Object.keys(names)) {
    const button = byId(`${side}-clock`);
    const running = state.active === side;
    button.classList.toggle('is-running', running);
    button.classList.toggle('is-expired', state.expired === side);
    button.setAttribute('aria-pressed', String(running));
    setText(byId(`${side}-time`), formatTime(state.remaining[side]));
    setText(byId(`${side}-state`), state.expired === side ? '时间到' : running ? '计时中' : '等待');
    setText(byId(`${side}-count`), String(state.counts[side]));
    document.querySelector(`[data-side="${side}"][data-delta="-1"]`).disabled = state.counts[side] === 0;
  }
  byId('pause-clock').setAttribute('aria-pressed', String(!state.active));
  setText(byId('clock-status'), state.expired ? `${names[state.expired]}时间到` : state.active ? `${names[state.active]}计时中` : '已暂停');
  setText(byId('settings-note'), state.expired ? '本轮时间到 · 点击重置一轮重新分配时间' : state.pending ? '配置已修改 · 点击重置一轮生效' : '人数与档位在重置一轮后生效 · 按己方棋钟开始对方计时');
}
for (const side of Object.keys(names)) {
  byId(`${side}-clock`).addEventListener('click', () => { clock.press(side); render(); });
}
byId('pause-clock').addEventListener('click', () => { clock.pause(); render(); });
byId('reset-round').addEventListener('click', () => { clock.reset(); render(); });
byId('seconds-per-operator').addEventListener('change', event => { clock.setSeconds(Number(event.target.value)); render(); });
for (const button of document.querySelectorAll('[data-delta]')) {
  button.addEventListener('click', () => { clock.changeCount(button.dataset.side, Number(button.dataset.delta)); render(); });
}
// Leaving this tool pauses it; hiding the browser alone does not lose elapsed time.
window.addEventListener('pagehide', () => clock.pause());
window.addEventListener('pageshow', render);
document.addEventListener('visibilitychange', render);
setInterval(render, 100);
render();
