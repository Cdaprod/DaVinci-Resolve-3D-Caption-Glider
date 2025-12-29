// Basic checks for animation helper utilities.
// Run with: node tests/animation-helpers.test.js
// Example: `node tests/animation-helpers.test.js`

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  clamp01,
  computeCenterBounds,
  endBias,
  extractEmphasisToken,
  parseScriptLines,
  stripControlTokens,
  normalizeProfileToken,
  visibleHalfWidth,
  requiredDistanceForSpan,
    sanitizePersistedState,
    normalizePersistedPayload,
    buildTextGeometrySpec,
    TYPOGRAPHY_PROFILES,
    DEFAULT_TYPOGRAPHY_PROFILE_ID,
    applyTypographyProfile,
    isValidFontResource,
    normalizeTextAlign,
    lineAlignmentOffset,
    parseSrtCues,
    buildCueWordTimings,
  } = require('../public/animation-helpers');

function testClamp01() {
  assert.strictEqual(clamp01(-1), 0);
  assert.strictEqual(clamp01(0.5), 0.5);
  assert.strictEqual(clamp01(2), 1);
}

function testIsValidFontResource() {
  const valid = { data: { glyphs: { ' ': { ha: 20 } }, resolution: 512 } };
  assert.strictEqual(isValidFontResource(valid), true);

  assert.strictEqual(isValidFontResource(null), false);
  assert.strictEqual(isValidFontResource({}), false);
  assert.strictEqual(isValidFontResource({ data: { glyphs: {} } }), false);
  assert.strictEqual(isValidFontResource({ data: { glyphs: {}, resolution: 'bad' } }), false);
}

function testComputeCenterBounds() {
  const centers = [{ x: -2 }, { x: 4 }, { x: 1 }];
  const { minX, maxX } = computeCenterBounds(centers);
  assert.strictEqual(minX, -2);
  assert.strictEqual(maxX, 4);
}

function testEndBias() {
  assert.strictEqual(endBias(0.6, 0.2), 0); // before bias window
  const nearEnd = endBias(1, 0.2);
  assert(nearEnd <= 0.2 + 1e-9 && nearEnd >= 0.19, 'bias should reach near max');
}

function testExtractEmphasisToken() {
  const emph = extractEmphasisToken('**Bold**');
  assert.strictEqual(emph.cleanText, 'Bold');
  assert.strictEqual(emph.isEmphasized, true);

  const plain = extractEmphasisToken('steady');
  assert.strictEqual(plain.cleanText, 'steady');
  assert.strictEqual(plain.isEmphasized, false);
}

function testParseScriptLines() {
  const lines = [
    'Opening line',
    '#B Second line [PAUSE=120]',
    '[HOLD=200]',
    '#C Third line **bold** word',
    '',
  ];

  const segments = parseScriptLines(lines, 'default');
  assert.strictEqual(segments.length, 3);

  assert.deepStrictEqual(segments[0], {
    profileId: 'default',
    text: 'Opening line',
    pauseMs: 0,
    holdMs: 0,
    breaks: 0,
  });

  assert.deepStrictEqual(segments[1], {
    profileId: 'B',
    text: 'Second line',
    pauseMs: 120,
    holdMs: 0,
    breaks: 0,
  });

  assert.deepStrictEqual(segments[2], {
    profileId: 'C',
    text: 'Third line **bold** word',
    pauseMs: 0,
    holdMs: 200,
    breaks: 0,
  });
}

function testStripControlTokens() {
  const { text, pauseMs, holdMs } = stripControlTokens('Lead [PAUSE=150] space [HOLD=220] end');
  assert.strictEqual(text, 'Lead   space   end');
  assert.strictEqual(pauseMs, 150);
  assert.strictEqual(holdMs, 220);

  const empty = stripControlTokens('[PAUSE=10][HOLD=5]');
  assert.strictEqual(empty.text, '');
  assert.strictEqual(empty.pauseMs, 10);
  assert.strictEqual(empty.holdMs, 5);
  assert.strictEqual(empty.breaks, 0);

  const breaksOnly = stripControlTokens('[BREAK][BR=2]');
  assert.strictEqual(breaksOnly.text, '');
  assert.strictEqual(breaksOnly.breaks, 3);
}

  function testNormalizeProfileToken() {
    assert.strictEqual(normalizeProfileToken('a'), 'A');
    assert.strictEqual(normalizeProfileToken('B '), 'B');
    assert.strictEqual(normalizeProfileToken('default'), 'default');
    assert.strictEqual(normalizeProfileToken(''), 'default');
  }

  function testNormalizeTextAlignHelper() {
    assert.strictEqual(normalizeTextAlign('LEFT'), 'left');
    assert.strictEqual(normalizeTextAlign('Center'), 'center');
    assert.strictEqual(normalizeTextAlign('right'), 'right');
    assert.strictEqual(normalizeTextAlign('unknown'), 'center');
  }

  function testLineAlignmentOffsetHelper() {
    assert.strictEqual(lineAlignmentOffset(4, 'center'), -2);
    assert.strictEqual(lineAlignmentOffset(4, 'left'), 0);
    assert.strictEqual(lineAlignmentOffset(4, 'right'), -4);
    assert.strictEqual(lineAlignmentOffset(-10, 'right'), 0);
  }

