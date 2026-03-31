// Image Generator Frontend
// Streamlined single-screen flow with auto-trigger analysis and generation

// DOM Elements
const profileSelect = document.getElementById('profileSelect');
const uploadSection = document.getElementById('uploadSection');
const fileInput = document.getElementById('fileInput');
const cameraInput = document.getElementById('cameraInput');
const cameraBtn = document.getElementById('cameraBtn');
const previewImage = document.getElementById('previewImage');
const newBtn = document.getElementById('newBtn');
const reanalyzeBtn = document.getElementById('reanalyzeBtn');
const regenerateBtn = document.getElementById('regenerateBtn');
const promptText = document.getElementById('promptText');
const resolutionSelect = document.getElementById('resolutionSelect');
const errorContainer = document.getElementById('errorContainer');
const errorMessage = document.getElementById('errorMessage');
const errorClose = document.getElementById('errorClose');
const tryAgainBtn = document.getElementById('tryAgainBtn');
const cancelBtn = document.getElementById('cancelBtn');
const errorActions = document.getElementById('errorActions');
const downloadBtn = document.getElementById('downloadBtn');

// Processing Elements
const progressFill = document.getElementById('progressFill');
const stepIndicator1 = document.getElementById('stepIndicator1');
const stepIndicator2 = document.getElementById('stepIndicator2');
const stepIndicator3 = document.getElementById('stepIndicator3');
const processingText = document.getElementById('processingText');

// Screens
const screen1 = document.getElementById('screen1');
const screen2 = document.getElementById('screen2');
const screen3 = document.getElementById('screen3');

// State
let currentProfile = null;
let selectedFile = null;
let generatedPrompt = null;
let availableProfiles = [];
let currentResolution = { width: 1024, height: 1024 };
let isProcessing = false;
let imageHistory = [];
const MAX_HISTORY = 10;

// DOM Elements for history
const historyContainer = document.getElementById('historyContainer');

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadProfiles();
    setupMobileCameraButton();
});

// Load available profiles from backend
async function loadProfiles() {
    try {
        const response = await fetch('/api/profiles');
        const data = await response.json();
        
        if (data.profiles && data.profiles.length > 0) {
            availableProfiles = data.profiles;
            profileSelect.innerHTML = '';
            data.profiles.forEach((profile, index) => {
                const option = document.createElement('option');
                option.value = profile.name;
                option.textContent = profile.name;
                profileSelect.appendChild(option);
                
                // Auto-select first profile
                if (index === 0) {
                    option.selected = true;
                    currentProfile = profile.name;
                }
            });
        } else {
            showError('No profiles available');
            profileSelect.innerHTML = '<option value="">No profiles available</option>';
        }
    } catch (err) {
        console.error('Failed to load profiles:', err);
        showError('Failed to load profiles. Please refresh the page.');
        profileSelect.innerHTML = '<option value="">Error loading profiles</option>';
    }
}

// Profile selection change handler
profileSelect.addEventListener('change', (e) => {
    currentProfile = e.target.value;
    console.log(`Selected profile: ${currentProfile}`);
});

// Upload section click
uploadSection.addEventListener('click', () => fileInput.click());

// Drag and drop
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
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

// File input change
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// Camera input change handler
cameraInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// Camera button click handler
cameraBtn.addEventListener('click', () => {
    cameraInput.click();
});

// Detect mobile device and show camera button
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.innerWidth <= 768 && 'ontouchstart' in window);
}

function setupMobileCameraButton() {
    if (isMobileDevice()) {
        document.querySelector('.camera-button-container').style.display = 'flex';
    }
}

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        showError('Please select an image file (PNG or JPG)');
        return;
    }
    
    // Reset state
    resetState();
    
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result;
        previewImage.style.display = 'block';
        
        // Auto-start analysis and generation
        startProcessing();
    };
    reader.readAsDataURL(file);
}

