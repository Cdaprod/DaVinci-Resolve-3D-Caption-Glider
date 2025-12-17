// Basic checks for animation helper utilities.
// Run with: node tests/animation-helpers.test.js
// Example: `node tests/animation-helpers.test.js`

const assert = require('assert');
const { clamp01, computeCenterBounds, endBias, extractEmphasisToken, parseScriptLines, visibleHalfWidth, requiredDistanceForSpan } = require('../public/animation-helpers');

function testClamp01() {
  assert.strictEqual(clamp01(-1), 0);
  assert.strictEqual(clamp01(0.5), 0.5);
  assert.strictEqual(clamp01(2), 1);
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
  });

  assert.deepStrictEqual(segments[1], {
    profileId: 'B',
    text: 'Second line',
    pauseMs: 120,
    holdMs: 0,
  });

  assert.deepStrictEqual(segments[2], {
    profileId: 'C',
    text: 'Third line **bold** word',
    pauseMs: 0,
    holdMs: 200,
  });
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
  });

  assert.deepStrictEqual(segments[1], {
    profileId: 'A',
    text: 'Calm dolly line',
    pauseMs: 0,
    holdMs: 0,
  });

  assert.deepStrictEqual(segments[2], {
    profileId: 'B',
    text: 'Assertive punch lands here',
    pauseMs: 220,
    holdMs: 0,
  });

  assert.deepStrictEqual(segments[3], {
    profileId: 'C',
    text: 'Dramatic settle widens the lens',
    pauseMs: 0,
    holdMs: 320,
  });

  assert.deepStrictEqual(segments[4], {
    profileId: 'default',
    text: 'Return to the glide',
    pauseMs: 0,
    holdMs: 0,
  });
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

function run() {
  testClamp01();
  testComputeCenterBounds();
  testEndBias();
  testExtractEmphasisToken();
  testParseScriptLines();
  testParseScriptLinesDefaultFirst();
  testVisibleHalfWidth();
  testRequiredDistanceForSpan();
  console.log('animation-helpers: all tests passed');
}

run();
