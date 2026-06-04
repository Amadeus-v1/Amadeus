const API_BASE_URL = 'http://localhost:8080/api';
let allItems = [];
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

    // Setup event listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('searchInput').addEventListener('input', filterItems);
    document.getElementById('filterMediaType').addEventListener('change', filterItems);
    document.getElementById('sortBy').addEventListener('change', sortItems);

    // Load collection
    loadCollection();
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

// Load collection from backend
async function loadCollection() {
    const userId = localStorage.getItem('userId');
    
    try {
        const response = await fetch(`${API_BASE_URL}/collection/list?userId=${encodeURIComponent(userId)}`);
        const data = await response.json();

        if (!response.ok) {
            displayEmptyState();
            return;
        }

        allItems = data.items || [];
        displayItems(allItems);
        updateStats();
    } catch (error) {
        console.error('Error loading collection:', error);
        displayEmptyState();
    }
}

// Display items
function displayItems(items) {
    const container = document.getElementById('collectionContainer');
    
    if (!items || items.length === 0) {
        displayEmptyState();
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="collection-item-card" onclick="openItemModal('${item.id}')">
            <div class="item-media-icon">${getMediaIcon(item.mediaType)}</div>
            <div class="item-content">
                <h3>${escapeHtml(item.title)}</h3>
                ${item.artistAuthor ? `<p class="item-artist">${escapeHtml(item.artistAuthor)}</p>` : ''}
                <div class="item-meta">
                    <span class="item-type">${item.mediaType}</span>
                    <span class="item-condition">${item.condition}</span>
                </div>
                <div class="item-footer">
                    <span class="item-value">$${parseFloat(item.estimatedValue || 0).toFixed(2)}</span>
                    <span class="item-qty">Qty: ${item.quantity}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Display empty state
function displayEmptyState() {
    const container = document.getElementById('collectionContainer');
    container.innerHTML = `
        <div class="empty-collection">
            <div style="font-size: 3rem; margin-bottom: 16px;">📚</div>
            <h3>No items in your collection yet</h3>
            <p>Start by adding your first item to begin cataloging your collection.</p>
            <a href="add-item.html" class="btn btn-primary">+ Add Your First Item</a>
        </div>
    `;
}

// Update stats
function updateStats() {
    const totalItems = allItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = allItems.reduce((sum, item) => sum + (item.estimatedValue || 0), 0);
    const mediaTypes = new Set(allItems.map(item => item.mediaType)).size;

    document.getElementById('totalItems').textContent = totalItems;
    document.getElementById('totalValue').textContent = `$${totalValue.toFixed(2)}`;
    document.getElementById('mediaTypes').textContent = mediaTypes;
}

// Filter items
function filterItems() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const mediaTypeFilter = document.getElementById('filterMediaType').value;

    const filtered = allItems.filter(item => {
        const matchesSearch = !searchTerm || 
            item.title.toLowerCase().includes(searchTerm) ||
            (item.artistAuthor && item.artistAuthor.toLowerCase().includes(searchTerm)) ||
            (item.description && item.description.toLowerCase().includes(searchTerm));
        
        const matchesType = !mediaTypeFilter || item.mediaType === mediaTypeFilter;

        return matchesSearch && matchesType;
    });

    displayItems(filtered);
}

// Sort items
function sortItems() {
    const sortBy = document.getElementById('sortBy').value;
    let sorted = [...allItems];

    switch(sortBy) {
        case 'title':
            sorted.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'artistAuthor':
            sorted.sort((a, b) => (a.artistAuthor || '').localeCompare(b.artistAuthor || ''));
            break;
        case 'releaseDate':
            sorted.sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0));
            break;
        case 'estimatedValue':
            sorted.sort((a, b) => (b.estimatedValue || 0) - (a.estimatedValue || 0));
            break;
        case 'condition':
            sorted.sort((a, b) => a.condition.localeCompare(b.condition));
            break;
        case 'dateAdded':
        default:
            sorted.sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));
            break;
    }

    displayItems(sorted);
}

