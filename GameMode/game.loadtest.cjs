// Load smoke-test: executes game.js in a mocked browser context to catch
// load-time crashes (temporal dead zone, undefined references) that a syntax
// check can't. Runs as part of `npm test`. Exits non-zero on any load error.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const dir = __dirname;

// Universal, never-throwing DOM stub: callable, iterable-as-empty, and every
// property access returns another universal stub.
function universal() {
  const f = function () { return universal(); };
  return new Proxy(f, {
    get(t, p) {
      if (p === Symbol.iterator) return function* () {};
      if (p === 'length') return 0;
      if (p === 'forEach') return () => {};
      if (p === 'classList') return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      if (p === 'hidden' || p === 'checked' || p === 'disabled') return false;
      if (p === 'value' || p === 'textContent' || p === 'innerHTML' || p === 'className' || p === 'tagName') return '';
      if (p === 'childElementCount' || p === 'offsetWidth' || p === 'offsetHeight') return 0;
      if (p === 'dataset') return {};
      return universal();
    },
    apply() { return universal(); },
    set() { return true; },
  });
}

const dclHandlers = [];
const documentMock = {
  getElementById: () => universal(),
  querySelector: () => universal(),
  querySelectorAll: () => [],
  createElement: () => universal(),
  createElementNS: () => universal(),
  addEventListener: (type, fn) => { if (type === 'DOMContentLoaded' && typeof fn === 'function') dclHandlers.push(fn); },
  removeEventListener: () => {},
  body: universal(),
  documentElement: universal(),
};

const store = {};
const localStorageMock = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const engine = require(path.join(dir, 'engine.js'));

const ctx = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean,
  isFinite, isNaN, parseInt, parseFloat, Set, Map, WeakMap, Promise, RegExp,
  Error, Symbol, Proxy, Reflect, TextEncoder, TextDecoder, Buffer,
  document: documentMock,
  localStorage: localStorageMock,
  navigator: { userAgent: 'node' },
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  setTimeout: () => 0,
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  performance: { now: () => 0 },
  innerWidth: 1024, innerHeight: 768, devicePixelRatio: 1,
  addEventListener: () => {},
  removeEventListener: () => {},
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  Audio: function () { return universal(); },
  AudioContext: function () { return universal(); },
};
ctx.window = ctx;
ctx.self = ctx;
ctx.globalThis = ctx;
ctx.window.ChronosEngine = engine;
ctx.window.anime = undefined;

vm.createContext(ctx);
const code = fs.readFileSync(path.join(dir, 'game.js'), 'utf8');
try {
  vm.runInContext(code, ctx, { filename: 'game.js' });
  dclHandlers.forEach((fn) => fn());
} catch (e) {
  console.error('✗ game.js load smoke-test FAILED: ' + e.message);
  console.error((e.stack || '').split('\n').slice(0, 5).join('\n'));
  process.exit(1);
}

// Sanity: the public surfaces must have been exported by a full run.
const problems = [];
if (typeof ctx.window.ChronosGame !== 'object') problems.push('window.ChronosGame not exported (IIFE did not reach the bottom)');
if (typeof ctx.window.ChronosIdentity !== 'object') problems.push('window.ChronosIdentity not exported');
if (problems.length) {
  console.error('✗ game.js load smoke-test FAILED:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('✓ game.js load smoke-test passed (IIFE executed cleanly, public API exported)');
