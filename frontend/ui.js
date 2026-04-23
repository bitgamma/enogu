// UI operations and custom dialog components

import { DOM, RESOLUTIONS, MAX_HISTORY, state } from './state.js';
import { generateRandomSeed } from './api.js';

// Screen navigation
export function showScreen(screenNumber) {
    [DOM.screen1, DOM.screen2, DOM.screen3].forEach((screen, index) => {
        screen.classList.toggle('active', index + 1 === screenNumber);
    });
    if (screenNumber === 3) {
        DOM.profileSelectResult.value = state.currentProfile || '';
    }
}

// Progress bar reset
export function resetProgress() {
    DOM.progressFill.style.width = '0%';
    DOM.stepIndicator1.classList.add('active');
    DOM.stepIndicator1.classList.remove('completed');
    DOM.stepIndicator2.classList.remove('active', 'completed');
    DOM.stepIndicator3.classList.remove('active', 'completed');
}

// ============== Unified Notification System ==============

/**
 * Shows a notification (error or success) with automatic dismissal.
 * @param {string} message - The notification message
 * @param {'error'|'success'} type - Notification type
 * @param {number} duration - Auto-dismiss duration in milliseconds (0 to disable)
 */
export function notify(message, type = 'error', duration = 3000) {
    if (window.notificationTimeout) {
        clearTimeout(window.notificationTimeout);
    }
    
    DOM.errorMessage.textContent = message;
    DOM.errorContainer.classList.add('show');
    DOM.errorContainer.classList.toggle('notification', type === 'success');
    
    if (duration > 0) {
        window.notificationTimeout = setTimeout(hideNotification, duration);
    }
}

/**
 * Hides the notification.
 */
export function hideNotification() {
    if (window.notificationTimeout) {
        clearTimeout(window.notificationTimeout);
    }
    
    DOM.errorMessage.textContent = '';
    DOM.errorContainer.classList.remove('show', 'notification');
}

// Convenience wrappers
export const showError = (msg, dur = 3000) => notify(msg, 'error', dur);
export const showSuccess = (msg, dur = 3000) => notify(msg, 'success', dur);

// Error actions visibility
export const showErrorActions = () => { DOM.errorActions.style.display = 'flex'; };
export const hideErrorActions = () => { DOM.errorActions.style.display = 'none'; };

// ============== Custom Dialog Components ==============

/**
 * Creates and shows a custom dialog overlay.
 * @param {string} title - Dialog title
 * @param {Object} content - Dialog content element
 * @param {Array} buttons - Array of {label, primary, action} objects
 * @returns {Promise<any>} Resolves with button action result
 */
function showDialog(title, content, buttons) {
    return new Promise((resolve) => {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';
        
        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'dialog';
        
        // Dialog header
        const header = document.createElement('div');
        header.className = 'dialog-header';
        header.innerHTML = `<h3>${title}</h3>`;
        
        // Dialog body
        const body = document.createElement('div');
        body.className = 'dialog-body';
        body.appendChild(content);
        
        // Dialog footer
        const footer = document.createElement('div');
        footer.className = 'dialog-footer';
        
        buttons.forEach(btnConfig => {
            const btn = document.createElement('button');
            btn.className = `btn ${btnConfig.primary ? 'primary' : ''}`;
            btn.textContent = btnConfig.label;
            btn.addEventListener('click', () => {
                overlay.remove();
                resolve(btnConfig.action());
            });
            footer.appendChild(btn);
        });
        
        dialog.appendChild(header);
        dialog.appendChild(body);
        dialog.appendChild(footer);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(null);
            }
        });
        
        // Focus first input if exists
        const input = content.querySelector('input, textarea');
        if (input) {
            setTimeout(() => input.focus(), 100);
        }
    });
}

/**
 * Shows a custom prompt dialog.
 * @param {string} message - Prompt message
 * @param {string} [defaultValue] - Default input value
 * @returns {Promise<string|null>} User input or null if cancelled
 */
