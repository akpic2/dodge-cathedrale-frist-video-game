// Simulation déterministe du mode classique (Survie sans limite) de Dodge la Cathédrale.
// Règles copiées de script.js (refonte Mote) : start, spawnGargoyle classique + pushSide/pushFall,
// branche « Mode classique » de gameStep, bloc JOUEUR, checkCollision et loop.
// Math.random -> sim.rng ; pas fixe DT = 1/60 comme FIXED_STEP de la refonte.
(function (root) {
  const W = 480, H = 420, DT = 1 / 60;
  const DIFFICULTIES = {
    easy: { spd: 100, spawnInt: 300 },
    normal: { spd: 150, spawnInt: 200 },
    hard: { spd: 220, spawnInt: 120 },
  };
  const DEFAULT_SPD_MAX = Infinity;
  const REFERENCE_FPS = 144; // spawnInt et progression restent calés sur l'équilibrage historique à 144 FPS
  const PROGRESSION_INTERVAL = 200 / REFERENCE_FPS;
  const MAX_STEPS_PER_FRAME = 60;

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

  // spawnGargoyle (mode classique) : type, puis latéral (pushSide) ou chute (pushFall).
  function spawn(sim) {
    const rng = sim.rng, spd = sim.spd, list = sim.obstacles;
    const type = rng.next() < 0.3 ? 'vitrail' : 'gargouille';
    if (rng.next() < 0.3) {
      // pushSide
      const y = H - 40;
      if (rng.next() < 0.5) {
        list.push({ x: W + 20, y, w: 50, h: 50, vx: -(spd * 0.4 + 18 + rng.next() * 18), vy: 0, rot: 0, type, fromRight: true });
      } else {
        list.push({ x: -20, y, w: 50, h: 50, vx: spd * 0.4 + 18 + rng.next() * 18, vy: 0, rot: 0, type, fromRight: true });
      }
    } else {
      // pushFall
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

    sim.progressTimer += DT;
    while (sim.progressTimer >= PROGRESSION_INTERVAL) {
      sim.progressTimer -= PROGRESSION_INTERVAL;
      sim.spd = Math.min(sim.spd + 25, cfg.spdMax);
      sim.spawnInt = Math.max(25, sim.spawnInt - 8);
    }

    // Score : fige des que la limite de vitesse est atteinte (les stats restent comparables).
    // survival : temps de survie complet x 20, sert a la selection.
    sim.survival = Math.floor(sim.time * 20);
    if (sim.spd < cfg.spdMax) sim.score = sim.survival;

    sim.spawnTimer += DT;
    const spawnIntervalSeconds = sim.spawnInt / REFERENCE_FPS;
    while (sim.spawnTimer >= spawnIntervalSeconds) { spawn(sim); sim.spawnTimer -= spawnIntervalSeconds; }

    let crossedSide = 0;
    for (const g of sim.obstacles) {
      if (g.fromRight) {
        const before = g.x - p.x;
        g.x += g.vx * DT;
        const after = g.x - p.x;
        if ((before < 0 && after >= 0) || (before > 0 && after <= 0)) crossedSide++;
      } else {
        g.y += g.vy * DT;
      }
      g.rot += 2.4 * DT;
    }
    sim.obstacles = sim.obstacles.filter(g => g.fromRight ? (g.x > -40 && g.x < W + 40) : (g.y < H + 40));

    // Collision : comme finish(false);return dans la refonte, le pas s'arrête là (le joueur ne bouge pas).
    for (const g of sim.obstacles) { if (collides(p, g)) { sim.dead = true; return; } }
    // Un passage au centre n'est une esquive que si aucune collision n'a tué le joueur.
    sim.stats.sideDodged += crossedSide;

    // JOUEUR
    if (input.left) p.x -= cfg.charSpeed * DT;
    if (input.right) p.x += cfg.charSpeed * DT;
    if (input.jump && !p.isJumping) { p.vy = -360; p.isJumping = true; }
    p.x = Math.max(p.w / 2, Math.min(W - p.w / 2, p.x));
    p.vy += 720 * DT; p.y += p.vy * DT;
    if (p.y + p.h >= H - 25) { p.y = H - 25 - p.h; p.vy = 0; p.isJumping = false; }

    if (sim.spd >= cfg.spdMax) sim.stats.timeAtCap += DT;
  }

  // Reproduit loop() de la refonte : temps réel borné à [0, 1] s, au plus 60 pas par appel.
  // Le reliquat reste dans sim.acc (comme simulationAccumulator). Retourne le nombre de pas joués.
  function advanceRealTime(sim, dtSeconds, input) {
    sim.acc += Math.min(Math.max(dtSeconds, 0), 1);
    let n = 0;
    while (sim.acc >= DT && n < MAX_STEPS_PER_FRAME && !sim.dead) { step(sim, input); sim.acc -= DT; n++; }
    return n;
  }

  // Vitesse atteinte apres `time` secondes sans limite (meme progression que step()).
  function speedAt(time, difficulty) {
    const diff = DIFFICULTIES[difficulty || 'normal'] || DIFFICULTIES.normal;
    return diff.spd + 25 * Math.floor(time / PROGRESSION_INTERVAL);
  }

  const DodgeSim = { W, H, DT, DIFFICULTIES, DEFAULT_SPD_MAX, makeRng, createSim, step, advanceRealTime, collides, speedAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeSim; else root.DodgeSim = DodgeSim;
})(typeof self !== 'undefined' ? self : globalThis);
