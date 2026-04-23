// Image history management

import { DOM, state, MAX_HISTORY } from './state.js';

/**
 * Add an image to the history.
 * @param {string} imageSrc - Base64 image data
 * @param {string} promptUsed - The prompt used for generation
 * @param {number|null} [seed] - The seed used (defaults to state.currentSeed)
 */
export function addToHistory(imageSrc, promptUsed, seed = state.currentSeed) {
    const existingIndex = state.imageHistory.findIndex(item => item.src === imageSrc);
    
    if (existingIndex !== -1) {
        const item = state.imageHistory.splice(existingIndex, 1)[0];
        state.imageHistory.unshift(item);
    } else {
        state.imageHistory.unshift({
            src: imageSrc,
            prompt: promptUsed,
            seed: seed
        });
        
        if (state.imageHistory.length > MAX_HISTORY) {
            state.imageHistory.pop();
        }
    }
    
    renderHistory();
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
 * Render the history thumbnails.
 */
export function renderHistory() {
    DOM.historyContainer.innerHTML = '';
    
    state.imageHistory.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item' + (index === 0 ? ' active' : '');
        
        const img = document.createElement('img');
        img.src = item.src;
        img.alt = 'History image';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '\u2715';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            removeFromHistory(index);
        };
        
        historyItem.appendChild(img);
        historyItem.appendChild(removeBtn);
        
        historyItem.onclick = () => {
            const resultImage = DOM.resultImage;
            resultImage.src = item.src;
            resultImage.onload = () => {
                resultImage.style.display = 'block';
                DOM.regenerateBtn.disabled = false;
            };
            
            if (item.prompt !== undefined) {
                DOM.promptText.value = item.prompt;
            }
            if (item.seed !== undefined) {
                state.currentSeed = item.seed;
            }
            
            renderHistory();
        };
        
        DOM.historyContainer.appendChild(historyItem);
    });
}
