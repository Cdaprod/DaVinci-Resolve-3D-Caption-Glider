/**
 * Shared animation helpers for the caption demo.
 * Usage:
 *   In browser: include <script src="./animation-helpers.js"></script> then use `AnimationHelpers.clamp01(...)`.
 *   In Node tests: `const { clamp01 } = require('../public/animation-helpers');`
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AnimationHelpers = factory();
  }
})(this, function () {
  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function easeOutCubic(t) {
    t = clamp01(t);
    return 1 - Math.pow(1 - t, 3);
  }

  function easeOutBack(t, overshoot = 0.30) {
    t = clamp01(t);
    const c1 = 1.70158 + overshoot * 2.0;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function damp(current, target, lambda, dt) {
    return current + (target - current) * (1 - Math.exp(-lambda * dt));
  }

  function computeCenterBounds(centers) {
    let minX = Infinity;
    let maxX = -Infinity;
    for (const c of centers || []) {
      if (typeof c?.x === 'number') {
        if (c.x < minX) minX = c.x;
        if (c.x > maxX) maxX = c.x;
      }
    }
    return { minX, maxX };
  }

  function endBias(u, maxBias) {
    const t = clamp01((u - 0.75) / 0.25);
    const e = easeOutCubic(t);
    return e * maxBias;
  }

  return {
    clamp01,
    easeOutCubic,
    easeOutBack,
    damp,
    computeCenterBounds,
    endBias,
  };
});
