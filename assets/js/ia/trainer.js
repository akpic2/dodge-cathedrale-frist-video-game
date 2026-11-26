(function (root) {
  const Sim = (typeof DodgeSim !== 'undefined') ? DodgeSim : require('../sim.js');
  const Brain = (typeof DodgeBrain !== 'undefined') ? DodgeBrain : require('./brain.js');
  const Evo = (typeof DodgeEvo !== 'undefined') ? DodgeEvo : require('./evolution.js');
  const Notables = (typeof DodgeNotables !== 'undefined') ? DodgeNotables : require('./notables.js');

  function poolSize(hc) { return Math.max(1, (hc || 2) - 1); }

  function copyNotable(n) { return Object.assign({}, n, { weights: new Float32Array(n.weights), cfg: Object.assign({}, n.cfg) }); }

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
    const onError = conf.onError || function () {};
    let running = false, loopPromise = null, busy = false, inflight = null, loopToken = 0;

    function resetSync() {
      rng.setState(seed);
      gen = 0; spdMax = Infinity; history = []; notables = []; notableState = null;
      population = [];
      for (let i = 0; i < popSize; i++) population.push(Brain.random(rng));
    }
    resetSync();

    async function runOne() {
      const seeds = [];
      for (let i = 0; i < gamesPerBot; i++) seeds.push(Math.floor(rng.next() * 4294967296) >>> 0);
      const spdMaxBefore = spdMax;
      const results = await evaluate(population, seeds, Object.assign({}, cfg, { spdMax: spdMaxBefore }));
      const fitness = results.map(r => r.fitness);
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

      const det = Notables.detect({ gen, population, results, cfg, spdMaxBefore, spdMaxAfter, humanRecord: opts.humanRecord }, notableState);
      notableState = det.state;
      for (const n of det.notables) { notables.push(n); onNotable(n); }

      const sorted = fitness.slice().sort((a, b) => a - b);
      const n = sorted.length;
      let sum = 0;
      for (const f of fitness) sum += f;
      const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
      history.push({ gen, best: sorted[n - 1], mean: sum / n, median, spdMax: spdMaxAfter });

      const summary = { gen, seeds, history, spdMax: spdMaxAfter, population, results, championIndex };
      spdMax = spdMaxAfter;
      population = Evo.nextGeneration(population, fitness, rng, opts);
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

    function getState() {
      return {
        gen, population: population.map(w => new Float32Array(w)), rngState: rng.getState(), spdMax,
        history: history.map(h => Object.assign({}, h)), notables: notables.map(copyNotable),
        notableState: notableState ? Object.assign({}, notableState, { milestonesDone: notableState.milestonesDone.slice() }) : null,
        opts: Object.assign({}, opts), cfg: Object.assign({}, cfg)
      };
    }
    async function loadState(s) {
      await settle();
      gen = s.gen; spdMax = s.spdMax; rng.setState(s.rngState);
      population = s.population.map(w => new Float32Array(w));
      history = s.history.map(h => Object.assign({}, h));
      notables = s.notables.map(copyNotable);
      notableState = s.notableState ? Object.assign({}, s.notableState, { milestonesDone: s.notableState.milestonesDone.slice() }) : null;
    }

    // Réglages modifiables en cours de route (lus à chaque génération) ; les autres demandent une réinitialisation.
    const LIVE_OPTS = ['humanRecord', 'holdSeconds', 'raise'];
    function setOpts(partial) {
      for (const k of LIVE_OPTS) if (partial && Object.prototype.hasOwnProperty.call(partial, k)) opts[k] = partial[k];
    }

    return { start, pause, resume, reset, isRunning, runGenerations, getState, loadState, setOpts };
  }

  // Pool de workers : découpe en `size` lots contigus, un ArrayBuffer transféré par lot.
  function createWorkerPool(workerUrl, size, WorkerCtor) {
    const W = WorkerCtor || Worker;
    const workers = [];
    const jobs = new Map(); // jobId -> {pending, parts, resolve, reject}
    let nextJob = 1;

    function failAll(err) {
      for (const [id, job] of jobs) { jobs.delete(id); job.reject(err); }
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
        jobs.set(jobId, { pending: sends.length, parts: new Array(sends.length), resolve, reject });
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

  const DodgeTrainer = { poolSize, createTrainer, createWorkerPool };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeTrainer; else root.DodgeTrainer = DodgeTrainer;
})(typeof self !== 'undefined' ? self : globalThis);
