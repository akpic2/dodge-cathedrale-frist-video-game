const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../assets/js/ia/trainer.js');
const Eval = require('../assets/js/ia/evaluate.js');
const W = require('../assets/js/ia/worker.js');
const Brain = require('../assets/js/ia/brain.js');
const Sim = require('../assets/js/sim.js');

const evaluate = async (b, s, c) => Eval.evaluateBatch(b, s, c);
const mk = (extra) => T.createTrainer(Object.assign({ evaluate, seed: 7, opts: { popSize: 20, gamesPerBot: 2 } }, extra));

test('poolSize', () => {
  assert.equal(T.poolSize(undefined), 1);
  assert.equal(T.poolSize(1), 1);
  assert.equal(T.poolSize(8), 7);
});

test('3 générations : history et notables champion', async () => {
  const got = [];
  const t = mk({ onNotable: n => got.push(n) });
  await t.runGenerations(3);
  const s = t.getState();
  assert.equal(s.history.length, 3);
  assert.equal(s.gen, 3);
  assert.ok(got.filter(n => n.type === 'champion').length >= 3);
});

test('reproductible', async () => {
  const a = mk(), b = mk();
  await a.runGenerations(3); await b.runGenerations(3);
  assert.deepEqual(a.getState().history, b.getState().history);
});

test('getState / loadState reprend à l identique', async () => {
  const a = mk();
  await a.runGenerations(3);
  const snap = a.getState();
  const b = mk();
  await b.loadState(snap);
  await a.runGenerations(1); await b.runGenerations(1);
  assert.equal(b.getState().history.length, 4);
  assert.deepEqual(b.getState().history, a.getState().history);
});

test('getState renvoie des copies profondes', async () => {
  const t = mk();
  await t.runGenerations(1);
  const s = t.getState();
  const h0 = JSON.stringify(s.history), p0 = s.population[0][0];
  await t.runGenerations(1);
  assert.equal(JSON.stringify(s.history), h0);
  assert.equal(s.population[0][0], p0);
  assert.equal(s.history.length, 1);
});

test('start / pause : s arrête après la génération en cours', async () => {
  const t = mk();
  const p = t.start();
  assert.ok(t.isRunning());
  t.pause();
  await p;
  assert.ok(!t.isRunning());
  assert.ok(t.getState().history.length >= 1);
});

test('worker.handleEval = evaluateBatch', () => {
  const rng = Sim.makeRng(5);
  const brains = [Brain.random(rng), Brain.random(rng), Brain.random(rng)];
  const all = new Float32Array(3 * Brain.N_WEIGHTS);
  brains.forEach((b, i) => all.set(b, i * Brain.N_WEIGHTS));
  const cfg = { difficulty: 'normal', charSpeed: 280, spdMax: Infinity };
  const r = W.handleEval({ type: 'eval', jobId: 4, part: 0, buffer: all.buffer, count: 3, seeds: [1, 2], cfg });
  assert.equal(r.jobId, 4);
  assert.deepEqual(r.results, Eval.evaluateBatch(brains, [1, 2], cfg));
});

test('pool : découpe, ordre, jobs concurrents (faux workers)', async () => {
  class Fake {
    constructor() { this.terminated = false; }
    postMessage(m) {
      const r = W.handleEval(m);
      setTimeout(() => this.onmessage({ data: r }), m.jobId === 1 ? 5 : 0);
    }
    terminate() { this.terminated = true; }
  }
  const pool = T.createWorkerPool('x', 3, Fake);
  const rng = Sim.makeRng(9);
  const brains = Array.from({ length: 7 }, () => Brain.random(rng));
  const cfg = { difficulty: 'normal', charSpeed: 280, spdMax: Infinity };
  const [a, b] = await Promise.all([pool.evaluate(brains, [1], cfg), pool.evaluate(brains.slice(0, 4), [2], cfg)]);
  assert.deepEqual(a, Eval.evaluateBatch(brains, [1], cfg));
  assert.deepEqual(b, Eval.evaluateBatch(brains.slice(0, 4), [2], cfg));
  pool.terminate();
});

test('pool : erreur de worker rejette', async () => {
  class Bad { postMessage() { setTimeout(() => this.onerror(new Error('boom')), 0); } terminate() {} }
  const pool = T.createWorkerPool('x', 1, Bad);
  await assert.rejects(pool.evaluate([new Float32Array(Brain.N_WEIGHTS)], [1], {}), /boom/);
});

