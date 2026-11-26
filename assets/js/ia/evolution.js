(function (root) {
  const DEFAULTS = {
    popSize: 300, eliteFrac: 0.05, tournament: 5, mutRate: 0.1, mutSigma: 0.3,
    gamesPerBot: 5, holdSeconds: 20, raise: 1.05, introSeconds: 40
  };

  function opt(opts) {
    const o = {};
    for (const k in DEFAULTS) o[k] = (opts && opts[k] !== undefined) ? opts[k] : DEFAULTS[k];
    return o;
  }

  // Somme de 12 uniformes - 6 : ~N(0,1), sans log/sqrt.
  function gaussian(rng) {
    let s = 0;
    for (let i = 0; i < 12; i++) s += rng.next();
    return s - 6;
  }

  function nextGeneration(pop, fitness, rng, opts) {
    const o = opt(opts);
    const n = pop.length;
    const order = [];
    for (let i = 0; i < n; i++) order.push(i);
    order.sort((a, b) => (fitness[b] - fitness[a]) || (a - b));
    const nElite = Math.min(n, Math.ceil(o.eliteFrac * n));
    const next = [];
    for (let i = 0; i < nElite; i++) next.push(new Float32Array(pop[order[i]]));

    function pick() {
      let best = -1;
      for (let t = 0; t < o.tournament; t++) {
        const i = Math.floor(rng.next() * n);
        if (best < 0 || fitness[i] > fitness[best]) best = i;
      }
      return pop[best];
    }

    while (next.length < n) {
      const a = pick(), b = pick();
      const child = new Float32Array(a.length);
      for (let k = 0; k < child.length; k++) {
        let v = rng.next() < 0.5 ? a[k] : b[k];
        if (rng.next() < o.mutRate) v += gaussian(rng) * o.mutSigma;
        child[k] = v;
      }
      next.push(child);
    }
    return next;
  }

  function meanOf(games, key) {
    let s = 0;
    for (const g of games) s += g[key];
    return games.length ? s / games.length : 0;
  }

  // Première limite de vitesse : seulement si le champion tient assez longtemps sans limite.
  function introduceSpdMax(championGames, opts) {
    const o = opt(opts);
    if (!championGames.length || meanOf(championGames, 'time') < o.introSeconds) return null;
    let m = Infinity;
    for (const g of championGames) if (g.spdAtEnd < m) m = g.spdAtEnd;
    return Math.floor(m / 10) * 10;
  }

  function updateSpdMax(spdMax, championGames, opts) {
    const o = opt(opts);
    if (spdMax === Infinity || !championGames.length) return { spdMax, raised: false };
    if (meanOf(championGames, 'timeAtCap') >= o.holdSeconds) {
      return { spdMax: Math.round(spdMax * o.raise), raised: true };
    }
    return { spdMax, raised: false };
  }

  const DodgeEvo = { DEFAULTS, gaussian, nextGeneration, introduceSpdMax, updateSpdMax };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeEvo; else root.DodgeEvo = DodgeEvo;
})(typeof self !== 'undefined' ? self : globalThis);
