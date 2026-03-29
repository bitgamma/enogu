// Image Generator Frontend
// Step-based navigation with profile selection and image upload

const profileSelect = document.getElementById('profileSelect');
const uploadSection = document.getElementById('uploadSection');
const fileInput = document.getElementById('fileInput');
const previewImage = document.getElementById('previewImage');
const analyzePreview = document.getElementById('analyzePreview');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const prev2Btn = document.getElementById('prev2Btn');
const generateBtn = document.getElementById('generateBtn');
const regenerateBtn = document.getElementById('regenerateBtn');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const error = document.getElementById('error');
const promptDisplay = document.getElementById('promptDisplay');
const promptText = document.getElementById('promptText');
const reanalyzeBtn = document.getElementById('reanalyzeBtn');
const generateLoading = document.getElementById('generateLoading');
const generateLoadingText = document.getElementById('generateLoadingText');
const generateError = document.getElementById('generateError');
const resultSection = document.getElementById('resultSection');
const resultImage = document.getElementById('resultImage');

let currentStep = 1;
let selectedFile = null;
let generatedPrompt = null;
let currentProfile = null;
let availableProfiles = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadProfiles();
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
            profileSelect.innerHTML = '<option value="">No profiles available</option>';
        }
    } catch (err) {
        console.error('Failed to load profiles:', err);
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

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        showError('Please select an image file', error);
        return;
    }
    
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result;
        previewImage.style.display = 'block';
        analyzePreview.src = e.target.result;
        analyzePreview.style.display = 'block';
        hideError(error);
    };
    reader.readAsDataURL(file);
}

// Step navigation
function goToStep(step) {
    // Update step content visibility
    document.querySelectorAll('.step-content').forEach((el, index) => {
        el.classList.toggle('active', index + 1 === step);
    });
    
    // Update progress indicator
    document.querySelectorAll('.step').forEach((el, index) => {
        el.classList.toggle('active', index + 1 === step);
        el.classList.toggle('completed', index + 1 < step);
    });
    
    currentStep = step;
}

// Step 1 -> Step 2
nextBtn.addEventListener('click', async () => {
    if (!currentProfile) {
        showError('Please select a profile', error);
        return;
    }
    
    if (!selectedFile) {
        showError('Please upload an image', error);
        return;
    }
    
    await analyzeImage();
});

// Step 2 -> Step 1 (back)
prevBtn.addEventListener('click', () => {
    goToStep(1);
});

// Step 2 -> Step 3
generateBtn.addEventListener('click', async () => {
    await generateImage();
});

// Step 3 -> Step 2 (back)
prev2Btn.addEventListener('click', () => {
    goToStep(2);
});

// Step 3 -> Regenerate
regenerateBtn.addEventListener('click', async () => {
    await generateImage();
});

async function analyzeImage() {
    showLoading(loading, loadingText, 'Analyzing image...');
    hideError(error);
    promptDisplay.style.display = 'none';
    
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
            throw new Error(data.detail || 'Analysis failed');
        }
        
        generatedPrompt = data.prompt;
        promptText.value = generatedPrompt;
        promptDisplay.style.display = 'block';
        generateBtn.disabled = false;
        
        // Move to next step
        goToStep(2);
        
    } catch (err) {
        showError(err.message, error);
    } finally {
        hideLoading(loading, loadingText);
    }
}

// Re-analyze button handler
reanalyzeBtn.addEventListener('click', async () => {
    // Update generatedPrompt with the edited value
    generatedPrompt = promptText.value;
    
    // Re-run analysis with the same image
    await analyzeImage();
});

async function generateImage() {
    showLoading(generateLoading, generateLoadingText, 'Generating image... This may take a moment.');
    hideError(generateError);
    resultSection.style.display = 'none';
    regenerateBtn.disabled = true;
    
    try {
        const formData = new FormData();
        formData.append('prompt', promptText.value);
        formData.append('profile', currentProfile);
        
        const response = await fetch('/api/generate', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Generation failed');
        }
        
        resultImage.src = data.image;
        resultSection.style.display = 'block';
        regenerateBtn.disabled = false;
        
        // Move to next step
        goToStep(3);
        
    } catch (err) {
        showError(err.message, generateError);
    } finally {
        hideLoading(generateLoading, generateLoadingText);
    }
}

function showLoading(loadingEl, textEl, text) {
    textEl.textContent = text;
    loadingEl.classList.add('active');
}

function hideLoading(loadingEl, textEl) {
    loadingEl.classList.remove('active');
}

function showError(message, errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

function hideError(errorEl) {
    errorEl.style.display = 'none';
}
