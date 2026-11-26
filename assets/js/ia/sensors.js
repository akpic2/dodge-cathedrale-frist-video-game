(function (root) {
  const N_INPUTS = 25;
  const N_FALL = 5;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // Layout (25 valeurs) :
  // [0] x joueur normalisé · [1] vy/360 · [2] au sol(1)/en saut(0) · [3] spd/1000
  // [4..18] 5 obstacles tombants (dx/240, clamp(t,0,2)/2, vy/1000), vide = 0,1,0
  // [19..21] latéral le plus proche venant de la gauche (présent, |dx|/480, |vx|/1000)
  // [22..24] idem venant de la droite
  const tT = new Float64Array(N_FALL), tDx = new Float64Array(N_FALL), tVy = new Float64Array(N_FALL);

  function observe(sim, out) {
    const o = out || new Float64Array(N_INPUTS);
    const p = sim.player;
    o[0] = (p.x - 240) / 240;
    o[1] = p.vy / 360;
    o[2] = p.isJumping ? 0 : 1;
    o[3] = sim.spd / 1000;

    const pTop = p.y + p.h * 0.15;
    const pBottom = p.y + p.h * 0.90;
    let nf = 0;
    let leftD = Infinity, leftV = 0, rightD = Infinity, rightV = 0;
    const obs = sim.obstacles;
    for (let i = 0; i < obs.length; i++) {
      const g = obs[i];
      if (!g.fromRight) {
        const hh = g.h / 2 * 0.55;
        // hitbox top of obstacle still above player hitbox bottom
        if (g.y - hh >= pBottom) continue;
        const bottom = g.y + hh;
        const t = g.vy > 0 ? (pTop - bottom) / g.vy : 2;
        // insertion dans les 5 plus proches (tri croissant sur t)
        let k = nf < N_FALL ? nf : N_FALL;
        if (nf === N_FALL && t >= tT[N_FALL - 1]) continue;
        if (nf < N_FALL) nf++;
        else k = N_FALL - 1;
        while (k > 0 && tT[k - 1] > t) {
          tT[k] = tT[k - 1]; tDx[k] = tDx[k - 1]; tVy[k] = tVy[k - 1]; k--;
        }
        tT[k] = t; tDx[k] = g.x - p.x; tVy[k] = g.vy;
      } else if (g.vx > 0 && g.x < p.x) {
        const d = p.x - g.x;
        if (d < leftD) { leftD = d; leftV = g.vx; }
      } else if (g.vx < 0 && g.x > p.x) {
        const d = g.x - p.x;
        if (d < rightD) { rightD = d; rightV = -g.vx; }
      }
    }
    for (let i = 0; i < N_FALL; i++) {
      const b = 4 + i * 3;
      if (i < nf) {
        o[b] = tDx[i] / 240;
        o[b + 1] = clamp(tT[i], 0, 2) / 2;
        o[b + 2] = tVy[i] / 1000;
      } else { o[b] = 0; o[b + 1] = 1; o[b + 2] = 0; }
    }
    if (leftD !== Infinity) { o[19] = 1; o[20] = leftD / 480; o[21] = leftV / 1000; }
    else { o[19] = 0; o[20] = 0; o[21] = 0; }
    if (rightD !== Infinity) { o[22] = 1; o[23] = rightD / 480; o[24] = rightV / 1000; }
    else { o[22] = 0; o[23] = 0; o[24] = 0; }
    return o;
  }

  const DodgeSensors = { N_INPUTS, observe };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeSensors; else root.DodgeSensors = DodgeSensors;
})(typeof self !== 'undefined' ? self : globalThis);
