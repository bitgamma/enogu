// Main entry point - initialization and event binding

import { DOM, ACTION_BUTTONS, RESOLUTIONS, state, generateRandomSeed } from './state.js';
import { analyzeImageAPI, generateImageAPI, downloadAllProfiles, downloadAllWorkflows, loadGallery, deleteGalleryImage, deleteAllGalleryImages } from './api.js';
import { showScreen, switchView, resetProgress, hideNotification, showError, showErrorActions, hideErrorActions, setupMobileCameraButton, resetState, createAsyncHandler, showSuccess, showConfirm } from './ui.js';
import { refreshProfilesAndUI, refreshWorkflowsAndUI, populateProfileSelects, populateWorkflowSelects, loadProfilesAndUI, loadWorkflowsAndUI } from './refresh.js';
import { addToHistory, updateHistoryImage, renderHistory } from './history.js';
import { populateEditorProfileList, syncEditorSidebar, loadProfileContentIntoEditor, saveCurrentProfile, duplicateCurrentProfile, renameCurrentProfile, deleteCurrentProfile } from './profile-editor.js';
import { populateEditorWorkflowList, syncWorkflowEditorSidebar, loadWorkflowContentIntoEditor, saveCurrentWorkflow, duplicateCurrentWorkflow, renameCurrentWorkflow, deleteCurrentWorkflow, selectWorkflowForEdit } from './workflow-editor.js';
import { saveConfigView, refreshLLMModels, loadConfigView } from './config-editor.js';

/**
 * Show the generate view.
 */
export function showGenerateView() {
    switchView(['profiles', 'workflows', 'gallery', 'config'], 'generate');
}

/**
 * Show the profile editor view.
 */
export async function showProfileEditor() {
    switchView(['generate', 'workflows', 'gallery', 'config'], 'profiles');
    populateEditorProfileList();
    syncEditorSidebar();
    if (state.currentProfile) {
        await loadProfileContentIntoEditor(state.currentProfile);
    }
}

/**
 * Show the workflow editor view.
 */
export async function showWorkflowEditor() {
    switchView(['generate', 'profiles', 'gallery', 'config'], 'workflows');
    populateEditorWorkflowList();
    syncWorkflowEditorSidebar();
    if (state.currentWorkflow) {
        await loadWorkflowContentIntoEditor(state.currentWorkflow);
    }
}

/**
 * Show the config editor view.
 */
export function showConfigEditor() {
    switchView(['generate', 'profiles', 'workflows', 'gallery'], 'config');
    loadConfigView();
}

/**
 * Show the gallery view.
 */
