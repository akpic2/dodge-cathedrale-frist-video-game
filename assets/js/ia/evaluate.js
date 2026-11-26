(function (root) {
  const Sim = (typeof DodgeSim !== 'undefined') ? DodgeSim : require('../sim.js');
  const Sensors = (typeof DodgeSensors !== 'undefined') ? DodgeSensors : require('./sensors.js');
  const Brain = (typeof DodgeBrain !== 'undefined') ? DodgeBrain : require('./brain.js');

  const DodgeEval = { MAX_GAME_TIME: 600, playGame, evaluateBrain, evaluateBatch, lowerTailMean };

  const inputs = new Float64Array(Sensors.N_INPUTS);

  function playGame(w, seed, cfg) {
    cfg = cfg || {};
    const sim = Sim.createSim({ seed, difficulty: cfg.difficulty, charSpeed: cfg.charSpeed, spdMax: cfg.spdMax });
    const maxTime = DodgeEval.MAX_GAME_TIME;
    while (!sim.dead && sim.time < maxTime) {
      Sim.step(sim, Brain.decide(w, Sensors.observe(sim, inputs)));
    }
    return {
      seed, score: sim.score, survival: Math.floor(sim.time * 20), time: sim.time,
      sideDodged: sim.stats.sideDodged, timeAtCap: sim.stats.timeAtCap,
      timedOut: !sim.dead, spdAtEnd: sim.spd
    };
  }

  // Moyenne des 25 % de parties les plus difficiles : évite qu'un bot soit sélectionné
  // uniquement parce qu'il a eu quelques graines faciles.
  function lowerTailMean(games, fraction) {
    if (!games.length) return 0;
    const values = games.map(g => g.survival !== undefined ? g.survival : g.score).sort((a, b) => a - b);
    const count = Math.max(1, Math.ceil(values.length * (fraction || 0.25)));
    let sum = 0;
    for (let i = 0; i < count; i++) sum += values[i];
    return sum / count;
  }

  function evaluateBrain(w, seeds, cfg) {
    const games = seeds.map(s => playGame(w, s, cfg));
    let sum = 0, surv = 0;
    for (const g of games) { sum += g.score; surv += g.survival; }
    const n = games.length;
    const survival = n ? surv / n : 0;
    const lowerTail = lowerTailMean(games, 0.25);
    // 75 % moyenne + 25 % pire quartile : privilégie la survie reproductible.
    const selectionFitness = 0.65 * survival + 0.35 * lowerTail;
    return { fitness: n ? sum / n : 0, survival, lowerTail, selectionFitness, games };
  }

  function evaluateBatch(brains, seeds, cfg) {
    return brains.map(w => evaluateBrain(w, seeds, cfg));
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeEval; else root.DodgeEval = DodgeEval;
})(typeof self !== 'undefined' ? self : globalThis);
