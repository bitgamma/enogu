// Main entry point - initialization and event binding

import { DOM, ACTION_BUTTONS, RESOLUTIONS, state, generateRandomSeed } from './state.js';
import { analyzeImageAPI, generateImageAPI, loadProfiles as fetchProfiles, downloadAllProfiles } from './api.js';
import { showScreen, switchView, resetProgress, hideNotification, showError, showErrorActions, hideErrorActions, populateSelect, setupMobileCameraButton, resetState, createAsyncHandler } from './ui.js';
import { addToHistory } from './history.js';
import { populateEditorProfileList, switchEditorTab, saveCurrentProfile, duplicateCurrentProfile, renameCurrentProfile, deleteCurrentProfile, syncEditorSidebar, loadProfileContentIntoEditor } from './profile-editor.js';
import { saveConfigView, refreshLLMModels, loadConfigView } from './config-editor.js';

/**
 * Show the generate view.
 */
export function showGenerateView() {
    switchView(['editor', 'config'], 'generate');
}

/**
 * Show the profile editor view.
 */
export async function showProfileEditor() {
    switchView(['generate', 'config'], 'editor');
    populateEditorProfileList();
    syncEditorSidebar();
    if (state.currentProfile) {
        await loadProfileContentIntoEditor(state.currentProfile);
    }
}

/**
 * Show the config editor view.
 */
export function showConfigEditor() {
    switchView(['generate', 'editor'], 'config');
    loadConfigView();
}

/**
 * Handle file upload and preview.
 */
function handleFileUpload(file) {
    if (!file.type.startsWith('image/')) {
        showError('Please select an image file (PNG or JPG)');
        return;
    }
    
    state.selectedFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
        DOM.previewImage.src = ev.target.result;
        DOM.previewImage.style.display = 'block';
        startProcessing();
    };
    reader.readAsDataURL(file);
}

/**
 * Load profiles from backend and update UI.
 */
async function loadProfilesAndUI() {
    try {
        const profiles = await fetchProfiles();
        
        if (profiles.length > 0) {
            state.availableProfiles = [...profiles];
            state.profilesLoaded = true;
        } else {
            showError('No profiles available');
        }
    } catch (err) {
        console.error('Failed to load profiles:', err);
        showError('Failed to load profiles. Please refresh the page.');
    }
}

/**
 * Populate all profile selects from loaded data.
 */
function populateProfileSelects() {
    if (state.availableProfiles.length > 0) {
        populateSelect(DOM.profileSelect, state.availableProfiles, (name) => { state.currentProfile = name; });
        populateSelect(DOM.profileSelectResult, state.availableProfiles);
    }
}

/**
 * Refresh profiles and update all UIs.
 */
window.refreshProfilesAndUI = async function(extraCallback = null) {
    await loadProfilesAndUI();
    populateProfileSelects();
    populateEditorProfileList();
    if (extraCallback) extraCallback();
};

// Profile selection change handler
function handleProfileChange(e) {
    state.currentProfile = e.target.value;
    syncEditorSidebar();
}

// Image generation
async function generateImage(upscale = false) {
    DOM.progressFill.style.width = '75%';
    
    let seed;
    if (upscale && state.currentSeed !== null) {
        seed = state.currentSeed;
    } else {
        seed = generateRandomSeed();
    }
    state.currentSeed = seed;
    
    const data = await generateImageAPI(
        DOM.promptText.value,
        state.currentProfile,
        state.currentResolution.width,
        state.currentResolution.height,
        seed,
        upscale,
        state.upscaleResolution
    );
    
    const resultImage = DOM.resultImage;
    resultImage.src = data.image;
    resultImage.onload = () => {
        resultImage.style.display = 'block';
        DOM.regenerateBtn.disabled = false;
        DOM.progressFill.style.width = '100%';
        addToHistory(data.image, DOM.promptText.value);
    };
}

// Processing flow
async function startProcessing() {
    if (!state.currentProfile) {
        showError('Please select a profile first');
        return;
    }
    
    if (!state.selectedFile) {
        showError('Please upload an image first');
        return;
    }
    
    state.isProcessing = true;
    showScreen(2);
    resetProgress();
    hideErrorActions();
    
    try {
        await analyzeImage();
        await generateImage();
        showScreen(3);
        DOM.progressFill.style.width = '100%';
        DOM.stepIndicator3.classList.add('active', 'completed');
        state.isProcessing = false;
    } catch (err) {
        console.error('Processing failed:', err);
        showError(err.message || 'Processing failed. Please try again.');
        state.isProcessing = false;
        showErrorActions();
    }
}