export function showPrompt(message, defaultValue = '') {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input';
    input.value = defaultValue;
    input.placeholder = 'Enter value...';
    
    return showDialog('Input', input, [
        { label: 'Cancel', action: () => null },
        { label: 'OK', primary: true, action: () => input.value || null }
    ]);
}

/**
 * Shows a custom confirmation dialog.
 * @param {string} message - Confirmation message
 * @returns {Promise<boolean>} True if confirmed
 */
export function showConfirm(message) {
    const messageEl = document.createElement('p');
    messageEl.className = 'dialog-message';
    messageEl.textContent = message;
    
    return showDialog('Confirm', messageEl, [
        { label: 'Cancel', action: () => false },
        { label: 'Delete', primary: true, action: () => true }
    ]);
}

// ============== Helper Functions ==============

/**
 * Populate a select element with profile options.
 * @param {HTMLSelectElement} selectElement - The select element to populate
 * @param {Array} profiles - Array of profile objects with 'name' property
 * @param {Function} onSelect - Callback when first profile is selected (with profile name)
 */
export function populateSelect(selectElement, profiles, onSelect) {
    selectElement.innerHTML = '';
    profiles.forEach((profile, index) => {
        const option = document.createElement('option');
        option.value = profile.name;
        option.textContent = profile.name;
        selectElement.appendChild(option);
        if (index === 0 && onSelect) {
            option.selected = true;
            onSelect(profile.name);
        }
    });
}

/**
 * Detect mobile device.
 * @returns {boolean}
 */
export function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Setup mobile camera button visibility.
 */
export function setupMobileCameraButton() {
    if (isMobileDevice()) {
        document.querySelector('.camera-button-container').style.display = 'flex';
    }
}

/**
 * Handle file upload.
 * @param {File} file - The uploaded file
 * @param {Function} [onLoaded] - Optional callback after file is loaded
 */
export function handleFile(file, onLoaded) {
    if (!file.type.startsWith('image/')) {
        showError('Please select an image file (PNG or JPG)');
        return;
    }
    
    resetState();
    
    state.selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        DOM.previewImage.src = e.target.result;
        DOM.previewImage.style.display = 'block';
        if (onLoaded) onLoaded();
    };
    reader.readAsDataURL(file);
}

/**
 * Reset application state.
 */
export function resetState() {
    state.selectedFile = null;
    state.currentSeed = null;
    DOM.promptText.value = '';
    DOM.previewImage.style.display = 'none';
    DOM.previewImage.src = '';
    DOM.resultImage.style.display = 'none';
    DOM.resultImage.src = '';
    DOM.regenerateBtn.disabled = true;
    hideNotification();
    resetProgress();
    DOM.fileInput.value = '';
    DOM.cameraInput.value = '';
    DOM.profileSelect.value = state.currentProfile || '';
    DOM.profileSelectResult.value = state.currentProfile || '';
}

/**
 * Wrapper for async button handlers with common loading/error/disabled state management.
 * @param {HTMLElement} btn - The button element
 * @param {string} loadingText - Text to show in processing area
 * @param {string} completeText - Text to show on completion
 * @param {string} progressWidth - Progress bar width percentage
 * @param {Function} operation - Async function to execute
 * @param {string} errorMsg - Error message prefix
 */
export function createAsyncHandler(btn, loadingText, completeText, progressWidth, operation, errorMsg) {
    return async () => {
        if (state.isProcessing) return;
        state.isProcessing = true;
        btn.disabled = true;
        try {
            DOM.processingText.textContent = loadingText;
            DOM.progressFill.style.width = progressWidth;
            await operation();
            DOM.processingText.textContent = completeText;
        } catch (err) {
            console.error(`${errorMsg} failed:`, err);
            showError(err.message || `${errorMsg} failed. Please try again.`);
        } finally {
            state.isProcessing = false;
            btn.disabled = false;
        }
    };
}
