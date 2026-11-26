// Courbes du tableau de bord, dessinées à la main sur un canvas (pas de bibliothèque).
(function (root) {
  // Monochrome, comme la refonte Mote : encre noire, gris, filets fins.
  const COLORS = { best: '#000', mean: '#777', median: '#b3b3b3', spd: '#000', human: '#777', grid: '#e7e7e7', axis: '#cfcfcf', text: '#777' };
  const FONT = '"Inter Tight",Arial,sans-serif';
  const STYLE = {
    best:   { color: COLORS.best, width: 2, dash: [] },
    mean:   { color: COLORS.mean, width: 1.5, dash: [] },
    median: { color: COLORS.median, width: 1.5, dash: [2, 3] },
    spdMax: { color: COLORS.spd, width: 1, dash: [5, 4] },
  };

  function niceMax(v) {
    if (!(v > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }
  function short(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + ' M';
    if (n >= 1e4) return Math.round(n / 1e3) + ' k';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.', ',') + ' k';
    return String(Math.round(n));
  }

  // history : [{gen, best, mean, median, spdMax}] ; o.humanRecord optionnel
  function drawHistory(canvas, history, o) {
    o = o || {};
    const dpr = root.devicePixelRatio || 1;
    const cw = canvas.clientWidth || 600, ch = canvas.clientHeight || 220;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    const padL = 46, padR = 50, padT = 12, padB = 24;
    const pw = cw - padL - padR, ph = ch - padT - padB;
    ctx.font = '400 10px ' + FONT;

    if (!history.length) {
      ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = Math.round(padT + ph * i / 4) + 0.5;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + pw, y); ctx.stroke();
      }
      ctx.fillStyle = COLORS.text; ctx.textAlign = 'center';
      ctx.fillText('LES COURBES APPARAÎTRONT APRÈS LA PREMIÈRE GÉNÉRATION.', cw / 2, ch / 2);
      return;
    }

    const n = history.length;
    let maxS = o.humanRecord > 0 ? o.humanRecord : 0, maxV = 0, anySpd = false;
    for (const h of history) {
      if (h.best > maxS) maxS = h.best;
      if (isFinite(h.spdMax)) { anySpd = true; if (h.spdMax > maxV) maxV = h.spdMax; }
    }
    maxS = niceMax(maxS * 1.05); maxV = niceMax(maxV * 1.1);
    const x0 = history[0].gen, x1 = Math.max(history[n - 1].gen, x0 + 1);
    const X = g => padL + pw * (g - x0) / (x1 - x0);
    const Y = v => padT + ph * (1 - v / maxS);
    const YV = v => padT + ph * (1 - v / maxV);

    // grille + axes
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1; ctx.fillStyle = COLORS.text;
    for (let i = 0; i <= 4; i++) {
      const y = Math.round(padT + ph * i / 4) + 0.5;
      ctx.strokeStyle = i === 4 ? COLORS.axis : COLORS.grid;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + pw, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(short(maxS * (1 - i / 4)), padL - 8, y + 3);
      if (anySpd) { ctx.textAlign = 'left'; ctx.fillStyle = COLORS.spd; ctx.fillText(short(maxV * (1 - i / 4)), padL + pw + 8, y + 3); ctx.fillStyle = COLORS.text; }
    }
    ctx.textAlign = 'center';
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const g = Math.round(x0 + (x1 - x0) * i / ticks);
      ctx.fillText('GÉN. ' + g, X(g), ch - 6);
    }

    // sous-échantillonnage : au plus un point par pixel
    const stride = Math.max(1, Math.floor(n / pw));
    function line(key, yf) {
      const st = STYLE[key];
      ctx.save();
      ctx.strokeStyle = st.color; ctx.lineWidth = st.width; ctx.setLineDash(st.dash); ctx.lineJoin = 'round';
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < n; i += stride) {
        // on garde le maximum du paquet pour le meilleur score (les pics restent visibles)
        let v = history[i][key];
        if (key === 'best') for (let k = i + 1; k < Math.min(n, i + stride); k++) v = Math.max(v, history[k].best);
        if (!isFinite(v)) { started = false; continue; }
        const x = X(history[i].gen), y = yf(v);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      if (n === 1 && isFinite(history[0][key])) { const y = yf(history[0][key]); ctx.moveTo(padL, y); ctx.lineTo(padL + pw, y); }
      ctx.stroke();
      ctx.restore();
    }

    if (o.humanRecord > 0) {
      const y = Math.round(Y(o.humanRecord)) + 0.5;
      ctx.save(); ctx.strokeStyle = COLORS.human; ctx.lineWidth = 1; ctx.setLineDash([8, 5]);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + pw, y); ctx.stroke(); ctx.restore();
      ctx.fillStyle = COLORS.human; ctx.textAlign = 'left'; ctx.fillText('RECORD HUMAIN', padL + 6, y - 5);
    }
    if (anySpd) line('spdMax', YV);
    line('median', Y);
    line('mean', Y);
    line('best', Y);
  }

  const DodgeCharts = { COLORS, drawHistory };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeCharts; else root.DodgeCharts = DodgeCharts;
})(typeof self !== 'undefined' ? self : globalThis);