function testParseScriptLinesDefaultFirst() {
  const lines = [
    'Default start with no marker',
    '#A Calm dolly line',
    '[PAUSE=220]',
    '#B',
    'Assertive punch lands here',
    '[HOLD=320]',
    '#C Dramatic settle widens the lens',
    '#default Return to the glide',
  ];

  const segments = parseScriptLines(lines, 'default');
  assert.strictEqual(segments.length, 5);

  assert.deepStrictEqual(segments[0], {
    profileId: 'default',
    text: 'Default start with no marker',
    pauseMs: 0,
    holdMs: 0,
    breaks: 0,
  });

  assert.deepStrictEqual(segments[1], {
    profileId: 'A',
    text: 'Calm dolly line',
    pauseMs: 0,
    holdMs: 0,
    breaks: 0,
  });

  assert.deepStrictEqual(segments[2], {
    profileId: 'B',
    text: 'Assertive punch lands here',
    pauseMs: 220,
    holdMs: 0,
    breaks: 0,
  });

  assert.deepStrictEqual(segments[3], {
    profileId: 'C',
    text: 'Dramatic settle widens the lens',
    pauseMs: 0,
    holdMs: 320,
    breaks: 0,
  });

  assert.deepStrictEqual(segments[4], {
    profileId: 'default',
    text: 'Return to the glide',
    pauseMs: 0,
    holdMs: 0,
    breaks: 0,
  });
}

function testBreakTokensAccumulate() {
  const lines = [
    'First paragraph line',
    '[BREAK]',
    '#B Second block',
    'Inline break here [BR=2] then text',
  ];

  const segments = parseScriptLines(lines, 'default');
  assert.strictEqual(segments.length, 3);
  assert.strictEqual(segments[1].breaks, 1);
  assert.strictEqual(segments[2].breaks, 2);
}

function testVisibleHalfWidth() {
  const half = visibleHalfWidth(3.5, 1, 50);
  assert(half > 1 && half < 3, 'visible half width should scale with distance and fov');
}

function testRequiredDistanceForSpan() {
  const base = 2;
  const needed = requiredDistanceForSpan(4, 1, 50, base, 0.2);
  assert(needed >= base, 'distance should never shrink below base');
  const tighter = requiredDistanceForSpan(1, 1, 50, base, 0);
  assert.strictEqual(tighter, base, 'small spans should use base distance');
}

function testBuildTextGeometrySpec() {
  const thin = buildTextGeometrySpec(0.1, 0.001);
  assert.strictEqual(thin.bevelEnabled, false);
  assert(thin.curveSegments >= 4 && thin.curveSegments <= 12);
  assert.strictEqual(thin.height, 0.001);

  const deep = buildTextGeometrySpec(0.1, 0.006);
  assert.strictEqual(deep.bevelEnabled, true);
  assert(deep.bevelSize > 0);
  assert(deep.bevelThickness > 0);
  assert(deep.bevelThickness <= 0.02);
  assert(deep.bevelSegments >= 3);
}

function testTypographyProfiles() {
  assert.ok(TYPOGRAPHY_PROFILES['epic-title']);
  const base = { textSize: 0.1, textDepth: 0.001, spaceMultiplier: 1.82 };
  const applied = applyTypographyProfile(base, 'epic-title');

  assert.strictEqual(applied.profileId, 'epic-title');
  assert.strictEqual(applied.cfg.typographyProfile, 'epic-title');
  assert(applied.cfg.textDepth > base.textDepth, 'epic profile should deepen extrusion');
  assert(applied.cfg.spaceMultiplier > base.spaceMultiplier, 'epic profile should widen tracking');

  const fallback = applyTypographyProfile(base, 'unknown-profile');
  assert.strictEqual(fallback.profileId, DEFAULT_TYPOGRAPHY_PROFILE_ID);
  assert.strictEqual(fallback.cfg.typographyProfile, DEFAULT_TYPOGRAPHY_PROFILE_ID);
}

function testSanitizePersistedState() {
  const defaults = { num: 1, flag: false, text: 'hi', ignored: 5 };
  const stored = { num: '2.5', flag: 'true', text: 99, extra: 'drop' };
  const cleaned = sanitizePersistedState(defaults, stored);
  assert.deepStrictEqual(cleaned, { num: 2.5, flag: true, text: '99' });

  const empty = sanitizePersistedState(defaults, null);
  assert.deepStrictEqual(empty, {});
}

