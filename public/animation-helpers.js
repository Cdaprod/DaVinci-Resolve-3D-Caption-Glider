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

  function smoothstep(edge0, edge1, x) {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  }

  function applyGamma(value, gamma = 1) {
    const safe = Math.max(0.0001, Number(gamma) || 1);
    return Math.pow(clamp01(value), safe);
  }

  function baselineFade(p, fadeStart = 0.02, fadeEnd = 0.34, gamma = 1) {
    const start = Math.max(0, Number(fadeStart) || 0);
    const end = Math.max(start + 1e-3, Number(fadeEnd) || 0);
    const eased = smoothstep(start, end, clamp01(p));
    return applyGamma(eased, gamma);
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

    function normalizeTextAlign(align = 'center') {
      const val = String(align ?? 'center').toLowerCase();
      return ['left', 'center', 'right'].includes(val) ? val : 'center';
    }

    function lineAlignmentOffset(totalWidth = 0, align = 'center') {
      const width = Math.max(0, Number(totalWidth) || 0);
      if (width <= 0) return 0;
      const a = normalizeTextAlign(align);
      if (a === 'left') return 0;
      if (a === 'right') return -width;
      return -width / 2;
    }

  function damp(current, target, lambda, dt) {
    return current + (target - current) * (1 - Math.exp(-lambda * dt));
  }

  function computeAnimationTime(currentTimeSec, startTimeSec, options = {}) {
    const { speed = 1, delayMs = 0 } = options || {};
    const start = Number(startTimeSec) || 0;
    const safeSpeed = Math.max(0.01, Number(speed) || 1);
    const delaySec = Math.max(0, Number(delayMs) || 0) / 1000;
    const rel = (Number(currentTimeSec) || 0) - start - delaySec;
    return start + (rel * safeSpeed);
  }

  function isValidFontResource(font) {
    if (!font || typeof font !== 'object') return false;
    const data = font.data;
    if (!data || typeof data !== 'object') return false;
    const hasGlyphs = !!data.glyphs && typeof data.glyphs === 'object';
    const hasResolution = typeof data.resolution === 'number' && isFinite(data.resolution);
    return hasGlyphs && hasResolution;
  }

  function normalizeFontResource(font, fallbackResolution = 1000) {
    if (!font || typeof font !== 'object') return font;
    if (!font.data || typeof font.data !== 'object') {
      if (font.glyphs && typeof font.glyphs === 'object') {
        const lifted = { glyphs: font.glyphs };
        if (font.resolution !== undefined) lifted.resolution = font.resolution;
        font.data = lifted;
      } else {
        return font;
      }
    }

    if (!font.data.glyphs && font.glyphs && typeof font.glyphs === 'object') {
      font.data.glyphs = font.glyphs;
    }

    if (typeof font.data.resolution === 'string') {
      const parsed = Number(font.data.resolution);
      if (Number.isFinite(parsed)) {
        font.data.resolution = parsed;
      }
    }

    if (!Number.isFinite(font.data.resolution)) {
      font.data.resolution = fallbackResolution;
    }

    return font;
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

  function parseSrtCues(srtText = '') {
    if (!srtText) return [];
    const text = String(srtText)
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
    if (!text) return [];

    const blocks = text.split(/\n{2,}/).map(block => block.trim()).filter(Boolean);
    const cues = [];
    const timingPattern = /^(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/;

    const toMs = (ts) => {
      const [hh, mm, rest] = ts.split(':');
      const [ss, ms] = rest.split(',');
      return (((Number(hh) * 60 + Number(mm)) * 60) + Number(ss)) * 1000 + Number(ms);
    };

    for (const block of blocks) {
      const lines = block.split('\n');
      if (!lines.length) continue;
      const idxLine = lines[0].trim();
      const hasIndex = /^\d+$/.test(idxLine);
      const timingLine = hasIndex ? (lines[1] || '').trim() : idxLine;
      const match = timingPattern.exec(timingLine);
      if (!match) continue;

      const startMs = toMs(match[1]);
      const endMs = toMs(match[2]);
      const captionLines = lines.slice(hasIndex ? 2 : 1).map(l => l.trim()).filter(Boolean);
      const text = captionLines.join('\n');

      cues.push({ startMs, endMs, text });
    }

    cues.sort((a, b) => a.startMs - b.startMs);
    return cues;
  }

  function classifyTrailingPunctuation(wordText = '') {
    const text = String(wordText || '').trim();
    if (!text) return null;
    if (/[.?!…]+$/.test(text)) return 'sentence';
    if (/[,;:]+$/.test(text)) return 'comma';
    if (/[-—]+$/.test(text)) return 'dash';
    return null;
  }

  function buildCueWordTimings(text = '', startMs = 0, endMs = 0, options = {}) {
    const { punctuationPausesMs = {} } = options || {};
    const tokens = String(text || '').split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    const duration = Math.max(0, Number(endMs) - Number(startMs));
    if (duration <= 0) {
      return tokens.map(token => ({
        text: token,
        startTime: startMs / 1000,
        endTime: startMs / 1000,
      }));
    }

    const weights = tokens.map(token => Math.max(1, token.replace(/[^\w]/g, '').length || token.length));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0) || tokens.length;
    const baseUnit = totalWeight > 0 ? duration / totalWeight : 0;
    const rawDurations = tokens.map((token, idx) => {
      const base = weights[idx] * baseUnit;
      const punctuationClass = classifyTrailingPunctuation(token);
      const pauseMs = punctuationClass === 'sentence'
        ? Number(punctuationPausesMs.sentence || 0)
        : punctuationClass === 'comma'
          ? Number(punctuationPausesMs.comma || 0)
          : punctuationClass === 'dash'
            ? Number(punctuationPausesMs.dash || 0)
            : 0;
      return Math.max(0, base + Math.max(0, pauseMs));
    });
    const totalRaw = rawDurations.reduce((sum, value) => sum + value, 0) || duration;
    const scale = totalRaw > 0 ? duration / totalRaw : 1;
    let cursor = Number(startMs);
    const words = [];

    for (let i = 0; i < tokens.length; i++) {
      const slice = rawDurations[i] * scale;
      const wordStart = cursor;
      const wordEnd = (i === tokens.length - 1) ? Number(endMs) : cursor + slice;
      words.push({
        text: tokens[i],
        startTime: wordStart / 1000,
        endTime: wordEnd / 1000,
      });
      cursor = wordEnd;
    }

    return words;
  }

  function buildLineCameraSegments(words = [], options = {}) {
    const { lineStartSec = 0, totalMs } = options || {};
    const safeWords = Array.isArray(words) ? words : [];
    if (!safeWords.length) {
      return { segments: [], totalMs: Math.max(0, Number(totalMs) || 0) };
    }

    const normalized = safeWords.map((word) => {
      const startSec = Number(word?.startTime ?? 0) - Number(lineStartSec || 0);
      const endSec = Number(word?.endTime ?? startSec) - Number(lineStartSec || 0);
      return {
        text: String(word?.text ?? '').trim(),
        startMs: Math.max(0, startSec * 1000),
        endMs: Math.max(0, endSec * 1000),
      };
    });

    const computedTotalMs = Math.max(
      0,
      Number.isFinite(Number(totalMs)) ? Number(totalMs) : Math.max(...normalized.map(word => word.endMs))
    );

    const breakpoints = [];
    for (let i = 0; i < normalized.length - 1; i++) {
      const punctuation = classifyTrailingPunctuation(normalized[i].text);
      if (punctuation) breakpoints.push(i);
    }

    const segmentEnds = breakpoints.length ? [...breakpoints, normalized.length - 1] : [normalized.length - 1];
    const segments = [];
    let startIdx = 0;
    let prevEndMs = 0;

    for (const endIdx of segmentEnds) {
      const startWord = normalized[startIdx] || normalized[0];
      const endWord = normalized[endIdx];
      const startMs = startIdx === 0 ? 0 : Math.max(prevEndMs, startWord.startMs);
      let endMs = Math.max(startMs + 1, endWord.endMs);
      if (endIdx === normalized.length - 1) {
        endMs = Math.max(endMs, computedTotalMs);
      } else {
        endMs = Math.min(endMs, computedTotalMs);
      }

      segments.push({
        startIdx,
        endIdx,
        startMs,
        endMs,
        isTerminal: endIdx === normalized.length - 1,
      });

      prevEndMs = endMs;
      startIdx = endIdx + 1;
    }

    return { segments, totalMs: computedTotalMs };
  }

  function buildWordEnvelopes(words = [], options = {}) {
    const {
      lineStartSec = 0,
      lineStartMs = 0,
      lineDurationMs,
      overlap = 0.22,
      minWordMs = 70,
      maxWordMs = 320,
      punctuationPausesMs = {},
    } = options || {};

    const safeWords = Array.isArray(words) ? words : [];
    if (!safeWords.length) return [];

    const hasTiming = safeWords.every((word) => Number.isFinite(Number(word?.startTime)) && Number.isFinite(Number(word?.endTime)));
    let baseDurations = [];

    if (hasTiming) {
      baseDurations = safeWords.map((word) => {
        const start = Number(word.startTime) - Number(lineStartSec || 0);
        const end = Number(word.endTime) - Number(lineStartSec || 0);
        return Math.max(0, (end - start) * 1000);
      });
    } else {
      const weights = safeWords.map(word => Math.max(1, String(word?.text || '').replace(/[^\w]/g, '').length || String(word?.text || '').length));
      const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;
      const targetMs = Math.max(0, Number(lineDurationMs) || 0);
      const baseUnit = targetMs > 0 ? targetMs / totalWeight : 120;
      baseDurations = weights.map(weight => weight * baseUnit);
    }

    const durationsWithPunctuation = baseDurations.map((duration, idx) => {
      const punctuationClass = classifyTrailingPunctuation(safeWords[idx]?.text || '');
      const pauseMs = punctuationClass === 'sentence'
        ? Number(punctuationPausesMs.sentence || 0)
        : punctuationClass === 'comma'
          ? Number(punctuationPausesMs.comma || 0)
          : punctuationClass === 'dash'
            ? Number(punctuationPausesMs.dash || 0)
            : 0;
      return Math.max(0, duration + Math.max(0, pauseMs));
    });

    const totalNominal = durationsWithPunctuation.reduce((sum, ms) => sum + ms, 0) || 1;
    const targetDuration = Number.isFinite(Number(lineDurationMs)) ? Math.max(1, Number(lineDurationMs)) : totalNominal;
    const scaled = durationsWithPunctuation.map((duration) => {
      const scaledMs = duration * (targetDuration / totalNominal);
      return Math.max(minWordMs, Math.min(maxWordMs, scaledMs));
    });

    const scaledTotal = scaled.reduce((sum, ms) => sum + ms, 0) || 1;
    const finalDurations = scaledTotal > targetDuration
      ? scaled.map(ms => ms * (targetDuration / scaledTotal))
      : scaled;

    const envelopes = [];
    let cursor = Math.max(0, Number(lineStartMs) || 0);
    for (const duration of finalDurations) {
      const endMs = cursor + duration;
      envelopes.push({
        startMs: cursor,
        endMs,
      });
      const advance = duration * (1 - Math.max(0, Math.min(0.6, overlap)));
      cursor += advance;
    }

    const hardEnd = Math.max(0, Number(lineStartMs) || 0) + targetDuration;
    const lastEnd = envelopes.length ? envelopes[envelopes.length - 1].endMs : hardEnd;
    if (lastEnd > hardEnd && envelopes.length) {
      const scale = targetDuration / (lastEnd - (Number(lineStartMs) || 0));
      for (const env of envelopes) {
        env.startMs = (Number(lineStartMs) || 0) + (env.startMs - (Number(lineStartMs) || 0)) * scale;
        env.endMs = (Number(lineStartMs) || 0) + (env.endMs - (Number(lineStartMs) || 0)) * scale;
      }
    }

    return envelopes;
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

  function patchNoiseShaderSources(vertexShader = '', fragmentShader = '') {
    const vNoiseDecl = 'varying vec2 vNoiseUv;';
    let vtx = String(vertexShader || '');
    let frag = String(fragmentShader || '');

    if (!vtx.includes('vNoiseUv')) {
      if (vtx.includes('varying vec2 vUv;')) {
        vtx = vtx.replace('varying vec2 vUv;', `varying vec2 vUv;\n${vNoiseDecl}`);
      } else {
        vtx = `${vNoiseDecl}\n${vtx}`;
      }

      if (vtx.includes('#include <begin_vertex>')) {
        vtx = vtx.replace('#include <begin_vertex>', `#include <begin_vertex>\n  vNoiseUv = position.xy;`);
      } else {
        vtx = vtx.replace('void main() {', 'void main() {\n  vNoiseUv = position.xy;');
      }
    }

    if (!frag.includes('vNoiseUv')) {
      if (frag.includes('varying vec2 vUv;')) {
        frag = frag.replace('varying vec2 vUv;', `varying vec2 vUv;\n${vNoiseDecl}`);
      } else {
        frag = `${vNoiseDecl}\n${frag}`;
      }
    }

    const noiseSnippet = `
        #include <map_fragment>
        vec2 noiseUv = vNoiseUv * uNoiseScale;
        float noise = texture2D(uNoiseMap, noiseUv).r;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.92 + noise * 0.16), uNoiseStrength);
        `;

    if (frag.includes('#include <map_fragment>')) {
      frag = frag.replace('#include <map_fragment>', noiseSnippet);
    } else if (!frag.includes('uNoiseMap')) {
      frag = `${frag}\n${noiseSnippet}`;
    }

    return { vertexShader: vtx, fragmentShader: frag };
  }

  return {
    clamp01,
    easeOutCubic,
    easeOutBack,
    smoothstep,
    applyGamma,
    baselineFade,
    damp,
    computeAnimationTime,
    isValidFontResource,
    normalizeFontResource,
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
    parseSrtCues,
    buildCueWordTimings,
    classifyTrailingPunctuation,
    buildLineCameraSegments,
    buildWordEnvelopes,
    normalizeProfileToken,
    normalizeTextAlign,
    lineAlignmentOffset,
    patchNoiseShaderSources,
    TYPOGRAPHY_PROFILES,
    DEFAULT_TYPOGRAPHY_PROFILE_ID,
    applyTypographyProfile,
  };
});
