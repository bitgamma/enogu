// Tests for frontend/resolution.js - the single place where a preset's target
// resolution (in megapixels) becomes concrete pixel dimensions.
//
// Run with: npm run test:js   (or: node --test tests/js/)

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import {
    DEFAULT_RATIO_KEY,
    DEFAULT_RESOLUTION_DIVISOR,
    DEFAULT_TARGET_MEGAPIXELS,
    PIXELS_PER_MEGAPIXEL,
    RATIOS,
    alignTo,
    computeSize,
    describeSize,
    describeTarget,
    megapixelsOf,
    presetResolution,
    ratioAspect,
} from '../../frontend/resolution.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = join(HERE, '..', '..', 'frontend');

const RATIO_KEYS = Object.keys(RATIOS);

const areaOf = (size) => size.width * size.height;

// Aligning both sides to a multiple of the divisor costs accuracy, and coarse
// alignment costs more. These are the measured worst cases per divisor (with a
// little headroom): the default divisor of 8 keeps area and ratio within ~1%.
const TOLERANCE_BY_DIVISOR = { 1: 0.005, 8: 0.02, 16: 0.05, 32: 0.08, 64: 0.15 };

function toleranceFor(divisor) {
    return TOLERANCE_BY_DIVISOR[divisor] ?? 0.15;
}

/**
 * Assert a computed size hits the target area, the aspect ratio and the alignment.
 */
function assertSane(size, { megapixels, scale = 1, divisor = DEFAULT_RESOLUTION_DIVISOR, ratioKey }) {
    const targetArea = PIXELS_PER_MEGAPIXEL * megapixels * scale * scale;
    const aspect = ratioAspect(ratioKey);
    const tolerance = toleranceFor(divisor);

    assert.ok(size.width > 0 && size.height > 0, 'sides are positive');
    assert.equal(size.width % divisor, 0, `${size.width} aligned to ${divisor}`);
    assert.equal(size.height % divisor, 0, `${size.height} aligned to ${divisor}`);

    const areaError = Math.abs(size.width * size.height - targetArea) / targetArea;
    assert.ok(
        areaError < tolerance,
        `area ${size.width * size.height} within ${tolerance * 100}% of ${targetArea} (was ${(areaError * 100).toFixed(2)}%)`,
    );

    const ratioError = Math.abs(size.width / size.height - aspect) / aspect;
    assert.ok(
        ratioError < tolerance,
        `ratio ${size.width / size.height} within ${tolerance * 100}% of ${aspect} (was ${(ratioError * 100).toFixed(2)}%)`,
    );
}

describe('megapixel definition', () => {
    test('1 MP is 1024x1024, not 1,000,000 px', () => {
        assert.equal(PIXELS_PER_MEGAPIXEL, 1048576);
        assert.equal(megapixelsOf(1024, 1024), 1);
        assert.equal(megapixelsOf(768, 1024), 0.75);
    });

    test('a 1 MP target at 1:1 is exactly 1024x1024', () => {
        const size = computeSize({ ratioKey: '1:1', megapixels: 1 });
        assert.deepEqual({ width: size.width, height: size.height }, { width: 1024, height: 1024 });
    });

    test('megapixelsOf of empty/zero input is 0', () => {
        assert.equal(megapixelsOf(0, 0), 0);
        assert.equal(megapixelsOf(undefined, undefined), 0);
    });
});

