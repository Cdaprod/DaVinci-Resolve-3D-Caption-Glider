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

  function visibleHalfWidth(distance, aspect = 1, fovDeg = 50) {
    const fov = Math.max(1e-3, Number(fovDeg) || 50) * Math.PI / 180;
    const asp = Math.max(0.1, Number(aspect) || 1);
    return Math.tan(fov / 2) * Math.max(0, distance) * asp;
  }

  function requiredDistanceForSpan(span, aspect = 1, fovDeg = 50, baseDistance = 1, padding = 0) {
    const safeSpan = Math.max(0, span) + Math.max(0, padding) * 2;
    if (safeSpan === 0) return baseDistance;

    const fov = Math.max(1e-3, Number(fovDeg) || 50) * Math.PI / 180;
    const asp = Math.max(0.1, Number(aspect) || 1);
    const denom = Math.tan(fov / 2) * asp;
    if (!isFinite(denom) || denom <= 0) return baseDistance;

    const needed = (safeSpan / 2) / denom;
    return Math.max(baseDistance, needed);
  }

  function stripControlTokens(text = '') {
    let pauseMs = 0;
    let holdMs = 0;
    let out = String(text || '');

    out = out.replace(/\[PAUSE\s*=\s*(\d+)\]/gi, (_, ms) => {
      pauseMs += Number(ms) || 0;
      return ' ';
    });

    out = out.replace(/\[HOLD\s*=\s*(\d+)\]/gi, (_, ms) => {
      holdMs += Number(ms) || 0;
      return ' ';
    });

    return { text: out.trim(), pauseMs, holdMs };
  }

  function normalizeProfileToken(token = '') {
    const trimmed = String(token || '').trim();
    if (!trimmed) return 'default';
    return trimmed.length === 1 ? trimmed.toUpperCase() : trimmed.toLowerCase();
  }

  function parseScriptLines(rawLines = [], defaultProfileId = 'default') {
    const segments = [];
    let activeProfile = normalizeProfileToken(defaultProfileId);
    let pendingPause = 0;
    let pendingHold = 0;

    for (const raw of rawLines || []) {
      const line = String(raw ?? '').trim();
      if (!line) continue;

      let content = line;
      const directive = content.match(/^#([A-Za-z0-9_-]+)(?:\s+(.+))?$/);
      if (directive) {
        activeProfile = normalizeProfileToken(directive[1]);
        content = (directive[2] || '').trim();
      }

      const { text, pauseMs, holdMs } = stripControlTokens(content);
      if (!text) {
        pendingPause += pauseMs;
        pendingHold += holdMs;
        continue;
      }

      segments.push({
        profileId: activeProfile,
        text,
        pauseMs: pendingPause + pauseMs,
        holdMs: pendingHold + holdMs,
      });

      pendingPause = 0;
      pendingHold = 0;
    }

    return segments;
  }

  function extractEmphasisToken(wordText = '') {
    const isEmphasized = /\*\*(.+?)\*\*/.test(wordText);
    const cleanText = String(wordText).replace(/\*\*/g, '') || String(wordText || '').trim();
    return { cleanText, isEmphasized };
  }

  return {
    clamp01,
    easeOutCubic,
    easeOutBack,
    damp,
    computeCenterBounds,
    endBias,
    visibleHalfWidth,
    requiredDistanceForSpan,
    extractEmphasisToken,
    parseScriptLines,
  };
});
