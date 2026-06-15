const API_BASE_URL = 'http://34.48.220.234:8080/api';

let currentScanResult = null;
let cameraActive = false;
let scannerInterval = null;
let isProcessing = false; // Prevent multiple simultaneous searches
let lastScannedCode = null; // Prevent repeated scans of the same item
let scanTarget = 'collection';

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
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;

    const username = localStorage.getItem('username');
    const userGreeting = document.getElementById('userGreeting');
    if (userGreeting) userGreeting.textContent = `Welcome, ${username}!`;

    // Setup event listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('scanButton').addEventListener('click', () => {
        const barcode = document.getElementById('barcodeInput').value;
        handleBarcodeSearch(barcode);
    });
    
    document.getElementById('barcodeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleBarcodeSearch(e.target.value);
        }
    });

    const toggleBtn = document.getElementById('toggleCameraButton');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleCamera);
    
    const stopBtn = document.getElementById('stopCameraButton');
    if (stopBtn) stopBtn.addEventListener('click', stopCamera);

    // Focus on the input field for immediate scanning
    document.getElementById('barcodeInput').focus();
});

// Target Selection
function setScanTarget(target) {
    scanTarget = target;
    const collBtn = document.getElementById('targetCollection');
    const wishBtn = document.getElementById('targetWishlist');
    
    if (target === 'collection') {
        collBtn.className = 'btn btn-primary';
        wishBtn.className = 'btn btn-secondary';
    } else {
        collBtn.className = 'btn btn-secondary';
        wishBtn.className = 'btn btn-primary';
    }
}

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
    errorEl.classList.remove('hidden');
    errorEl.style.display = 'block';
    setTimeout(() => {
        errorEl.classList.add('hidden');
        errorEl.style.display = 'none';
    }, 5000);
}

// Show success message
function showSuccess(message) {
    const successEl = document.getElementById('successMessage');
    successEl.textContent = message;
    successEl.classList.remove('hidden');
    successEl.style.display = 'block';
    setTimeout(() => {
        successEl.classList.add('hidden');
        successEl.style.display = 'none';
    }, 3000);
}

/**
 * Handle barcode search
 * @param {string} barcodeValue 
 * @param {boolean} autoAdd - Whether to automatically add the item if found
 */
