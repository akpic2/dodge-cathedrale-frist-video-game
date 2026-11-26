(function (root) {
  const Sim = (typeof DodgeSim !== 'undefined') ? DodgeSim : require('../sim.js');
  // v2 : pas fixe 1/60 (refonte Mote). Une sauvegarde d'un autre pas ne rejoue pas les mêmes parties.
  const VERSION = 2;
  const INCOMPATIBLE_MSG = 'Sauvegarde d\'une ancienne version du jeu — incompatible';
  const DB_NAME = 'dodge-ia', STORE = 'runs', KEY = 'current';

  function bytesToB64(bytes) {
    if (typeof btoa === 'function') {
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s);
    }
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  function b64ToBytes(str) {
    if (typeof atob === 'function') {
      const s = atob(str), out = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
      return out;
    }
    const b = Buffer.from(str, 'base64');
    return new Uint8Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  }
  function f32ToB64(f) { return bytesToB64(new Uint8Array(f.buffer, f.byteOffset, f.byteLength)); }
  function b64ToF32(str) {
    const bytes = b64ToBytes(str);
    if (bytes.length % 4 !== 0) throw new Error('sauvegarde invalide : poids tronqués');
    return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
  }

  // Encodage récursif, sans muter l'entrée : Float32Array -> {__f32}, nombres non finis -> {__num}.
  function enc(v) {
    if (v instanceof Float32Array) return { __f32: f32ToB64(v) };
    if (typeof v === 'number' && !isFinite(v)) return { __num: v !== v ? 'NaN' : (v > 0 ? 'Infinity' : '-Infinity') };
    if (Array.isArray(v)) return v.map(enc);
    if (v && typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v)) o[k] = enc(v[k]);
      return o;
    }
    return v;
  }
  function dec(v) {
    if (Array.isArray(v)) return v.map(dec);
    if (v && typeof v === 'object') {
      if (typeof v.__f32 === 'string') return b64ToF32(v.__f32);
      if (typeof v.__num === 'string') {
        if (v.__num === 'Infinity') return Infinity;
        if (v.__num === '-Infinity') return -Infinity;
        if (v.__num === 'NaN') return NaN;
        throw new Error('sauvegarde invalide : nombre inconnu');
      }
      const o = {};
      for (const k of Object.keys(v)) o[k] = dec(v[k]);
      return o;
    }
    return v;
  }

  function serialize(state) { return { version: VERSION, dt: Sim.DT, state: enc(state) }; }

  function incompatible() {
    const e = new Error(INCOMPATIBLE_MSG);
    e.code = 'incompatible';
    return e;
  }

  function deserialize(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('sauvegarde invalide : format inattendu');
    if (obj.version !== VERSION || obj.dt !== Sim.DT) throw incompatible();
    const s = obj.state;
    if (!s || typeof s !== 'object' || !Array.isArray(s.population) || !Array.isArray(s.history) ||
        !Array.isArray(s.notables) || s.gen === undefined || s.rngState === undefined) {
      throw new Error('sauvegarde invalide : champs manquants');
    }
    return dec(s);
  }

  // --- IndexedDB (navigateur uniquement ; rien n'est touché au chargement du module) ---
  function openDB() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponible'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('ouverture de la base impossible'));
    });
  }
  async function saveToIDB(state) {
    const db = await openDB();
    const data = serialize(state);
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(data, KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('écriture impossible'));
        tx.onabort = () => reject(tx.error || new Error('écriture annulée'));
      });
    } finally { db.close(); }
  }
  async function loadFromIDB() {
    const db = await openDB();
    try {
      const data = await new Promise((resolve, reject) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('lecture impossible'));
      });
      return data === undefined ? null : deserialize(data);
    } finally { db.close(); }
  }

  // --- Fichier JSON ---
  function exportFile(state) {
    const json = JSON.stringify(serialize(state));
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dodge-ia-gen' + state.gen + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function importFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error('lecture du fichier impossible'));
      r.onload = () => {
        let obj;
        try { obj = JSON.parse(r.result); } catch (e) { return reject(new Error('fichier invalide : JSON illisible')); }
        try { resolve(deserialize(obj)); } catch (e) { reject(e); }
      };
      r.readAsText(file);
    });
  }

  const DodgeStorage = { VERSION, INCOMPATIBLE_MSG, serialize, deserialize, saveToIDB, loadFromIDB, exportFile, importFile };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeStorage; else root.DodgeStorage = DodgeStorage;
})(typeof self !== 'undefined' ? self : globalThis);
