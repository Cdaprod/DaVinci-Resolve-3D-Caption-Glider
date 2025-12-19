// Lighting rig helper tests.
// Run with: node tests/lighting-rig.test.js

const assert = require('assert');
const lighting = require('../public/lighting-rig');

function testSpecShape() {
  const spec = lighting.getLightingSpec();
  assert.ok(spec.ambient && spec.hemi && spec.key && spec.fill && spec.rim, 'spec should expose all lights');
  assert.ok(spec.key.position && typeof spec.key.position.x === 'number', 'key light should include position');

  const spec2 = lighting.getLightingSpec();
  spec2.ambient.intensity = 99;
  assert.notStrictEqual(spec.ambient.intensity, spec2.ambient.intensity, 'spec should be cloned per call');
}

function testMaterialParams() {
  const base = lighting.buildMaterialParams(0x111111);
  assert.ok(base.color > 0, 'base color should be preserved or lifted above zero');
  assert.strictEqual(base.transparent, true);
  assert.ok(base.roughness > 0, 'roughness should be set');

  const emph = lighting.buildMaterialParams(0x222222, { emphasis: true });
  assert.ok(emph.emissiveIntensity > base.emissiveIntensity, 'emphasis should boost emissive');
  assert.ok(emph.roughness < base.roughness, 'emphasis should be slightly less rough');

  const dark = lighting.buildMaterialParams(0x000000);
  assert.ok(dark.color > 0, 'pure black should be lifted to a visible diffuse color');
  assert.ok(dark.emissiveIntensity > base.emissiveIntensity, 'lifted black should get extra emissive');
}

function run() {
  testSpecShape();
  testMaterialParams();
  console.log('lighting-rig tests: OK');
}

if (require.main === module) run();

module.exports = { testSpecShape, testMaterialParams };
