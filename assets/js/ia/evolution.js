(function (root) {
  const DEFAULTS = {
    popSize: 1000, eliteFrac: 0.05, tournament: 3, mutRate: 0.1, mutSigma: 0.3,
    // Croisement : probabilité qu'un enfant mélange deux parents (sinon simple copie mutée d'un parent).
    crossoverRate: 0.25,
    // Mutation auto-adaptative : la force de mutation de chaque bot mute elle aussi (×(1 ± sigmaMut)).
    sigmaMut: 0.2, sigmaMin: 0.02, sigmaMax: 1.5,
    // Familles (espèces) : on vise ~targetSpecies familles ; le meilleur de chaque famille d'au moins
    // speciesMinSize bots est protégé, et la sélection divise le score par la taille de la famille.
    targetSpecies: 8, speciesMinSize: 5, maxEliteFrac: 0.2,
    gamesPerBot: 15, holdSeconds: 20, raise: 1.05, introSeconds: 40,
    // Repêchage : le top rescueFrac rejoue rescueGames parties de plus avant la sélection.
    rescueFrac: 0.2, rescueGames: 20,
    // Mémoire des survivants : on garde au plus memoryGames parties dans la moyenne cumulée.
    memoryGames: 50
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

  function rankOrder(fitness) {
    const order = [];
    for (let i = 0; i < fitness.length; i++) order.push(i);
    order.sort((a, b) => (fitness[b] - fitness[a]) || (a - b));
    return order;
  }

  // Élites : le top eliteFrac global, puis le meilleur de chaque famille assez grande (si species fourni),
  // sans dépasser maxEliteFrac. nextGeneration les place, dans cet ordre, en tête de la nouvelle population.
  function eliteIndices(fitness, opts, species) {
    const o = opt(opts);
    const n = fitness.length;
    const order = rankOrder(fitness);
    const out = order.slice(0, Math.min(n, Math.ceil(o.eliteFrac * n)));
    if (species) {
      const cap = Math.max(out.length, Math.floor(o.maxEliteFrac * n));
      const taken = new Set(out), seen = new Set();
      for (const i of order) {
        if (out.length >= cap) break;
        const sp = species.ids[i];
        if (seen.has(sp)) continue;
        seen.add(sp);
        if (species.sizes[sp] >= o.speciesMinSize && !taken.has(i)) { out.push(i); taken.add(i); }
      }
    }
    return out;
  }

  // Distance entre deux cerveaux : écart moyen des poids (échantillonné 1 poids sur 5).
  function distance(a, b, nNet) {
    let s = 0, c = 0;
    for (let k = 0; k < nNet; k += 5) { const d = a[k] - b[k]; s += d < 0 ? -d : d; c++; }
    return c ? s / c : 0;
  }

  // Regroupe la population en familles : un bot rejoint la 1re famille dont le représentant est à moins de threshold.
  function speciate(pop, threshold, nNet) {
    const reps = [], ids = new Array(pop.length), sizes = [];
    for (let i = 0; i < pop.length; i++) {
      let sp = -1;
      for (let r = 0; r < reps.length; r++) if (distance(pop[i], pop[reps[r]], nNet) < threshold) { sp = r; break; }
      if (sp < 0) { sp = reps.length; reps.push(i); sizes.push(0); }
      ids[i] = sp; sizes[sp]++;
    }
    return { ids, sizes, count: reps.length };
  }

  // Ajuste le seuil pour viser targetSpecies familles.
  function adaptThreshold(threshold, count, opts) {
    const o = opt(opts);
    if (count < o.targetSpecies) return threshold * 0.95;
    if (count > o.targetSpecies) return threshold * 1.05;
    return threshold;
  }

  // Indices du top rescueFrac (au moins 1 bot si rescueFrac > 0), du meilleur au moins bon.
  function rescueIndices(fitness, opts) {
    const o = opt(opts);
    const n = fitness.length;
    if (!(o.rescueFrac > 0) || !(o.rescueGames > 0) || n === 0) return [];
    const order = [];
    for (let i = 0; i < n; i++) order.push(i);
    order.sort((a, b) => (fitness[b] - fitness[a]) || (a - b));
    return order.slice(0, Math.min(n, Math.max(1, Math.ceil(o.rescueFrac * n))));
  }

  // Ajoute des parties à un compteur {sum, count} en bornant la mémoire à memoryGames parties
  // (au-delà, l'ancien total est réduit proportionnellement : les vieilles parties pèsent moins).
  function addToRecord(rec, games, opts) {
    const o = opt(opts);
    let sum = rec ? rec.sum : 0, count = rec ? rec.count : 0;
    for (const g of games) { sum += g.score; count++; }
    if (o.memoryGames > 0 && count > o.memoryGames) { sum = sum * o.memoryGames / count; count = o.memoryGames; }
    return { sum, count };
  }

  // pop : Float32Array dont la dernière case est la force de mutation du bot (voir brain.js).
  // species (optionnel) : résultat de speciate() — active la protection des familles et le partage du score.
  function nextGeneration(pop, fitness, rng, opts, species) {
    const o = opt(opts);
    const n = pop.length;
    const len = pop[0].length, sIdx = len - 1;
    const next = [];
    for (const i of eliteIndices(fitness, opts, species)) next.push(new Float32Array(pop[i]));

    // Score de sélection : partagé dans la famille (une famille nombreuse ne monopolise pas les parents).
    const sel = species ? fitness.map((f, i) => f / species.sizes[species.ids[i]]) : fitness;

    function pick() {
      let best = -1;
      for (let t = 0; t < o.tournament; t++) {
        const i = Math.floor(rng.next() * n);
        if (best < 0 || sel[i] > sel[best]) best = i;
      }
      return pop[best];
    }

    while (next.length < n) {
      const a = pick();
      const b = rng.next() < o.crossoverRate ? pick() : null;
      const child = new Float32Array(len);
      // Nouvelle force de mutation (héritée de a, elle-même mutée), bornée.
      let sigma = (a[sIdx] > 0 ? a[sIdx] : o.mutSigma) * (1 + o.sigmaMut * gaussian(rng));
      sigma = sigma < o.sigmaMin ? o.sigmaMin : (sigma > o.sigmaMax ? o.sigmaMax : sigma);
      for (let k = 0; k < sIdx; k++) {
        let v = (b && rng.next() < 0.5) ? b[k] : a[k];
        if (rng.next() < o.mutRate) v += gaussian(rng) * sigma;
        child[k] = v;
      }
      child[sIdx] = sigma;
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

  const DodgeEvo = { DEFAULTS, gaussian, nextGeneration, eliteIndices, speciate, adaptThreshold, distance, rescueIndices, addToRecord, introduceSpdMax, updateSpdMax };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeEvo; else root.DodgeEvo = DodgeEvo;
})(typeof self !== 'undefined' ? self : globalThis);