async function handleBarcodeSearch(barcodeValue, autoAdd = false) {
    if (isProcessing) return;
    
    let barcode = (barcodeValue || '').toString().trim();
    // Clean up barcode
    barcode = barcode.replace(/[- _.]/g, '');

    if (!barcode) {
        showError('Please enter or scan a barcode');
        return;
    }

    isProcessing = true;
    const scanButton = document.getElementById('scanButton');
    const originalText = scanButton.innerHTML;
    
    scanButton.disabled = true;
    scanButton.innerHTML = 'Searching...';
    document.getElementById('barcodeInput').value = barcode;

    try {
        const response = await fetch(`${API_BASE_URL}/catalog/barcode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ barcode: barcode })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            displayResults([data]);
            currentScanResult = data;
            
            if (autoAdd) {
                showSuccess(`✓ Item found! Adding to ${scanTarget}...`);
                await addItemFromBarcode(data, false, scanTarget); // false = don't redirect yet
                if (cameraActive) stopCamera();
            } else {
                showSuccess('✓ Item found!');
                if (cameraActive) stopCamera();
            }
        } else {
            displayNoResults();
            currentScanResult = null;
            // If camera was active, we might want to keep it running but clear the status
            updateScannerStatus("No item found for this barcode.", true);
            setTimeout(() => {
                if (cameraActive) updateScannerStatus("Ready to scan", false);
            }, 3000);
        }
    } catch (error) {
        showError(`Error: ${error.message}`);
        console.error('Error scanning barcode:', error);
    } finally {
        isProcessing = false;
        scanButton.disabled = false;
        scanButton.innerHTML = originalText;
    }
}

// Display search results
function displayResults(results) {
    const resultsSection = document.getElementById('resultsSection');
    const resultsList = document.getElementById('resultsList');
    const noResults = document.getElementById('noResults');

    noResults.classList.add('hidden');
    resultsList.innerHTML = '';

    results.forEach((item) => {
        const itemJson = JSON.stringify(item).replace(/'/g, "&apos;");
        const resultHtml = `
            <div class="result-item-card">
                <div class="result-cover">
                    ${item.coverUrl ? `<img src="${item.coverUrl}" alt="${item.title}">` : `<div style="height: 150px; background: var(--border); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 3rem;">📦</div>`}
                </div>
                <div class="result-details">
                    <h3 style="margin-bottom: 4px;">${item.title || 'Unknown Title'}</h3>
                    ${item.artist ? `<p class="item-artist">👤 ${item.artist}</p>` : ''}
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 16px 0; font-size: 0.9rem;">
                        <div><strong>Type:</strong> ${item.mediaType || 'N/A'}</div>
                        <div><strong>Year:</strong> ${item.year || 'N/A'}</div>
                        <div><strong>Format:</strong> ${item.format || 'N/A'}</div>
                        <div><strong>Barcode:</strong> ${item.barcode || 'N/A'}</div>
                    </div>

                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        <button class="btn btn-primary" onclick='addItemFromBarcode(${itemJson}, true, "collection")'>
                            ✓ Add to Collection
                        </button>
                        <button class="btn" style="background: var(--accent); color: white;" onclick='addItemFromBarcode(${itemJson}, true, "wishlist")'>
                            ✨ Add to Wishlist
                        </button>
                        <button class="btn btn-secondary" onclick="clearResults()">
                            🔄 Scan Again
                        </button>
                    </div>
                </div>
            </div>
        `;
        resultsList.insertAdjacentHTML('beforeend', resultHtml);
    });

    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function displayNoResults() {
    document.getElementById('resultsSection').classList.add('hidden');
    document.getElementById('noResults').classList.remove('hidden');
}

async function addItemFromBarcode(itemData, redirect = true, target = 'collection') {
    const userId = localStorage.getItem('userId');
    const entryData = {
        title: itemData.title || '',
        mediaType: itemData.mediaType || 'Other',
        artistAuthor: itemData.artist || '',
        description: `Added via barcode scan (${itemData.source || 'api'})`,
        condition: 'Good',
        format: itemData.format || '',
        quantity: 1,
        dateAdded: new Date().toISOString(),
        barcode: itemData.barcode || '',
        coverUrl: itemData.coverUrl || '',
        visibility: 'public'
    };

    const endpoint = target === 'collection' ? '/collection/add' : '/wishlist/add';
    const payload = {
        userId: userId,
        title: itemData.title || 'Unknown',
        artist: itemData.artist || '',
        mediaType: itemData.mediaType || 'Other',
        format: itemData.format || '',
        year: itemData.year || 0,
        barcode: itemData.barcode || '',
        coverUrl: itemData.coverUrl || '',
        visibility: 'public'
    };
    
    if (target === 'collection') {
        payload.collection = entryData;
    } else {
        payload.wishlist = entryData;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            if (redirect) {
                showSuccess(`✓ Item added to ${target}!`);
                const redirectUrl = target === 'collection' ? 'collection.html' : 'wishlist.html';
                setTimeout(() => { window.location.href = redirectUrl; }, 1500);
            } else {
                showSuccess(`✓ Item added to ${target}!`);
            }
        } else {
            const data = await response.json();
            showError(data.message || `Failed to add item to ${target}`);
        }
    } catch (error) {
        showError(`Error: ${error.message}`);
    }
}

function clearResults() {
    document.getElementById('barcodeInput').value = '';
    document.getElementById('resultsSection').classList.add('hidden');
    document.getElementById('noResults').classList.add('hidden');
    document.getElementById('barcodeInput').focus();
    lastScannedCode = null;
}

// --- Camera Scanner Implementation ---

async function toggleCamera() {
    if (cameraActive) {
        stopCamera();
    } else {
        startCamera();
    }
}

async function startCamera() {
    const cameraSection = document.getElementById('cameraSection');
    const toggleBtn = document.getElementById('toggleCameraButton');
    
    isProcessing = false;
    lastScannedCode = null;

    // 1. Try Native BarcodeDetector API first
    if ('BarcodeDetector' in window) {
        try {
            const formats = await BarcodeDetector.getSupportedFormats();
            if (formats.includes('ean_13')) {
                startNativeScanner();
                return;
            }
        } catch (e) {
            console.warn('Native BarcodeDetector failed', e);
        }
    }

    // 2. Fallback to Quagga2
    startQuaggaScanner();
}

/**
 * Handles the logic for a single clear detection.
 */
function handleDetection(code) {
    if (!cameraActive || isProcessing) return;

    const cleanCode = code.toString().trim().replace(/[- _.]/g, '');
    if (!cleanCode || cleanCode.length < 8) return;

    // If we just scanned this code, don't trigger again immediately
    if (cleanCode === lastScannedCode) return;

    lastScannedCode = cleanCode;
    updateScannerStatus(`Detected: ${cleanCode}`, true);
    
    // Immediate search and add
    handleBarcodeSearch(cleanCode, true);
}

function updateScannerStatus(message, visible) {
    const statusOverlay = document.getElementById('scannerStatus');
    const statusText = document.getElementById('statusMessage');
    
    if (statusText) statusText.textContent = message;
    
    if (visible) {
        statusOverlay.classList.remove('hidden');
    } else {
        statusOverlay.classList.add('hidden');
    }
}

function startQuaggaScanner() {
    const cameraSection = document.getElementById('cameraSection');
    const toggleBtn = document.getElementById('toggleCameraButton');

    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#interactive'),
            constraints: {
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
        },
        decoder: {
            readers: ["ean_reader", "upc_reader", "code_128_reader"]
        },
        locate: true,
        halfSample: false
    }, function(err) {
        if (err) {
            showError("Unable to start camera: " + err.message);
            return;
        }
        Quagga.start();
        cameraActive = true;
        cameraSection.classList.remove('hidden');
        toggleBtn.textContent = "📷 Close Camera Scanner";
        updateScannerStatus("Align barcode in frame", true);
    });

    Quagga.onDetected((result) => {
        const code = result.codeResult.code;
        if (code) {
            handleDetection(code);
        }
    });
}

async function startNativeScanner() {
    const cameraSection = document.getElementById('cameraSection');
    const toggleBtn = document.getElementById('toggleCameraButton');
    const viewport = document.querySelector('#interactive');
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        
        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', true);
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        viewport.appendChild(video);
        await video.play();

        const barcodeDetector = new BarcodeDetector({ formats: ['ean_13', 'upc_a', 'code_128'] });
        
        cameraActive = true;
        cameraSection.classList.remove('hidden');
        toggleBtn.textContent = "📷 Close Camera Scanner";
        updateScannerStatus("Align barcode in frame", true);

        scannerInterval = setInterval(async () => {
            if (!cameraActive || isProcessing) return;
            try {
                const barcodes = await barcodeDetector.detect(video);
                if (barcodes.length > 0) {
                    handleDetection(barcodes[0].rawValue);
                }
            } catch (e) {
                console.error('Detection error', e);
            }
        }, 150); 

        viewport.stream = stream;

    } catch (err) {
        showError("Camera access denied.");
    }
}

function stopCamera() {
    if (!cameraActive) return;
    
    updateScannerStatus("", false);
    
    try { Quagga.stop(); } catch(e) {}
    if (scannerInterval) {
        clearInterval(scannerInterval);
        scannerInterval = null;
    }
    
    const viewport = document.querySelector('#interactive');
    if (viewport.stream) {
        viewport.stream.getTracks().forEach(track => track.stop());
        viewport.stream = null;
    }
    
    viewport.innerHTML = `
        <div id="scannerStatus" class="scanner-status-overlay hidden">
            <div class="status-content">
                <div class="status-spinner"></div>
                <span id="statusMessage">Evaluating...</span>
            </div>
        </div>
    `;
    
    cameraActive = false;
    document.getElementById('cameraSection').classList.add('hidden');
    document.getElementById('toggleCameraButton').textContent = "📷 Open Camera Scanner";
}
