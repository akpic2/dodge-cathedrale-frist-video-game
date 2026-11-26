(function (root) {
  const Sensors = (typeof DodgeSensors !== 'undefined') ? DodgeSensors : require('./sensors.js');
  const LAYERS = [Sensors.N_INPUTS, 24, 24, 4];
  // Disposition des poids : pour chaque couche l (de LAYERS[l] vers LAYERS[l+1]),
  // d'abord les poids en ligne-majeure [out][in], puis les LAYERS[l+1] biais.
  let NET_WEIGHTS = 0;
  for (let l = 0; l < LAYERS.length - 1; l++) NET_WEIGHTS += LAYERS[l] * LAYERS[l + 1] + LAYERS[l + 1];
  // + 1 case à la fin : la force de mutation propre au bot (mutation auto-adaptative), ignorée par le réseau.
  const N_WEIGHTS = NET_WEIGHTS + 1;
  const SIGMA_INDEX = NET_WEIGHTS;
  const INIT_SIGMA = 0.3;

  const INIT_SCALE = 1; // poids initiaux uniformes dans [-1, 1)

  function random(rng) {
    const w = new Float32Array(N_WEIGHTS);
    for (let i = 0; i < NET_WEIGHTS; i++) w[i] = (rng.next() * 2 - 1) * INIT_SCALE;
    w[SIGMA_INDEX] = INIT_SIGMA;
    return w;
  }

  // Calcule toutes les couches ; acts[0] = entrées. ReLU caché, sortie linéaire.
  function run(w, inputs, acts) {
    const a0 = acts[0];
    for (let i = 0; i < LAYERS[0]; i++) a0[i] = inputs[i];
    let off = 0;
    for (let l = 0; l < LAYERS.length - 1; l++) {
      const nIn = LAYERS[l], nOut = LAYERS[l + 1], src = acts[l], dst = acts[l + 1];
      const last = l === LAYERS.length - 2;
      const bOff = off + nIn * nOut;
      for (let j = 0; j < nOut; j++) {
        let s = w[bOff + j];
        const r = off + j * nIn;
        for (let i = 0; i < nIn; i++) s += w[r + i] * src[i];
        dst[j] = (!last && s < 0) ? 0 : s;
      }
      off = bOff + nOut;
    }
    return acts[acts.length - 1];
  }

  function makeActs() { return LAYERS.map(n => new Float64Array(n)); }

  const scratch = makeActs();

  function forward(w, inputs) {
    run(w, inputs, scratch);
    return Float64Array.from(scratch[scratch.length - 1]);
  }

  function decide(w, inputs) {
    const o = run(w, inputs, scratch);
    // argmax gauche/rien/droite ; égalité -> « rien » (index 1) prioritaire
    let best = 1, bv = o[1];
    if (o[0] > bv) { best = 0; bv = o[0]; }
    if (o[2] > bv) { best = 2; }
    return { left: best === 0, right: best === 2, jump: o[3] > 0 };
  }

  function activations(w, inputs) {
    const acts = makeActs();
    run(w, inputs, acts);
    return acts;
  }

  const DodgeBrain = { LAYERS, N_WEIGHTS, NET_WEIGHTS, SIGMA_INDEX, INIT_SIGMA, random, forward, decide, activations };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeBrain; else root.DodgeBrain = DodgeBrain;
})(typeof self !== 'undefined' ? self : globalThis);