function resetState() {
    selectedFile = null;
    generatedPrompt = null;
    promptText.value = '';
    previewImage.style.display = 'none';
    previewImage.src = '';
    document.getElementById('resultImage').style.display = 'none';
    document.getElementById('resultImage').src = '';
    regenerateBtn.disabled = true;
    hideError();
    resetProgress();
    // Reset file inputs to allow re-selecting the same file
    fileInput.value = '';
    cameraInput.value = '';
}

// Image History Functions
function addToHistory(imageSrc) {
    // Check if image already exists in history
    const existingIndex = imageHistory.findIndex(item => item.src === imageSrc);
    
    if (existingIndex !== -1) {
        // Move to front if already exists
        const item = imageHistory.splice(existingIndex, 1)[0];
        imageHistory.unshift(item);
    } else {
        // Add new image to front
        imageHistory.unshift({ src: imageSrc });
        
        // Remove oldest if exceeds max
        if (imageHistory.length > MAX_HISTORY) {
            imageHistory.pop();
        }
    }
    
    renderHistory();
}

function renderHistory() {
    historyContainer.innerHTML = '';
    
    imageHistory.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item' + (index === 0 ? ' active' : '');
        
        const img = document.createElement('img');
        img.src = item.src;
        img.alt = 'History image';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '✕';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            removeFromHistory(index);
        };
        
        historyItem.appendChild(img);
        historyItem.appendChild(removeBtn);
        
        historyItem.onclick = () => {
            // Load this image as the current result
            const resultImage = document.getElementById('resultImage');
            resultImage.src = item.src;
            resultImage.onload = () => {
                resultImage.style.display = 'block';
                regenerateBtn.disabled = false;
            };
            
            // Update active state
            renderHistory();
        };
        
        historyContainer.appendChild(historyItem);
    });
}

function removeFromHistory(index) {
    imageHistory.splice(index, 1);
    renderHistory();
    
    // If we removed the current result, clear it
    if (index === 0) {
        const resultImage = document.getElementById('resultImage');
        resultImage.style.display = 'none';
        resultImage.src = '';
    }
}

function clearHistory() {
    imageHistory = [];
    renderHistory();
}

function resetProgress() {
    progressFill.style.width = '0%';
    stepIndicator1.classList.add('active');
    stepIndicator1.classList.remove('completed');
    stepIndicator2.classList.remove('active', 'completed');
    stepIndicator3.classList.remove('active', 'completed');
}

// Screen navigation
function showScreen(screenNumber) {
    screen1.classList.remove('active');
    screen2.classList.remove('active');
    screen3.classList.remove('active');
    
    if (screenNumber === 1) {
        screen1.classList.add('active');
    } else if (screenNumber === 2) {
        screen2.classList.add('active');
    } else if (screenNumber === 3) {
        screen3.classList.add('active');
    }
}

// Start the processing flow (analyze + generate)
async function startProcessing() {
    if (!currentProfile) {
        showError('Please select a profile first');
        return;
    }
    
    if (!selectedFile) {
        showError('Please upload an image first');
        return;
    }
    
    isProcessing = true;
    showScreen(2);
    resetProgress();
    hideErrorActions();
    
    try {
        // Step 1: Analyze image
        await analyzeImage();
        
        // Step 2: Generate image
        await generateImage();
        
        // Step 3: Show result
        showScreen(3);
        progressFill.style.width = '100%';
        stepIndicator3.classList.add('active', 'completed');
        isProcessing = false;
        
    } catch (err) {
        console.error('Processing failed:', err);
        showError(err.message || 'Processing failed. Please try again.');
        isProcessing = false;
        showErrorActions();
    }
}

async function analyzeImage() {
    processingText.textContent = 'Analyzing image with LLM...';
    progressFill.style.width = '50%';
    stepIndicator2.classList.add('active');
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('profile', currentProfile);
    
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            // Use error_reason if provided, otherwise fall back to detail
            const errorMessage = data.error_reason || data.detail || 'Analysis failed';
            throw new Error(errorMessage);
        }
        
        generatedPrompt = data.prompt;
        promptText.value = generatedPrompt;
        
        // Move to generation
        processingText.textContent = 'Generating image...';
        
    } catch (err) {
        throw err;
    }
}

