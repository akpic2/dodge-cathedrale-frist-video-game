(function (root) {
  const MILESTONES = [1000, 2000, 5000, 10000, 20000, 50000, 100000];
  const PRIORITY = { benchRecord: 6, record: 5, spdMaxUp: 5, humanBeaten: 4, milestone: 3, bigJump: 2, sideDodges: 1, champion: 0 };

  // 1234567 -> "1 234 567" (sans toLocaleString, dont le rendu varie)
  function fmt(n) {
    const s = String(Math.round(n));
    const neg = s[0] === '-';
    const d = neg ? s.slice(1) : s;
    let out = '';
    for (let i = 0; i < d.length; i++) {
      if (i > 0 && (d.length - i) % 3 === 0) out += ' ';
      out += d[i];
    }
    return (neg ? '-' : '') + out;
  }

  function initialState() {
    return { bestScore: 0, bestGen: -1, bestJumpRatio: 1, bestSideDodges: 0, milestonesDone: [], humanBeaten: false };
  }

  function bestGame(games) {
    let b = games[0];
    for (const g of games) if (g.score > b.score) b = g;
    return b;
  }
  function worstGame(games) {
    let b = games[0];
    for (const g of games) if (g.time < b.time) b = g;
    return b;
  }

  function detect(summary, state) {
    const st = state ? {
      bestScore: state.bestScore, bestGen: state.bestGen, bestJumpRatio: state.bestJumpRatio,
      bestSideDodges: state.bestSideDodges, milestonesDone: state.milestonesDone.slice(), humanBeaten: state.humanBeaten
    } : initialState();
    const { gen, population, results, cfg, spdMaxBefore, spdMaxAfter, humanRecord } = summary;
    const notables = [];
    if (!results.length) return { notables, state: st };

    function make(type, botIdx, game, label, idSuffix, extra) {
      const n = {
        id: type + '-' + gen + (idSuffix ? '-' + idSuffix : ''),
        type, gen, score: game.score, seed: game.seed,
        weights: new Float32Array(population[botIdx]),
        spdMax: spdMaxBefore, cfg: { difficulty: cfg && cfg.difficulty, charSpeed: cfg && cfg.charSpeed },
        label, priority: PRIORITY[type]
      };
      if (extra) Object.assign(n, extra);
      notables.push(n);
    }

    // champion = meilleure fitness ; meilleure partie globale ; plus de sauts latéraux
    let champ = 0, topBot = 0, topGame = bestGame(results[0].games), sideBot = 0, sideGame = results[0].games[0];
    for (let i = 0; i < results.length; i++) {
      if ((results[i].selectionFitness !== undefined ? results[i].selectionFitness : results[i].fitness) > (results[champ].selectionFitness !== undefined ? results[champ].selectionFitness : results[champ].fitness)) champ = i;
      const bg = bestGame(results[i].games);
      if (bg.score > topGame.score) { topGame = bg; topBot = i; }
      for (const g of results[i].games) if (g.sideDodged > sideGame.sideDodged) { sideGame = g; sideBot = i; }
    }

    const cg = results[champ].games, cBest = bestGame(cg), cWorst = worstGame(cg);
    make('champion', champ, cBest,
      'Champion de la gén. ' + gen + ' : ' + fmt(results[champ].fitness) + ' de moyenne',
      '', { worstSeed: cWorst.seed, worstScore: cWorst.score });

    const prev = st.bestScore;
    if (topGame.score > prev) {
      const label = st.bestGen < 0 || prev <= 0
        ? 'Premier record : ' + fmt(topGame.score)
        : 'Nouveau record : ' + fmt(topGame.score) + ' (+' + Math.round((topGame.score / prev - 1) * 100) + ' % vs gén. ' + st.bestGen + ')';
      make('record', topBot, topGame, label);
      if (prev > 0) {
        const ratio = topGame.score / prev;
        if (ratio > st.bestJumpRatio) {
          st.bestJumpRatio = ratio;
          make('bigJump', topBot, topGame,
            'Gros bond : x' + (Math.round(ratio * 100) / 100) + ' (' + fmt(prev) + ' à ' + fmt(topGame.score) + ')');
        }
      }
      st.bestScore = topGame.score;
      st.bestGen = gen;
    }

    for (const m of MILESTONES) {
      if (topGame.score >= m && st.milestonesDone.indexOf(m) < 0) {
        st.milestonesDone.push(m);
        make('milestone', topBot, topGame, 'Cap des ' + fmt(m) + ' points franchi (' + fmt(topGame.score) + ')', String(m));
      }
    }

    const up = (spdMaxBefore === Infinity && isFinite(spdMaxAfter)) || spdMaxAfter > spdMaxBefore;
    if (up) {
      const label = spdMaxBefore === Infinity
        ? 'Limite de vitesse fixée : ' + fmt(spdMaxAfter) + ' px/s'
        : 'Limite de vitesse relevée : ' + fmt(spdMaxAfter) + ' px/s (gén. ' + gen + ')';
      make('spdMaxUp', champ, cBest, label);
    }

    if (sideGame.sideDodged > st.bestSideDodges) {
      st.bestSideDodges = sideGame.sideDodged;
      make('sideDodges', sideBot, sideGame, 'Esquives latérales : ' + fmt(sideGame.sideDodged) + ' dans une partie');
    }

    if (humanRecord !== undefined && humanRecord !== null && !st.humanBeaten && topGame.score > humanRecord) {
      st.humanBeaten = true;
      make('humanBeaten', topBot, topGame, 'Record humain battu : ' + fmt(topGame.score) + ' contre ' + fmt(humanRecord));
    }

    return { notables, state: st };
  }

  // ===== Éclaircissement de la liste stockée =====
  // Champions : tous jusqu'à la gén. 20, puis 1 sur 10 jusqu'à 200, 1 sur 100 jusqu'à 2000, puis 1 sur 1000.
  // Le champion de la dernière génération est toujours gardé (il remplace l'ancien « dernier » hors grille).
  // Les autres types sont tous gardés, sauf sideDodges : seulement les SIDE_DODGES_KEEP plus récents.
  const SIDE_DODGES_KEEP = 20;
  function championKept(gen) {
    if (gen <= 20) return true;
    if (gen <= 200) return gen % 10 === 0;
    if (gen <= 2000) return gen % 100 === 0;
    return gen % 1000 === 0;
  }

  // Ajoute n à list (en place) puis retire ce qui sort de la règle. Renvoie list.
  function addNotable(list, n) {
    list.push(n);
    if (n.type === 'champion') {
      for (let i = list.length - 2; i >= 0; i--) {
        const p = list[i];
        if (p.type !== 'champion') continue;
        if (p.gen < n.gen && !championKept(p.gen)) list.splice(i, 1);
        break; // un seul champion hors grille possible : le précédent « dernier »
      }
    } else if (n.type === 'sideDodges') {
      let count = 0;
      for (const p of list) if (p.type === 'sideDodges') count++;
      for (let i = 0; i < list.length && count > SIDE_DODGES_KEEP; i++) {
        if (list[i].type === 'sideDodges') { list.splice(i, 1); i--; count--; }
      }
    }
    return list;
  }

  // Applique la règle à une liste complète (ex. sauvegarde chargée). Nouveau tableau, mêmes objets.
  function thin(list) {
    let lastChamp = -Infinity, sideTotal = 0;
    for (const n of list) {
      if (n.type === 'champion' && n.gen > lastChamp) lastChamp = n.gen;
      if (n.type === 'sideDodges') sideTotal++;
    }
    let sideSkip = sideTotal - SIDE_DODGES_KEEP;
    const out = [];
    for (const n of list) {
      if (n.type === 'champion' && !championKept(n.gen) && n.gen !== lastChamp) continue;
      if (n.type === 'sideDodges' && sideSkip > 0) { sideSkip--; continue; }
      out.push(n);
    }
    return out;
  }

  // ===== File d'auto-sélection (logique pure, utilisée par le tableau de bord) =====
  // Élément : {n, parts: [{type, label, priority}], priority, seq}. Plusieurs perfs d'une même partie
  // (record + gros bond + palier) fusionnent en un seul replay.
  const QUEUE_MAX = 5;
  const QUEUE_REPLACING = ['benchRecord', 'record', 'bigJump', 'milestone', 'spdMaxUp', 'humanBeaten'];
  function sameGame(a, b) { return a.gen === b.gen && a.seed === b.seed && a.score === b.score; }
  function queueable(n) { return n.priority > 0 && n.type !== 'sideDodges'; }
  function refreshItem(q) {
    q.priority = 0;
    for (const p of q.parts) q.priority = Math.max(q.priority, p.priority);
  }
  // Renvoie la nouvelle file (l'ancienne n'est pas modifiée ; les éléments gardés peuvent l'être).
  function queueAdd(queue, n, seq, max) {
    if (!queueable(n)) return queue;
    let out = queue.slice();
    // un nouveau record (etc.) remplace l'élément du même type encore en attente
    if (QUEUE_REPLACING.indexOf(n.type) >= 0) {
      for (const q of out) {
        if (sameGame(q.n, n)) continue;
        q.parts = q.parts.filter(p => p.type !== n.type);
        refreshItem(q);
      }
      out = out.filter(q => q.parts.length);
    }
    const part = { type: n.type, label: n.label, priority: n.priority };
    const dup = out.find(q => sameGame(q.n, n));
    if (dup) { dup.parts.push(part); refreshItem(dup); dup.seq = seq; }
    else out.push({ n, parts: [part], priority: n.priority, seq });
    // priorité décroissante, puis la plus récente d'abord
    out.sort((a, b) => (b.priority - a.priority) || (b.seq - a.seq));
    const cap = max || QUEUE_MAX;
    while (out.length > cap) out.pop(); // la plus ancienne parmi les moins prioritaires
    return out;
  }

  const DodgeNotables = {
    MILESTONES, PRIORITY, SIDE_DODGES_KEEP, QUEUE_MAX, QUEUE_REPLACING,
    detect, fmt, initialState, championKept, addNotable, thin, queueAdd,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeNotables; else root.DodgeNotables = DodgeNotables;
})(typeof self !== 'undefined' ? self : globalThis);
