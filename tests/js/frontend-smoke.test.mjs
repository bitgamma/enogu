// Integration smoke tests for the frontend modules that touch the DOM.
//
// The frontend is build-less ES modules, so a typo'd import or a stale state
// field only shows up in the browser. These tests load the real modules against
// a minimal DOM stub and check that the resolution read-out follows preset,
// ratio and scale changes.
//
// Run with: npm run test:js

import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

/** Minimal element stub: enough for the state registry, populateSelect and text updates. */
function makeElement(id) {
    return {
        id,
        value: '',
        textContent: '',
        innerHTML: '',
        src: '',
        disabled: false,
        style: {},
        dataset: {},
        children: [],
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        addEventListener() {},
        appendChild(child) {
            this.children.push(child);
        },
        querySelector: () => makeElement(`${id}-child`),
        querySelectorAll: () => [],
    };
}

/** Minimal document/window stub installed before the modules are imported. */
function installDomStub() {
    const elements = new Map();
    const document = {
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, makeElement(id));
            return elements.get(id);
        },
        createElement: (tag) => makeElement(`<${tag}>`),
        querySelectorAll: () => [],
        addEventListener() {},
        body: makeElement('body'),
    };
    globalThis.document = document;
    // Node >= 21 provides a read-only global navigator; ui.js only reads
    // navigator.userAgent lazily, so the native one is fine.
    globalThis.window = { location: { href: '' } };
    return document;
}

describe('frontend module graph (with a DOM stub)', () => {
    let state;
    let DOM;
    let refresh;
    let history;

    before(async () => {
        installDomStub();
        // Import after the stub is in place: state.js reads the DOM at import time.
        state = await import('../../frontend/state.js');
        DOM = state.DOM;
        refresh = await import('../../frontend/refresh.js');
        history = await import('../../frontend/history.js');
    });

    test('every registry entry was resolved through document.getElementById', () => {
        const unresolved = Object.entries(DOM).filter(([, el]) => !el || !el.id);
        assert.deepEqual(unresolved, []);
    });

    test('resolutionInfo is registered', () => {
        assert.equal(DOM.resolutionInfo.id, 'resolutionInfo');
    });

    test('the read-out follows the preset target, ratio and scale', () => {
        state.state.availablePresets = [
            { name: 'plain', target_megapixels: null, resolution_divisor: null },
            { name: 'big', target_megapixels: 2.0, resolution_divisor: 8 },
        ];

        refresh.setCurrentPreset('plain');
        refresh.setRatioKey('3:4');
        refresh.setScale(1);
        assert.equal(DOM.resolutionInfo.textContent, '1 MP \u2192 888x1184 (1.00 MP)');

        refresh.setCurrentPreset('big');
        assert.equal(DOM.resolutionInfo.textContent, '2 MP \u2192 1256x1672 (2.00 MP)');

        refresh.setRatioKey('1:1');
        assert.equal(DOM.resolutionInfo.textContent, '2 MP \u2192 1448x1448 (2.00 MP)');

        refresh.setScale(2);
        assert.equal(DOM.resolutionInfo.textContent, '2 MP x2 per side \u2192 2896x2896 (8.00 MP)');
    });

    test('setCurrentPreset keeps both selects and the state in sync', () => {
        refresh.setCurrentPreset('big');
        assert.equal(state.state.currentPreset, 'big');
        assert.equal(DOM.presetSelect.value, 'big');
        assert.equal(DOM.presetSelectResult.value, 'big');
    });

    test('setRatioKey ignores unknown ratios', () => {
        refresh.setRatioKey('16:9');
        assert.equal(state.state.currentRatioKey, '16:9');
        refresh.setRatioKey('nonsense');
        assert.equal(state.state.currentRatioKey, '16:9');
    });

    test('history stores ratio and scale, and restoring them refreshes the read-out', () => {
        state.state.imageHistory.length = 0;
        state.state.currentRatioKey = '9:16';
        state.state.currentScale = 1;

        history.addToHistory('data:image/png;base64,x', 'a prompt', {
            seed: 42,
            preset: 'big',
            ratioKey: '3:4',
            scale: 1.5,
            width: 1328,
            height: 1768,
        });

        const item = state.state.imageHistory[0];
        assert.equal(item.ratioKey, '3:4');
        assert.equal(item.scale, 1.5);
        assert.equal(item.width, 1328);
        assert.equal(item.height, 1768);
        assert.equal(item.seed, 42);

        // Simulate picking the history item (its click handler).
        state.state.currentRatioKey = '9:16';
        state.state.currentScale = 1;
        refresh.setCurrentPreset(item.preset);
        refresh.setRatioKey(item.ratioKey);
        refresh.setScale(item.scale);

        assert.equal(state.state.currentRatioKey, '3:4');
        assert.equal(state.state.currentScale, 1.5);
        assert.equal(DOM.resolutionInfo.textContent, '2 MP x1.5 per side \u2192 1880x2504 (4.49 MP)');
    });

    test('populatePresetSelects refreshes the read-out from the listing', () => {
        state.state.availablePresets = [{ name: 'solo', target_megapixels: 4, resolution_divisor: 8 }];
        refresh.setScale(1);
        refresh.populatePresetSelects();
        assert.equal(state.state.currentPreset, 'solo');
        assert.equal(DOM.resolutionInfo.textContent, '4 MP \u2192 1776x2368 (4.01 MP)');
    });
});
