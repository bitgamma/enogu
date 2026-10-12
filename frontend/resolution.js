// Resolution targeting: turns a preset's target resolution (in megapixels) plus
// the selected aspect ratio into concrete pixel dimensions.
//
// 1 MP is defined here as 1024 x 1024 pixels (1,048,576 px), NOT 1,000,000 px.
//
// The preset owns the target (`target_megapixels` in presets/<name>/settings.json);
// the backend only stores and exposes it. This module is the single place where a
// target becomes a width/height pair. Server-side defaults live in app/config.py
// (MEGAPIXEL_PIXELS, DEFAULT_TARGET_MEGAPIXELS, DEFAULT_RESOLUTION_DIVISOR) and
// must be kept in sync with the constants below.
//
// The scale multiplier is applied PER SIDE, so "2x" means 2x width and 2x height,
// i.e. 4x the megapixel count.
//
// Both sides are aligned to multiples of `divisor` (default 8 - the VAE tile size).
// Aligning both sides forces a small compromise either on the ratio or on the
// target area, so the candidates around the ideal size (searched from both the
// width and the height side) are scored by combined area + ratio error, and the
// best one wins. With the default divisor of 8 that keeps both within ~1%; coarser
// divisors (16/32/64) cost accuracy, which is inherent to the alignment.
//
// Result at target 1.0 MP (divisor 8):
//   1:1   -> 1024x1024    3:4  -> 888x1184     4:3   -> 1184x888
//   9:16  -> 768x1368     16:9 -> 1368x768     9:20  -> 688x1528     20:9 -> 1528x688

export const PIXELS_PER_MEGAPIXEL = 1024 * 1024;
export const DEFAULT_TARGET_MEGAPIXELS = 1.0;
export const DEFAULT_RESOLUTION_DIVISOR = 8;
export const DEFAULT_RATIO_KEY = '3:4';
// Aspect ratios offered by the UI. Keys are the <option> values in index.html.
export const RATIOS = {
    '1:1': { width: 1, height: 1, label: '1:1 (Square)' },
    '3:4': { width: 3, height: 4, label: '3:4 (Portrait)' },
    '4:3': { width: 4, height: 3, label: '4:3 (Landscape)' },
    '9:16': { width: 9, height: 16, label: '9:16 (Portrait)' },
    '16:9': { width: 16, height: 9, label: '16:9 (Landscape)' },
    '9:20': { width: 9, height: 20, label: '9:20 (Portrait)' },
    '20:9': { width: 20, height: 9, label: '20:9 (Landscape)' },
};

/**
 * Resolve an aspect ratio key to a width/height quotient.
 * @param {string} ratioKey
 * @returns {number}
 */
export function ratioAspect(ratioKey) {
    const ratio = RATIOS[ratioKey] || RATIOS[DEFAULT_RATIO_KEY];
    return ratio.width / ratio.height;
}

/**
 * Round a pixel value to the nearest multiple of `divisor` (never below it).
 * @param {number} value
 * @param {number} [divisor]
 * @returns {number}
 */
export function alignTo(value, divisor = DEFAULT_RESOLUTION_DIVISOR) {
    const d = normalizeDivisor(divisor);
    return Math.max(d, Math.round(value / d) * d);
}

function normalizeDivisor(divisor) {
    const value = Number(divisor);
    if (!Number.isFinite(value) || value < 1) return DEFAULT_RESOLUTION_DIVISOR;
    return Math.trunc(value);
}

function normalizeMegapixels(megapixels) {
    const value = Number(megapixels);
    if (!Number.isFinite(value) || value <= 0) return DEFAULT_TARGET_MEGAPIXELS;
    return value;
}

function normalizeScale(scale) {
    const value = Number(scale);
    if (!Number.isFinite(value) || value <= 0) return 1;
    return value;
}

/**
 * Compute the concrete generation size for a preset target, ratio and scale.
 *
 * @param {Object} options
 * @param {string} [options.ratioKey] - Ratio key from RATIOS (default DEFAULT_RATIO_KEY)
 * @param {number} [options.megapixels] - Preset target in MP (1 MP = 1024x1024); falls back to 1.0
 * @param {number} [options.scale] - Per-side scale factor (1, 1.5, 2, ...)
 * @param {number} [options.divisor] - Alignment multiple (default 8)
 * @returns {{width: number, height: number, ratioKey: string, scale: number,
 *            targetMegapixels: number, divisor: number}}
 */