const slowEval = (delay) => async (b, s, c) => { await new Promise(r => setTimeout(r, delay)); return Eval.evaluateBatch(b, s, c); };
const tick = (ms) => new Promise(r => setTimeout(r, ms));

test('pause puis resume immédiat (pendant une génération) : une seule boucle, pas d erreur', async () => {
  const errs = [];
  let active = 0, maxActive = 0;
  const ev = async (b, s, c) => { active++; maxActive = Math.max(maxActive, active); await tick(15); active--; return Eval.evaluateBatch(b, s, c); };
  const t = mk({ evaluate: ev, onError: e => errs.push(e) });
  t.start();
  await tick(5);
  t.pause(); t.resume();
  await tick(80);
  const n1 = t.getState().history.length;
  await tick(60);
  assert.ok(t.getState().history.length > n1);
  await t.pause();
  assert.deepEqual(errs, []);
  assert.equal(maxActive, 1);
});

test('pause puis resume pendant le yield : une seule boucle', async () => {
  const errs = [];
  let calls = 0;
  const ev = async (b, s, c) => { calls++; return Eval.evaluateBatch(b, s, c); };
  const t = mk({ evaluate: ev, onError: e => errs.push(e), onGeneration: () => { t.pause(); t.resume(); } });
  t.start();
  await tick(150);
  await t.pause();
  assert.deepEqual(errs, []);
  const h = t.getState().history;
  assert.ok(h.length >= 2);
  assert.equal(calls, h.length); // une seule évaluation commune par génération
  assert.deepEqual(h.map(x => x.gen), h.map((_, i) => i));
});

test('loadState et reset en pleine génération attendent la fin', async () => {
  const a = mk();
  await a.runGenerations(2);
  const snap = a.getState();
  const t = mk({ evaluate: slowEval(20) });
  t.start();
  await tick(5);
  await t.loadState(snap);
  assert.ok(!t.isRunning());
  assert.deepEqual(t.getState().history, snap.history);
  assert.equal(t.getState().gen, 2);
  t.start();
  await tick(5);
  await t.reset();
  assert.equal(t.getState().gen, 0);
  assert.equal(t.getState().history.length, 0);
});

test('getState partage les notables (immuables) mais copie la population', async () => {
  const t = mk();
  await t.runGenerations(2);
  const a = t.getState(), b = t.getState();
  assert.ok(a.notables.length > 0);
  assert.strictEqual(a.notables[0], b.notables[0]);
  assert.notStrictEqual(a.notables, b.notables);
  assert.notStrictEqual(a.population[0], b.population[0]);
  a.population[0][0] = 12345;
  assert.notEqual(t.getState().population[0][0], 12345);
});

test('loadState invalide : rejet en français, trainer intact', async () => {
  const t = mk();
  await t.runGenerations(2);
  const before = JSON.stringify(t.getState().history);
  const bad = t.getState();
  bad.notableState = { bestScore: 1 }; // milestonesDone manquant
  const other = mk();
  await other.runGenerations(1);
  await assert.rejects(other.loadState(bad), /sauvegarde invalide : notableState\.milestonesDone manquant/);
  assert.equal(other.getState().gen, 1);
  assert.equal(JSON.stringify(t.getState().history), before);
});

test('trainer : champions éclaircis au fil des générations', async () => {
  const t = mk({ opts: { popSize: 6, gamesPerBot: 1 } });
  await t.runGenerations(25);
  const champs = t.getState().notables.filter(n => n.type === 'champion').map(n => n.gen);
  assert.deepStrictEqual(champs, Array.from({ length: 21 }, (_, i) => i).concat([24]));
});

test('pool : un worker muet fait échouer le job (délai dépassé, en français)', async () => {
  class Mute { postMessage() {} terminate() {} }
  const pool = T.createWorkerPool('x', 2, Mute, { timeoutMs: 30 });
  const rng = Sim.makeRng(1);
  await assert.rejects(pool.evaluate([Brain.random(rng), Brain.random(rng)], [1], {}), /ne répond plus/);
  assert.equal(T.JOB_TIMEOUT_MS, 0);
  pool.terminate();
});