function testNormalizePersistedPayload() {
  const raw = {
    captioner_state_v1: JSON.stringify({ cfg: { followLambda: 12 }, wpl: 7 }),
  };
  const parsed = normalizePersistedPayload(raw);
  assert.deepStrictEqual(parsed, { cfg: { followLambda: 12 }, wpl: 7 });

  const nested = normalizePersistedPayload('{"cfg":{"fontId":"helvetiker"}}');
  assert.deepStrictEqual(nested, { cfg: { fontId: 'helvetiker' } });

  assert.strictEqual(normalizePersistedPayload(5), null);
}

function testParseSrtCues() {
  const srt = [
    '1',
    '00:00:01,000 --> 00:00:02,500',
    'Hello world',
    '',
    '2',
    '00:00:03,000 --> 00:00:04,000',
    'Second line',
    '',
  ].join('\n');
  const cues = parseSrtCues(srt);
  assert.strictEqual(cues.length, 2);
  assert.deepStrictEqual(cues[0], { startMs: 1000, endMs: 2500, text: 'Hello world' });
  assert.deepStrictEqual(cues[1], { startMs: 3000, endMs: 4000, text: 'Second line' });
}

function testBuildCueWordTimings() {
  const words = buildCueWordTimings('Hello world', 0, 1000);
  assert.strictEqual(words.length, 2);
  assert.strictEqual(words[0].text, 'Hello');
  assert.strictEqual(words[1].text, 'world');
  assert(words[0].startTime >= 0);
  assert(words[1].endTime <= 1);
}

function testSeedFilesAreCleanObjects() {
  const seeds = [
    path.join(__dirname, '..', 'public', 'localStorage.json'),
    path.join(__dirname, '..', 'public', 'alternate-test-versions', 'localStorage.json'),
  ];

  for (const seedPath of seeds) {
    if (!fs.existsSync(seedPath)) continue;
    const data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    assert.strictEqual(typeof data.captioner_state_v1, 'object', `${seedPath} captioner_state_v1 should be an object payload`);
      assert.strictEqual(typeof data.captioner_state_v1.cfg, 'object', `${seedPath} cfg should be an object`);
      assert.strictEqual(typeof data.captioner_state_v1.wpl, 'number', `${seedPath} wpl should be numeric`);
      assert.strictEqual(typeof data.captioner_state_v1.cfg.revealStyle, 'string', `${seedPath} revealStyle should be string`);
      assert.strictEqual(typeof data.captioner_state_v1.cfg.theme, 'string', `${seedPath} theme should be string`);
      assert.strictEqual(typeof data.captioner_state_v1.cfg.typographyProfile, 'string', `${seedPath} typographyProfile should be string`);
      assert.strictEqual(typeof data.captioner_state_v1.cfg.textAlign, 'string', `${seedPath} textAlign should be string`);
      assert.strictEqual(typeof data.captioner_state_v1.cfg.paragraphGap, 'number', `${seedPath} paragraphGap should be numeric`);
      assert.strictEqual(typeof data.captioner_state_v1.captionSource, 'object', `${seedPath} captionSource should be an object`);
      assert.strictEqual(typeof data.captioner_state_v1.captionSource.mode, 'string', `${seedPath} captionSource.mode should be string`);
    }
  }

function testSeedThemesMatchPalettes() {
  const seeds = [
    path.join(__dirname, '..', 'public', 'localStorage.json'),
    path.join(__dirname, '..', 'public', 'alternate-test-versions', 'localStorage.json'),
  ];

  const palettes = {
    light: { backgroundColor: 0xffffff, color: 0x000000 },
    dark:  { backgroundColor: 0x000000, color: 0xffffff },
  };

  for (const seedPath of seeds) {
    if (!fs.existsSync(seedPath)) continue;
    const data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    const cfg = data?.captioner_state_v1?.cfg;
    if (!cfg || typeof cfg.theme !== 'string') continue;
    const palette = palettes[cfg.theme];
    if (!palette) continue;

    assert.strictEqual(
      cfg.backgroundColor,
      palette.backgroundColor,
      `${seedPath} backgroundColor should match ${cfg.theme} palette`
    );
    assert.strictEqual(
      cfg.color,
      palette.color,
      `${seedPath} color should match ${cfg.theme} palette`
    );
  }
}

function run() {
  testClamp01();
  testIsValidFontResource();
  testComputeCenterBounds();
  testEndBias();
  testExtractEmphasisToken();
  testParseScriptLines();
  testParseScriptLinesDefaultFirst();
  testBreakTokensAccumulate();
  testStripControlTokens();
  testNormalizeProfileToken();
  testNormalizeTextAlignHelper();
  testLineAlignmentOffsetHelper();
  testVisibleHalfWidth();
  testRequiredDistanceForSpan();
  testBuildTextGeometrySpec();
  testTypographyProfiles();
  testSanitizePersistedState();
  testNormalizePersistedPayload();
  testParseSrtCues();
  testBuildCueWordTimings();
  testSeedFilesAreCleanObjects();
  testSeedThemesMatchPalettes();
  console.log('animation-helpers: all tests passed');
}

run();
