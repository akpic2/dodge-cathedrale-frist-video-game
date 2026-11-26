const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../assets/js/sim.js');
const Sensors = require('../assets/js/ia/sensors.js');
const Brain = require('../assets/js/ia/brain.js');

test('observe: 25 valeurs finies sur seed 3', () => {
  const sim = S.createSim({ seed: 3 });
  const rng = S.makeRng(99);
  const check = () => {
    const o = Sensors.observe(sim);
    assert.equal(o.length, Sensors.N_INPUTS);
    for (const v of o) assert.ok(Number.isFinite(v));
  };
  let n = 0;
  for (const target of [0, 500, 3000]) {
    while (n < target) {
      sim.dead = false;
      S.step(sim, { left: rng.next() < 0.3, right: rng.next() < 0.3, jump: rng.next() < 0.05 });
      n++;
    }
    check();
  }
});

test('observe: sans obstacle, motif vide', () => {
  const sim = S.createSim({ seed: 3 });
  sim.obstacles = [];
  const o = Sensors.observe(sim);
  for (let i = 4; i < 19; i += 3) assert.deepEqual([o[i], o[i + 1], o[i + 2]], [0, 1, 0]);
  assert.equal(o[19], 0);
  assert.equal(o[22], 0);
});

test('observe: obstacle tombant au-dessus du joueur en premier', () => {
  const sim = S.createSim({ seed: 3 });
  const p = sim.player;
  sim.obstacles = [
    { x: p.x + 100, y: 0, w: 30, h: 30, vx: 0, vy: 200, rot: 0, type: 0, fromRight: false },
    { x: p.x, y: p.y - 80, w: 30, h: 30, vx: 0, vy: 200, rot: 0, type: 0, fromRight: false },
  ];
  const o = Sensors.observe(sim);
  assert.ok(Math.abs(o[4]) < 1e-9);
  assert.ok(o[5] > 0 && o[5] < 0.5);
});

test('observe: latéraux gauche/droite', () => {
  const sim = S.createSim({ seed: 3 });
  const p = sim.player;
  sim.obstacles = [
    { x: p.x - 100, y: 380, w: 30, h: 30, vx: 300, vy: 0, rot: 0, type: 0, fromRight: true },
    { x: p.x + 50, y: 380, w: 30, h: 30, vx: -200, vy: 0, rot: 0, type: 0, fromRight: true },
  ];
  const o = Sensors.observe(sim);
  assert.equal(o[19], 1);
  assert.ok(Math.abs(o[20] - 100 / 480) < 1e-9);
  assert.ok(Math.abs(o[21] - 0.3) < 1e-9);
  assert.equal(o[22], 1);
  assert.ok(Math.abs(o[23] - 50 / 480) < 1e-9);
});

test('brain: poids', () => {
  assert.ok(Brain.N_WEIGHTS > 2000);
  assert.equal(Brain.random(S.makeRng(1)).length, Brain.N_WEIGHTS);
  assert.ok(Brain.random(S.makeRng(1)) instanceof Float32Array);
});

test('brain: forward déterministe', () => {
  const w = Brain.random(S.makeRng(7));
  const sim = S.createSim({ seed: 3 });
  const inp = Sensors.observe(sim);
  const a = Array.from(Brain.forward(w, inp)), b = Array.from(Brain.forward(w, inp));
  assert.equal(a.length, 4);
  assert.deepEqual(a, b);
});

test('brain: poids nuls -> rien', () => {
  const w = new Float32Array(Brain.N_WEIGHTS);
  const inp = new Float64Array(Sensors.N_INPUTS).fill(0.5);
  assert.deepEqual(Brain.decide(w, inp), { left: false, right: false, jump: false });
});

test('brain: activations une par couche', () => {
  const w = Brain.random(S.makeRng(2));
  const acts = Brain.activations(w, new Float64Array(25));
  assert.deepEqual(acts.map(a => a.length), [Sensors.N_INPUTS, 48, 32, 4]);
});

test('sources sans fonctions interdites', () => {
  for (const f of ['brain.js', 'sensors.js']) {
    const src = fs.readFileSync(path.join(__dirname, '../assets/js/ia', f), 'utf8');
    for (const bad of ['Math.exp', 'Math.tanh', 'Math.random']) assert.ok(!src.includes(bad), f + ' contient ' + bad);
  }
});
