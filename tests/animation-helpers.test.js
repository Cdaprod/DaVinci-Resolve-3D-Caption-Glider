// Basic checks for animation helper utilities.
// Run with: node tests/animation-helpers.test.js
// Example: `node tests/animation-helpers.test.js`

const assert = require('assert');
const { clamp01, computeCenterBounds, endBias } = require('../public/animation-helpers');

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

function run() {
  testClamp01();
  testComputeCenterBounds();
  testEndBias();
  console.log('animation-helpers: all tests passed');
}

run();