export async function showGalleryView() {
    switchView(['generate', 'profiles', 'workflows', 'config'], 'gallery');
    await loadAndRenderGallery();
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

// Profile selection change handler
function handleProfileChange(e) {
    state.currentProfile = e.target.value;
    syncEditorSidebar();
}

// Workflow selection change handler
function handleWorkflowChange(e) {
    state.currentWorkflow = e.target.value;
    syncWorkflowEditorSidebar();
}

// Image generation
async function generateImage(upscale = false, save = false, resolutionMultiplier = 1) {
    DOM.progressFill.style.width = '75%';

    if (!state.currentWorkflow) {
        showError('Please select a workflow first');
        return;
    }

    let seed;
    if (upscale && state.currentSeed !== null) {
        seed = state.currentSeed;
    } else {
        seed = generateRandomSeed();
    }
    state.currentSeed = seed;

    const width = Math.round(state.currentResolution.width * resolutionMultiplier);
    const height = Math.round(state.currentResolution.height * resolutionMultiplier);

    // Snapshot current prompt for history (before any async operations)
    const promptSnapshot = DOM.promptText.value;

    // Store generation parameters for save-to-gallery re-execution
    state.lastGenerationParams = {
        prompt: promptSnapshot,
        workflow: state.currentWorkflow,
        width: width,
        height: height,
        seed: seed,
        upscale: upscale,
        upscaleResolution: state.upscaleResolution,
    };

    // Create history placeholder immediately with all metadata
    addToHistory('', promptSnapshot, {
        seed: seed,
        workflow: state.currentWorkflow,
        width: state.currentResolution.width,
        height: state.currentResolution.height,
        resolutionMultiplier: resolutionMultiplier,
    });
    state.historyResolutionMultiplier = resolutionMultiplier;

    let data;
    try {
        data = await generateImageAPI(
            promptSnapshot,
            state.currentWorkflow,
            width,
            height,
            seed,
            upscale,
            state.upscaleResolution,
            save
        );

        // Update history with the generated image
        updateHistoryImage(0, data.image);
    } catch (err) {
        state.imageHistory.splice(0, 1);
        renderHistory();
        throw err;
    }

    const resultImage = DOM.resultImage;
    resultImage.src = data.image;
    resultImage.onload = () => {
        resultImage.style.display = 'block';
        DOM.regenerateBtn.disabled = false;
        DOM.progressFill.style.width = '100%';
    };
}

// Save to gallery - re-execute generation with original parameters and same seed
async function saveToGallery() {
    if (!state.lastGenerationParams) {
        showError('No image to save');
        return;
    }
    const params = state.lastGenerationParams;
    DOM.progressFill.style.width = '75%';

    const data = await generateImageAPI(
        params.prompt,
        params.workflow,
        params.width,
        params.height,
        params.seed,
        params.upscale,
        params.upscaleResolution,
        true  // save to gallery
    );

    const resultImage = DOM.resultImage;
    resultImage.src = data.image;
    resultImage.onload = () => {
        resultImage.style.display = 'block';
        DOM.progressFill.style.width = '100%';
        addToHistory(data.image, params.prompt, {
            seed: params.seed,
            workflow: params.workflow,
            width: Math.round(params.width / (state.historyResolutionMultiplier || 1)),
            height: Math.round(params.height / (state.historyResolutionMultiplier || 1)),
            resolutionMultiplier: state.historyResolutionMultiplier || 1,
        });
        showSuccess('Image saved to gallery');
    };
}

// Processing flow
async function startProcessing() {
    if (!state.currentProfile) {
        showError('Please select a profile first');
        return;
    }

    if (!state.currentWorkflow) {
        showError('Please select a workflow first');
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

// ============== Gallery Functions ==============

/**
 * Load gallery data from backend and render it.
 */
async function loadAndRenderGallery() {
    try {
        state.galleryItems = await loadGallery();
        renderGallery();
    } catch (err) {
        console.error('Failed to load gallery:', err);
        showError('Failed to load gallery');
    }
}

/**
 * Render gallery grid from state.galleryItems.
 */
function renderGallery() {
    const grid = DOM.galleryGrid;
    const empty = DOM.galleryEmpty;
    grid.innerHTML = '';

    if (state.galleryItems.length === 0) {
        grid.style.display = 'none';
        empty.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    empty.style.display = 'none';

    state.galleryItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'gallery-item';
        if (state.downloadedGalleryFiles.has(item.filename)) {
            card.classList.add('gallery-item-downloaded');
        }

        const img = document.createElement('img');
        img.src = `/api/gallery/${encodeURIComponent(item.filename)}`;
        img.alt = item.filename;
        img.loading = 'lazy';

        const info = document.createElement('div');
        info.className = 'gallery-item-info';

        const name = document.createElement('span');
        name.className = 'gallery-item-name';
        name.textContent = item.filename;

        const meta = document.createElement('span');
        meta.className = 'gallery-item-meta';
        const date = new Date(item.created_at * 1000);
        meta.textContent = `${formatFileSize(item.size)} · ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

        info.appendChild(name);
        info.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'gallery-item-actions';

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn-icon';
        downloadBtn.title = 'Download';
        downloadBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.downloadedGalleryFiles.add(item.filename);
            card.classList.add('gallery-item-downloaded');
            const link = document.createElement('a');
            link.href = `/api/gallery/${encodeURIComponent(item.filename)}`;
            link.download = item.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-icon btn-icon-danger';
        deleteBtn.title = 'Delete';
        deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await deleteGalleryImage(item.filename);
                showSuccess('Image deleted');
                await loadAndRenderGallery();
            } catch (err) {
                showError(err.message || 'Failed to delete image');
            }
        });

        actions.appendChild(downloadBtn);
        actions.appendChild(deleteBtn);

        card.appendChild(img);
        card.appendChild(info);
        card.appendChild(actions);
        grid.appendChild(card);
    });
}

/**
 * Format file size in human-readable form.
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============== Event Binding ==============

document.addEventListener('DOMContentLoaded', async () => {
    // Load initial data
    await loadProfilesAndUI();
    await loadWorkflowsAndUI();
    populateProfileSelects();
    populateWorkflowSelects();
    populateEditorProfileList();
    populateEditorWorkflowList();
    setupMobileCameraButton();

    // Profile select handlers
    DOM.profileSelect.addEventListener('change', handleProfileChange);
    DOM.profileSelectResult.addEventListener('change', handleProfileChange);

    // Workflow select handlers
    DOM.workflowSelect.addEventListener('change', handleWorkflowChange);
    DOM.workflowSelectResult.addEventListener('change', handleWorkflowChange);

    // Navigation handlers
    DOM.navGenerate?.addEventListener('click', showGenerateView);
    DOM.navProfiles?.addEventListener('click', showProfileEditor);
    DOM.navWorkflows?.addEventListener('click', showWorkflowEditor);
    DOM.navGallery?.addEventListener('click', showGalleryView);
    DOM.navConfig?.addEventListener('click', showConfigEditor);
    DOM.refreshModelsBtn?.addEventListener('click', refreshLLMModels);
    DOM.saveConfigBtn?.addEventListener('click', saveConfigView);
    DOM.downloadAllProfilesBtn?.addEventListener('click', downloadAllProfiles);
    DOM.downloadAllWorkflowsBtn?.addEventListener('click', downloadAllWorkflows);

    // Gallery handlers
    DOM.refreshGalleryBtn?.addEventListener('click', loadAndRenderGallery);
    DOM.deleteAllGalleryBtn?.addEventListener('click', async () => {
        if (state.galleryItems.length === 0) return;
        const confirmed = await showConfirm('Are you sure you want to delete all saved images? This action cannot be undone.');
        if (!confirmed) return;
        try {
            await deleteAllGalleryImages();
            showSuccess('All images deleted');
            await loadAndRenderGallery();
        } catch (err) {
            showError(err.message || 'Failed to delete all images');
        }
    });

    // Profile editor tab handlers (none needed - single textarea)

    // Workflow editor tab handlers
    document.querySelectorAll('#workflowEditorTabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            import('./workflow-editor.js').then(mod => mod.switchWorkflowEditorTab(btn.dataset.tab));
        });
    });

    // Profile editor handlers
    DOM.saveProfileBtn.addEventListener('click', saveCurrentProfile);
    DOM.duplicateProfileBtn.addEventListener('click', duplicateCurrentProfile);
    DOM.renameProfileBtn.addEventListener('click', renameCurrentProfile);
    DOM.deleteProfileBtn.addEventListener('click', deleteCurrentProfile);

    // Workflow editor handlers
    DOM.saveWorkflowBtn.addEventListener('click', saveCurrentWorkflow);
    DOM.duplicateWorkflowBtn.addEventListener('click', duplicateCurrentWorkflow);
    DOM.renameWorkflowBtn.addEventListener('click', renameCurrentWorkflow);
    DOM.deleteWorkflowBtn.addEventListener('click', deleteCurrentWorkflow);

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
    const actionOperations = {
        reanalyze: async () => {
            DOM.stepIndicator2.classList.add('active');
            const data = await analyzeImageAPI(state.selectedFile, state.currentProfile);
            DOM.promptText.value = data.prompt;
        },
        regenerate: () => generateImage(false, false, 1),
        regenerate15: () => generateImage(false, false, 1.5),
        regenerate2: () => generateImage(false, false, 2),
        upscale: () => {
            const multiplier = state.historyResolutionMultiplier || 1;
            generateImage(true, true, multiplier);
        },
        saveToGallery,
    };

    ACTION_BUTTONS.forEach(({ btn, loading, complete, progress, key, error }) => {
        const operation = actionOperations[key];
        if (operation) {
            btn.addEventListener('click', createAsyncHandler(btn, loading, complete, progress, operation, error));
        }
    });

    // Control handlers
    DOM.upscaleResolutionSelect.addEventListener('change', (e) => {
        state.upscaleResolution = parseInt(e.target.value, 10);
    });

    DOM.newBtn.addEventListener('click', () => {
        resetState();
        state.historyResolutionMultiplier = null;
        showScreen(1);
    });

    DOM.resolutionSelect.addEventListener('change', (e) => {
        state.currentResolution = RESOLUTIONS[e.target.value] || { width: 768, height: 1024 };
        state.historyResolutionMultiplier = null;
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
