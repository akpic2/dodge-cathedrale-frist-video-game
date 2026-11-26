// Tableau de bord d'entraînement (ia.html) : boutons, stats, courbes, perfs notables, file d'auto-sélection.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = DodgeNotables.fmt;

  const CHARS = [
    { id: 'HommeBleu', name: 'Homme Bleu', speed: 280 }, { id: 'FemmeBleu', name: 'Femme Bleu', speed: 280 },
    { id: 'HitmanG', name: 'Hitman', speed: 300 }, { id: 'HitmanF', name: 'Hitwoman', speed: 300 },
    { id: 'Garcon1', name: 'Garçon', speed: 280 }, { id: 'Fille1', name: 'Fille', speed: 280 },
    { id: 'Chevalier', name: 'Chevalier', speed: 260 }, { id: 'Gigachad', name: 'Gigachad', speed: 320 },
  ];
  const TYPE_LABEL = {
    record: 'Record', bigJump: 'Gros bond', milestone: 'Palier', spdMaxUp: 'Limite',
    sideDodges: 'Esquives', humanBeaten: 'Humain battu', benchRecord: 'Niveau réel', champion: 'Champion',
  };
  const SAMPLE = 30, LIVE_SPEED = 4, AUTOSAVE_MS = 60000, END_HOLD_MS = 2500;
  const params = new URLSearchParams(location.search);

  // ===== État =====
  let pool = null, trainer = null;
  let run = null;           // {seed, opts, cfg, charId}
  let phase = 'idle';       // idle | running | paused | busy
  let history = [], notables = [], lastSummary = null; // notables : mêmes objets et même éclaircissement que le trainer
  let elapsedMs = 0, runStartedAt = 0, rateWin = [];
  let queue = [], queueSeq = 0, mode = 'live', current = null, endTimer = 0, playToken = 0;
  let importing = false, saving = false;

  const live = DodgeReplay.createLive($('liveCanvas'));
  const replay = DodgeReplay.create($('replayCanvas'));

  // ===== Utilitaires =====
  function showError(msg) { $('errorText').textContent = msg; $('errorBanner').hidden = false; }
  function info(msg) { const b = $('infoBanner'); b.textContent = msg || ''; b.hidden = !msg; }
  function status(msg) { $('status').textContent = msg; }
  function randSeed() { return (Math.random() * 4294967296) >>> 0; }
  function charById(id) { return CHARS.find(c => c.id === id) || CHARS[0]; }
  function num(id, def) { const v = parseFloat($(id).value); return isFinite(v) ? v : def; }
  function clockStr(ms) {
    const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(ss).padStart(2, '0');
  }

  // ===== Réglages =====
  for (const c of CHARS) {
    const o = document.createElement('option'); o.value = c.id; o.textContent = c.name + ' (' + c.speed + ')';
    $('setChar').appendChild(o);
  }
  $('setChar').value = 'HommeBleu';
  if (params.get('pop')) $('setPop').value = parseInt(params.get('pop'), 10) || 1000;
  if (params.get('games')) $('setGames').value = parseInt(params.get('games'), 10) || 15;

  function humanRecordValue() {
    const v = parseFloat($('setHuman').value);
    return isFinite(v) && v > 0 ? v : undefined;
  }
  function readSettings() {
    const D = DodgeEvo.DEFAULTS, ch = charById($('setChar').value);
    return {
      opts: {
        popSize: Math.max(2, Math.round(num('setPop', D.popSize))),
        gamesPerBot: Math.max(1, Math.round(num('setGames', D.gamesPerBot))),
        mutRate: num('setMutRate', D.mutRate), mutSigma: num('setMutSigma', D.mutSigma),
        holdSeconds: num('setHold', D.holdSeconds), raise: num('setRaise', D.raise),
        humanRecord: humanRecordValue(),
      },
      cfg: { difficulty: $('setDiff').value, charSpeed: ch.speed },
      charId: ch.id,
    };
  }
  function writeSettings(r) {
    const D = DodgeEvo.DEFAULTS, o = r.opts;
    const v = (k) => o[k] !== undefined ? o[k] : D[k];
    $('setPop').value = v('popSize'); $('setGames').value = v('gamesPerBot');
    $('setMutRate').value = v('mutRate'); $('setMutSigma').value = v('mutSigma');
    $('setHold').value = v('holdSeconds'); $('setRaise').value = v('raise');
    $('setHuman').value = o.humanRecord !== undefined ? o.humanRecord : '';
    $('setDiff').value = r.cfg.difficulty || 'normal';
    $('setChar').value = r.charId;
  }
  function liveOptsChanged() {
    if (!run) return;
    const partial = { humanRecord: humanRecordValue(), holdSeconds: num('setHold', 20), raise: num('setRaise', 1.05) };
    Object.assign(run.opts, partial);
    if (trainer) trainer.setOpts(partial);
    scheduleChart();
  }
  ['setHuman', 'setHold', 'setRaise'].forEach(id => $(id).addEventListener('change', liveOptsChanged));

  // ===== Entraîneur =====
  // Construit un trainer sans toucher à l'état global ; ses rappels ne font rien tant qu'il n'est pas installé.
  function buildTrainer(r) {
    const b = { run: { seed: r.seed, opts: Object.assign({}, r.opts), cfg: Object.assign({}, r.cfg), charId: r.charId }, t: null };
    const guard = f => x => { if (b.t && trainer === b.t) f(x); };
    b.t = DodgeTrainer.createTrainer({
      evaluate: pool.evaluate, seed: b.run.seed, opts: b.run.opts, cfg: b.run.cfg,
      onGeneration: guard(onGeneration), onNotable: guard(onNotable), onError: guard(onError),
    });
    return b;
  }
  function install(b) {
    trainer = b.t; run = b.run;
    live.setCharId(run.charId);
  }
  function makeTrainer(r) { install(buildTrainer(r)); }

  function fullState() {
    const s = trainer.getState();
    s.charId = run.charId; s.seed = run.seed; s.elapsedMs = currentElapsed();
    return s;
  }
  function save(why) {
    if (saving) return Promise.resolve();
    saving = true;
    return DodgeStorage.saveToIDB(fullState())
      .then(() => { if (why) status(why + ' (gén. ' + history.length + ')'); })
      .catch(e => showError('Sauvegarde automatique impossible : ' + e.message))
      .then(() => { saving = false; });
  }
  // Sauvegarde auto toutes les 60 s pendant l'entraînement (et à chaque pause, voir onMain).
  setInterval(() => { if (phase === 'running' && !importing) save('Sauvegarde auto'); }, AUTOSAVE_MS);

  function onGeneration(summary) {
    summary.cfg = run.cfg;
    history = summary.history;
    lastSummary = summary;
    const games = run.opts.popSize * run.opts.gamesPerBot;
    rateWin.push({ t: performance.now(), games });
    if (rateWin.length > 11) rateWin.shift();
    if (mode === 'live' && $('liveToggle').checked) { live.show(summary, SAMPLE, LIVE_SPEED); $('stageLabel').textContent = liveLabel(); }
    updateStats();
    scheduleChart();
  }

  function onNotable(n) {
    DodgeNotables.addNotable(notables, n);
    if ($('autoToggle').checked) enqueue(n);
    scheduleList();
    maybePlayNext();
  }

  function onError(e) {
    showError('Erreur pendant l\'entraînement : ' + (e && e.message ? e.message : e));
    if (phase === 'running') { stopClock(); phase = 'paused'; }
    updateButtons();
  }

  // ===== Boutons principaux =====
  function startClock() { runStartedAt = performance.now(); rateWin = []; }
  function stopClock() { if (runStartedAt) elapsedMs += performance.now() - runStartedAt; runStartedAt = 0; }
  function currentElapsed() { return elapsedMs + (runStartedAt ? performance.now() - runStartedAt : 0); }

  function updateButtons() {
    const b = $('btnMain');
    b.textContent = phase === 'running' ? 'Pause' : (phase === 'paused' ? 'Reprendre' : 'Démarrer');
    const busy = phase === 'busy' || importing || !pool;
    b.disabled = busy; $('btnReset').disabled = busy; $('btnExport').disabled = busy; $('btnImport').disabled = busy;
  }

  async function onMain() {
    if (phase === 'running') {
      phase = 'busy'; updateButtons(); status('Pause après la génération en cours…');
      await trainer.pause();
      stopClock(); phase = 'paused'; updateButtons(); updateStats();
      status('En pause.');
      save('Sauvegardé');
    } else if (phase === 'idle' || phase === 'paused') {
      const wasIdle = phase === 'idle';
      info('');
      startClock(); phase = 'running'; updateButtons();
      status(wasIdle ? 'Entraînement lancé.' : 'Entraînement repris.');
      if (wasIdle) trainer.start(); else trainer.resume();
    }
  }

  async function onReset() {
    if (history.length && !confirm('Réinitialiser ? L\'entraînement en cours sera perdu (pense à l\'exporter avant).')) return;
    phase = 'busy'; updateButtons(); status('Réinitialisation…');
    await trainer.reset();
    const r = readSettings(); r.seed = randSeed();
    makeTrainer(r);
    clearRun();
    phase = 'idle'; updateButtons();
    status('Prêt (population ' + run.opts.popSize + ', ' + run.opts.gamesPerBot + ' parties par bot).');
    save();
  }

  function clearRun() {
    history = []; notables = []; lastSummary = null; queue = []; updateQueueBadge();
    elapsedMs = 0; runStartedAt = 0; rateWin = [];
    live.clear();
    backToLive();
    updateStats(); scheduleChart(); scheduleList(); info('');
  }

  // Charge un entraînement sauvegardé (IndexedDB ou fichier). Ne relance pas l'entraînement.
  // Le nouveau trainer est construit et chargé à part : si ça échoue, l'ancien (et son état) reste intact.
  async function adopt(s) {
    const ch = s.charId ? charById(s.charId) : (CHARS.find(c => c.speed === (s.cfg && s.cfg.charSpeed)) || CHARS[0]);
    const b = buildTrainer({ seed: s.seed !== undefined ? s.seed : 1, opts: s.opts || {}, cfg: s.cfg || {}, charId: ch.id });
    await b.t.loadState(s); // lève une erreur si la sauvegarde est invalide
    // succès : on arrête l'ancien (génération en cours terminée) avant de basculer
    if (trainer) await trainer.pause();
    stopClock();
    install(b);
    clearRun();
    history = s.history; notables = DodgeNotables.thin(s.notables);
    elapsedMs = s.elapsedMs || 0;
    writeSettings(run);
    phase = s.gen > 0 ? 'paused' : 'idle';
    updateButtons(); updateStats(); scheduleChart(); scheduleList();
  }

  async function onExport() {
    const wasRunning = phase === 'running';
    if (wasRunning) {
      phase = 'busy'; updateButtons(); status('Export après la génération en cours…');
      await trainer.pause(); stopClock();
    }
    try { DodgeStorage.exportFile(fullState()); status('Export JSON téléchargé (gén. ' + history.length + ').'); }
    catch (e) { showError('Export impossible : ' + e.message); }
    if (wasRunning) { startClock(); phase = 'running'; trainer.start(); }
    updateButtons();
  }

  // Pendant l'import, l'entraînement en cours continue ; il n'est remplacé qu'une fois la sauvegarde chargée.
  async function onImportFile(file) {
    if (!file || importing) return;
    importing = true; updateButtons();
    let ok = false, s = null;
    try {
      s = await DodgeStorage.importFile(file);
      await adopt(s);
      ok = true;
    } catch (e) {
      showError('Import impossible : ' + e.message);
    }
    importing = false;
    $('importFile').value = '';
    updateButtons();
    if (ok) {
      save();
      status('Import réussi : génération ' + s.gen + '. Clique sur Reprendre pour continuer.');
    }
  }

  $('btnMain').addEventListener('click', onMain);
  $('btnReset').addEventListener('click', onReset);
  $('btnExport').addEventListener('click', onExport);
  $('btnImport').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', e => onImportFile(e.target.files[0]));
  $('errorClose').addEventListener('click', () => { $('errorBanner').hidden = true; });

  // ===== Stats =====
  function bestGameScore() {
    let b = 0;
    for (const n of notables) if (n.type === 'record' && n.score > b) b = n.score;
    return b;
  }
  function updateStats() {
    const gens = history.length;
    $('stGen').textContent = fmt(gens);
    $('stGames').textContent = run ? fmt(gens * run.opts.popSize * run.opts.gamesPerBot) : '0';
    let rate = '–';
    if (phase === 'running' && rateWin.length >= 2) {
      let g = 0; for (let i = 1; i < rateWin.length; i++) g += rateWin[i].games;
      const dt = (rateWin[rateWin.length - 1].t - rateWin[0].t) / 1000;
      if (dt > 0) rate = fmt(g / dt);
    }
    $('stRate').textContent = rate;
    $('stTime').textContent = clockStr(currentElapsed());
    $('stRecord').textContent = fmt(bestGameScore());
    const spd = history.length ? history[history.length - 1].spdMax : Infinity;
    $('stSpd').textContent = isFinite(spd) ? fmt(spd) + ' px/s' : '∞';
    // Encart « Limite trouvée »
    const found = isFinite(spd);
    $('limitValue').textContent = found ? fmt(spd) + ' px/s' : 'Aucune limite pour l\'instant';
    $('limitValue').classList.toggle('found', found);
    $('limitHint').hidden = found;
    $('limitCodeRow').hidden = !found; $('limitCodeHint').hidden = !found;
    if (found) $('limitCode').textContent = 'DEFAULT_SPD_MAX = ' + spd + ';';
  }
  setInterval(() => { if (phase === 'running') $('stTime').textContent = clockStr(currentElapsed()); }, 1000);
  $('limitCopy').addEventListener('click', () => {
    const t = $('limitCode').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject())
      .then(() => status('Ligne copiée.'), () => status('Copie impossible : sélectionne la ligne à la main.'));
  });

  // ===== Courbes =====
  let chartPending = false;
  function scheduleChart() {
    if (chartPending) return;
    chartPending = true;
    requestAnimationFrame(() => {
      chartPending = false;
      DodgeCharts.drawHistory($('chart'), history, { humanRecord: run && run.opts.humanRecord });
    });
  }
  window.addEventListener('resize', scheduleChart);

  // ===== Liste des perfs notables =====
  let listPending = false;
  function scheduleList() {
    if (listPending) return;
    listPending = true;
    requestAnimationFrame(() => { listPending = false; renderList(); });
  }
  function renderList() {
    const f = $('notableFilter').value;
    const ul = $('notableList');
    const out = [];
    for (let i = notables.length - 1; i >= 0 && out.length < 150; i--) {
      const n = notables[i];
      if (f === 'interesting' ? n.type === 'champion' : (f !== 'all' && n.type !== f)) continue;
      out.push(n);
    }
    ul.textContent = '';
    if (!out.length) {
      const li = document.createElement('li'); li.className = 'empty';
      li.textContent = notables.length ? 'Rien pour ce filtre.' : 'Aucune perf pour l\'instant.';
      ul.appendChild(li); return;
    }
    const playingId = mode === 'replay' && current && current.n ? current.n.id : null;
    for (const n of out) {
      const li = document.createElement('li');
      li.className = 't-' + n.type + (n.id === playingId ? ' playing' : '');
      const lab = document.createElement('div'); lab.className = 'n-label';
      const tp = document.createElement('span'); tp.className = 'n-type'; tp.textContent = TYPE_LABEL[n.type] || n.type;
      lab.appendChild(tp); lab.appendChild(document.createTextNode(n.label));
      const meta = document.createElement('div'); meta.className = 'n-meta';
      meta.textContent = 'Gén. ' + n.gen + ' · score ' + fmt(n.score) + ' · limite ' + (isFinite(n.spdMax) ? fmt(n.spdMax) : '∞');
      const act = document.createElement('div'); act.className = 'n-actions';
      act.appendChild(iconBtn('▶', 'Rejouer cette partie', n.id, 'play'));
      act.appendChild(iconBtn('↻', 'Rejouer sur une nouvelle graine', n.id, 'newSeed'));
      if (n.worstSeed !== undefined) act.appendChild(iconBtn('✝', 'Pire mort (' + fmt(n.worstScore) + ')', n.id, 'worst'));
      li.appendChild(lab); li.appendChild(act); li.appendChild(meta);
      ul.appendChild(li);
    }
  }
  function iconBtn(txt, title, id, act) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'icon-btn'; b.textContent = txt; b.title = title;
    b.setAttribute('aria-label', title); b.dataset.id = id; b.dataset.act = act;
    return b;
  }
  $('notableFilter').addEventListener('change', renderList);
  $('notableList').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const n = notables.find(x => x.id === b.dataset.id) || (current && current.n.id === b.dataset.id ? current.n : null);
    if (n) playNotable(n, b.dataset.act, false);
  });

  // ===== File d'auto-sélection =====
  // Règles (remplacement par type, plus récent d'abord, 5 max, pas d'esquives) : DodgeNotables.queueAdd.
  function enqueue(n) {
    queue = DodgeNotables.queueAdd(queue, n, ++queueSeq);
    updateQueueBadge();
  }
  function updateQueueBadge() { $('queueBadge').textContent = queue.length + ' en file'; }
  function maybePlayNext() {
    if (mode !== 'live' || !queue.length || !$('autoToggle').checked) return;
    const q = queue.shift();
    updateQueueBadge();
    playNotable(q.n, 'play', true, q.parts.map(p => p.label).join(' · '));
  }
  $('autoToggle').addEventListener('change', e => {
    if (!e.target.checked) { queue = []; updateQueueBadge(); } else maybePlayNext();
  });

  // ===== Scène : replay / direct =====
  function playNotable(n, variant, auto, label) {
    clearTimeout(endTimer);
    const token = ++playToken;
    let spec, title, banner;
    if (variant === 'newSeed') {
      spec = { weights: n.weights, seed: randSeed(), cfg: n.cfg, spdMax: n.spdMax };
      title = 'Gén. ' + n.gen + ' · nouvelle graine';
      banner = 'Cerveau de la gén. ' + n.gen + ' sur une partie inconnue';
    } else if (variant === 'worst') {
      spec = { weights: n.weights, seed: n.worstSeed, cfg: n.cfg, spdMax: n.spdMax, score: n.worstScore };
      title = 'Gén. ' + n.gen + ' · pire mort';
      banner = 'Pire mort du champion de la gén. ' + n.gen;
    } else {
      spec = n;
      title = 'Gén. ' + n.gen;
      banner = label || n.label;
    }
    const charId = run ? run.charId : 'HommeBleu';
    current = { n, spec, auto, token, title, charId };
    mode = 'replay';
    live.stop();
    $('liveCanvas').hidden = true; $('replayCanvas').hidden = false; $('stageOff').hidden = true;
    $('stageBanner').classList.add('is-replay');
    $('stageMode').textContent = auto ? 'Auto' : 'Replay';
    $('stageLabel').textContent = banner;
    setScore(spec.score, null);
    $('rpPlay').disabled = false; $('rpBack').disabled = false; $('rpPlay').textContent = '⏸ Pause';
    replay.setSpeed(parseFloat($('rpSpeed').value));
    replay.play(spec, { charId, title });
    scheduleList();
  }

  function setScore(expected, got) {
    const el = $('stageScore');
    el.textContent = '';
    el.dataset.expected = expected !== undefined ? expected : '';
    el.dataset.actual = got !== null && got !== undefined ? got : '';
    if (expected !== undefined) el.appendChild(document.createTextNode('Annoncé ' + fmt(expected)));
    if (got !== null && got !== undefined) {
      el.appendChild(document.createTextNode((expected !== undefined ? ' · ' : '') + 'Obtenu ' + fmt(got) + ' '));
      if (expected !== undefined) {
        const s = document.createElement('span');
        s.className = got === expected ? 'ok' : 'ko'; s.textContent = got === expected ? '✓' : '✗';
        el.appendChild(s);
      }
    }
  }

  replay.onEnd(res => {
    if (!current) return;
    setScore(current.spec.score, res.score);
    $('rpPlay').textContent = '▶ Revoir';
    const token = current.token;
    endTimer = setTimeout(() => {
      if (token !== playToken || mode !== 'replay') return;
      if (queue.length && $('autoToggle').checked) { mode = 'live'; maybePlayNext(); } else backToLive();
    }, END_HOLD_MS);
  });

  function backToLive() {
    clearTimeout(endTimer); playToken++;
    replay.pause();
    mode = 'live'; current = null;
    $('replayCanvas').hidden = true; $('liveCanvas').hidden = false;
    $('stageBanner').classList.remove('is-replay');
    $('stageMode').textContent = 'Direct';
    $('rpPlay').disabled = true; $('rpBack').disabled = true; $('rpPlay').textContent = '⏸ Pause';
    setScore(undefined, null);
    refreshLive();
    scheduleList();
    maybePlayNext();
  }

  function liveLabel() {
    return 'Échantillon de ' + SAMPLE + ' bots par génération, sur la même partie · le champion est en surbrillance';
  }

  function refreshLive() {
    if (mode !== 'live') return;
    const on = $('liveToggle').checked;
    $('stageOff').hidden = on;
    if (on) {
      live.show(lastSummary, SAMPLE, LIVE_SPEED, { charId: run ? run.charId : 'HommeBleu' });
      $('stageLabel').textContent = lastSummary
        ? liveLabel()
        : (phase === 'idle' ? 'Démarre l\'entraînement pour voir les bots jouer.' : 'En attente de la prochaine génération…');
    } else {
      live.stop();
      $('stageLabel').textContent = 'Vue en direct coupée : vitesse maximale';
    }
  }

  $('liveToggle').addEventListener('change', refreshLive);
  $('rpBack').addEventListener('click', backToLive);
  $('rpPlay').addEventListener('click', () => {
    if (mode !== 'replay' || !current) return;
    if (replay.isPlaying()) { replay.pause(); $('rpPlay').textContent = '▶ Lecture'; return; }
    clearTimeout(endTimer);
    const s = replay.getSim();
    if (s && (s.dead || s.time >= DodgeEval.MAX_GAME_TIME)) {
      // revoir la même partie depuis le début
      current.token = ++playToken;
      setScore(current.spec.score, null);
      replay.play(current.spec, { charId: current.charId, title: current.title });
    } else replay.play();
    $('rpPlay').textContent = '⏸ Pause';
  });
  $('rpSpeed').addEventListener('change', e => replay.setSpeed(parseFloat(e.target.value)));
  $('brainToggle').addEventListener('change', e => replay.showBrain(e.target.checked));

  // ===== Démarrage de la page =====
  async function init() {
    updateButtons();
    if (location.protocol === 'file:') {
      showError('Cette page doit être ouverte via un serveur local (ex. Live Server) : les workers ne marchent pas en double-clic.');
      return;
    }
    try {
      pool = DodgeTrainer.createWorkerPool('assets/js/ia/worker.js', DodgeTrainer.poolSize(navigator.hardwareConcurrency));
    } catch (e) { showError('Impossible de lancer les workers : ' + e.message); return; }
    const r = readSettings(); r.seed = randSeed();
    makeTrainer(r);
    clearRun();
    let saved = null;
    try { saved = await DodgeStorage.loadFromIDB(); }
    catch (e) {
      if (e.code === 'incompatible') info(e.message + '. Elle est ignorée : nouvel entraînement.');
      else if (!/indisponible/.test(e.message)) showError('Lecture de la sauvegarde impossible : ' + e.message);
    }
    let loaded = false;
    if (saved && !params.has('fresh')) {
      try {
        await adopt(saved);
        loaded = true;
        if (saved.gen > 0) info('Entraînement repris à la génération ' + saved.gen + ' (sauvegarde auto). Clique sur Reprendre pour continuer.');
        status('Sauvegarde chargée.');
      } catch (e) {
        // adopt n'a rien remplacé : le trainer neuf créé plus haut reste en place
        showError('Sauvegarde illisible, nouvel entraînement : ' + e.message);
      }
    }
    if (!loaded) {
      status('Prêt (population ' + run.opts.popSize + ', ' + run.opts.gamesPerBot + ' parties par bot).');
    }
    phase = phase === 'busy' ? 'idle' : phase;
    updateButtons();
  }

  // Accès de débogage (console) : lecture seule.
  window.DodgeDashboard = {
    get notables() { return notables; }, get history() { return history; }, get queue() { return queue; },
    get mode() { return mode; }, get phase() { return phase; }, replay, live,
  };

  init();
})();