describe('computeSize', () => {
    test('every ratio hits its target area at 1 MP, divisor 8', () => {
        for (const ratioKey of RATIO_KEYS) {
            const size = computeSize({ ratioKey, megapixels: 1 });
            assertSane(size, { megapixels: 1, ratioKey });
        }
    });

    test('every ratio hits its target area at other targets too', () => {
        for (const ratioKey of RATIO_KEYS) {
            for (const megapixels of [0.25, 0.5, 1, 2, 4]) {
                const size = computeSize({ ratioKey, megapixels });
                assertSane(size, { megapixels, ratioKey });
            }
        }
    });

    test('golden sizes at a 1 MP target (regression pins)', () => {
        const expected = {
            '1:1': '1024x1024',
            '3:4': '888x1184',
            '4:3': '1184x888',
            '9:16': '768x1368',
            '16:9': '1368x768',
            '9:20': '688x1528',
            '20:9': '1528x688',
        };
        for (const [ratioKey, dimensions] of Object.entries(expected)) {
            const size = computeSize({ ratioKey, megapixels: 1 });
            assert.equal(`${size.width}x${size.height}`, dimensions, ratioKey);
        }
    });

    test('scale is applied per side (2x per side = 4x megapixels)', () => {
        const base = computeSize({ ratioKey: '3:4', megapixels: 1 });
        const doubled = computeSize({ ratioKey: '3:4', megapixels: 1, scale: 2 });
        const oneAndHalf = computeSize({ ratioKey: '3:4', megapixels: 1, scale: 1.5 });

        assert.equal(doubled.width, base.width * 2);
        assert.equal(doubled.height, base.height * 2);
        assert.ok(Math.abs(megapixelsOf(doubled.width, doubled.height) - 4) < 0.015);

        assert.ok(oneAndHalf.width > base.width && oneAndHalf.width < doubled.width);
        assert.ok(Math.abs(megapixelsOf(oneAndHalf.width, oneAndHalf.height) - 2.25) < 0.05);
    });

    test('scale multiplies each side by ~the same factor for every ratio', () => {
        for (const ratioKey of RATIO_KEYS) {
            const base = computeSize({ ratioKey, megapixels: 1 });
            const upscaled = computeSize({ ratioKey, megapixels: 1, scale: 1.5 });
            const widthFactor = upscaled.width / base.width;
            const heightFactor = upscaled.height / base.height;
            assert.ok(Math.abs(widthFactor - 1.5) < 0.02, `${ratioKey} width factor ${widthFactor}`);
            assert.ok(Math.abs(heightFactor - 1.5) < 0.02, `${ratioKey} height factor ${heightFactor}`);
        }
    });

    test('orientation follows the ratio (portrait is taller, landscape wider)', () => {
        assert.ok(computeSize({ ratioKey: '3:4' }).height > computeSize({ ratioKey: '3:4' }).width);
        assert.ok(computeSize({ ratioKey: '4:3' }).width > computeSize({ ratioKey: '4:3' }).height);
    });

    test('portrait and landscape of the same ratio are mirrors', () => {
        for (const [portrait, landscape] of [['3:4', '4:3'], ['9:16', '16:9'], ['9:20', '20:9']]) {
            const a = computeSize({ ratioKey: portrait, megapixels: 1 });
            const b = computeSize({ ratioKey: landscape, megapixels: 1 });
            assert.deepEqual([a.width, a.height], [b.height, b.width], `${portrait} vs ${landscape}`);
        }
    });

    test('divisor alignment is honoured', () => {
        for (const divisor of [1, 8, 16, 32, 64]) {
            for (const ratioKey of RATIO_KEYS) {
                const size = computeSize({ ratioKey, megapixels: 1, divisor });
                assertSane(size, { megapixels: 1, divisor, ratioKey });
            }
        }
    });

    test('unknown ratio falls back to the default ratio', () => {
        const fallback = computeSize({ ratioKey: DEFAULT_RATIO_KEY, megapixels: 1 });
        const unknown = computeSize({ ratioKey: '7:11', megapixels: 1 });
        assert.deepEqual({ width: unknown.width, height: unknown.height }, { width: fallback.width, height: fallback.height });
    });

    test('invalid target, scale and divisor fall back to defaults', () => {
        const reference = computeSize({ ratioKey: '3:4' });
        assert.deepEqual(reference, computeSize({ ratioKey: '3:4', megapixels: undefined }));
        assert.equal(reference.targetMegapixels, DEFAULT_TARGET_MEGAPIXELS);
        assert.equal(reference.divisor, DEFAULT_RESOLUTION_DIVISOR);

        for (const megapixels of [0, -1, NaN, Infinity, 'big', null]) {
            assert.equal(computeSize({ ratioKey: '1:1', megapixels }).targetMegapixels, DEFAULT_TARGET_MEGAPIXELS, String(megapixels));
        }
        for (const scale of [0, -2, NaN, 'x', null]) {
            assert.equal(computeSize({ ratioKey: '1:1', scale }).scale, 1, String(scale));
        }
        for (const divisor of [0, -8, NaN, null]) {
            assert.equal(computeSize({ ratioKey: '1:1', divisor }).divisor, DEFAULT_RESOLUTION_DIVISOR, String(divisor));
        }
        assert.equal(computeSize({ ratioKey: '1:1', divisor: 8.9 }).divisor, 8);
    });

    test('larger targets and larger scales both produce larger images', () => {
        for (const ratioKey of RATIO_KEYS) {
            let previousArea = 0;
            for (const megapixels of [0.5, 1, 2, 4]) {
                const area = areaOf(computeSize({ ratioKey, megapixels }));
                assert.ok(area > previousArea, `${ratioKey}: area grows with target ${previousArea} -> ${area}`);
                previousArea = area;
            }
            previousArea = 0;
            for (const scale of [1, 1.5, 2, 3]) {
                const area = areaOf(computeSize({ ratioKey, megapixels: 1, scale }));
                assert.ok(area > previousArea, `${ratioKey}: area grows with scale ${previousArea} -> ${area}`);
                previousArea = area;
            }
        }
    });

    test('very small targets still return positive aligned sizes', () => {
        const size = computeSize({ ratioKey: '20:9', megapixels: 0.01 });
        assert.ok(size.width >= 8 && size.height >= 8);
        assert.equal(size.width % 8, 0);
        assert.equal(size.height % 8, 0);
    });

    test('returns the inputs alongside the size', () => {
        const size = computeSize({ ratioKey: '16:9', megapixels: 1.5, scale: 1.5, divisor: 16 });
        assert.equal(size.ratioKey, '16:9');
        assert.equal(size.targetMegapixels, 1.5);
        assert.equal(size.scale, 1.5);
        assert.equal(size.divisor, 16);
    });

    test('works with no arguments at all', () => {
        const size = computeSize();
        assert.equal(size.ratioKey, DEFAULT_RATIO_KEY);
        assert.equal(size.targetMegapixels, DEFAULT_TARGET_MEGAPIXELS);
        assert.equal(size.scale, 1);
        assert.equal(size.width % DEFAULT_RESOLUTION_DIVISOR, 0);
    });
});

