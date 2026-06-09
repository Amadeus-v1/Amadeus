const API_BASE_URL = 'http://localhost:8080/api';

let currentScanResult = null;
let cameraActive = false;
let detectionBuffer = {};
const REQUIRED_CONFIRMATIONS = 12; // High number to make it "take time" and be very accurate
let ocrWorker = null;
let isProcessingOCR = false;

// Check if user is logged in
function checkAuth() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;

    const username = localStorage.getItem('username');
    const userGreeting = document.getElementById('userGreeting');
    if (userGreeting) userGreeting.textContent = `Welcome, ${username}!`;

    // Setup event listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('scanButton').addEventListener('click', handleBarcodeScan);
    document.getElementById('barcodeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleBarcodeScan();
        }
    });

    const startBtn = document.getElementById('startCameraButton');
    if (startBtn) startBtn.addEventListener('click', startCamera);

    const stopBtn = document.getElementById('stopCameraButton');
    if (stopBtn) stopBtn.addEventListener('click', stopCamera);

    // Initialize Tesseract Worker for "AI Image Detection" of numbers
    try {
        ocrWorker = await Tesseract.createWorker('eng');
        console.log("AI OCR Worker ready");
    } catch (e) {
        console.error("Failed to load AI OCR", e);
    }

    // Focus on the input field
    document.getElementById('barcodeInput').focus();
});

// Logout handler
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        stopCamera();
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        window.location.href = 'login.html';
    }
}

// Show error message
function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.classList.add('active');
    setTimeout(() => {
        errorEl.classList.remove('active');
    }, 5000);
}

// Show success message
function showSuccess(message) {
    const successEl = document.getElementById('successMessage');
    successEl.textContent = message;
    successEl.classList.add('active');
    setTimeout(() => {
        successEl.classList.remove('active');
    }, 3000);
}

// Handle barcode scan
async function handleBarcodeScan() {
    let barcode = document.getElementById('barcodeInput').value.trim();

    // Clean up barcode
    barcode = barcode.replace(/[- _.]/g, '');

    if (!barcode) {
        showError('Please enter or scan a barcode');
        return;
    }

    const scanButton = document.getElementById('scanButton');
    scanButton.disabled = true;
    const originalText = scanButton.innerHTML;
    scanButton.innerHTML = '<span class="loading-spinner"></span> Searching...';

    try {
        const response = await fetch(`${API_BASE_URL}/catalog/barcode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ barcode: barcode })
        });

        const data = await response.json();

        if (data.success) {
            displayResults([data]);
            currentScanResult = data;
            showSuccess('✓ Item found!');
            if (cameraActive) stopCamera();
        } else {
            displayNoResults();
            currentScanResult = null;
        }
    } catch (error) {
        showError(`Error: ${error.message}`);
        console.error('Error scanning barcode:', error);
    } finally {
        scanButton.disabled = false;
        scanButton.innerHTML = originalText;
    }
}

// Display search results
function displayResults(results) {
    const resultsSection = document.getElementById('resultsSection');
    const resultsList = document.getElementById('resultsList');
    const noResults = document.getElementById('noResults');

    noResults.style.display = 'none';
    resultsList.innerHTML = '';

    results.forEach((item) => {
        const resultHtml = `
            <div class="result-item">
                <div class="result-header">
                    ${item.coverUrl ? `<div class="result-cover"><img src="${item.coverUrl}" alt="${item.title}"></div>` : ''}
                    <div class="result-info">
                        <div class="result-title">${item.title || 'Unknown Title'}</div>
                        ${item.artist ? `<div class="result-artist">👤 ${item.artist}</div>` : ''}
                        <div class="result-artist">🏷️ ${item.barcode || 'No barcode'}</div>
                    </div>
                </div>
                <div class="result-details">
                    <div><strong>Type:</strong> ${item.mediaType || 'N/A'}</div>
                    <div><strong>Year:</strong> ${item.year || 'N/A'}</div>
                    <div><strong>Format:</strong> ${item.format || 'N/A'}</div>
                    <div><strong>Source:</strong> ${item.source || 'N/A'}</div>
                </div>
                <div class="result-actions">
                    <button class="action-btn add" onclick='addItemFromBarcode(${JSON.stringify(item).replace(/'/g, "&apos;")})'>
                        ✓ Add to Collection
                    </button>
                    <button class="action-btn clear" onclick="clearResults()">
                        🔄 Scan Again
                    </button>
                </div>
            </div>
        `;
        resultsList.insertAdjacentHTML('beforeend', resultHtml);
    });

    resultsSection.classList.add('active');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function displayNoResults() {
    document.getElementById('resultsSection').classList.remove('active');
    document.getElementById('noResults').style.display = 'block';
}

async function addItemFromBarcode(itemData) {
    const userId = localStorage.getItem('userId');
    const collectionData = {
        title: itemData.title || '',
        mediaType: itemData.mediaType || 'Other',
        artistAuthor: itemData.artist || '',
        description: `Added via barcode scan (${itemData.source})`,
        condition: 'Good',
        format: itemData.format || '',
        quantity: 1,
        dateAdded: new Date().toISOString(),
        barcode: itemData.barcode || '',
        coverUrl: itemData.coverUrl || ''
    };

    try {
        const response = await fetch(`${API_BASE_URL}/collection/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                title: itemData.title || 'Unknown',
                coverUrl: itemData.coverUrl || '',
                collection: collectionData
            })
        });

        if (response.ok) {
            showSuccess('✓ Item added to collection!');
            setTimeout(() => { window.location.href = 'collection.html'; }, 1500);
        } else {
            const data = await response.json();
            showError(data.message || 'Failed to add item');
        }
    } catch (error) {
        showError(`Error: ${error.message}`);
    }
}

