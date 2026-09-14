const sides = ['attack', 'defense'];
export const timeOptions = [150, 120, 90, 60];

// An elapsed-time clock stays accurate even when browser callbacks are throttled.
export function createClock(now = () => performance.now()) {
  let seconds = 120;
  const counts = { attack: 5, defense: 5 };
  let remaining = { attack: seconds * 5000, defense: seconds * 5000 };
  let active = null, expired = null, last = now(), pending = false;
  function settle() {
    const current = now();
    if (active) {
      remaining[active] = Math.max(0, remaining[active] - Math.max(0, current - last));
      if (remaining[active] === 0) { expired = active; active = null; }
    }
    last = current;
  }
  return {
    snapshot() { settle(); return { seconds, counts: { ...counts }, remaining: { ...remaining }, active, expired, pending }; },
    press(side) {
      if (!sides.includes(side)) return;
      settle();
      if (expired) return;
      const next = side === 'attack' ? 'defense' : 'attack';
      if (remaining[next] === 0) { expired = next; active = null; }
      else active = next;
    },
    pause() { settle(); active = null; },
    setSeconds(value) { if (timeOptions.includes(value) && seconds !== value) { seconds = value; pending = true; } },
    changeCount(side, delta) {
      if (!sides.includes(side) || !Number.isInteger(delta)) return;
      const next = Math.max(0, counts[side] + delta);
      if (next !== counts[side]) { counts[side] = next; pending = true; }
    },
    reset() {
      remaining = Object.fromEntries(sides.map(side => [side, seconds * counts[side] * 1000]));
      active = null; expired = null; pending = false; last = now();
    },
  };
}

export function formatTime(milliseconds) {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
