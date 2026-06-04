const API_BASE_URL = 'http://localhost:8080/api';

let currentScanResult = null;
let cameraActive = false;
let cameraStream = null;

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
    document.getElementById('userGreeting').textContent = `Welcome, ${username}!`;

    // Setup event listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('scanButton').addEventListener('click', handleBarcodeScan);
    document.getElementById('barcodeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleBarcodeScan();
        }
    });

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

    // Clean up barcode: remove hyphens, spaces, and other formatting
    barcode = barcode
        .replace(/-/g, '')      // Remove hyphens
        .replace(/ /g, '')      // Remove spaces
        .replace(/_/g, '')      // Remove underscores
        .replace(/\./g, '');    // Remove dots

    if (!barcode) {
        showError('Please enter or scan a barcode');
        return;
    }

    const scanButton = document.getElementById('scanButton');
    scanButton.disabled = true;
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
        } else {
            displayNoResults(barcode);
            currentScanResult = null;
        }
    } catch (error) {
        showError(`Error: ${error.message}`);
        console.error('Error scanning barcode:', error);
    } finally {
        scanButton.disabled = false;
        scanButton.innerHTML = 'Search';
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
                    ${item.coverUrl ? `
                        <div class="result-cover">
                            <img src="${item.coverUrl}" alt="${item.title}" onerror="this.style.display='none'">
                        </div>
                    ` : ''}
                    <div class="result-info">
                        <div class="result-title">${item.title || 'Unknown Title'}</div>
                        ${item.artist ? `<div class="result-artist">👤 ${item.artist}</div>` : ''}
                        <div class="result-artist">🏷️ ${item.barcode || 'No barcode'}</div>
                    </div>
                </div>

                <div class="result-details">
                    ${item.mediaType ? `
                        <div class="detail-row">
                            <span class="detail-label">Media Type:</span>
                            <span>${item.mediaType}</span>
                        </div>
                    ` : ''}
                    ${item.year ? `
                        <div class="detail-row">
                            <span class="detail-label">Year:</span>
                            <span>${item.year}</span>
                        </div>
                    ` : ''}
                    ${item.format ? `
                        <div class="detail-row">
                            <span class="detail-label">Format:</span>
                            <span>${item.format}</span>
                        </div>
                    ` : ''}
                    ${item.publisher ? `
                        <div class="detail-row">
                            <span class="detail-label">Publisher:</span>
                            <span>${item.publisher}</span>
                        </div>
                    ` : ''}
                    ${item.source ? `
                        <div class="detail-row">
                            <span class="detail-label">Source:</span>
                            <span style="text-transform: capitalize;">${item.source}</span>
                        </div>
                    ` : ''}
                </div>

                <div class="result-actions">
                    <button class="action-btn add" onclick="addItemFromBarcode(${JSON.stringify(item).replace(/"/g, '&quot;')})">
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
}

// Display no results message
function displayNoResults(barcode) {
    const noResults = document.getElementById('noResults');
    const resultsSection = document.getElementById('resultsSection');

    resultsSection.classList.remove('active');
    noResults.style.display = 'block';
}

// Add item from barcode result
async function addItemFromBarcode(itemData) {
    const userId = localStorage.getItem('userId');

    // Map source media types to standardized Amadeus types
    const mediaTypeMap = {
        'Book': 'Book',
        'CD': 'CD',
        'DVD': 'DVD',
        'Blu-ray': 'Blu-ray',
        'Vinyl': 'Vinyl',
        'Cassette': 'Cassette',
        'Video Game': 'Video Game',
        'Collectible': 'Collectible',
        'Comic': 'Comic',
        'Other': 'Other'
    };

    const standardizedType = mediaTypeMap[itemData.mediaType] || itemData.mediaType || 'Other';

    // Prepare collection data
    const collectionData = {
        title: itemData.title || '',
        mediaType: standardizedType,
        artistAuthor: itemData.artist || '',
        description: `Added via barcode scan (${itemData.source})`,
        condition: 'Good',
        format: itemData.format || '',
        quantity: 1,
        dateAdded: new Date().toISOString(),
        barcode: itemData.barcode || ''
    };

    console.log('[barcode.js] Adding item with mediaType:', standardizedType);

    try {
        const response = await fetch(`${API_BASE_URL}/collection/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                title: itemData.title || 'Unknown',
                mediaType: standardizedType,
                collection: collectionData
            })
        });

        const data = await response.json();

        if (response.ok) {
            showSuccess('✓ Item added to collection!');
            setTimeout(() => {
                window.location.href = 'collection.html';
            }, 1500);
        } else {
            showError(data.message || 'Failed to add item');
        }
    } catch (error) {
        showError(`Error: ${error.message}`);
        console.error('Error adding item:', error);
    }
}

// Clear results and reset form
function clearResults() {
    document.getElementById('barcodeInput').value = '';
    document.getElementById('resultsSection').classList.remove('active');
    document.getElementById('noResults').style.display = 'none';
    currentScanResult = null;
    document.getElementById('barcodeInput').focus();
}

// Optional: Camera-based barcode scanning (for future enhancement)
async function startCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        const videoElement = document.getElementById('cameraVideo');
        videoElement.srcObject = cameraStream;
        cameraActive = true;
        document.getElementById('cameraSection').classList.add('active');
    } catch (error) {
        showError('Unable to access camera: ' + error.message);
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraActive = false;
        document.getElementById('cameraSection').classList.remove('active');
    }
}

// Optional: Capture frame from camera for further processing
function captureFrame() {
    if (!cameraActive) {
        showError('Camera not active');
        return;
    }

    const canvas = document.createElement('canvas');
    const video = document.getElementById('cameraVideo');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0);

    // Convert to base64 for processing
    const imageBase64 = canvas.toDataURL('image/jpeg').split(',')[1];
    
    // Show message about barcode recognition limitations
    showSuccess('📸 Frame captured. Manual barcode entry recommended for accuracy.');
    
    // Could send to barcode detection service here in future
    console.log('Frame captured:', imageBase64.substring(0, 50) + '...');
}