describe('alignTo', () => {
    test('rounds to the nearest multiple', () => {
        assert.equal(alignTo(886.4, 8), 888);
        assert.equal(alignTo(1184, 8), 1184);
        assert.equal(alignTo(1187, 8), 1184);
        assert.equal(alignTo(1189, 8), 1192);
    });

    test('never returns less than the divisor', () => {
        assert.equal(alignTo(0, 8), 8);
        assert.equal(alignTo(-100, 8), 8);
    });

    test('divisor 1 keeps whole pixels', () => {
        assert.equal(alignTo(37, 1), 37);
    });
});

describe('presetResolution', () => {
    const presets = [
        { name: 'plain', target_megapixels: null, resolution_divisor: null },
        { name: 'big', target_megapixels: 2.5, resolution_divisor: 16 },
    ];

    test('reads values from the preset listing', () => {
        assert.deepEqual(presetResolution(presets, 'big'), { targetMegapixels: 2.5, divisor: 16 });
    });

    test('null values fall back to the defaults', () => {
        assert.deepEqual(presetResolution(presets, 'plain'), {
            targetMegapixels: DEFAULT_TARGET_MEGAPIXELS,
            divisor: DEFAULT_RESOLUTION_DIVISOR,
        });
    });

    test('unknown preset, null name and empty list fall back to the defaults', () => {
        const fallback = { targetMegapixels: DEFAULT_TARGET_MEGAPIXELS, divisor: DEFAULT_RESOLUTION_DIVISOR };
        assert.deepEqual(presetResolution(presets, 'missing'), fallback);
        assert.deepEqual(presetResolution(presets, null), fallback);
        assert.deepEqual(presetResolution([], 'x'), fallback);
        assert.deepEqual(presetResolution(undefined, 'x'), fallback);
    });
});

