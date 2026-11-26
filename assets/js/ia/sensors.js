(function (root) {
  const Sim = (typeof DodgeSim !== 'undefined') ? DodgeSim : require('../sim.js');

  // Ce que le bot « voit » (23 valeurs, à peu près entre -1 et 1) :
  //  [0..11]  carte de danger des obstacles qui tombent : 12 colonnes de 40 px centrées sur le joueur
  //           (de -240 à +240 px). Valeur = temps avant impact / 1,5 s, plafonné à 1 (1 = rien).
  //           Une colonne hors de l'arène vaut 0 (un mur = danger permanent).
  //  [12..14] obstacles latéraux venant de la GAUCHE : temps avant contact du 1er, du 2e (/1,5 s, 1 = rien),
  //           vitesse du 1er (/1000)
  //  [15..17] idem venant de la DROITE
  //  [18] position x (-1 bord gauche, +1 bord droit)   [19] au sol (1) ou en l'air (0)
  //  [20] hauteur au-dessus du sol (/90 px)              [21] vitesse verticale (/360)
  //  [22] vitesse du jeu spd (/2000)
  const NB = 12, BW = 40, SPAN = NB * BW / 2; // 240
  const T_SCALE = 1.5;
  const N_INPUTS = NB + 6 + 5;
  const GROUND = Sim.H - 25;
  const CONTACT = 25; // demi-largeur obstacle (13,75) + demi-largeur joueur (11,2) ≈ 25 px

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  function observe(sim, out) {
    const o = out || new Float64Array(N_INPUTS);
    const p = sim.player;
    const pTop = p.y + p.h * 0.15, pBottom = p.y + p.h * 0.90;

    // Carte de danger (les colonnes hors arène = 0)
    for (let i = 0; i < NB; i++) {
      const b0 = p.x - SPAN + i * BW, b1 = b0 + BW;
      o[i] = (b1 <= 0 || b0 >= Sim.W) ? 0 : 1;
    }
    let l1 = 1, l2 = 1, lv = 0, r1 = 1, r2 = 1, rv = 0;

    for (const g of sim.obstacles) {
      const dx = g.x - p.x;
      if (!g.fromRight) {
        const hh = g.h / 2 * 0.55;
        if (g.y - hh >= pBottom) continue; // déjà passé sous les pieds
        const t = g.vy > 0 ? (pTop - (g.y + hh)) / g.vy : T_SCALE;
        const v = clamp01(t / T_SCALE);
        const lo = dx - CONTACT, hi = dx + CONTACT;
        for (let i = 0; i < NB; i++) {
          const b0 = -SPAN + i * BW;
          if (hi > b0 && lo < b0 + BW && v < o[i]) o[i] = v;
        }
      } else {
        let t;
        if (g.vx > 0) { if (dx > CONTACT) continue; t = dx >= -CONTACT ? 0 : (-dx - CONTACT) / g.vx; }
        else if (g.vx < 0) { if (dx < -CONTACT) continue; t = dx <= CONTACT ? 0 : (dx - CONTACT) / -g.vx; }
        else continue;
        const v = clamp01(t / T_SCALE);
        if (g.vx > 0) {
          if (v < l1) { l2 = l1; l1 = v; lv = g.vx / 1000; } else if (v < l2) l2 = v;
        } else {
          if (v < r1) { r2 = r1; r1 = v; rv = -g.vx / 1000; } else if (v < r2) r2 = v;
        }
      }
    }
    let k = NB;
    o[k++] = l1; o[k++] = l2; o[k++] = lv;
    o[k++] = r1; o[k++] = r2; o[k++] = rv;
    o[k++] = p.x / (Sim.W / 2) - 1;
    o[k++] = p.isJumping ? 0 : 1;
    o[k++] = (GROUND - (p.y + p.h)) / 90;
    o[k++] = p.vy / 360;
    o[k++] = sim.spd / 2000;
    return o;
  }

  // Pour l'affichage : obstacles qui influencent la carte de danger ou les capteurs latéraux.
  function seenObstacles(sim) {
    const p = sim.player, pBottom = p.y + p.h * 0.90;
    const out = [];
    for (const g of sim.obstacles) {
      const dx = g.x - p.x;
      if (!g.fromRight) {
        if (g.y - g.h / 2 * 0.55 >= pBottom) continue;
        if (dx + CONTACT > -SPAN && dx - CONTACT < SPAN) out.push(g);
      } else if ((g.vx > 0 && dx <= CONTACT) || (g.vx < 0 && dx >= -CONTACT)) out.push(g);
    }
    return out;
  }

  const DodgeSensors = { N_INPUTS, NB, BW, observe, seenObstacles };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeSensors; else root.DodgeSensors = DodgeSensors;
})(typeof self !== 'undefined' ? self : globalThis);
