(function (root) {
  const Sensors = (typeof DodgeSensors !== 'undefined') ? DodgeSensors : require('./sensors.js');
  const LAYERS = [Sensors.N_INPUTS, 48, 32, 4];
  let NET_WEIGHTS = 0;
  for (let l = 0; l < LAYERS.length - 1; l++) NET_WEIGHTS += LAYERS[l] * LAYERS[l + 1] + LAYERS[l + 1];
  const N_WEIGHTS = NET_WEIGHTS + 1, SIGMA_INDEX = NET_WEIGHTS, INIT_SIGMA = 0.22;
  function random(rng) {
    const w = new Float32Array(N_WEIGHTS);
    let off = 0;
    for (let l = 0; l < LAYERS.length - 1; l++) {
      const ni = LAYERS[l], no = LAYERS[l + 1], limit = Math.sqrt(6 / (ni + no));
      for (let j = 0; j < no; j++) for (let i = 0; i < ni; i++) w[off + j * ni + i] = (rng.next() * 2 - 1) * limit;
      off += ni * no;
      for (let j = 0; j < no; j++) w[off + j] = 0;
      off += no;
    }
    w[SIGMA_INDEX] = INIT_SIGMA;
    return w;
  }
  function run(w, inputs, acts) {
    for (let i = 0; i < LAYERS[0]; i++) acts[0][i] = inputs[i];
    let off = 0;
    for (let l = 0; l < LAYERS.length - 1; l++) {
      const ni = LAYERS[l], no = LAYERS[l + 1], src = acts[l], dst = acts[l + 1], last = l === LAYERS.length - 2;
      const bo = off + ni * no;
      for (let j = 0; j < no; j++) {
        let s = w[bo + j], r = off + j * ni;
        for (let i = 0; i < ni; i++) s += w[r + i] * src[i];
        dst[j] = (!last && s < 0) ? 0 : s;
      }
      off = bo + no;
    }
    return acts[acts.length - 1];
  }
  function makeActs() { return LAYERS.map(n => new Float64Array(n)); }
  const scratch = makeActs();
  function forward(w, inputs) { run(w, inputs, scratch); return Float64Array.from(scratch[scratch.length - 1]); }
  function decide(w, inputs) {
    const o = run(w, inputs, scratch);
    let best = 1, bv = o[1];
    if (o[0] > bv) { best = 0; bv = o[0]; }
    if (o[2] > bv) best = 2;
    return { left: best === 0, right: best === 2, jump: o[3] > 0 };
  }
  function activations(w, inputs) { const acts = makeActs(); run(w, inputs, acts); return acts; }
  const DodgeBrain = { LAYERS, N_WEIGHTS, NET_WEIGHTS, SIGMA_INDEX, INIT_SIGMA, random, forward, decide, activations };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeBrain; else root.DodgeBrain = DodgeBrain;
})(typeof self !== 'undefined' ? self : globalThis);
