const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../assets/js/sim.js');

const NONE = { left: false, right: false, jump: false };

function forced(sim, n) {
  for (let i = 0; i < n; i++) { sim.dead = false; sim.obstacles = []; S.step(sim, NONE); }
}

test('rng déterministe', () => {
  const a = S.makeRng(42), b = S.makeRng(42), c = S.makeRng(43);
  let diff = false;
  for (let i = 0; i < 1000; i++) {
    const x = a.next(), y = b.next(), z = c.next();
    assert.equal(x, y);
    assert.ok(x >= 0 && x < 1);
    if (x !== z) diff = true;
  }
  assert.ok(diff);
  const r = S.makeRng(5);
  r.next(); r.next();
  const st = r.getState();
  const expected = [r.next(), r.next(), r.next()];
  r.setState(st);
  assert.deepEqual([r.next(), r.next(), r.next()], expected);
});

test('état initial', () => {
  const s = S.createSim({ seed: 1 });
  assert.deepEqual(s.player, { x: 240, y: 390, w: 32, h: 45, vy: 0, isJumping: false });
  assert.equal(s.spd, 150);
  assert.equal(s.spawnInt, 200);
  assert.equal(s.score, 0);
  assert.equal(s.dead, false);
});

test('même graine + mêmes entrées = même partie', () => {
  const a = S.createSim({ seed: 7 }), b = S.createSim({ seed: 7 });
  const r = S.makeRng(99);
  for (let i = 0; i < 20000; i++) {
    const input = { left: r.next() < 0.4, right: r.next() < 0.4, jump: r.next() < 0.1 };
    S.step(a, input); S.step(b, input);
    assert.equal(JSON.stringify(a.obstacles), JSON.stringify(b.obstacles));
    assert.equal(a.score, b.score);
    assert.equal(a.dead, b.dead);
    assert.deepEqual(a.player, b.player);
  }
});

test('obstacles indépendants du joueur', () => {
  const a = S.createSim({ seed: 7 }), b = S.createSim({ seed: 7 });
  let compared = 0;
  for (let i = 0; i < 20000 && !a.dead && !b.dead; i++) {
    S.step(a, { left: true, right: false, jump: false });
    S.step(b, { left: false, right: true, jump: true });
    if (a.dead || b.dead) break;
    assert.equal(JSON.stringify(a.obstacles), JSON.stringify(b.obstacles));
    compared++;
  }
  assert.ok(compared > 50);
});

test('progression de difficulté', () => {
  const s = S.createSim({ seed: 1 });
  const first = Math.ceil((200 / 144) / (1 / 60)); // 84 pas à 60 Hz
  forced(s, first - 1);
  assert.equal(s.spd, 150);
  forced(s, 1);
  assert.equal(s.spd, 175);
  assert.equal(s.spawnInt, 192);
  forced(s, 200000);
  assert.equal(s.spawnInt, 25);
});

test('spdMax', () => {
  const s = S.createSim({ seed: 1, spdMax: 300 });
  forced(s, 10000);
  assert.equal(s.spd, 300);
  assert.ok(s.stats.timeAtCap > 0);
});

test('score', () => {
  const s = S.createSim({ seed: 1 });
  forced(s, 61);
  assert.equal(s.score, 20);
});

test('saut', () => {
  const s = S.createSim({ seed: 1 });
  S.step(s, NONE); // l'état initial (y=H-30) est sous le sol : le 1er pas recale au sol
  assert.equal(s.player.y, S.H - 25 - 45);
  S.step(s, { left: false, right: false, jump: true });
  assert.equal(s.player.vy, -360 + 720 * S.DT);
  let n = 1;
  while (s.player.isJumping && n < 400) { s.dead = false; s.obstacles = []; S.step(s, NONE); n++; }
  assert.ok(n < 70);
  assert.equal(s.player.isJumping, false);
  assert.equal(s.player.y, S.H - 25 - 45);
});

test('collides', () => {
  const p = { x: 240, y: 390, w: 32, h: 45, vy: 0, isJumping: false };
  assert.equal(S.collides(p, { x: 240, y: 410, w: 50, h: 50 }), true);
  const falling = { x: 240, y: 300, w: 32, h: 45, vy: 100, isJumping: true };
  const g = { x: 240, y: 372, w: 50, h: 50 }; // sous les pieds du joueur qui descend
  assert.equal(falling.y + falling.h - 5 < g.y - g.h / 2, true);
  assert.equal(S.collides(falling, g), false);
});

test('advanceRealTime plafonné', () => {
  const s = S.createSim({ seed: 1 });
  const n = S.advanceRealTime(s, 5, NONE);
  assert.ok(n <= 60);
  assert.ok(n >= 59);
  assert.equal(S.advanceRealTime(S.createSim({ seed: 1 }), -3, NONE), 0);
  const t = S.createSim({ seed: 1 });
  const m = S.advanceRealTime(t, 1 / 120, NONE) + S.advanceRealTime(t, 1 / 120, NONE);
  assert.equal(m, 1);
});

test('DT = 1/60', () => {
  assert.equal(S.DT, 1 / 60);
});

test('mort = le joueur ne bouge pas pendant le pas mortel', () => {
  const s = S.createSim({ seed: 1 });
  S.step(s, NONE);
  const before = { ...s.player };
  s.obstacles = [{ x: before.x, y: before.y + 25, w: 50, h: 50, vx: 0, vy: 0, rot: 0, type: 'gargouille', fromRight: false }];
  S.step(s, { left: false, right: true, jump: true });
  assert.equal(s.dead, true);
  assert.deepEqual(s.player, before);
});

test('ordre des tirages du spawn (pushSide / pushFall de la refonte)', () => {
  let side = 0, fall = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = S.createSim({ seed });
    while (s.obstacles.length === 0) { s.dead = false; S.step(s, NONE); }
    assert.equal(s.obstacles.length, 1);
    const g = s.obstacles[0], r = S.makeRng(seed), spd = s.spd;
    const type = r.next() < 0.3 ? 'vitrail' : 'gargouille';
    assert.equal(g.type, type);
    if (r.next() < 0.3) {
      side++;
      assert.equal(g.fromRight, true);
      if (r.next() < 0.5) {
        assert.equal(g.vx, -(spd * 0.4 + 18 + r.next() * 18));
        assert.equal(g.x, S.W + 20 + g.vx * S.DT);
      } else {
        assert.equal(g.vx, spd * 0.4 + 18 + r.next() * 18);
        assert.equal(g.x, -20 + g.vx * S.DT);
      }
    } else {
      fall++;
      assert.equal(g.fromRight, false);
      assert.equal(g.x, r.next() * (S.W - 30) + 15);
      assert.equal(g.vy, spd + 30 + r.next() * 48);
    }
  }
  assert.ok(side > 0 && fall > 0);
});