describe('formatters', () => {
    test('describeSize shows pixels and megapixels', () => {
        assert.equal(describeSize({ width: 888, height: 1184 }), '888x1184 (1.00 MP)');
        assert.equal(describeSize({ width: 1536, height: 1536 }), '1536x1536 (2.25 MP)');
        assert.equal(describeSize(null), '');
    });

    test('describeTarget mentions the per-side scale only when it differs from 1', () => {
        assert.equal(describeTarget(1), '1 MP');
        assert.equal(describeTarget(1, 1), '1 MP');
        assert.equal(describeTarget(1, 2), '1 MP x2 per side');
        assert.equal(describeTarget(1.5, 1.5), '1.5 MP x1.5 per side');
        assert.equal(describeTarget(0.75), '0.75 MP');
        assert.equal(describeTarget(2), '2 MP');
    });
});

describe('RATIOS table', () => {
    test('every entry has positive integer sides and a label', () => {
        for (const [key, ratio] of Object.entries(RATIOS)) {
            assert.ok(ratio.width > 0 && ratio.height > 0, key);
            assert.ok(Number.isInteger(ratio.width) && Number.isInteger(ratio.height), key);
            assert.ok(ratio.label.startsWith(key), `${key} label "${ratio.label}"`);
        }
    });

    test('the aspect-ratio select in index.html covers exactly the RATIOS keys', () => {
        const html = readFileSync(join(FRONTEND_DIR, 'index.html'), 'utf8');
        const block = html.match(/<select id="resolutionSelect"[\s\S]*?<\/select>/);
        assert.ok(block, 'resolutionSelect found in index.html');
        const optionValues = [...block[0].matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
        assert.deepEqual(optionValues.sort(), [...RATIO_KEYS].sort());
    });

    test('exactly one option is selected and it is a known ratio', () => {
        const html = readFileSync(join(FRONTEND_DIR, 'index.html'), 'utf8');
        const block = html.match(/<select id="resolutionSelect"[\s\S]*?<\/select>/)[0];
        const selected = [...block.matchAll(/<option value="([^"]+)"[^>]*selected/g)].map((m) => m[1]);
        assert.equal(selected.length, 1);
        assert.ok(RATIOS[selected[0]], `${selected[0]} exists in RATIOS`);
        assert.equal(selected[0], DEFAULT_RATIO_KEY);
    });
});

describe('refactor consistency', () => {
    test('no frontend module still references the removed pixel-table state', () => {
        const removed = ['RESOLUTIONS', 'currentResolution', 'resolutionMultiplier', 'historyResolutionMultiplier'];
        const files = readdirSync(FRONTEND_DIR).filter((name) => name.endsWith('.js'));
        for (const file of files) {
            const source = readFileSync(join(FRONTEND_DIR, file), 'utf8');
            for (const name of removed) {
                assert.ok(!source.includes(name), `${file} still references ${name}`);
            }
        }
    });

    test('resolution.js stays free of DOM and state imports (so it stays testable)', () => {
        const source = readFileSync(join(FRONTEND_DIR, 'resolution.js'), 'utf8');
        assert.ok(!source.includes("from './state.js'"), 'no state import');
        assert.ok(!/document\./.test(source), 'no DOM access');
    });
});
