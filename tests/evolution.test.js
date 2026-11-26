const test = require('node:test');
const assert = require('node:assert/strict');
const Evo = require('../assets/js/ia/evolution.js');
const Sim = require('../assets/js/sim.js');

function mkPop(n, len) {
  const rng = Sim.makeRng(3);
  return Array.from({ length: n }, () => Float32Array.from({ length: len }, () => rng.next() - 0.5));
}
const game = (o) => Object.assign({ seed: 1, score: 0, time: 10, sideDodged: 0, timeAtCap: 0, timedOut: false, spdAtEnd: 200 }, o);

test('gaussian : moyenne ~0, ecart ~1', () => {
  const rng = Sim.makeRng(1); let s = 0, s2 = 0; const N = 20000;
  for (let i = 0; i < N; i++) { const g = Evo.gaussian(rng); s += g; s2 += g * g; }
  assert.ok(Math.abs(s / N) < 0.05);
  assert.ok(Math.abs(s2 / N - 1) < 0.05);
});

test('nextGeneration : taille, elites identiques en tete, nouveaux tableaux', () => {
  const pop = mkPop(300, 20), fit = pop.map((_, i) => (i * 37) % 300);
  const next = Evo.nextGeneration(pop, fit, Sim.makeRng(5));
  assert.equal(next.length, 300);
  const order = fit.map((f, i) => i).sort((a, b) => fit[b] - fit[a]);
  for (let i = 0; i < 15; i++) {
    assert.deepStrictEqual(next[i], pop[order[i]]);
    assert.notStrictEqual(next[i], pop[order[i]]);
  }
  assert.ok(!next.some(w => pop.includes(w)));
});

test('nextGeneration deterministe', () => {
  const pop = mkPop(50, 10), fit = pop.map((_, i) => i);
  assert.deepStrictEqual(Evo.nextGeneration(pop, fit, Sim.makeRng(9)), Evo.nextGeneration(pop, fit, Sim.makeRng(9)));
});

test('updateSpdMax', () => {
  assert.deepStrictEqual(Evo.updateSpdMax(1000, [game({ timeAtCap: 20 })]), { spdMax: 1050, raised: true });
  assert.deepStrictEqual(Evo.updateSpdMax(1000, [game({ timeAtCap: 19.9 })]), { spdMax: 1000, raised: false });
  assert.deepStrictEqual(Evo.updateSpdMax(Infinity, [game({ timeAtCap: 500 })]), { spdMax: Infinity, raised: false });
});

test('introduceSpdMax', () => {
  assert.equal(Evo.introduceSpdMax([game({ time: 39.9, spdAtEnd: 1250 })]), null);
  assert.equal(Evo.introduceSpdMax([game({ time: 50, spdAtEnd: 1249 }), game({ time: 40, spdAtEnd: 1300 })]), 1240);
});
