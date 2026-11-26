// Simulation des replays isolée du thread principal pour éviter les freezes de l'interface.
importScripts('../sim.js', 'sensors.js', 'brain.js');

let sim = null, weights = null, speed = 1, running = false;
let last = 0, accumulator = 0, lastSend = 0;
const DT = DodgeSim.DT;
const MAX_TIME = 600;
const inputs = new Float64Array(DodgeSensors.N_INPUTS);

function sendFrame(finished) {
  self.postMessage({
    type: 'frame',
    sim: { player: sim.player, obstacles: sim.obstacles, dead: sim.dead, time: sim.time, score: sim.score },
    inputs: Array.from(inputs),
    finished: !!finished
  });
}
function tick() {
  if (!running || !sim) return;
  const now = performance.now();
  accumulator += Math.min((now - last) / 1000, 0.1) * speed;
  last = now;
  let steps = 0;
  while (accumulator >= DT && !sim.dead && sim.time < MAX_TIME && steps < 24) {
    accumulator -= DT;
    DodgeSim.step(sim, DodgeBrain.decide(weights, DodgeSensors.observe(sim, inputs)));
    steps++;
  }
  const finished = sim.dead || sim.time >= MAX_TIME;
  if (now - lastSend >= 1000 / 30 || finished) { sendFrame(finished); lastSend = now; }
  if (finished) { running = false; return; }
  setTimeout(tick, 8);
}
self.onmessage = e => {
  const m = e.data || {};
  if (m.type === 'play') {
    const s = m.spec;
    weights = new Float32Array(s.weights);
    sim = DodgeSim.createSim({ seed: s.seed, difficulty: s.cfg && s.cfg.difficulty, charSpeed: s.cfg && s.cfg.charSpeed, spdMax: s.spdMax });
    speed = m.speed || speed; accumulator = 0; last = performance.now(); lastSend = 0; running = true;
    sendFrame(false); tick();
  } else if (m.type === 'pause') running = false;
  else if (m.type === 'speed') speed = Math.max(0.5, Math.min(8, m.speed || 1));
};
self.postMessage({ type: 'ready' });