async function generateImage() {
    progressFill.style.width = '75%';
    
    const formData = new FormData();
    formData.append('prompt', promptText.value);
    formData.append('profile', currentProfile);
    formData.append('width', currentResolution.width);
    formData.append('height', currentResolution.height);
    
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Generation failed');
        }
        
        const resultImage = document.getElementById('resultImage');
        resultImage.src = data.image;
        resultImage.onload = () => {
        resultImage.style.display = 'block';
        regenerateBtn.disabled = false;
        progressFill.style.width = '100%';
        // Add to history
        addToHistory(data.image);
        };
        
    } catch (err) {
        throw err;
    }
}

// Re-analyze button handler - only re-analyze, don't regenerate
reanalyzeBtn.addEventListener('click', async () => {
    if (isProcessing) return;
    
    isProcessing = true;
    reanalyzeBtn.disabled = true;
    
    try {
        processingText.textContent = 'Re-analyzing image with LLM...';
        progressFill.style.width = '50%';
        stepIndicator2.classList.add('active');
        
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('profile', currentProfile);
        
        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            // Use error_reason if provided, otherwise fall back to detail
            const errorMessage = data.detail || 'Analysis failed';
            throw new Error(errorMessage);
        }
        
        generatedPrompt = data.prompt;
        promptText.value = generatedPrompt;
        
        processingText.textContent = 'Analysis complete';
        progressFill.style.width = '100%';
        
    } catch (err) {
        console.error('Re-analysis failed:', err);
        showError(err.message || 'Re-analysis failed. Please try again.');
    } finally {
        isProcessing = false;
        reanalyzeBtn.disabled = false;
    }
});

// Regenerate button handler - only regenerate, don't re-analyze
regenerateBtn.addEventListener('click', async () => {
    if (isProcessing) return;
    
    isProcessing = true;
    regenerateBtn.disabled = true;
    
    try {
        processingText.textContent = 'Generating image...';
        progressFill.style.width = '75%';
        
        const formData = new FormData();
        formData.append('prompt', promptText.value);
        formData.append('profile', currentProfile);
        formData.append('width', currentResolution.width);
        formData.append('height', currentResolution.height);
        
        const response = await fetch('/api/generate', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Generation failed');
        }
        
        const resultImage = document.getElementById('resultImage');
        resultImage.src = data.image;
        resultImage.onload = () => {
        resultImage.style.display = 'block';
        regenerateBtn.disabled = false;
        progressFill.style.width = '100%';
        processingText.textContent = 'Generation complete';
        // Add to history
        addToHistory(data.image);
        };
        
    } catch (err) {
        console.error('Regeneration failed:', err);
        showError(err.message || 'Regeneration failed. Please try again.');
    } finally {
        isProcessing = false;
        regenerateBtn.disabled = false;
    }
});

// New button handler - go back to first screen
newBtn.addEventListener('click', () => {
    resetState();
    showScreen(1);
});

// Resolution selector change handler
resolutionSelect.addEventListener('change', (e) => {
    const [width, height] = e.target.value.split('x').map(Number);
    currentResolution = { width, height };
});

// Download button handler
downloadBtn.addEventListener('click', () => {
    const resultImage = document.getElementById('resultImage');
    if (resultImage.src) {
        const link = document.createElement('a');
        link.href = resultImage.src;
        link.download = `generated-image-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});

// Error handling
function showError(message) {
    errorMessage.textContent = message;
    errorContainer.classList.add('show');
}

function hideError() {
    errorMessage.textContent = "";
    errorContainer.classList.remove('show');
}

errorClose.addEventListener('click', hideError);

// Close error on click outside
document.addEventListener('click', (e) => {
    if (e.target === errorContainer) {
        hideError();
    }
});

// Try again button handler
tryAgainBtn.addEventListener('click', () => {
    hideErrorActions();
    startProcessing();
});

// Cancel button handler
cancelBtn.addEventListener('click', () => {
    hideErrorActions();
    resetState();
    showScreen(1);
});

function showErrorActions() {
    errorActions.style.display = 'flex';
}

function hideErrorActions() {
    errorActions.style.display = 'none';
}
