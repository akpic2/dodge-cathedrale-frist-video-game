(function (root) {
  const Sim = (typeof DodgeSim !== 'undefined') ? DodgeSim : require('../sim.js');

  // 12 zones larges pour anticiper + 12 zones fines autour du joueur pour les trajectoires proches.
  const NB = 12, BW = 40, SPAN = NB * BW / 2;
  const FINE_NB = 12, FINE_BW = 20, FINE_SPAN = FINE_NB * FINE_BW / 2;
  const T_SCALE = 1.5;
  const IDX = Object.freeze({
    coarse: 0, fine: NB,
    leftTime1: NB + FINE_NB, leftTime2: NB + FINE_NB + 1, leftSpeed: NB + FINE_NB + 2,
    rightTime1: NB + FINE_NB + 3, rightTime2: NB + FINE_NB + 4, rightSpeed: NB + FINE_NB + 5,
    x: NB + FINE_NB + 6, onGround: NB + FINE_NB + 7, height: NB + FINE_NB + 8,
    verticalSpeed: NB + FINE_NB + 9, gameSpeed: NB + FINE_NB + 10
  });
  const N_INPUTS = NB + FINE_NB + 11;
  const GROUND = Sim.H - 25;
  const CONTACT = 25;

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  function observe(sim, out) {
    const o = out || new Float64Array(N_INPUTS), p = sim.player;
    const pTop = p.y + p.h * 0.15, pBottom = p.y + p.h * 0.90;

    for (let i = 0; i < NB; i++) {
      const b0 = p.x - SPAN + i * BW, b1 = b0 + BW;
      o[IDX.coarse + i] = (b1 <= 0 || b0 >= Sim.W) ? 0 : 1;
    }
    for (let i = 0; i < FINE_NB; i++) {
      const b0 = p.x - FINE_SPAN + i * FINE_BW, b1 = b0 + FINE_BW;
      o[IDX.fine + i] = (b1 <= 0 || b0 >= Sim.W) ? 0 : 1;
    }

    let l1 = 1, l2 = 1, lv = 0, r1 = 1, r2 = 1, rv = 0;
    for (const g of sim.obstacles) {
      const dx = g.x - p.x;
      if (!g.fromRight) {
        const hh = g.h / 2 * 0.55;
        if (g.y - hh >= pBottom) continue;
        const t = g.vy > 0 ? (pTop - (g.y + hh)) / g.vy : T_SCALE;
        const v = clamp01(t / T_SCALE);
        const lo = dx - CONTACT, hi = dx + CONTACT;
        for (let i = 0; i < NB; i++) {
          const b0 = -SPAN + i * BW;
          if (hi > b0 && lo < b0 + BW && v < o[IDX.coarse + i]) o[IDX.coarse + i] = v;
        }
        for (let i = 0; i < FINE_NB; i++) {
          const b0 = -FINE_SPAN + i * FINE_BW;
          if (hi > b0 && lo < b0 + FINE_BW && v < o[IDX.fine + i]) o[IDX.fine + i] = v;
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
    o[IDX.leftTime1] = l1; o[IDX.leftTime2] = l2; o[IDX.leftSpeed] = lv;
    o[IDX.rightTime1] = r1; o[IDX.rightTime2] = r2; o[IDX.rightSpeed] = rv;
    o[IDX.x] = p.x / (Sim.W / 2) - 1;
    o[IDX.onGround] = p.isJumping ? 0 : 1;
    o[IDX.height] = (GROUND - (p.y + p.h)) / 90;
    o[IDX.verticalSpeed] = p.vy / 360;
    o[IDX.gameSpeed] = sim.spd / 2000;
    return o;
  }

  function seenObstacles(sim) {
    const p = sim.player, pBottom = p.y + p.h * 0.90, out = [];
    for (const g of sim.obstacles) {
      const dx = g.x - p.x;
      if (!g.fromRight) {
        if (g.y - g.h / 2 * 0.55 >= pBottom) continue;
        if (dx + CONTACT > -SPAN && dx - CONTACT < SPAN) out.push(g);
      } else if ((g.vx > 0 && dx <= CONTACT) || (g.vx < 0 && dx >= -CONTACT)) out.push(g);
    }
    return out;
  }

  const DodgeSensors = { N_INPUTS, NB, BW, FINE_NB, FINE_BW, IDX, observe, seenObstacles };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeSensors; else root.DodgeSensors = DodgeSensors;
})(typeof self !== 'undefined' ? self : globalThis);
