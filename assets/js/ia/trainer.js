(function (root) {
  const Sim = (typeof DodgeSim !== 'undefined') ? DodgeSim : require('../sim.js');
  const Brain = (typeof DodgeBrain !== 'undefined') ? DodgeBrain : require('./brain.js');
  const Evo = (typeof DodgeEvo !== 'undefined') ? DodgeEvo : require('./evolution.js');
  const Notables = (typeof DodgeNotables !== 'undefined') ? DodgeNotables : require('./notables.js');

  function poolSize(hc, requested) { const max = Math.max(1, Math.min(32, hc || 1)); return requested > 0 ? Math.min(max, Math.max(1, Math.floor(requested))) : max; }

  // Les notables sont immuables une fois créés : on partage les objets (pas de copie profonde à chaque sauvegarde).
  function copyNotableState(ns) {
    return ns ? Object.assign({}, ns, { milestonesDone: ns.milestonesDone.slice() }) : null;
  }
  function checkState(s) {
    const bad = (what) => { throw new Error('sauvegarde invalide : ' + what); };
    if (!s || typeof s !== 'object') bad('état manquant');
    if (!Array.isArray(s.population) || !s.population.length) bad('population manquante');
    if (!Array.isArray(s.history)) bad('historique manquant');
    if (!Array.isArray(s.notables)) bad('perfs notables manquantes');
    for (const n of s.notables) if (!n || !(n.weights instanceof Float32Array) || typeof n.type !== 'string') bad('perf notable illisible');
    if (s.notableState !== null && s.notableState !== undefined) {
      if (typeof s.notableState !== 'object' || !Array.isArray(s.notableState.milestonesDone)) bad('notableState.milestonesDone manquant');
    }
    if (typeof s.gen !== 'number') bad('génération manquante');
    if (s.population[0].length !== Brain.N_WEIGHTS) bad('cerveaux d\'une ancienne version du bot (capteurs différents)');
  }

  // Banc de validation déterministe de 256 graines, strictement exclues de l'entraînement.
  const BENCH_SEEDS = (function () {
    const r = Sim.makeRng(0x5eedbe7c), out = [];
    for (let i = 0; i < 256; i++) out.push(Math.floor(r.next() * 4294967296) >>> 0);
    return out;
  })();
  const BENCH_SEED_SET = new Set(BENCH_SEEDS);
  function nextTrainingSeed(rng) {
    let seed;
    do { seed = Math.floor(rng.next() * 4294967296) >>> 0; } while (BENCH_SEED_SET.has(seed));
    return seed;
  }
  function percentile(sorted, p) {
    if (!sorted.length) return 0;
    return sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p)))];
  }
  const INIT_THRESHOLD = 0.6;

  // Version coopérative de la spéciation : même résultat que Evo.speciate(),
  // mais cède régulièrement le thread principal pour garder l'interface fluide.

  // Même reproduction que Evo.nextGeneration(), avec des cessions régulières au navigateur.
  async function nextGenerationYielding(pop, fitness, rng, opts, species) {
    const o = Object.assign({}, Evo.DEFAULTS, opts);
    const n = pop.length, len = pop[0].length, sIdx = len - 1;
    const next = [];
    for (const i of Evo.eliteIndices(fitness, opts, species)) next.push(new Float32Array(pop[i]));
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
      const child = new Float32Array(len);
      if (rng.next() < Math.max(0, Math.min(0.3, o.immigrantFrac || 0))) {
        for (let k = 0; k < sIdx; k++) child[k] = (rng.next() * 2 - 1) * 0.8;
        child[sIdx] = o.mutSigma;
        next.push(child);
      } else {
        const a = pick(), b = rng.next() < o.crossoverRate ? pick() : null;
        let sigma = (a[sIdx] > 0 ? a[sIdx] : o.mutSigma) * (1 + o.sigmaMut * Evo.gaussian(rng));
        sigma = sigma < o.sigmaMin ? o.sigmaMin : (sigma > o.sigmaMax ? o.sigmaMax : sigma);
        for (let k = 0; k < sIdx; k++) {
          let v = (b && rng.next() < 0.5) ? b[k] : a[k];
          if (rng.next() < o.mutRate) v += Evo.gaussian(rng) * sigma;
          child[k] = v;
        }
        if (rng.next() < Math.max(0, Math.min(0.35, o.macroMutationFrac || 0))) {
          const start = Math.floor(rng.next() * sIdx);
          const block = Math.max(1, Math.floor(sIdx * (0.025 + rng.next() * 0.10)));
          for (let k = start; k < Math.min(sIdx, start + block); k++) child[k] = (rng.next() * 2 - 1) * 0.8;
        }
        child[sIdx] = sigma;
        next.push(child);
      }
      if ((next.length & 15) === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    return next;
  }

  async function speciateYielding(pop, threshold, nNet) {
    const reps = [], ids = new Array(pop.length), sizes = [];
    for (let i = 0; i < pop.length; i++) {
      let sp = -1;
      for (let r = 0; r < reps.length; r++) {
        if (Evo.distance(pop[i], pop[reps[r]], nNet) < threshold) { sp = r; break; }
      }
      if (sp < 0) { sp = reps.length; reps.push(i); sizes.push(0); }
      ids[i] = sp; sizes[sp]++;
      if ((i & 3) === 3) await new Promise(resolve => setTimeout(resolve, 0));
    }
    return { ids, sizes, count: reps.length };
  }

  function createTrainer(conf) {
    const evaluate = conf.evaluate;
    const seed = conf.seed === undefined ? 1 : conf.seed;
    const opts = Object.assign({}, conf.opts);
    const cfg = Object.assign({ difficulty: 'normal', charSpeed: 280 }, conf.cfg);
    const onGeneration = conf.onGeneration || function () {};
    const onNotable = conf.onNotable || function () {};
    const popSize = opts.popSize !== undefined ? opts.popSize : Evo.DEFAULTS.popSize;
    const gamesPerBot = opts.gamesPerBot !== undefined ? opts.gamesPerBot : Evo.DEFAULTS.gamesPerBot;

    const rng = Sim.makeRng(seed);
    let gen, population, spdMax, history, notables, notableState;
    // records[i] = {sum, count} : parties cumulées du bot i (les élites gardent leur passé).
    let records;
    let speciesThreshold, benchBest; // seuil des familles ; meilleur score au banc {score, gen}
    const onError = conf.onError || function () {};
    let running = false, loopPromise = null, busy = false, inflight = null, loopToken = 0;

    // Limite de depart = vitesse atteinte au score startScore (score = temps x 20).
    function initialSpdMax() {
      const s = opts.startScore !== undefined ? opts.startScore : Evo.DEFAULTS.startScore;
      return s > 0 ? Sim.speedAt(s / 20, cfg.difficulty) : Infinity;
    }

    function resetSync() {
      rng.setState(seed);
      gen = 0; spdMax = initialSpdMax(); history = []; notables = []; notableState = null;
      population = [];
      for (let i = 0; i < popSize; i++) population.push(Brain.random(rng));
      records = population.map(() => null);
      speciesThreshold = INIT_THRESHOLD; benchBest = null;
    }
    resetSync();

    async function runOne() {
      const seeds = [];
      for (let i = 0; i < gamesPerBot; i++) seeds.push(nextTrainingSeed(rng));
      const spdMaxBefore = spdMax;
      const playCfg = Object.assign({}, cfg, { spdMax: spdMaxBefore });
      const results = await evaluate(population, seeds, playCfg);
      // Score brut de la génération (5 parties) : sert aux courbes moyenne/médiane.
      const rawFitness = results.map(r => r.fitness);

      // Chaque génome reçoit exactement le même nombre de parties et les mêmes graines.
      // La sélection utilise une fitness robuste (moyenne + quartile inférieur), sans avantage
      // statistique artificiel lié au repêchage ou à l'ancienneté des élites.
      const fitness = results.map(r => r.selectionFitness !== undefined ? r.selectionFitness : (r.survival !== undefined ? r.survival : r.fitness));
      const newRecords = fitness.map(value => ({ sum: value, count: 1 }));
      // Affichage (champion, courbe "meilleur") : score fige a la limite, moyenne des parties de cette gen.
      const shown = results.map(r => { let s = 0; for (const g of r.games) s += g.score; return r.games.length ? s / r.games.length : 0; });
      for (let i = 0; i < results.length; i++) { results[i].fitness = shown[i]; results[i].selectionFitness = fitness[i]; }

      let championIndex = 0;
      for (let i = 1; i < fitness.length; i++) if (fitness[i] > fitness[championIndex]) championIndex = i;
      const championGames = results[championIndex].games;

      let spdMaxAfter = spdMaxBefore;
      if (spdMaxBefore === Infinity) {
        const v = Evo.introduceSpdMax(championGames, opts);
        if (v !== null) spdMaxAfter = v;
      } else {
        spdMaxAfter = Evo.updateSpdMax(spdMaxBefore, championGames, opts).spdMax;
      }

      // Banc d'essai du champion (256 graines fixes, sans limite de vitesse).
      const benchCfg = Object.assign({}, cfg, { spdMax: Infinity });
      const bench = (await evaluate([population[championIndex]], BENCH_SEEDS, benchCfg))[0];
      const benchSorted = bench.games.map(g => g.survival !== undefined ? g.survival : g.score).sort((a, b) => a - b);
      const benchP10 = percentile(benchSorted, 0.10);
      const benchMedian = percentile(benchSorted, 0.50);
      const benchNotables = [];
      if (!benchBest || bench.fitness > benchBest.score) {
        let bg = bench.games[0];
        for (const g of bench.games) if (g.score > bg.score) bg = g;
        benchNotables.push({
          id: 'benchRecord-' + gen, type: 'benchRecord', gen, score: bg.score, seed: bg.seed,
          weights: new Float32Array(population[championIndex]), spdMax: Infinity,
          cfg: { difficulty: cfg.difficulty, charSpeed: cfg.charSpeed },
          label: 'Meilleur niveau réel : ' + Notables.fmt(bench.fitness) + ' de moyenne sur ' + BENCH_SEEDS.length + ' parties (gén. ' + gen + ')',
          priority: Notables.PRIORITY.benchRecord, benchScore: bench.fitness
        });
        benchBest = { score: bench.fitness, gen };
      }

      const det = Notables.detect({ gen, population, results, cfg, spdMaxBefore, spdMaxAfter, humanRecord: opts.humanRecord }, notableState);
      notableState = det.state;
      for (const n of det.notables.concat(benchNotables)) { Notables.addNotable(notables, n); onNotable(n); }

      // best = meilleur score de sélection (fiable) ; mean/median = parties de la génération (5 par bot).
      const sorted = rawFitness.slice().sort((a, b) => a - b);
      const n = sorted.length;
      let sum = 0;
      for (const f of rawFitness) sum += f;
      const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
      // Familles de cerveaux (pour protéger les nouveautés), seuil ajusté pour en viser ~targetSpecies.
      const species = await speciateYielding(population, speciesThreshold, Brain.NET_WEIGHTS);
      speciesThreshold = Evo.adaptThreshold(speciesThreshold, species.count, opts);

      const gamesEvaluated = results.reduce((total, r) => total + r.games.length, 0) + bench.games.length;
      history.push({ gen, best: shown[championIndex], mean: sum / n, median, spdMax: spdMaxAfter,
        bench: bench.fitness, benchP10, benchMedian, gamesEvaluated, species: species.count });

      const summary = { gen, seeds, history, spdMax: spdMaxAfter, population, results, championIndex, gamesEvaluated };
      spdMax = spdMaxAfter;
      const elites = Evo.eliteIndices(fitness, opts, species);
      const stagnation = benchBest ? Math.max(0, gen - benchBest.gen) : gen;
      const pressure = Math.min(2.2, stagnation / 55);
      const adaptiveOpts = Object.assign({}, opts, {
        mutRate: Math.min(0.48, (opts.mutRate || Evo.DEFAULTS.mutRate) * (1 + pressure)),
        sigmaMut: Math.min(0.75, (opts.sigmaMut || Evo.DEFAULTS.sigmaMut) + Math.min(0.4, stagnation / 260)),
        immigrantFrac: Math.min(0.16, 0.025 + stagnation / 1500),
        macroMutationFrac: Math.min(0.24, 0.04 + stagnation / 850)
      });
      const last = history[history.length - 1];
      if (last) { last.stagnation = stagnation; last.mutRateUsed = adaptiveOpts.mutRate; last.immigrantFrac = adaptiveOpts.immigrantFrac; last.macroMutationFrac = adaptiveOpts.macroMutationFrac; }
      population = await nextGenerationYielding(population, fitness, rng, adaptiveOpts, species);
      // Les élites sont en tête de la nouvelle population : elles gardent leur passé ; les enfants repartent de zéro.
      records = population.map((_, i) => i < elites.length ? newRecords[elites[i]] : null);
      gen++;
      onGeneration(summary);
    }

    function runGenerations(count) {
      if (busy) return Promise.reject(new Error('génération déjà en cours'));
      busy = true;
      inflight = (async () => {
        try { for (let i = 0; i < count; i++) await runOne(); } finally { busy = false; }
      })();
      return inflight;
    }

    function start() {
      if (running) return loopPromise;
      running = true;
      const my = ++loopToken, prev = loopPromise;
      loopPromise = (async () => {
        if (prev) await prev; // l'ancienne boucle (jamais rejetée) doit être arrêtée
        while (running && loopToken === my) {
          await runGenerations(1);
          await new Promise(r => setTimeout(r, 0));
        }
      })().catch(e => { if (loopToken === my) running = false; onError(e); });
      return loopPromise;
    }
    // Résout quand la boucle est réellement arrêtée (génération en cours terminée).
    function pause() { running = false; return loopPromise || Promise.resolve(); }
    function resume() { return start(); }
    function isRunning() { return running; }

    // Arrête la boucle et attend toute génération en cours avant de toucher à l'état.
    async function settle() {
      await pause();
      if (inflight) { try { await inflight; } catch (e) { /* déjà signalée */ } }
    }
    async function reset() { await settle(); resetSync(); }

    // Population, historique et état des notables sont copiés ; les notables (immuables) sont partagés.
    function getState() {
      return {
        gen, population: population.map(w => new Float32Array(w)), rngState: rng.getState(), spdMax,
        records: records.map(r => r ? { sum: r.sum, count: r.count } : null),
        speciesThreshold, benchBest: benchBest ? Object.assign({}, benchBest) : null,
        history: history.map(h => Object.assign({}, h)), notables: notables.slice(),
        notableState: copyNotableState(notableState),
        opts: Object.assign({}, opts), cfg: Object.assign({}, cfg)
      };
    }
    // Valide tout avant de toucher à l'état : en cas d'erreur, le trainer reste tel quel.
    async function loadState(s) {
      checkState(s);
      await settle();
      gen = s.gen; spdMax = s.spdMax; rng.setState(s.rngState);
      // Sauvegarde sans limite (ou Infinity perdu en JSON -> null) : on pose la limite de depart.
      if (!(typeof spdMax === 'number' && spdMax > 0 && isFinite(spdMax))) spdMax = initialSpdMax();
      population = s.population.map(w => new Float32Array(w));
      // Anciennes sauvegardes sans `records` : tout le monde repart sans passé.
      records = population.map((_, i) => (Array.isArray(s.records) && s.records[i]) ? { sum: s.records[i].sum, count: s.records[i].count } : null);
      history = s.history.map(h => Object.assign({}, h));
      speciesThreshold = typeof s.speciesThreshold === 'number' ? s.speciesThreshold : INIT_THRESHOLD;
      benchBest = s.benchBest ? Object.assign({}, s.benchBest) : null;
      notables = Notables.thin(s.notables);
      notableState = copyNotableState(s.notableState);
    }

    // Réglages modifiables en cours de route (lus à chaque génération) ; les autres demandent une réinitialisation.
    const LIVE_OPTS = ['humanRecord', 'holdSeconds', 'raise'];
    function setOpts(partial) {
      for (const k of LIVE_OPTS) if (partial && Object.prototype.hasOwnProperty.call(partial, k)) opts[k] = partial[k];
    }

    return { start, pause, resume, reset, isRunning, runGenerations, getState, loadState, setOpts };
  }

  // Pool de workers : découpe en `size` lots contigus, un ArrayBuffer transféré par lot.
  // Option poolOpts.timeoutMs : un lot sans réponse au bout de ce délai fait échouer le job.
  // Désactivé par défaut (0) : un lot de bons bots peut légitimement durer plusieurs minutes,
  // et un worker qui plante est déjà détecté par onerror.
  const JOB_TIMEOUT_MS = 0;
  function createWorkerPool(workerUrl, size, WorkerCtor, poolOpts) {
    const W = WorkerCtor || Worker;
    const timeoutMs = (poolOpts && poolOpts.timeoutMs) || JOB_TIMEOUT_MS;
    const workers = [];
    const jobs = new Map(); // jobId -> {pending, parts, resolve, reject}
    let nextJob = 1;

    function failAll(err) {
      for (const [id, job] of jobs) { jobs.delete(id); clearTimeout(job.timer); job.reject(err); }
    }
    for (let i = 0; i < size; i++) {
      const w = new W(workerUrl);
      w.onmessage = function (e) {
        const m = e.data;
        if (!m || m.type !== 'result') return;
        const job = jobs.get(m.jobId);
        if (!job) return;
        job.parts[m.part] = m.results;
        if (--job.pending === 0) {
          jobs.delete(m.jobId);
          clearTimeout(job.timer);
          job.resolve([].concat.apply([], job.parts));
        }
      };
      w.onerror = function (e) { failAll(e instanceof Error ? e : new Error((e && e.message) || 'erreur du worker')); };
      workers.push(w);
    }

    function evaluate(brains, seeds, cfg) {
      return new Promise((resolve, reject) => {
        const n = brains.length;
        if (n === 0) return resolve([]);
        const jobId = nextJob++;
        const chunks = Math.min(size, n);
        const per = Math.ceil(n / chunks);
        const sends = [];
        for (let c = 0; c * per < n; c++) sends.push([c * per, Math.min(n, (c + 1) * per)]);
        const timer = timeoutMs > 0 && setTimeout(() => {
          if (!jobs.has(jobId)) return;
          jobs.delete(jobId);
          reject(new Error('un worker ne répond plus (aucune réponse en ' + Math.round(timeoutMs / 1000) + ' s)'));
        }, timeoutMs);
        jobs.set(jobId, { pending: sends.length, parts: new Array(sends.length), resolve, reject, timer });
        sends.forEach(([a, b], part) => {
          const len = brains[a].length;
          const buf = new Float32Array((b - a) * len);
          for (let i = a; i < b; i++) buf.set(brains[i], (i - a) * len);
          workers[part].postMessage({ type: 'eval', jobId, part, buffer: buf.buffer, count: b - a, seeds, cfg }, [buf.buffer]);
        });
      });
    }

    function terminate() {
      for (const w of workers) w.terminate();
      failAll(new Error('pool terminé'));
    }
    return { evaluate, terminate };
  }

  const DodgeTrainer = { BENCH_SEEDS, poolSize, createTrainer, createWorkerPool, JOB_TIMEOUT_MS };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeTrainer; else root.DodgeTrainer = DodgeTrainer;
})(typeof self !== 'undefined' ? self : globalThis);
