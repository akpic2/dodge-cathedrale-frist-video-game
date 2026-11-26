// Worker d'évaluation : reçoit un lot de cerveaux (poids concaténés), renvoie les résultats.
(function (root) {
  const inWorker = typeof importScripts === 'function';
  if (inWorker) importScripts('../sim.js', 'sensors.js', 'brain.js', 'evaluate.js');
  const Brain = (typeof DodgeBrain !== 'undefined') ? DodgeBrain : require('./brain.js');
  const Eval = (typeof DodgeEval !== 'undefined') ? DodgeEval : require('./evaluate.js');

  function handleEval(msg) {
    const n = Brain.N_WEIGHTS;
    const all = new Float32Array(msg.buffer);
    const brains = [];
    for (let i = 0; i < msg.count; i++) brains.push(all.subarray(i * n, (i + 1) * n));
    return { type: 'result', jobId: msg.jobId, part: msg.part, results: Eval.evaluateBatch(brains, msg.seeds, msg.cfg) };
  }

  if (inWorker) {
    self.onmessage = function (e) {
      if (e.data && e.data.type === 'eval') self.postMessage(handleEval(e.data));
    };
  }

  const DodgeWorker = { handleEval };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeWorker; else root.DodgeWorker = DodgeWorker;
})(typeof self !== 'undefined' ? self : globalThis);
