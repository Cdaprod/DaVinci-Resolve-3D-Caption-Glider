/**
 * Soft lighting rig for the captioner scene.
 * Usage (browser): include this script before index logic, then call
 *   const rig = window.CaptionLighting.applyLightingRig({ THREE, scene, camera, palette: { text: 0x000000, background: 0xffffff } });
 * Example (Node):
 *   const { getLightingSpec } = require('./lighting-rig');
 *   const spec = getLightingSpec();
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CaptionLighting = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const LIGHTING_SPEC = {
    ambient: { color: 0xffffff, intensity: 0.32 },
    hemi: { skyColor: 0xf7fbff, groundColor: 0x0f1117, intensity: 0.26 },
    key: { color: 0xffffff, intensity: 0.92, position: { x: 0.55, y: 0.82, z: 1.45 } },
    fill: { color: 0xf0f4ff, intensity: 0.5, position: { x: -1.2, y: 0.18, z: 1.05 } },
    rim: { color: 0x8cc7ff, intensity: 0.34, position: { x: -0.25, y: 0.95, z: -0.8 } },
  };

  const MATERIAL_SPEC = {
    metalness: 0.06,
    roughness: 0.5,
    emissiveScalar: 0.14,
    emphasis: {
      emissiveScalar: 0.28,
      roughness: 0.42,
    },
  };

  function clampColorFloor(hex, floor = 0x0a) {
    const r = Math.max((hex >> 16) & 0xff, floor);
    const g = Math.max((hex >> 8) & 0xff, floor);
    const b = Math.max(hex & 0xff, floor);
    return (r << 16) | (g << 8) | b;
  }

  function luminance(hex) {
    const r = (hex >> 16) & 0xff;
    const g = (hex >> 8) & 0xff;
    const b = hex & 0xff;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  function getLightingSpec() {
    return JSON.parse(JSON.stringify(LIGHTING_SPEC));
  }

  function getMaterialSpec() {
    return JSON.parse(JSON.stringify(MATERIAL_SPEC));
  }

  function buildMaterialParams(colorHex, opts = {}) {
    const emphasis = !!opts.emphasis;
    const emissiveScalar = emphasis ? MATERIAL_SPEC.emphasis.emissiveScalar : MATERIAL_SPEC.emissiveScalar;
    const roughness = emphasis ? MATERIAL_SPEC.emphasis.roughness : MATERIAL_SPEC.roughness;

    const safeColor = clampColorFloor(typeof colorHex === 'number' ? colorHex : 0xffffff, 0x0a);
    const lumin = luminance(safeColor);
    const needsLift = lumin < 0.05;

    const emissiveColor = needsLift ? clampColorFloor(safeColor, 0x18) : safeColor;
    const emissiveIntensity = needsLift ? emissiveScalar + 0.08 : emissiveScalar;

    return {
      color: safeColor,
      emissive: emissiveColor,
      emissiveIntensity,
      metalness: MATERIAL_SPEC.metalness,
      roughness,
      transparent: true,
      opacity: 1,
    };
  }

  function tintMaterial(mat, colorHex, opts = {}) {
    if (!mat) return;
    const emphasis = !!opts.emphasis;
    const params = buildMaterialParams(colorHex, { emphasis });
    if (mat.color && typeof mat.color.set === 'function') mat.color.set(params.color);
    if (mat.emissive && typeof mat.emissive.set === 'function') mat.emissive.set(params.emissive);
    mat.emissiveIntensity = params.emissiveIntensity;
    mat.metalness = params.metalness;
    mat.roughness = params.roughness;
    mat.opacity = params.opacity;
    mat.transparent = params.transparent;
    mat.needsUpdate = true;
  }

  function applyLightingRig({ THREE, scene, camera, palette }) {
    if (!THREE || !scene || !camera) return null;

    const spec = getLightingSpec();
    const lights = {};

    lights.ambient = new THREE.AmbientLight(spec.ambient.color, spec.ambient.intensity);
    lights.hemi = new THREE.HemisphereLight(spec.hemi.skyColor, spec.hemi.groundColor, spec.hemi.intensity);

    lights.key = new THREE.DirectionalLight(spec.key.color, spec.key.intensity);
    lights.key.position.set(spec.key.position.x, spec.key.position.y, spec.key.position.z);

    lights.fill = new THREE.DirectionalLight(spec.fill.color, spec.fill.intensity);
    lights.fill.position.set(spec.fill.position.x, spec.fill.position.y, spec.fill.position.z);

    lights.rim = new THREE.DirectionalLight(spec.rim.color, spec.rim.intensity);
    lights.rim.position.set(spec.rim.position.x, spec.rim.position.y, spec.rim.position.z);

    scene.add(lights.ambient);
    scene.add(lights.hemi);
    scene.add(lights.key);
    scene.add(lights.fill);
    scene.add(lights.rim);

    function updatePalette(nextPalette) {
      const bg = nextPalette?.background;
      if (typeof bg === 'number') {
        const lightness = luminance(bg);
        const ambientScale = lightness > 0.6 ? 0.72 : 1;
        const hemiScale = lightness > 0.6 ? 0.8 : 1.05;
        const dirScale = lightness > 0.6 ? 0.92 : 1;

        lights.hemi.groundColor.setHex(bg);
        lights.hemi.intensity = spec.hemi.intensity * hemiScale;
        lights.ambient.intensity = spec.ambient.intensity * ambientScale;
        lights.key.intensity = spec.key.intensity * dirScale;
        lights.fill.intensity = spec.fill.intensity * dirScale;
      }
    }

    if (palette) updatePalette(palette);

    return {
      spec,
      lights,
      buildMaterialParams,
      tintMaterial,
      updatePalette,
    };
  }

  return {
    getLightingSpec,
    getMaterialSpec,
    buildMaterialParams,
    tintMaterial,
    applyLightingRig,
  };
});