export function computeSize({
    ratioKey = DEFAULT_RATIO_KEY,
    megapixels = DEFAULT_TARGET_MEGAPIXELS,
    scale = 1,
    divisor = DEFAULT_RESOLUTION_DIVISOR,
} = {}) {
    const aspect = ratioAspect(ratioKey);
    const d = normalizeDivisor(divisor);
    const mp = normalizeMegapixels(megapixels);
    const s = normalizeScale(scale);
    const targetArea = PIXELS_PER_MEGAPIXEL * mp * s * s;
    const idealWidth = Math.sqrt(targetArea * aspect);
    const idealHeight = idealWidth / aspect;

    // Candidates: aligned sizes around the ideal one, approached from the width
    // and from the height so neither orientation is privileged.
    const candidates = [];
    const baseWidth = Math.floor(idealWidth / d);
    const baseHeight = Math.floor(idealHeight / d);
    for (let offset = -1; offset <= 1; offset++) {
        const width = Math.max(d, (baseWidth + offset) * d);
        candidates.push([width, alignTo(width / aspect, d)]);
        const height = Math.max(d, (baseHeight + offset) * d);
        candidates.push([alignTo(height * aspect, d), height]);
    }

    let best = null;
    for (const [width, height] of candidates) {
        const areaError = Math.abs(width * height - targetArea) / targetArea;
        const ratioError = Math.abs(width / height - aspect) / aspect;
        const score = areaError + ratioError;
        const better = !best
            || score < best.score - 1e-12
            || (Math.abs(score - best.score) <= 1e-12 && ratioError < best.ratioError - 1e-12)
            || (Math.abs(score - best.score) <= 1e-12
                && Math.abs(ratioError - best.ratioError) <= 1e-12
                && width > best.width);
        if (better) {
            best = { width, height, score, areaError, ratioError };
        }
    }

    return { width: best.width, height: best.height, ratioKey, scale: s, targetMegapixels: mp, divisor: d };
}

/**
 * Megapixel size (1 MP = 1024x1024) of a pixel size.
 * @param {number} width
 * @param {number} height
 * @returns {number}
 */
export function megapixelsOf(width, height) {
    if (!width || !height) return 0;
    return (width * height) / PIXELS_PER_MEGAPIXEL;
}

/**
 * Read the resolution settings of a preset from the /api/presets listing.
 * Missing/invalid values fall back to the defaults.
 * @param {Array<{name: string, target_megapixels?: number|null, resolution_divisor?: number|null}>} presets
 * @param {string|null} presetName
 * @returns {{targetMegapixels: number, divisor: number}}
 */
export function presetResolution(presets, presetName) {
    const preset = (presets || []).find((item) => item.name === presetName);
    return {
        targetMegapixels: normalizeMegapixels(preset?.target_megapixels),
        divisor: normalizeDivisor(preset?.resolution_divisor),
    };
}

/**
 * Human-readable size, e.g. "888x1184 (1.00 MP)".
 * @param {{width: number, height: number}} size
 * @returns {string}
 */
export function describeSize(size) {
    if (!size || !size.width || !size.height) return '';
    return `${size.width}x${size.height} (${megapixelsOf(size.width, size.height).toFixed(2)} MP)`;
}

/**
 * Human-readable target description, e.g. "1 MP" or "1 MP x2 (per side)".
 * @param {number} targetMegapixels
 * @param {number} [scale]
 * @returns {string}
 */
export function describeTarget(targetMegapixels, scale = 1) {
    const mp = normalizeMegapixels(targetMegapixels);
    const label = Number.isInteger(mp) ? `${mp} MP` : `${mp.toFixed(2).replace(/0$/, '')} MP`;
    const s = normalizeScale(scale);
    return s === 1 ? label : `${label} x${s} per side`;
}

export default { RATIOS, computeSize, megapixelsOf, presetResolution, describeSize, describeTarget };
