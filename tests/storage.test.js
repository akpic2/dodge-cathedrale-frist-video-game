const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../assets/js/ia/storage.js');
const T = require('../assets/js/ia/trainer.js');
const Eval = require('../assets/js/ia/evaluate.js');
const Sim = require('../assets/js/sim.js');

const evaluate = async (b, s, c) => Eval.evaluateBatch(b, s, c);
const rt = (st) => S.deserialize(JSON.parse(JSON.stringify(S.serialize(st))));
const bits = (f) => Array.from(new Uint32Array(f.buffer, f.byteOffset, f.length));

test('poids identiques au bit près (dont NaN, -0, dénormalisés)', () => {
  const w = new Float32Array([0, -0, 1.5, -3.14159, 1e-45, 3.4e38, NaN, Math.fround(0.1)]);
  const st = { gen: 1, population: [w], rngState: 5, spdMax: 1, history: [], notables: [], notableState: null };
  const out = rt(st);
  assert.ok(out.population[0] instanceof Float32Array);
  assert.deepEqual(bits(out.population[0]), bits(w));
});

test('Infinity survit (état, notable, historique)', () => {
  const st = {
    gen: 2, population: [new Float32Array(3)], rngState: 1, spdMax: Infinity,
    history: [{ gen: 0, best: 1, spdMax: Infinity }],
    notables: [{ id: 1, weights: new Float32Array([1, 2]), spdMax: Infinity, cfg: {} }], notableState: null
  };
  const out = rt(st);
  assert.equal(out.spdMax, Infinity);
  assert.equal(out.notables[0].spdMax, Infinity);
  assert.equal(out.history[0].spdMax, Infinity);
});

test('serialize ne mute pas son entrée', () => {
  const st = { gen: 1, population: [new Float32Array([1, 2])], rngState: 1, spdMax: Infinity, history: [], notables: [], notableState: null };
  const snap = JSON.stringify(S.serialize(st));
  S.serialize(st);
  assert.ok(st.population[0] instanceof Float32Array);
  assert.equal(st.spdMax, Infinity);
  assert.equal(JSON.stringify(S.serialize(st)), snap);
});

test('version 2 et pas de temps enregistrés', () => {
  const out = S.serialize({ gen: 0, population: [], rngState: 1, spdMax: 1, history: [], notables: [], notableState: null });
  assert.equal(out.version, 2);
  assert.equal(out.dt, Sim.DT);
  assert.equal(Sim.DT, 1 / 60);
});

test('ancienne version ou autre pas de temps : incompatible, en français', () => {
  const st = { gen: 1, population: [new Float32Array(2)], rngState: 1, spdMax: 1, history: [], notables: [], notableState: null };
  const ok = JSON.parse(JSON.stringify(S.serialize(st)));
  const msg = /Sauvegarde d'une ancienne version du jeu — incompatible/;
  assert.throws(() => S.deserialize(Object.assign({}, ok, { version: 1 })), msg);
  assert.throws(() => S.deserialize(Object.assign({}, ok, { version: 99 })), msg);
  assert.throws(() => S.deserialize(Object.assign({}, ok, { dt: 1 / 144 })), msg);
  const noDt = Object.assign({}, ok); delete noDt.dt;
  assert.throws(() => S.deserialize(noDt), msg);
  try { S.deserialize(Object.assign({}, ok, { version: 1 })); } catch (e) { assert.equal(e.code, 'incompatible'); }
  assert.ok(S.deserialize(ok).population[0] instanceof Float32Array);
});

test('forme invalide rejetée en français', () => {
  assert.throws(() => S.deserialize(null), /invalide/);
  assert.throws(() => S.deserialize({ version: 2, dt: Sim.DT, state: { gen: 1 } }), /invalide/);
});

test('replay après rechargement : mêmes scores', async () => {
  const t = T.createTrainer({ evaluate, seed: 1, opts: { popSize: 20, gamesPerBot: 2 } });
  await t.runGenerations(2);
  const st = t.getState();
  assert.ok(st.notables.length > 0);
  const out = rt(st);
  assert.equal(out.gen, st.gen);
  assert.equal(out.rngState, st.rngState);
  for (const n of out.notables) {
    const g = Eval.playGame(n.weights, n.seed, Object.assign({}, n.cfg, { spdMax: n.spdMax }));
    assert.equal(g.score, n.score);
  }
  // le trainer peut recharger l'état
  const t2 = T.createTrainer({ evaluate, seed: 1, opts: { popSize: 20, gamesPerBot: 2 } });
  await t2.loadState(out);
  assert.equal(t2.getState().gen, st.gen);
});
