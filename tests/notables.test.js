const test = require('node:test');
const assert = require('node:assert/strict');
const Evo = require('../assets/js/ia/evolution.js');
const N = require('../assets/js/ia/notables.js');

const game = (o) => Object.assign({ seed: 1, score: 100, time: 10, sideDodged: 0, timeAtCap: 0, timedOut: false, spdAtEnd: 200 }, o);
function summary(gen, scores, extra) {
  const population = scores.map((s, i) => new Float32Array([i, s]));
  const results = scores.map((s, i) => ({ fitness: s, games: [game({ seed: i * 10 + 1, score: s }), game({ seed: i * 10 + 2, score: s / 2, time: 3 })] }));
  return Object.assign({ gen, population, results, cfg: { difficulty: 'normal', charSpeed: 280 }, spdMaxBefore: 500, spdMaxAfter: 500 }, extra);
}
const types = (r) => r.notables.map(n => n.type);

test('gen 0 : 1 champion et 1 record', () => {
  const r = N.detect(summary(0, [100, 200]), null);
  assert.equal(types(r).filter(t => t === 'champion').length, 1);
  assert.equal(types(r).filter(t => t === 'record').length, 1);
  const ch = r.notables.find(n => n.type === 'champion');
  assert.equal(ch.worstSeed, 12); assert.equal(ch.worstScore, 100);
});

test('sans amelioration : seulement champion', () => {
  const r0 = N.detect(summary(0, [100, 200]), null);
  const r1 = N.detect(summary(1, [100, 150]), r0.state);
  assert.deepStrictEqual(types(r1), ['champion']);
});

test('milestone 1000 une seule fois', () => {
  const r0 = N.detect(summary(0, [100, 200]), null);
  const r1 = N.detect(summary(1, [100, 1200]), r0.state);
  assert.equal(types(r1).filter(t => t === 'milestone').length, 1);
  const r2 = N.detect(summary(2, [100, 1500]), r1.state);
  assert.equal(types(r2).filter(t => t === 'milestone').length, 0);
});

test('spdMaxUp, Infinity -> fini, jamais humanBeaten sans humanRecord', () => {
  const r = N.detect(summary(3, [100, 5000], { spdMaxBefore: 500, spdMaxAfter: 525 }), null);
  assert.equal(types(r).filter(t => t === 'spdMaxUp').length, 1);
  assert.ok(!types(r).includes('humanBeaten'));
  const r2 = N.detect(summary(4, [100, 200], { spdMaxBefore: Infinity, spdMaxAfter: 1240 }), null);
  const up = r2.notables.filter(t => t.type === 'spdMaxUp');
  assert.equal(up.length, 1);
  assert.equal(up[0].label, 'Limite de vitesse fixée : 1 240 px/s');
  assert.equal(up[0].spdMax, Infinity);
});

test('humanBeaten avec humanRecord, une fois', () => {
  const r = N.detect(summary(0, [100, 5000], { humanRecord: 3000 }), null);
  assert.ok(types(r).includes('humanBeaten'));
  const r2 = N.detect(summary(1, [100, 6000], { humanRecord: 3000 }), r.state);
  assert.ok(!types(r2).includes('humanBeaten'));
});

test('gel : poids copies, non lies a la population', () => {
  const s = summary(0, [100, 200]);
  const r = N.detect(s, null);
  const rec = r.notables.find(n => n.type === 'record');
  assert.notStrictEqual(rec.weights, s.population[1]);
  const before = Float32Array.from(rec.weights);
  const next = Evo.nextGeneration(s.population, [100, 200], { next: () => 0.3 }, { popSize: 2 });
  next[0][0] += 99;
  assert.deepStrictEqual(rec.weights, before);
});

test('fmt', () => { assert.equal(N.fmt(1234567), '1 234 567'); assert.equal(N.fmt(999), '999'); });
