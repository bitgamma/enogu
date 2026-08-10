// Image history management

import { DOM, state, RESOLUTIONS, MAX_HISTORY } from './state.js';

/**
 * Add an image to the history (creates a placeholder if image is not yet available).
 * @param {string} imageSrc - Base64 image data (can be empty for placeholder)
 * @param {string} promptUsed - The prompt used for generation
 * @param {Object} options - Additional generation metadata
 * @param {number|null} [options.seed] - The seed used (defaults to state.currentSeed)
 * @param {string} [options.preset] - The preset name used
 * @param {number} [options.width] - Resolution width
 * @param {number} [options.height] - Resolution height
 * @returns {number} Index of the created/updated history item
 */
export function addToHistory(imageSrc, promptUsed, options = {}) {
    const {
        seed = state.currentSeed,
        preset,
        width,
        height,
        resolutionMultiplier = 1,
    } = options;

    state.imageHistory.unshift({
        src: imageSrc || null,
        prompt: promptUsed,
        seed: seed,
        preset: preset || null,
        width: width || null,
        height: height || null,
        resolutionMultiplier: resolutionMultiplier,
    });

    if (state.imageHistory.length > MAX_HISTORY) {
        state.imageHistory.pop();
    }

    renderHistory();
}

/**
 * Update the image source of a history item (after ComfyUI responds).
 * @param {number} index - Index in history array
 * @param {string} imageSrc - Base64 image data
 */
export function updateHistoryImage(index, imageSrc) {
    if (index >= 0 && index < state.imageHistory.length) {
        state.imageHistory[index].src = imageSrc;
        renderHistory();
    }
}

/**
 * Remove an image from history by index.
 * @param {number} index - Index in history array
 */
export function removeFromHistory(index) {
    state.imageHistory.splice(index, 1);
    renderHistory();
    if (index === 0) {
        DOM.resultImage.style.display = 'none';
        DOM.resultImage.src = '';
    }
}

/**
 * Find the resolution select value that matches the given width/height.
 * @param {number} width
 * @param {number} height
 * @returns {string} Resolution key (e.g. "768x1024") or null
 */
function findResolutionKey(width, height) {
    for (const [key, res] of Object.entries(RESOLUTIONS)) {
        if (res.width === width && res.height === height) {
            return key;
        }
    }
    return null;
}

/**
 * Render the history thumbnails.
 */
export function renderHistory() {
    DOM.historyContainer.innerHTML = '';

    state.imageHistory.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item' + (index === 0 ? ' active' : '');

        if (item.src) {
            const img = document.createElement('img');
            img.src = item.src;
            img.alt = 'History image';
            historyItem.appendChild(img);
        } else {
            // Pending placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 'history-item-pending';
            placeholder.innerHTML = '<div class="spinner-small"></div><span>Generating...</span>';
            historyItem.appendChild(placeholder);
        }

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '\u2715';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            removeFromHistory(index);
        };

        historyItem.appendChild(removeBtn);

        historyItem.onclick = () => {
            const resultImage = DOM.resultImage;

            if (item.src) {
                resultImage.src = item.src;
                resultImage.onload = () => {
                    resultImage.style.display = 'block';
                    DOM.regenerateBtn.disabled = false;
                };
            }

            if (item.prompt !== undefined) {
                DOM.promptText.value = item.prompt;
            }
            if (item.seed !== undefined) {
                state.currentSeed = item.seed;
            }
            if (item.preset) {
                state.currentPreset = item.preset;
                DOM.presetSelect.value = item.preset;
                DOM.presetSelectResult.value = item.preset;
            }
            if (item.width !== null && item.height !== null) {
                state.currentResolution = { width: item.width, height: item.height };
                const resKey = findResolutionKey(item.width, item.height);
                if (resKey) {
                    DOM.resolutionSelect.value = resKey;
                }
            }
            if (item.resolutionMultiplier !== undefined) {
                state.historyResolutionMultiplier = item.resolutionMultiplier;
            }

            renderHistory();
        };

        DOM.historyContainer.appendChild(historyItem);
    });
}
