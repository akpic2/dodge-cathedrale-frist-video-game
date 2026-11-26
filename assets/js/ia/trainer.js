(function (root) {
  const Sim = (typeof DodgeSim !== 'undefined') ? DodgeSim : require('../sim.js');
  const Brain = (typeof DodgeBrain !== 'undefined') ? DodgeBrain : require('./brain.js');
  const Evo = (typeof DodgeEvo !== 'undefined') ? DodgeEvo : require('./evolution.js');
  const Notables = (typeof DodgeNotables !== 'undefined') ? DodgeNotables : require('./notables.js');

  function poolSize(hc) { return Math.max(1, (hc || 2) - 1); }

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

  // Banc d'essai : 100 graines fixes, jamais utilisées pour l'entraînement, jouées sans limite de vitesse
  // (le vrai jeu). Le champion de chaque génération y passe : c'est son « vrai niveau ».
  const BENCH_SEEDS = (function () {
    const r = Sim.makeRng(0x5eedbe7c), out = [];
    for (let i = 0; i < 100; i++) out.push(Math.floor(r.next() * 4294967296) >>> 0);
    return out;
  })();
  const INIT_THRESHOLD = 0.6;

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

    function resetSync() {
      rng.setState(seed);
      gen = 0; spdMax = Infinity; history = []; notables = []; notableState = null;
      population = [];
      for (let i = 0; i < popSize; i++) population.push(Brain.random(rng));
      records = population.map(() => null);
      speciesThreshold = INIT_THRESHOLD; benchBest = null;
    }
    resetSync();

    async function runOne() {
      const seeds = [];
      for (let i = 0; i < gamesPerBot; i++) seeds.push(Math.floor(rng.next() * 4294967296) >>> 0);
      const spdMaxBefore = spdMax;
      const playCfg = Object.assign({}, cfg, { spdMax: spdMaxBefore });
      const results = await evaluate(population, seeds, playCfg);
      // Score brut de la génération (5 parties) : sert aux courbes moyenne/médiane.
      const rawFitness = results.map(r => r.fitness);

      // Repêchage : le top rejoue des parties en plus, sur de nouvelles graines communes.
      const rescued = Evo.rescueIndices(rawFitness, opts);
      const rescueGames = opts.rescueGames !== undefined ? opts.rescueGames : Evo.DEFAULTS.rescueGames;
      if (rescued.length) {
        const extraSeeds = [];
        for (let i = 0; i < rescueGames; i++) extraSeeds.push(Math.floor(rng.next() * 4294967296) >>> 0);
        const extra = await evaluate(rescued.map(i => population[i]), extraSeeds, playCfg);
        rescued.forEach((i, k) => { results[i] = { fitness: results[i].fitness, games: results[i].games.concat(extra[k].games) }; });
      }

      // Score de sélection = moyenne cumulée (parties de cette génération + passé des survivants).
      const newRecords = results.map((r, i) => Evo.addToRecord(records[i], r.games, opts));
      const fitness = newRecords.map(rec => rec.count ? rec.sum / rec.count : 0);
      for (let i = 0; i < results.length; i++) results[i].fitness = fitness[i];

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

      // Banc d'essai du champion (100 graines fixes, sans limite de vitesse).
      const benchCfg = Object.assign({}, cfg, { spdMax: Infinity });
      const bench = (await evaluate([population[championIndex]], BENCH_SEEDS, benchCfg))[0];
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
      const species = Evo.speciate(population, speciesThreshold, Brain.NET_WEIGHTS);
      speciesThreshold = Evo.adaptThreshold(speciesThreshold, species.count, opts);

      history.push({ gen, best: fitness[championIndex], mean: sum / n, median, spdMax: spdMaxAfter,
        bench: bench.fitness, species: species.count });

      const summary = { gen, seeds, history, spdMax: spdMaxAfter, population, results, championIndex };
      spdMax = spdMaxAfter;
      const elites = Evo.eliteIndices(fitness, opts, species);
      population = Evo.nextGeneration(population, fitness, rng, opts, species);
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
