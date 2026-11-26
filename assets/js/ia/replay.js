// Lecteur de replays, vue en direct et schéma du cerveau (navigateur uniquement).
// Un replay recrée la sim avec la graine de la perf et la fait jouer au cerveau gelé :
// même graine + mêmes poids + mêmes réglages => exactement la même partie.
(function (root) {
  const Sim = (typeof DodgeSim !== 'undefined') ? DodgeSim : require('../sim.js');
  const Render = (typeof DodgeRender !== 'undefined') ? DodgeRender : require('../render.js');
  const Sensors = (typeof DodgeSensors !== 'undefined') ? DodgeSensors : require('./sensors.js');
  const Brain = (typeof DodgeBrain !== 'undefined') ? DodgeBrain : require('./brain.js');
  const Eval = (typeof DodgeEval !== 'undefined') ? DodgeEval : require('./evaluate.js');
  const Notables = (typeof DodgeNotables !== 'undefined') ? DodgeNotables : require('./notables.js');
  const W = Sim.W, DT = Sim.DT;
  const MAX_TIME = Eval.MAX_GAME_TIME;
  const fmt = Notables.fmt;

  // Prépare un canvas dont la taille interne est un multiple de 480×420 (dessin net une fois agrandi).
  function setupCtx(canvas) {
    const ctx = canvas.getContext('2d');
    const k = canvas.width / W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = false;
    return ctx;
  }

  function makeSim(spec) {
    const cfg = spec.cfg || {};
    return Sim.createSim({ seed: spec.seed, difficulty: cfg.difficulty, charSpeed: cfg.charSpeed, spdMax: spec.spdMax });
  }

  // Les mêmes 5 obstacles tombants que sensors.js retient (les plus proches en temps d'impact).
  function observedObstacles(sim) {
    const p = sim.player, pTop = p.y + p.h * 0.15, pBottom = p.y + p.h * 0.90;
    const list = [];
    for (const g of sim.obstacles) {
      if (g.fromRight) continue;
      const hh = g.h / 2 * 0.55;
      if (g.y - hh >= pBottom) continue;
      const t = g.vy > 0 ? (pTop - (g.y + hh)) / g.vy : 2;
      list.push({ g, t });
    }
    list.sort((a, b) => a.t - b.t);
    return list.slice(0, 5).map(e => e.g);
  }

  function drawObserved(ctx, sim) {
    const obs = observedObstacles(sim);
    ctx.save();
    ctx.lineWidth = 2;
    obs.forEach((g, i) => {
      ctx.strokeStyle = i === 0 ? 'rgba(240,200,64,0.95)' : 'rgba(124,92,240,0.85)';
      ctx.beginPath(); ctx.arc(g.x, g.y, 24, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle; ctx.font = '600 10px Outfit, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), g.x, g.y - 28);
    });
    ctx.restore();
  }

  // Petit schéma nœuds-liens : luminosité = activation (normalisée par couche).
  const OUT_NAMES = ['←', '·', '→', '↑'];
  function drawBrain(ctx, weights, inputs, x0, y0, w, h) {
    const acts = Brain.activations(weights, inputs);
    const L = Brain.LAYERS;
    ctx.save();
    ctx.fillStyle = 'rgba(8,6,20,0.82)'; ctx.strokeStyle = 'rgba(124,92,240,0.35)'; ctx.lineWidth = 1;
    ctx.fillRect(x0, y0, w, h); ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
    const padX = 14, padY = 8;
    const colX = l => x0 + padX + (w - 2 * padX - 10) * l / (L.length - 1);
    const rowY = (l, i) => y0 + padY + (h - 2 * padY) * (L[l] === 1 ? 0.5 : i / (L[l] - 1));
    // force par couche
    const norm = acts.map(a => { let m = 1e-6; for (const v of a) m = Math.max(m, Math.abs(v)); return m; });
    // liens : seulement vers les neurones actifs, pour rester lisible
    ctx.lineWidth = 0.5;
    for (let l = 0; l < L.length - 1; l++) {
      for (let j = 0; j < L[l + 1]; j++) {
        const aj = Math.abs(acts[l + 1][j]) / norm[l + 1];
        if (aj < 0.15) continue;
        for (let i = 0; i < L[l]; i++) {
          const ai = Math.abs(acts[l][i]) / norm[l];
          const s = ai * aj;
          if (s < 0.08) continue;
          ctx.strokeStyle = 'rgba(160,130,255,' + Math.min(0.6, s * 0.8).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(colX(l), rowY(l, i)); ctx.lineTo(colX(l + 1), rowY(l + 1, j)); ctx.stroke();
        }
      }
    }
    // décision réelle (comme Brain.decide)
    const o = acts[acts.length - 1];
    let best = 1; if (o[0] > o[best]) best = 0; if (o[2] > o[best]) best = 2;
    for (let l = 0; l < L.length; l++) {
      const r = L[l] > 20 ? 1.6 : 2.6;
      for (let i = 0; i < L[l]; i++) {
        const v = acts[l][i] / norm[l];
        const b = Math.min(1, Math.abs(v));
        const last = l === L.length - 1;
        const on = last && (i === best || (i === 3 && o[3] > 0));
        ctx.fillStyle = on ? '#f0c840'
          : (v >= 0 ? 'rgba(240,234,255,' + (0.12 + 0.88 * b).toFixed(3) + ')' : 'rgba(124,92,240,' + (0.15 + 0.85 * b).toFixed(3) + ')');
        ctx.beginPath(); ctx.arc(colX(l), rowY(l, i), r, 0, Math.PI * 2); ctx.fill();
        if (last) {
          ctx.fillStyle = on ? '#f0c840' : '#9a8dc8'; ctx.font = '600 9px Outfit, sans-serif'; ctx.textAlign = 'left';
          ctx.fillText(OUT_NAMES[i], colX(l) + 5, rowY(l, i) + 3);
        }
      }
    }
    ctx.restore();
  }

  function hud(ctx, lines, color) {
    ctx.save();
    ctx.font = '600 13px Outfit, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    let y = 8;
    for (const t of lines) {
      if (!t) continue;
      const wd = ctx.measureText(t).width;
      ctx.fillStyle = 'rgba(8,6,20,0.65)'; ctx.fillRect(6, y - 2, wd + 10, 18);
      ctx.fillStyle = color || '#f0eaff'; ctx.fillText(t, 11, y);
      y += 20; color = '#9a8dc8';
    }
    ctx.restore();
  }

  // ===== Replay d'une perf =====
  function create(canvas) {
    const ctx = setupCtx(canvas);
    let spec = null, sim = null, speed = 1, playing = false, brainOn = false, ended = false;
    let raf = 0, last = 0, acc = 0, charId = 'HommeBleu', title = '';
    const endCbs = [], frameCbs = [];
    const inputs = new Float64Array(Sensors.N_INPUTS);

    function finished() { return sim.dead || sim.time >= MAX_TIME; }

    function draw() {
      Render.drawSimFrame(ctx, [sim], { charId });
      if (brainOn) {
        drawObserved(ctx, sim);
        Sensors.observe(sim, inputs);
        drawBrain(ctx, spec.weights, inputs, W - 168, 6, 162, 112);
      }
      hud(ctx, [title, 'Score ' + fmt(sim.score) + (ended ? (sim.dead ? '  ·  mort' : '  ·  10 min atteintes') : ''),
        speed !== 1 ? '×' + speed : ''], '#f0c840');
      for (const cb of frameCbs) cb(sim);
    }

    function tick(now) {
      raf = 0;
      if (!playing || !sim) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      acc += dt * speed;
      while (acc >= DT && !finished()) {
        acc -= DT;
        Sim.step(sim, Brain.decide(spec.weights, Sensors.observe(sim, inputs)));
      }
      if (finished() && !ended) {
        ended = true; playing = false;
        draw();
        const res = { score: sim.score, time: sim.time, dead: sim.dead, expected: spec.score };
        for (const cb of endCbs) cb(res);
        return;
      }
      draw();
      raf = requestAnimationFrame(tick);
    }

    function loop() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }

    return {
      canvas,
      // spec : une perf notable, ou {weights, seed, cfg, spdMax[, score, label]}
      play(s, o) {
        if (s) {
          spec = s; sim = makeSim(s); acc = 0; ended = false;
          charId = (o && o.charId) || charId;
          title = (o && o.title !== undefined) ? o.title : (s.gen !== undefined ? 'Gén. ' + s.gen : '');
        }
        if (!sim || ended) return;
        playing = true; draw(); loop();
      },
      pause() { playing = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } },
      stop() { this.pause(); spec = null; sim = null; },
      isPlaying() { return playing; },
      setSpeed(x) { speed = Math.max(0.5, Math.min(8, x)); },
      onEnd(cb) { endCbs.push(cb); },
      onFrame(cb) { frameCbs.push(cb); },
      showBrain(b) { brainOn = !!b; if (sim) draw(); },
      getSim() { return sim; },
      // Rejoue toute la partie sans affichage (score attendu, vérification).
      simulate(s) {
        const sm = makeSim(s), inp = new Float64Array(Sensors.N_INPUTS);
        while (!sm.dead && sm.time < MAX_TIME) Sim.step(sm, Brain.decide(s.weights, Sensors.observe(sm, inp)));
        return { score: sm.score, time: sm.time, dead: sm.dead };
      },
    };
  }

  // ===== Vue en direct : un échantillon de la génération, sur la même graine =====
  function createLive(canvas) {
    const ctx = setupCtx(canvas);
    let sims = [], brains = [], raf = 0, last = 0, acc = 0, speed = 4, info = null, pending = null;
    let charId = 'HommeBleu', active = false;
    const inputs = new Float64Array(Sensors.N_INPUTS);

    function begin(summary, sampleSize) {
      const n = summary.population.length;
      const champ = summary.championIndex;
      const idx = [champ];
      // tirage d'affichage avec Math.random : jamais le rng d'entraînement
      const pool = [];
      for (let i = 0; i < n; i++) if (i !== champ) pool.push(i);
      while (idx.length < Math.min(sampleSize, n) && pool.length) {
        idx.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      }
      // spdMax utilisé pendant l'évaluation de cette génération (= valeur après la génération précédente)
      const h = summary.history;
      const before = summary.gen > 0 && h[summary.gen - 1] ? h[summary.gen - 1].spdMax : Infinity;
      const spec = { seed: summary.seeds[0], cfg: summary.cfg || {}, spdMax: before };
      brains = idx.map(i => summary.population[i]);
      sims = idx.map(() => makeSim(spec));
      info = { gen: summary.gen, total: idx.length, summary, sampleSize };
      acc = 0;
    }

    function draw() {
      if (!sims.length) {
        Render.drawClassicBackground(ctx);
        hud(ctx, ['En attente de la première génération…']);
        return;
      }
      Render.drawSimFrame(ctx, sims, {
        charId, highlight: 0,
        alphaFor: i => i === 0 ? 1 : 0.35,
        labels: ['Champion gén. ' + info.gen],
      });
      let alive = 0, best = 0;
      for (const s of sims) { if (!s.dead) alive++; if (s.score > best) best = s.score; }
      hud(ctx, ['Direct · gén. ' + info.gen, 'Vivants ' + alive + '/' + info.total + '  ·  score ' + fmt(best), '×' + speed]);
    }

    function tick(now) {
      raf = 0;
      if (!active) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (sims.length) {
        acc += dt * speed;
        let alive = true;
        while (acc >= DT && alive) {
          acc -= DT;
          alive = false;
          for (let i = 0; i < sims.length; i++) {
            const s = sims[i];
            if (s.dead || s.time >= MAX_TIME) continue;
            Sim.step(s, Brain.decide(brains[i], Sensors.observe(s, inputs)));
            if (!s.dead && s.time < MAX_TIME) alive = true;
          }
        }
        if (!alive) {
          // tous morts : nouvelle génération si elle est arrivée, sinon on reboucle le même échantillon
          const next = pending || info.summary;
          pending = null;
          begin(next, info.sampleSize);
        }
      } else if (pending) { begin(pending, 30); pending = null; }
      draw();
      raf = requestAnimationFrame(tick);
    }

    return {
      canvas,
      // Appelé à chaque génération : l'échantillon courant finit sa partie avant de passer à la suivante.
      show(summary, sampleSize, sp, o) {
        if (o && o.charId) charId = o.charId;
        if (sp) speed = sp;
        if (!summary) { active = true; if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } return; }
        if (!sims.length) begin(summary, sampleSize || 30); else pending = summary;
        if (info) info.sampleSize = sampleSize || 30;
        active = true;
        if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
      },
      // Garde l'échantillon en mémoire (on peut reprendre avec show(null)).
      stop() { active = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } },
      // Oublie tout (réinitialisation).
      clear() { this.stop(); sims = []; brains = []; info = null; pending = null; },
      setSpeed(x) { speed = x; },
      setCharId(id) { charId = id; },
      isActive() { return active; },
      draw,
    };
  }

  const DodgeReplay = { create, createLive, observedObstacles };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeReplay; else root.DodgeReplay = DodgeReplay;
})(typeof self !== 'undefined' ? self : globalThis);
