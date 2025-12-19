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

  function buildTextGeometrySpec(textSize = 0.1, textDepth = 0.001) {
    const size = Math.max(1e-4, Number(textSize) || 0.1);
    const depth = Math.max(0, Number(textDepth) || 0);
    const bevelEnabled = depth >= 0.002;

    const curveSegments = Math.max(4, Math.min(12, Math.round(size * 80)));
    const bevelSize = bevelEnabled ? Math.min(size * 0.06, depth * 0.8) : 0;
    const bevelThickness = bevelEnabled ? Math.min(depth * 0.75, 0.02) : 0;
    const bevelSegments = bevelEnabled ? 3 : 0;

    return {
      size,
      height: depth,
      curveSegments,
      bevelEnabled,
      bevelSize,
      bevelThickness,
      bevelSegments,
    };
  }

  function damp(current, target, lambda, dt) {
    return current + (target - current) * (1 - Math.exp(-lambda * dt));
  }

  function isValidFontResource(font) {
    if (!font || typeof font !== 'object') return false;
    const data = font.data;
    if (!data || typeof data !== 'object') return false;
    const hasGlyphs = !!data.glyphs && typeof data.glyphs === 'object';
    const hasResolution = typeof data.resolution === 'number' && isFinite(data.resolution);
    return hasGlyphs && hasResolution;
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
    let breaks = 0;
    let out = String(text || '');

    out = out.replace(/\[PAUSE\s*=\s*(\d+)\]/gi, (_, ms) => {
      pauseMs += Number(ms) || 0;
      return ' ';
    });

    out = out.replace(/\[HOLD\s*=\s*(\d+)\]/gi, (_, ms) => {
      holdMs += Number(ms) || 0;
      return ' ';
    });

    out = out.replace(/\[(BREAK|BR)(?:\s*=\s*(\d+))?\]/gi, (_, __, count) => {
      const n = Number(count);
      breaks += isFinite(n) && n > 0 ? Math.floor(n) : 1;
      return ' ';
    });

    return { text: out.trim(), pauseMs, holdMs, breaks };
  }

  function sanitizePersistedState(defaults = {}, stored = {}) {
    const base = (defaults && typeof defaults === 'object') ? defaults : {};
    const src = (stored && typeof stored === 'object') ? stored : {};
    const out = {};

    for (const [key, defVal] of Object.entries(base)) {
      if (!(key in src)) continue;
      const val = src[key];

      if (typeof defVal === 'number') {
        const num = Number(val);
        if (isFinite(num)) out[key] = num;
      } else if (typeof defVal === 'boolean') {
        if (typeof val === 'boolean') out[key] = val;
        else if (typeof val === 'string') out[key] = val.toLowerCase() === 'true';
        else if (typeof val === 'number') out[key] = !!val;
      } else if (typeof defVal === 'string') {
        if (val !== undefined && val !== null) out[key] = String(val);
      } else if (val !== undefined) {
        out[key] = val;
      }
    }

    return out;
  }

  function normalizePersistedPayload(raw) {
    if (raw == null) return null;
    if (typeof raw === 'string') {
      try { return normalizePersistedPayload(JSON.parse(raw)); } catch (_) { return null; }
    }

    if (typeof raw !== 'object') return null;

    if (raw.captioner_state_v1) {
      const inner = normalizePersistedPayload(raw.captioner_state_v1);
      if (inner) return inner;
    }

    return raw;
  }

  function normalizeProfileToken(token = '') {
    const trimmed = String(token || '').trim();
    if (!trimmed) return 'default';
    return trimmed.length === 1 ? trimmed.toUpperCase() : trimmed.toLowerCase();
  }

  const DEFAULT_TYPOGRAPHY_PROFILE_ID = 'manual';

  const TYPOGRAPHY_PROFILES = {
    manual: {
      id: 'manual',
      label: 'Manual (use cfg values)',
      settings: {},
    },
    'epic-title': {
      id: 'epic-title',
      label: 'Epic title card (Cinzel + wide tracking)',
      settings: {
        fontId: 'cinzel',
        textSize: 0.12,
        textDepth: 0.006,
        spaceMultiplier: 2.4,
        stackLineGap: 0.28,
        revealStyle: 'bloom',
      },
    },
    'modern-action': {
      id: 'modern-action',
      label: 'Modern action (Bebas Neue, tight spacing)',
      settings: {
        fontId: 'bebas-neue',
        textSize: 0.14,
        textDepth: 0.004,
        spaceMultiplier: 1.65,
        stackLineGap: 0.18,
        revealStyle: 'slide-up',
      },
    },
    'elegant-luxury': {
      id: 'elegant-luxury',
      label: 'Elegant luxury (Playfair, airy)',
      settings: {
        fontId: 'playfair-display',
        textSize: 0.1,
        textDepth: 0.003,
        spaceMultiplier: 2.8,
        stackLineGap: 0.32,
        revealStyle: 'grow-up',
      },
    },
    'sci-fi-tech': {
      id: 'sci-fi-tech',
      label: 'Sci-fi tech (Orbitron, balanced spacing)',
      settings: {
        fontId: 'orbitron',
        textSize: 0.12,
        textDepth: 0.0045,
        spaceMultiplier: 1.9,
        stackLineGap: 0.22,
        revealStyle: 'grow-up',
      },
    },
  };

  function applyTypographyProfile(cfg = {}, profileId = DEFAULT_TYPOGRAPHY_PROFILE_ID) {
    const activeId = TYPOGRAPHY_PROFILES[profileId]?.id || DEFAULT_TYPOGRAPHY_PROFILE_ID;
    const patch = TYPOGRAPHY_PROFILES[activeId]?.settings || {};
    const merged = { ...cfg, ...patch, typographyProfile: activeId };
    return { profileId: activeId, cfg: merged };
  }

  function parseScriptLines(rawLines = [], defaultProfileId = 'default') {
    const segments = [];
    let activeProfile = normalizeProfileToken(defaultProfileId);
    let pendingPause = 0;
    let pendingHold = 0;
    let pendingBreaks = 0;

    for (const raw of rawLines || []) {
      const line = String(raw ?? '').trim();
      if (!line) continue;

      let content = line;
      const directive = content.match(/^#([A-Za-z0-9_-]+)(?:\s+(.+))?$/);
      if (directive) {
        activeProfile = normalizeProfileToken(directive[1]);
        content = (directive[2] || '').trim();
      }

      const { text, pauseMs, holdMs, breaks } = stripControlTokens(content);
      pendingBreaks += breaks;
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
        breaks: pendingBreaks,
      });

      pendingPause = 0;
      pendingHold = 0;
      pendingBreaks = 0;
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
    isValidFontResource,
    computeCenterBounds,
    endBias,
    visibleHalfWidth,
    requiredDistanceForSpan,
    extractEmphasisToken,
    buildTextGeometrySpec,
    sanitizePersistedState,
    normalizePersistedPayload,
    parseScriptLines,
    stripControlTokens,
    normalizeProfileToken,
    TYPOGRAPHY_PROFILES,
    DEFAULT_TYPOGRAPHY_PROFILE_ID,
    applyTypographyProfile,
  };
});
