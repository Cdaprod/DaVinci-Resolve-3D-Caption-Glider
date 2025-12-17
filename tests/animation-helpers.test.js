// Basic checks for animation helper utilities.
// Run with: node tests/animation-helpers.test.js
// Example: `node tests/animation-helpers.test.js`

const assert = require('assert');
const { clamp01, computeCenterBounds, endBias, extractEmphasisToken, parseScriptLines } = require('../public/animation-helpers');

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

function run() {
  testClamp01();
  testComputeCenterBounds();
  testEndBias();
  testExtractEmphasisToken();
  testParseScriptLines();
  console.log('animation-helpers: all tests passed');
}

run();
