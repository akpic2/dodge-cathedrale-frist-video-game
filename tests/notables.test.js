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

// ===== Éclaircissement des perfs stockées =====
const mkN = (type, gen, i) => ({ id: type + '-' + gen + (i !== undefined ? '-' + i : ''), type, gen, weights: new Float32Array(1) });
function expectedGrid(max) {
  const out = [];
  for (let g = 0; g <= max; g++) {
    if (g <= 20 || (g <= 200 && g % 10 === 0) || (g <= 2000 && g % 100 === 0) || g % 1000 === 0) out.push(g);
  }
  return out;
}

test('éclaircissement : champions gardés sur la grille log jusqu à 2500', () => {
  const list = [];
  for (let g = 0; g <= 2500; g++) N.addNotable(list, mkN('champion', g));
  const gens = list.map(n => n.gen);
  // 0..20, 30..200 par 10, 300..2000 par 100, 3000.. (aucun) + 2500 = dernier
  const want = expectedGrid(2500).concat([2500]);
  assert.deepStrictEqual(gens, want);
  assert.equal(gens.filter(g => g > 20 && g <= 200).length, 18);
  assert.equal(gens.filter(g => g > 200 && g <= 2000).length, 18);
  assert.ok(gens.includes(1000) && gens.includes(2000) && !gens.includes(2400));
  assert.equal(list.length, 21 + 18 + 18 + 1);
});

test('éclaircissement : le dernier champion est toujours gardé et remplacé', () => {
  const list = [];
  for (let g = 0; g <= 23; g++) N.addNotable(list, mkN('champion', g));
  assert.deepStrictEqual(list.map(n => n.gen).slice(-2), [20, 23]);
  N.addNotable(list, mkN('champion', 30));
  assert.deepStrictEqual(list.map(n => n.gen).slice(-2), [20, 30]);
  N.addNotable(list, mkN('champion', 31));
  assert.deepStrictEqual(list.map(n => n.gen).slice(-3), [20, 30, 31]);
  assert.ok(N.championKept(3000) && !N.championKept(2500) && N.championKept(150) && !N.championKept(155));
});

test('éclaircissement : les autres types ne sont jamais retirés', () => {
  const list = [];
  const others = ['record', 'spdMaxUp', 'milestone', 'bigJump', 'humanBeaten'];
  for (let g = 0; g <= 1500; g++) {
    N.addNotable(list, mkN('champion', g));
    N.addNotable(list, mkN(others[g % others.length], g));
  }
  for (const t of others) assert.equal(list.filter(n => n.type === t).length, t === 'record' ? 301 : 300);
  assert.equal(list.filter(n => n.type !== 'champion').length, 1501);
});

test('éclaircissement : sideDodges limité aux 20 plus récents', () => {
  const list = [mkN('record', 0)];
  for (let g = 0; g < 50; g++) N.addNotable(list, mkN('sideDodges', g));
  const side = list.filter(n => n.type === 'sideDodges');
  assert.equal(side.length, 20);
  assert.deepStrictEqual(side.map(n => n.gen), Array.from({ length: 20 }, (_, i) => 30 + i));
  assert.equal(list[0].type, 'record');
});

test('thin = addNotable successifs (liste chargée)', () => {
  const all = [], inc = [];
  for (let g = 0; g <= 1234; g++) {
    for (const n of [mkN('champion', g), g % 7 === 0 ? mkN('sideDodges', g) : mkN('record', g)]) { all.push(n); N.addNotable(inc, n); }
  }
  const th = N.thin(all);
  assert.deepStrictEqual(th.map(n => n.id), inc.map(n => n.id));
  assert.strictEqual(th[0], all[0]); // mêmes objets, pas de copie
});

// ===== File d'auto-sélection =====
let qid = 0;
const qn = (type, gen, extra) => Object.assign({ id: type + gen + '-' + (++qid), type, gen, seed: gen * 7 + qid, score: gen * 10 + qid, label: type + ' ' + gen, priority: N.PRIORITY[type] }, extra);
function fill(list) { let q = [], seq = 0; for (const n of list) q = N.queueAdd(q, n, ++seq); return q; }

test('file : un nouvel élément remplace celui du même type', () => {
  for (const t of N.QUEUE_REPLACING) {
    const q = fill([qn(t, 1), qn('record' === t ? 'milestone' : 'record', 2), qn(t, 3)]);
    const ofType = q.filter(x => x.parts.some(p => p.type === t));
    assert.equal(ofType.length, 1, t);
    assert.equal(ofType[0].n.gen, 3, t);
  }
});

test('file : même partie fusionnée ; le remplacement ne retire que la partie du type', () => {
  const rec = qn('record', 2), jump = Object.assign({}, rec, { id: 'bj', type: 'bigJump', label: 'bond', priority: N.PRIORITY.bigJump });
  let q = fill([rec, jump]);
  assert.equal(q.length, 1);
  assert.deepStrictEqual(q[0].parts.map(p => p.type), ['record', 'bigJump']);
  q = N.queueAdd(q, qn('record', 5), 10);
  const old = q.find(x => x.n.gen === 2);
  assert.deepStrictEqual(old.parts.map(p => p.type), ['bigJump']);
  assert.equal(old.priority, N.PRIORITY.bigJump);
});

test('file : à priorité égale, la plus récente d abord', () => {
  const q = fill([qn('milestone', 1), qn('bigJump', 2), qn('humanBeaten', 3), qn('spdMaxUp', 4), qn('record', 5)]);
  // record et spdMaxUp (5) : le plus récent (record, gén. 5) d'abord
  assert.deepStrictEqual(q.map(x => x.n.type), ['record', 'spdMaxUp', 'humanBeaten', 'milestone', 'bigJump']);
});

test('file : 5 max, on retire la plus ancienne des moins prioritaires', () => {
  // types non remplaçants inventés pour avoir plusieurs éléments de même priorité
  const low = (g) => qn('other', g, { priority: 1 });
  let q = fill([low(1), low(2), low(3), qn('record', 4), qn('milestone', 5), low(6)]);
  assert.equal(q.length, 5);
  assert.ok(!q.some(x => x.n.gen === 1));
  assert.deepStrictEqual(q.map(x => x.n.gen), [4, 5, 6, 3, 2]);
  for (let g = 7; g < 40; g++) q = N.queueAdd(q, low(g), g);
  assert.equal(q.length, 5);
  assert.deepStrictEqual(q.map(x => x.n.gen), [4, 5, 39, 38, 37]);
});

test('file : ni esquives latérales ni champions', () => {
  const q = fill([qn('sideDodges', 1), qn('champion', 2)]);
  assert.equal(q.length, 0);
});
