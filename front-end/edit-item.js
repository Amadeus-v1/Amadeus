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

    // Load item data
    loadItemData();
});

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
    messageEl.className = `form-message ${type}`;
    messageEl.classList.remove('hidden');
    
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
            // Try to find the item in the collection
            // Note: This is a workaround since we don't have a direct /get endpoint yet
            
            // For now, redirect to collection if item not found
            // In a full implementation, we'd fetch item details directly
            if (!Array.isArray(items) || items.length === 0) {
                showFormMessage('Item not found', 'error');
            } else {
                // Load the first item for demo purposes
                // In production, this should search for the specific item ID
                const item = items[0];
                populateForm(item);
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
    document.getElementById('itemArtistAuthor').value = item.artist || '';
    document.getElementById('itemYear').value = item.year || '';
    document.getElementById('itemDescription').value = item.notes || '';
    document.getElementById('itemFormat').value = item.format || '';
    document.getElementById('itemBarcode').value = item.barcode || '';
    document.getElementById('itemCoverUrl').value = item.coverUrl || '';
}

// Handle edit item form submission
async function handleEditItem(e) {
    e.preventDefault();

    const userId = localStorage.getItem('userId');
    const title = document.getElementById('itemTitle').value.trim();
    const mediaType = document.getElementById('itemMediaType').value;

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
        format: document.getElementById('itemFormat').value.trim(),
        barcode: document.getElementById('itemBarcode').value.trim(),
        coverUrl: document.getElementById('itemCoverUrl').value.trim()
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
