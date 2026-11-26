const test = require('node:test');
const assert = require('node:assert/strict');
const Brain = require('../assets/js/ia/brain.js');
const Ev = require('../assets/js/ia/evaluate.js');

const zero = () => new Float32Array(Brain.N_WEIGHTS);

test('playGame deterministe', () => {
  const w = Brain.random({ next: (() => { let s = 7; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x80000000); })() });
  assert.deepStrictEqual(Ev.playGame(w, 5, {}), Ev.playGame(w, 5, {}));
});

test('poids nuls : meurt sans timeout sur seed 1', () => {
  const r = Ev.playGame(zero(), 1, {});
  assert.equal(r.timedOut, false);
  assert.equal(r.seed, 1);
});

test('MAX_GAME_TIME lu a l appel', () => {
  const old = Ev.MAX_GAME_TIME;
  Ev.MAX_GAME_TIME = 0.5;
  try {
    const r = Ev.playGame(zero(), 1, {});
    assert.equal(r.timedOut, true);
    assert.ok(Math.abs(r.time - 0.5) < 0.02, String(r.time));
  } finally { Ev.MAX_GAME_TIME = old; }
  assert.equal(Ev.MAX_GAME_TIME, 600);
});

test('evaluateBrain : fitness = moyenne des scores', () => {
  const r = Ev.evaluateBrain(zero(), [1, 2, 3], {});
  assert.equal(r.games.length, 3);
  assert.equal(r.fitness, r.games.reduce((a, g) => a + g.score, 0) / 3);
  const b = Ev.evaluateBatch([zero(), zero()], [1, 2], {});
  assert.equal(b.length, 2);
  assert.deepStrictEqual(b[0], b[1]);
});

test('playGame expose spdAtEnd', () => {
  const r = Ev.playGame(zero(), 1, {});
  assert.ok(Number.isFinite(r.spdAtEnd) && r.spdAtEnd >= 150, String(r.spdAtEnd));
});
