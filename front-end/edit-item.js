const API_BASE_URL = 'http://localhost:8080/api';

let currentItemId = null;

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

    // Get item ID from URL parameter
    const params = new URLSearchParams(window.location.search);
    currentItemId = params.get('id');

    if (!currentItemId) {
        showFormMessage('Item ID not provided', 'error');
        return;
    }

    // Setup event listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('editItemForm').addEventListener('submit', handleEditItem);
    document.getElementById('deleteBtn').addEventListener('click', handleDeleteItem);

    // Live preview for cover URL
    const coverUrlInput = document.getElementById('itemCoverUrl');
    if (coverUrlInput) {
        coverUrlInput.addEventListener('input', updateCoverPreview);
    }

    // Load item data
    loadItemData();
});

// Update cover preview
function updateCoverPreview() {
    const url = document.getElementById('itemCoverUrl').value.trim();
    const previewContainer = document.getElementById('coverPreviewContainer');
    
    if (url) {
        previewContainer.innerHTML = `<img src="${url}" alt="Preview" style="max-height: 100%; max-width: 100%; border-radius: 4px;" onerror="this.parentElement.innerHTML='<span style=\'color: #ff4444; font-size: 0.8rem;\'>Invalid Image URL</span>'">`;
    } else {
        previewContainer.innerHTML = `<span style="color: var(--muted); font-size: 0.8rem;">Image Preview</span>`;
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

// Load item data from collection
function loadItemData() {
    const userId = localStorage.getItem('userId');

    fetch(`${API_BASE_URL}/collection/list?userId=${encodeURIComponent(userId)}`)
        .then(response => response.json())
        .then(data => {
            const items = data.items || [];
            
            // Search for the specific item by ID
            const item = items.find(i => i.id === currentItemId || i.itemId === currentItemId);
            
            if (item) {
                populateForm(item);
            } else {
                showFormMessage('Item not found in your collection', 'error');
            }
        })
        .catch(error => {
            showFormMessage('Error loading item: ' + error.message, 'error');
            console.error('Error loading item:', error);
        });
}

// Populate form with item data
function populateForm(item) {
    document.getElementById('itemTitle').value = item.title || '';
    document.getElementById('itemMediaType').value = item.mediaType || '';
    document.getElementById('itemArtistAuthor').value = item.artist || item.artistAuthor || '';
    document.getElementById('itemYear').value = item.year || '';
    document.getElementById('itemDescription').value = item.notes || item.description || '';
    document.getElementById('itemCondition').value = item.condition || item.conditionLabel || '';
    document.getElementById('itemQuantity').value = item.quantity || 1;
    document.getElementById('itemFormat').value = item.format || '';
    document.getElementById('itemEstimatedValue').value = item.estimatedValue || 0;
    document.getElementById('itemBarcode').value = item.barcode || '';
    document.getElementById('itemCoverUrl').value = item.coverUrl || '';
    
    if (document.getElementById('itemVisibility')) {
        document.getElementById('itemVisibility').value = item.visibility || 'public';
    }
    
    // Trigger preview update
    updateCoverPreview();
}

// Handle edit item form submission
async function handleEditItem(e) {
    e.preventDefault();

    const userId = localStorage.getItem('userId');
    const title = document.getElementById('itemTitle').value.trim();
    const mediaType = document.getElementById('itemMediaType').value;
    const condition = document.getElementById('itemCondition').value;
    const quantity = parseInt(document.getElementById('itemQuantity').value) || 1;
    const estimatedValue = parseFloat(document.getElementById('itemEstimatedValue').value) || 0;
    const visibility = document.getElementById('itemVisibility') ? document.getElementById('itemVisibility').value : 'public';

    if (!title || !mediaType) {
        showFormMessage('Please fill in all required fields', 'error');
        return;
    }

    // Build update object
    const updateData = {
        itemId: currentItemId,
        userId: userId,
        title: title,
        mediaType: mediaType,
        artist: document.getElementById('itemArtistAuthor').value.trim(),
        year: parseInt(document.getElementById('itemYear').value) || 0,
        notes: document.getElementById('itemDescription').value.trim(),
        condition: condition,
        quantity: quantity,
        format: document.getElementById('itemFormat').value.trim(),
        estimatedValue: estimatedValue,
        barcode: document.getElementById('itemBarcode').value.trim(),
        coverUrl: document.getElementById('itemCoverUrl').value.trim(),
        visibility: visibility
    };

    try {
        const response = await fetch(`${API_BASE_URL}/collection/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        const data = await response.json();

        if (response.ok) {
            showFormMessage('✓ Item updated successfully! Redirecting...', 'success');
        } else {
            showFormMessage(data.message || 'Failed to update item', 'error');
        }
    } catch (error) {
        showFormMessage(`Error: ${error.message}`, 'error');
        console.error('Error updating item:', error);
    }
}

// Handle delete item
async function handleDeleteItem() {
    if (!confirm('Are you sure you want to delete this item from your collection? This action cannot be undone.')) {
        return;
    }

    const userId = localStorage.getItem('userId');

    try {
        const response = await fetch(`${API_BASE_URL}/collection/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                itemId: currentItemId,
                userId: userId
            })
        });

        const data = await response.json();

        if (response.ok) {
            showFormMessage('✓ Item deleted successfully! Redirecting...', 'success');
        } else {
            showFormMessage(data.message || 'Failed to delete item', 'error');
        }
    } catch (error) {
        showFormMessage(`Error: ${error.message}`, 'error');
        console.error('Error deleting item:', error);
    }
}
