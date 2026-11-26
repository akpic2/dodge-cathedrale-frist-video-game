(function (root) {
  const Sim = (typeof DodgeSim !== 'undefined') ? DodgeSim : require('../sim.js');
  const Sensors = (typeof DodgeSensors !== 'undefined') ? DodgeSensors : require('./sensors.js');
  const Brain = (typeof DodgeBrain !== 'undefined') ? DodgeBrain : require('./brain.js');

  const DodgeEval = { MAX_GAME_TIME: 600, playGame, evaluateBrain, evaluateBatch };

  const inputs = new Float64Array(Sensors.N_INPUTS);

  function playGame(w, seed, cfg) {
    cfg = cfg || {};
    const sim = Sim.createSim({ seed, difficulty: cfg.difficulty, charSpeed: cfg.charSpeed, spdMax: cfg.spdMax });
    const maxTime = DodgeEval.MAX_GAME_TIME;
    while (!sim.dead && sim.time < maxTime) {
      Sim.step(sim, Brain.decide(w, Sensors.observe(sim, inputs)));
    }
    return {
      seed, score: sim.score, time: sim.time,
      sideDodged: sim.stats.sideDodged, timeAtCap: sim.stats.timeAtCap,
      timedOut: !sim.dead, spdAtEnd: sim.spd
    };
  }

  function evaluateBrain(w, seeds, cfg) {
    const games = seeds.map(s => playGame(w, s, cfg));
    let sum = 0;
    for (const g of games) sum += g.score;
    return { fitness: games.length ? sum / games.length : 0, games };
  }

  function evaluateBatch(brains, seeds, cfg) {
    return brains.map(w => evaluateBrain(w, seeds, cfg));
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeEval; else root.DodgeEval = DodgeEval;
})(typeof self !== 'undefined' ? self : globalThis);