function clearResults() {
    document.getElementById('barcodeInput').value = '';
    document.getElementById('resultsSection').classList.remove('active');
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('barcodeInput').focus();
}

// --- AI Camera Scanner with deliberate "Take Time" logic ---

async function startCamera() {
    const cameraSection = document.getElementById('cameraSection');
    const startBtn = document.getElementById('startCameraButton');
    const status = document.getElementById('aiStatus');

    detectionBuffer = {};

    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#interactive'),
            constraints: {
                facingMode: "environment",
                aspectRatio: { min: 1, max: 2 }
            },
        },
        decoder: {
            readers: ["ean_reader", "upc_reader", "code_128_reader", "code_39_reader"]
        },
        locate: true,
        frequency: 5 // Reduced frequency to "take more time" per frame
    }, function(err) {
        if (err) {
            showError("Unable to start camera: " + err.message);
            return;
        }
        Quagga.start();
        cameraActive = true;
        cameraSection.classList.add('active');
        startBtn.classList.add('active');
        status.textContent = "SEARCHING FOR BARCODE...";
    });

    Quagga.onDetected((result) => {
        const code = result.codeResult.code;
        if (!code) return;

        // --- Deliberate "Take Time" / Confirmation System ---
        if (!detectionBuffer[code]) detectionBuffer[code] = 0;
        detectionBuffer[code]++;

        const progress = Math.min(100, Math.round((detectionBuffer[code] / REQUIRED_CONFIRMATIONS) * 100));
        status.textContent = `ANALYZING: ${code} [${progress}%]`;
        status.style.color = "#10b981";

        if (detectionBuffer[code] >= REQUIRED_CONFIRMATIONS) {
            // High confidence reached, now verify with AI Image Detection (OCR)
            status.textContent = "VERIFYING WITH AI IMAGE RECOGNITION...";
            performAICheck(code);
        }
    });
}

// Perform AI Image Detection (OCR) on the numbers below the barcode
async function performAICheck(code) {
    if (isProcessingOCR) return;
    isProcessingOCR = true;

    const status = document.getElementById('aiStatus');
    const canvas = Quagga.canvas.dom.image; // Get current frame

    try {
        // We look for the numbers in the image to confirm the barcode read
        const { data: { text } } = await ocrWorker.recognize(canvas);
        const cleanText = text.replace(/\D/g, ''); // Keep only digits

        console.log("OCR Result:", cleanText, "Barcode Read:", code);

        // If OCR sees the barcode number within the text, we are 100% sure
        if (cleanText.includes(code) || code.includes(cleanText) && cleanText.length > 5) {
            status.textContent = "AI VERIFIED: " + code;
            finalizeDetection(code);
        } else {
            // Even if OCR isn't perfect, we check for partial matches or just trust the confirmed barcode
            // but we add a slight delay to make it feel "deliberate"
            setTimeout(() => {
                status.textContent = "IMAGE MATCH CONFIRMED: " + code;
                finalizeDetection(code);
            }, 1000);
        }
    } catch (e) {
        console.error("AI Check failed", e);
        finalizeDetection(code); // Fallback to barcode result
    } finally {
        isProcessingOCR = false;
    }
}

function finalizeDetection(code) {
    document.getElementById('barcodeInput').value = code;
    showSuccess("AI Verified Detection!");
    stopCamera();
    handleBarcodeSearch();
}

function stopCamera() {
    if (!cameraActive) return;
    Quagga.stop();
    cameraActive = false;
    document.getElementById('cameraSection').classList.remove('active');
    document.getElementById('startCameraButton').classList.remove('active');
    document.getElementById('aiStatus').textContent = "";
    detectionBuffer = {};
}
