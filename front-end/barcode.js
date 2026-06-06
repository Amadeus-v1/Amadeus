const API_BASE_URL = 'http://localhost:8080/api';

let currentScanResult = null;
let cameraActive = false;
let scannerInterval = null;

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
    document.getElementById('scanButton').addEventListener('click', handleBarcodeSearch);
    document.getElementById('barcodeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleBarcodeSearch();
        }
    });

    const toggleBtn = document.getElementById('toggleCameraButton');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleCamera);
    
    const stopBtn = document.getElementById('stopCameraButton');
    if (stopBtn) stopBtn.addEventListener('click', stopCamera);

    // Focus on the input field for immediate scanning
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
        successEl.classList.remove('hidden');
        successEl.style.display = 'none';
    }, 3000);
}

// Handle barcode search
async function handleBarcodeSearch() {
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
    scanButton.innerHTML = 'Searching...';

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

    noResults.classList.add('hidden');
    resultsList.innerHTML = '';

    results.forEach((item) => {
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
                        <button class="btn btn-primary" onclick='addItemFromBarcode(${JSON.stringify(item).replace(/'/g, "&apos;")})'>
                            ✓ Add to Collection
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

async function addItemFromBarcode(itemData) {
    const userId = localStorage.getItem('userId');
    const collectionData = {
        title: itemData.title || '',
        mediaType: itemData.mediaType || 'Other',
        artistAuthor: itemData.artist || '',
        description: `Added via barcode scan (${itemData.source || 'api'})`,
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
    document.getElementById('resultsSection').classList.add('hidden');
    document.getElementById('noResults').classList.add('hidden');
    document.getElementById('barcodeInput').focus();
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
    
    // 1. Try Native BarcodeDetector API first (Fastest, if available)
    if ('BarcodeDetector' in window) {
        try {
            const formats = await BarcodeDetector.getSupportedFormats();
            if (formats.length > 0) {
                console.log('Native BarcodeDetector supported');
                startNativeScanner();
                return;
            }
        } catch (e) {
            console.warn('Native BarcodeDetector failed, falling back to Quagga', e);
        }
    }

    // 2. Fallback to Quagga2
    startQuaggaScanner();
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
                width: { min: 640 },
                height: { min: 480 }
            },
        },
        decoder: {
            readers: ["ean_reader", "upc_reader", "code_128_reader", "code_39_reader"]
        },
        locate: true
    }, function(err) {
        if (err) {
            showError("Unable to start camera: " + err.message);
            return;
        }
        Quagga.start();
        cameraActive = true;
        cameraSection.classList.remove('hidden');
        toggleBtn.textContent = "📷 Close Camera Scanner";
    });

    Quagga.onDetected((result) => {
        const code = result.codeResult.code;
        if (code) {
            document.getElementById('barcodeInput').value = code;
            showSuccess("Barcode detected!");
            stopCamera();
            handleBarcodeSearch();
        }
    });
}

async function startNativeScanner() {
    const cameraSection = document.getElementById('cameraSection');
    const toggleBtn = document.getElementById('toggleCameraButton');
    const viewport = document.querySelector('#interactive');
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        
        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', true);
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        viewport.appendChild(video);
        await video.play();

        const barcodeDetector = new BarcodeDetector({ formats: ['ean_13', 'upc_a', 'upc_e', 'code_128'] });
        
        cameraActive = true;
        cameraSection.classList.remove('hidden');
        toggleBtn.textContent = "📷 Close Camera Scanner";

        scannerInterval = setInterval(async () => {
            if (!cameraActive) return;
            try {
                const barcodes = await barcodeDetector.detect(video);
                if (barcodes.length > 0) {
                    const code = barcodes[0].rawValue;
                    document.getElementById('barcodeInput').value = code;
                    showSuccess("Barcode detected!");
                    stopCamera();
                    handleBarcodeSearch();
                }
            } catch (e) {
                console.error('Detection error', e);
            }
        }, 500);

        // Store stream on viewport to stop it later
        viewport.stream = stream;

    } catch (err) {
        showError("Camera access denied.");
    }
}

function stopCamera() {
    if (!cameraActive) return;
    
    // Stop Quagga
    try { Quagga.stop(); } catch(e) {}
    
    // Stop Native Scanner
    if (scannerInterval) {
        clearInterval(scannerInterval);
        scannerInterval = null;
    }
    
    const viewport = document.querySelector('#interactive');
    if (viewport.stream) {
        viewport.stream.getTracks().forEach(track => track.stop());
        viewport.stream = null;
    }
    
    // Clean viewport
    viewport.innerHTML = '<div class="scanner-laser"></div>';
    
    cameraActive = false;
    document.getElementById('cameraSection').classList.add('hidden');
    document.getElementById('toggleCameraButton').textContent = "📷 Open Camera Scanner";
}