async function analyzeImage() {
    DOM.processingText.textContent = 'Analyzing image with LLM...';
    DOM.progressFill.style.width = '50%';
    DOM.stepIndicator2.classList.add('active');
    
    const data = await analyzeImageAPI(state.selectedFile, state.currentProfile);
    
    DOM.promptText.value = data.prompt;
    DOM.processingText.textContent = 'Generating image...';
}

// ============== Event Binding ==============

document.addEventListener('DOMContentLoaded', async () => {
    // Load initial data
    await loadProfilesAndUI();
    populateProfileSelects();
    populateEditorProfileList();
    setupMobileCameraButton();
    
    // Profile select handlers
    DOM.profileSelect.addEventListener('change', handleProfileChange);
    DOM.profileSelectResult.addEventListener('change', handleProfileChange);
    
    // Navigation handlers
    DOM.navGenerate?.addEventListener('click', showGenerateView);
    DOM.navEditor?.addEventListener('click', showProfileEditor);
    DOM.navConfig?.addEventListener('click', showConfigEditor);
    DOM.refreshModelsBtn?.addEventListener('click', refreshLLMModels);
    DOM.saveConfigBtn?.addEventListener('click', saveConfigView);
    DOM.downloadAllBtn?.addEventListener('click', downloadAllProfiles);
    
    // Editor tab handlers
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchEditorTab(btn.dataset.tab));
    });
    
    // Profile editor handlers
    DOM.saveProfileBtn.addEventListener('click', saveCurrentProfile);
    DOM.duplicateProfileBtn.addEventListener('click', duplicateCurrentProfile);
    DOM.renameProfileBtn.addEventListener('click', renameCurrentProfile);
    DOM.deleteProfileBtn.addEventListener('click', deleteCurrentProfile);
    
    // Upload handlers
    DOM.uploadSection.addEventListener('click', () => DOM.fileInput.click());
    
    // Drag and drop
    const uploadSection = DOM.uploadSection;
    uploadSection.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadSection.classList.add('dragover');
    });
    
    uploadSection.addEventListener('dragleave', () => {
        uploadSection.classList.remove('dragover');
    });
    
    uploadSection.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadSection.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });
    
    // File input handlers
    DOM.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });
    DOM.cameraInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });
    
    // Camera button
    DOM.cameraBtn.addEventListener('click', () => DOM.cameraInput.click());
    
    // Action buttons - attach operation handlers after DOM is ready
    ACTION_BUTTONS[0].operation = async () => { 
        DOM.stepIndicator2.classList.add('active'); 
        const data = await analyzeImageAPI(state.selectedFile, state.currentProfile); 
        DOM.promptText.value = data.prompt; 
    };
    ACTION_BUTTONS[1].operation = () => generateImage(false);
    ACTION_BUTTONS[2].operation = () => generateImage(true);
    
    ACTION_BUTTONS.forEach(({ btn, loading, complete, progress, operation, error }) => {
        btn.addEventListener('click', createAsyncHandler(btn, loading, complete, progress, operation, error));
    });
    
    // Control handlers
    DOM.upscaleResolutionSelect.addEventListener('change', (e) => {
        state.upscaleResolution = parseInt(e.target.value, 10);
    });
    
    DOM.newBtn.addEventListener('click', () => {
        resetState();
        showScreen(1);
    });
    
    DOM.resolutionSelect.addEventListener('change', (e) => {
        state.currentResolution = RESOLUTIONS[e.target.value] || { width: 768, height: 1024 };
    });
    
    DOM.downloadBtn.addEventListener('click', () => {
        if (DOM.resultImage.src) {
            const link = document.createElement('a');
            link.href = DOM.resultImage.src;
            link.download = `generated-image-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    });
    
    // Notification handlers
    DOM.errorClose.addEventListener('click', hideNotification);
    document.addEventListener('click', (e) => {
        if (e.target === DOM.errorContainer) {
            hideNotification();
        }
    });
    
    // Error action handlers
    DOM.tryAgainBtn.addEventListener('click', () => {
        hideErrorActions();
        hideNotification();
        startProcessing();
    });
    
    DOM.cancelBtn.addEventListener('click', () => {
        hideErrorActions();
        hideNotification();
        resetState();
        showScreen(1);
    });
});