// Get media icon
function getMediaIcon(mediaType) {
    const icons = {
        'Book': '📖',
        'Vinyl': '🎵',
        'CD': '💿',
        'DVD': '🎬',
        'Blu-ray': '📀',
        'Cassette': '📼',
        'Video Game': '🎮',
        'Collectible': '✨',
        'Comic': '💭'
    };
    return icons[mediaType] || '📦';
}

// Open item detail modal
function openItemModal(itemId) {
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    currentItemId = itemId;
    const modal = document.getElementById('itemModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    modalTitle.textContent = item.title;
    
    modalBody.innerHTML = `
        <div class="modal-item-details">
            <div class="detail-row">
                <span class="detail-label">Media Type:</span>
                <span class="detail-value">${item.mediaType}</span>
            </div>
            ${item.artistAuthor ? `
                <div class="detail-row">
                    <span class="detail-label">Artist/Author:</span>
                    <span class="detail-value">${escapeHtml(item.artistAuthor)}</span>
                </div>
            ` : ''}
            ${item.releaseDate ? `
                <div class="detail-row">
                    <span class="detail-label">Release Date:</span>
                    <span class="detail-value">${new Date(item.releaseDate).toLocaleDateString()}</span>
                </div>
            ` : ''}
            ${item.genre ? `
                <div class="detail-row">
                    <span class="detail-label">Genre:</span>
                    <span class="detail-value">${escapeHtml(item.genre)}</span>
                </div>
            ` : ''}
            <div class="detail-row">
                <span class="detail-label">Condition:</span>
                <span class="detail-value">${item.condition}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Quantity:</span>
                <span class="detail-value">${item.quantity}</span>
            </div>
            ${item.estimatedValue ? `
                <div class="detail-row">
                    <span class="detail-label">Estimated Value:</span>
                    <span class="detail-value">$${parseFloat(item.estimatedValue).toFixed(2)}</span>
                </div>
            ` : ''}
            ${item.purchasePrice ? `
                <div class="detail-row">
                    <span class="detail-label">Purchase Price:</span>
                    <span class="detail-value">$${parseFloat(item.purchasePrice).toFixed(2)}</span>
                </div>
            ` : ''}
            ${item.location ? `
                <div class="detail-row">
                    <span class="detail-label">Location:</span>
                    <span class="detail-value">${escapeHtml(item.location)}</span>
                </div>
            ` : ''}
            ${item.isSigned || item.isRare || item.isFirstEdition ? `
                <div class="detail-row">
                    <span class="detail-label">Special:</span>
                    <span class="detail-value">
                        ${item.isSigned ? '✍️ Signed ' : ''}
                        ${item.isRare ? '🌟 Rare ' : ''}
                        ${item.isFirstEdition ? '📌 First Edition' : ''}
                    </span>
                </div>
            ` : ''}
            ${item.description ? `
                <div class="detail-row">
                    <span class="detail-label">Notes:</span>
                    <span class="detail-value">${escapeHtml(item.description)}</span>
                </div>
            ` : ''}
        </div>
    `;

    modal.classList.remove('hidden');
}

// Close item modal
function closeItemModal() {
    document.getElementById('itemModal').classList.add('hidden');
    currentItemId = null;
}

// Edit current item
function editCurrentItem() {
    if (!currentItemId) return;
    // TODO: Implement edit functionality
    alert('Edit functionality coming soon!');
}

// Delete current item
async function deleteCurrentItem() {
    if (!currentItemId) return;
    
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/collection/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: localStorage.getItem('userId'),
                itemId: currentItemId
            })
        });

        if (response.ok) {
            closeItemModal();
            loadCollection();
            alert('Item deleted successfully!');
        } else {
            alert('Failed to delete item');
        }
    } catch (error) {
        console.error('Error deleting item:', error);
        alert('Error deleting item');
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('itemModal');
    if (e.target === modal) {
        closeItemModal();
    }
});
