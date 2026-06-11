const API_BASE_URL = 'http://localhost:8080/api';
let capturedImageBase64 = null;
let stream = null;

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
    document.getElementById('addItemForm').addEventListener('submit', handleAddItem);
    
    // UI Source Toggles
    const useCameraBtn = document.getElementById('useCameraBtn');
    const useUrlBtn = document.getElementById('useUrlBtn');
    const cameraSection = document.getElementById('cameraSection');
    const urlSection = document.getElementById('urlSection');
    
    useCameraBtn.addEventListener('click', () => {
        cameraSection.classList.remove('hidden');
        urlSection.classList.add('hidden');
        startCamera();
    });

    useUrlBtn.addEventListener('click', () => {
        cameraSection.classList.add('hidden');
        urlSection.classList.remove('hidden');
        stopCamera();
    });

    // Camera Controls
    document.getElementById('captureBtn').addEventListener('click', capturePhoto);
    document.getElementById('closeCameraBtn').addEventListener('click', () => {
        cameraSection.classList.add('hidden');
        urlSection.classList.remove('hidden');
        stopCamera();
    });

    // Live preview for cover URL
    const coverUrlInput = document.getElementById('itemCoverUrl');
    if (coverUrlInput) {
        coverUrlInput.addEventListener('input', updateCoverPreview);
    }
});

// Camera Functions
async function startCamera() {
    const video = document.getElementById('cameraVideo');
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' }, 
            audio: false 
        });
        video.srcObject = stream;
    } catch (err) {
        console.error("Error accessing camera: ", err);
        alert("Could not access camera. Please check permissions.");
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('photoCanvas');
    const previewContainer = document.getElementById('coverPreviewContainer');
    
    // Match canvas size to video aspect ratio
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to Base64 (using JPEG for better compression)
    capturedImageBase64 = canvas.toDataURL('image/jpeg', 0.8);
    
    // Update Preview
    previewContainer.innerHTML = `<img src="${capturedImageBase64}" alt="Captured" style="width: 100%; height: 100%; object-fit: cover;">`;
    
    // Show success state
    stopCamera();
    document.getElementById('cameraSection').classList.add('hidden');
    document.getElementById('urlSection').classList.remove('hidden');
    
    // Clear URL input since we have a capture
    document.getElementById('itemCoverUrl').value = "";
}

// Update cover preview for URL input
function updateCoverPreview() {
    const url = document.getElementById('itemCoverUrl').value.trim();
    const previewContainer = document.getElementById('coverPreviewContainer');
    
    if (url) {
        capturedImageBase64 = null; // Reset captured image if user starts typing a URL
        previewContainer.innerHTML = `<img src="${url}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='<span style=\'color: #ff4444; font-size: 0.8rem;\'>Invalid Image URL</span>'">`;
    } else if (!capturedImageBase64) {
        previewContainer.innerHTML = `<span style="color: var(--muted); font-size: 0.8rem;">Cover Preview</span>`;
    }
}

// Logout handler
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        window.location.href = 'login.html';
    }
}

// Show form message
function showFormMessage(message, type = 'success') {
    const messageEl = document.getElementById('formMessage');
    messageEl.textContent = message;
    messageEl.className = `error-message ${type === 'success' ? '' : 'active'}`;
    if (type === 'success') {
        messageEl.style.backgroundColor = '#10b981';
        messageEl.style.display = 'block';
        messageEl.classList.remove('hidden');
    } else {
        messageEl.style.backgroundColor = '#ff4444';
        messageEl.style.display = 'block';
        messageEl.classList.remove('hidden');
    }
    
    if (type === 'success') {
        setTimeout(() => {
            window.location.href = 'collection.html';
        }, 1500);
    }
}

// Handle add item form submission
async function handleAddItem(e) {
    e.preventDefault();

    const userId = localStorage.getItem('userId');
    const title = document.getElementById('itemTitle').value.trim();
    const mediaType = document.getElementById('itemMediaType').value;
    const condition = document.getElementById('itemCondition').value;
    const quantity = parseInt(document.getElementById('itemQuantity').value) || 1;
    const estimatedValue = parseFloat(document.getElementById('itemEstimatedValue').value) || 0;
    
    // Use captured image OR url input
    const urlInput = document.getElementById('itemCoverUrl').value.trim();
    const coverUrl = capturedImageBase64 || urlInput;

    if (!title || !mediaType || !condition) {
        showFormMessage('Please fill in all required fields', 'error');
        return;
    }

    const releaseDate = document.getElementById('itemReleaseDate').value;
    const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : 0;

    // Build item object with all details
    const itemData = {
        title: title,
        mediaType: mediaType,
        artistAuthor: document.getElementById('itemArtistAuthor').value.trim(),
        releaseYear: releaseYear,
        description: document.getElementById('itemDescription').value.trim(),
        condition: condition,
        format: document.getElementById('itemFormat').value.trim(),
        quantity: quantity,
        estimatedValue: estimatedValue,
        coverUrl: coverUrl,
        dateAdded: new Date().toISOString()
    };

    console.log('[add-item.js] Sending item data:', itemData);

    try {
        const response = await fetch(`${API_BASE_URL}/collection/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                title: title,
                coverUrl: coverUrl,
                collection: itemData
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showFormMessage(data.message || 'Failed to add item', 'error');
            return;
        }

        showFormMessage('✓ Item added successfully! Redirecting...', 'success');
    } catch (error) {
        showFormMessage(`Error: ${error.message}`, 'error');
        console.error('Error adding item:', error);
    }
}
