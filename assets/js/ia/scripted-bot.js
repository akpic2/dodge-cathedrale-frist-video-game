(function (root) {
  const Sim = (typeof DodgeSim !== 'undefined') ? DodgeSim : require('../sim.js');

  const DEFAULT_JUMP_LEAD = 0.5;  // on saute quand le latéral qui approche est à ~0,5 s du centre du joueur (il le croise en plein saut)
  const REACT_TIME = 0.9;         // on ne réagit qu'aux chutes qui touchent le joueur dans moins de 0,9 s
  const X_MARGIN = 26;            // marge de sécurité en x autour de la hitbox
  const NONE = { left: false, right: false, jump: false };

  // Heuristique déterministe (aucun aléa), paramétrée par la distance de saut.
  function makeDecide(jumpLead) {
    return function decide(sim) {
      const p = sim.player;
      const halfW = p.w / 2 * 0.7;
      const pTop = p.y + p.h * 0.15;
      // chute la plus imminente qui chevauche le joueur en x
      let best = null, bestT = Infinity;
      let jump = false;
      let nearL = false, nearR = false; // latéral à moins de 100 px de chaque côté
      for (const g of sim.obstacles) {
        if (!g.fromRight) {
          const dx = g.x - p.x;
          const reach = halfW + g.w / 2 * 0.55 + X_MARGIN;
          if (dx > reach || dx < -reach) continue;
          const bottom = g.y + g.h / 2 * 0.55;
          if (bottom > p.y + p.h * 0.90) continue; // déjà passée
          const t = g.vy > 0 ? Math.max(0, (pTop - bottom) / g.vy) : Infinity;
          if (t < bestT) { bestT = t; best = g; }
        } else if (!p.isJumping) {
          const d = Math.abs(g.x - p.x);
          if (d < 100) { if (g.x < p.x) nearL = true; else nearR = true; }
          const approaching = (g.vx > 0 && g.x < p.x) || (g.vx < 0 && g.x > p.x);
          if (approaching && d <= Math.abs(g.vx) * jumpLead) jump = true;
        }
      }
      let left = false, right = false;
      if (best && bestT < REACT_TIME) {
        const dx = best.x - p.x;
        const roomL = p.x, roomR = Sim.W - p.x;
        // côté où fuir : opposé à la menace, sinon celui qui a le plus de place
        let goLeft = dx === 0 ? roomL > roomR : dx > 0;
        if (goLeft && roomL < 50 && roomR > roomL) goLeft = false;
        else if (!goLeft && roomR < 50 && roomL > roomR) goLeft = true;
        if (goLeft && nearL && !nearR) goLeft = false;
        else if (!goLeft && nearR && !nearL) goLeft = true;
        left = goLeft; right = !goLeft;
      }
      return { left, right, jump };
    };
  }

  const decide = makeDecide(DEFAULT_JUMP_LEAD);

  const DodgeScripted = { makeDecide, decide };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeScripted; else root.DodgeScripted = DodgeScripted;
})(typeof self !== 'undefined' ? self : globalThis);
