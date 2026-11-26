// Simulation déterministe du mode classique (Survie infinie) de Dodge la Cathédrale.
// Règles copiées de script.js : initGame, spawnGargoyle (mode classique), loop (else classique),
// bloc JOUEUR et checkCollision. Math.random -> sim.rng, dt variable -> DT fixe.
(function (root) {
  const W = 480, H = 420, DT = 1 / 144;
  const DIFFICULTIES = {
    easy: { spd: 100, spawnInt: 300 },
    normal: { spd: 150, spawnInt: 200 },
    hard: { spd: 220, spawnInt: 120 },
  };
  const DEFAULT_SPD_MAX = Infinity;
  const PROGRESSION_INTERVAL = 200 / 144;

  // mulberry32 : seulement des opérations entières
  function makeRng(seed) {
    let a = seed >>> 0;
    return {
      next() {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      getState() { return a; },
      setState(n) { a = n >>> 0; },
    };
  }

  function createSim(opts) {
    const o = opts || {};
    const difficulty = o.difficulty || 'normal';
    const diff = DIFFICULTIES[difficulty];
    const cfg = {
      seed: o.seed,
      difficulty,
      charSpeed: o.charSpeed === undefined ? 280 : o.charSpeed,
      spdMax: o.spdMax === undefined ? DEFAULT_SPD_MAX : o.spdMax,
    };
    return {
      player: { x: W / 2, y: H - 30, w: 32, h: 45, vy: 0, isJumping: false },
      obstacles: [],
      spd: diff.spd,
      spawnInt: diff.spawnInt,
      time: 0,
      score: 0,
      dead: false,
      stats: { sideDodged: 0, timeAtCap: 0 },
      cfg,
      rng: makeRng(cfg.seed),
      progressTimer: 0,
      spawnTimer: 0,
      acc: 0,
    };
  }

  function spawn(sim) {
    const rng = sim.rng, spd = sim.spd, list = sim.obstacles;
    const type = rng.next() < 0.3 ? 'vitrail' : 'gargouille';
    const rand = rng.next();
    if (rand < 0.3) {
      const y = H - 40;
      if (rand < 0.15) {
        list.push({ x: W + 20, y, w: 50, h: 50, vx: -(spd * 0.4 + 18 + rng.next() * 18), vy: 0, rot: 0, type, fromRight: true });
      } else {
        list.push({ x: -20, y, w: 50, h: 50, vx: spd * 0.4 + 18 + rng.next() * 18, vy: 0, rot: 0, type, fromRight: true });
      }
    } else {
      const x = rng.next() * (W - 30) + 15;
      list.push({ x, y: -30, w: 50, h: 50, vy: spd + 30 + rng.next() * 48, vx: 0, rot: 0, type, fromRight: false });
    }
  }

  function collides(player, g) {
    const shrink = 0.55;
    const left = player.x - player.w / 2 * 0.7, right = player.x + player.w / 2 * 0.7;
    const top = player.y + player.h * 0.15, bottom = player.y + player.h * 0.90;
    const gleft = g.x - (g.w / 2) * shrink, gright = g.x + (g.w / 2) * shrink;
    const gtop = g.y - (g.h / 2) * shrink, gbottom = g.y + (g.h / 2) * shrink;
    if (right <= gleft || left >= gright || bottom <= gtop || top >= gbottom) return false;
    if (player.y + player.h - 5 < g.y - g.h / 2 && player.vy >= 0) return false;
    return true;
  }

  function step(sim, input) {
    if (sim.dead) return;
    const p = sim.player, cfg = sim.cfg;

    sim.time += DT;
    sim.score = Math.floor(sim.time * 20);

    sim.progressTimer += DT;
    while (sim.progressTimer >= PROGRESSION_INTERVAL) {
      sim.progressTimer -= PROGRESSION_INTERVAL;
      sim.spd = Math.min(sim.spd + 25, cfg.spdMax);
      sim.spawnInt = Math.max(25, sim.spawnInt - 8);
    }

    sim.spawnTimer += DT;
    if (sim.spawnTimer >= sim.spawnInt / 144) { spawn(sim); sim.spawnTimer -= sim.spawnInt / 144; }

    for (const g of sim.obstacles) {
      if (g.fromRight) {
        const before = g.x - p.x;
        g.x += g.vx * DT;
        const after = g.x - p.x;
        if ((before < 0 && after >= 0) || (before > 0 && after <= 0)) sim.stats.sideDodged++;
      } else {
        g.y += g.vy * DT;
      }
      g.rot += 2.4 * DT;
    }
    sim.obstacles = sim.obstacles.filter(g => g.fromRight ? (g.x > -40 && g.x < W + 40) : (g.y < H + 40));

    for (const g of sim.obstacles) { if (collides(p, g)) { sim.dead = true; break; } }

    // JOUEUR
    if (input.left) p.x -= cfg.charSpeed * DT;
    if (input.right) p.x += cfg.charSpeed * DT;
    if (input.jump && !p.isJumping) { p.vy = -360; p.isJumping = true; }
    p.x = Math.max(p.w / 2, Math.min(W - p.w / 2, p.x));
    p.vy += 720 * DT; p.y += p.vy * DT;
    if (p.y + p.h >= H - 25) { p.y = H - 25 - p.h; p.vy = 0; p.isJumping = false; }

    if (sim.spd >= cfg.spdMax) sim.stats.timeAtCap += DT;
  }

  function advanceRealTime(sim, dtSeconds, input) {
    sim.acc += Math.min(dtSeconds, 0.1);
    let n = 0;
    while (sim.acc >= DT) { sim.acc -= DT; step(sim, input); n++; }
    return n;
  }

  const DodgeSim = { W, H, DT, DIFFICULTIES, DEFAULT_SPD_MAX, makeRng, createSim, step, advanceRealTime, collides };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeSim; else root.DodgeSim = DodgeSim;
})(typeof self !== 'undefined' ? self : globalThis);
