(function (root) {
  const MILESTONES = [1000, 2000, 5000, 10000, 20000, 50000, 100000];
  const PRIORITY = { record: 5, spdMaxUp: 5, humanBeaten: 4, milestone: 3, bigJump: 2, sideDodges: 1, champion: 0 };

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
      if (results[i].fitness > results[champ].fitness) champ = i;
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

  const DodgeNotables = { MILESTONES, PRIORITY, detect, fmt, initialState };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeNotables; else root.DodgeNotables = DodgeNotables;
})(typeof self !== 'undefined' ? self : globalThis);
