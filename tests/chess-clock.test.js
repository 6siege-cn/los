import test from 'node:test';
import assert from 'node:assert/strict';
import { createClock, formatTime, timeOptions } from '../chess-clock/engine.js';

function setup() {
  let time = 0;
  return { clock: createClock(() => time), advance: ms => { time += ms; } };
}
test('pressing either side runs only the opponent; repeated taps do not reset time', () => {
  const { clock, advance } = setup();
  clock.press('defense'); advance(1234);
  assert.equal(clock.snapshot().remaining.attack, 598766);
  clock.press('defense'); advance(766); clock.press('attack'); advance(3000);
  const state = clock.snapshot();
  assert.equal(state.active, 'defense');
  assert.deepEqual(state.remaining, { attack: 598000, defense: 597000 });
});
test('pause freezes both clocks and either player can resume the opponent', () => {
  const { clock, advance } = setup();
  clock.press('attack'); advance(1000); clock.pause(); advance(50000);
  assert.equal(clock.snapshot().remaining.defense, 599000);
  assert.equal(clock.snapshot().active, null);
  clock.press('defense'); advance(1000);
  assert.equal(clock.snapshot().remaining.attack, 599000);
});
test('all four time settings and operator changes apply only on round reset', () => {
  for (const seconds of timeOptions) {
    const { clock, advance } = setup();
    clock.press('attack'); advance(2000);
    clock.setSeconds(seconds); clock.changeCount('attack', -2); clock.changeCount('defense', 1);
    assert.deepEqual(clock.snapshot().remaining, { attack: 600000, defense: 598000 });
    assert.equal(clock.snapshot().active, 'defense');
    clock.reset();
    assert.deepEqual(clock.snapshot().remaining, { attack: 3 * seconds * 1000, defense: 6 * seconds * 1000 });
    assert.equal(clock.snapshot().active, null);
    assert.equal(clock.snapshot().pending, false);
  }
});
test('a delayed callback or switching at the deadline stops at zero until reset', () => {
  const { clock, advance } = setup();
  clock.press('attack'); advance(900000); clock.press('defense');
  assert.equal(clock.snapshot().expired, 'defense');
  assert.equal(clock.snapshot().active, null);
  assert.deepEqual(clock.snapshot().remaining, { attack: 600000, defense: 0 });
  clock.reset(); clock.press('defense');
  assert.equal(clock.snapshot().expired, null);
  assert.equal(clock.snapshot().active, 'attack');
});
test('zero operators never become negative and a zero-time side cannot run', () => {
  const { clock } = setup();
  clock.changeCount('attack', -6); clock.reset(); clock.press('defense');
  assert.equal(clock.snapshot().counts.attack, 0);
  assert.equal(clock.snapshot().expired, 'attack');
  assert.equal(clock.snapshot().active, null);
});
test('time display rounds up remaining fractions and supports long rounds', () => {
  assert.equal(formatTime(599999), '10:00');
  assert.equal(formatTime(1), '00:01');
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(7200000), '120:00');
});
