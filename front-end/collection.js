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

    container.innerHTML = items.map(item => {
        const hasCover = item.coverUrl && item.coverUrl.trim() !== '';
        const mediaIcon = getMediaIcon(item.mediaType);
        
        return `
            <div class="collection-item-card">
                <div class="item-actions">
                    <a href="edit-item.html?id=${item.id}" class="btn-icon" title="Edit item" style="text-decoration: none; font-size: 1rem;">✏️</a>
                </div>
                <div class="item-media-icon" onclick="openItemModal('${item.id}')" style="cursor: pointer;">
                    ${hasCover 
                        ? `<img src="${item.coverUrl}" alt="${escapeHtml(item.title)}" onerror="this.parentElement.innerHTML='${mediaIcon}'">` 
                        : mediaIcon
                    }
                </div>
                <div class="item-content" onclick="openItemModal('${item.id}')" style="cursor: pointer;">
                    <h3>${escapeHtml(item.title)}</h3>
                    ${item.artistAuthor ? `<p class="item-artist">${escapeHtml(item.artistAuthor)}</p>` : ''}
                    <div class="item-meta">
                        <span class="item-type">${item.mediaType}</span>
                        <span class="item-condition">${item.condition || 'N/A'}</span>
                    </div>
                    <div class="item-footer">
                        <span class="item-value" style="color: var(--accent); font-weight: 800;">$${parseFloat(item.estimatedValue || 0).toFixed(2)}</span>
                        <span class="item-qty" style="color: var(--text);">Qty: ${item.quantity || 1}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Display empty state
function displayEmptyState() {
    const container = document.getElementById('collectionContainer');
    container.innerHTML = `
        <div class="empty-collection" style="text-align: center; padding: 48px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border);">
            <div style="font-size: 3rem; margin-bottom: 16px;">📚</div>
            <h3 style="color: var(--text);">No items in your collection yet</h3>
            <p style="color: var(--text); margin-bottom: 24px;">Start by adding your first item to begin cataloging your collection.</p>
            <a href="add-item.html" class="btn btn-primary" style="text-decoration: none;">+ Add Your First Item</a>
        </div>
    `;
}

// Update stats
function updateStats() {
    const totalItems = allItems.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
    const totalValue = allItems.reduce((sum, item) => sum + ((parseFloat(item.estimatedValue) || 0) * (parseInt(item.quantity) || 1)), 0);
    const mediaTypesCount = new Set(allItems.map(item => item.mediaType)).size;

    const totalItemsEl = document.getElementById('totalItems');
    const totalValueEl = document.getElementById('totalValue');
    const mediaTypesEl = document.getElementById('mediaTypes');

    if (totalItemsEl) totalItemsEl.textContent = totalItems;
    if (totalValueEl) totalValueEl.textContent = `$${totalValue.toFixed(2)}`;
    if (mediaTypesEl) mediaTypesEl.textContent = mediaTypesCount;
}

// Filter items
function filterItems() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const mediaTypeFilter = document.getElementById('filterMediaType').value;

    const filtered = allItems.filter(item => {
        const matchesSearch = !searchTerm || 
            item.title.toLowerCase().includes(searchTerm) ||
            (item.artistAuthor && item.artistAuthor.toLowerCase().includes(searchTerm)) ||
            (item.description && item.description.toLowerCase().includes(searchTerm)) ||
            (item.notes && item.notes.toLowerCase().includes(searchTerm));
        
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
            sorted.sort((a, b) => (parseFloat(b.estimatedValue) || 0) - (parseFloat(a.estimatedValue) || 0));
            break;
        case 'condition':
            sorted.sort((a, b) => (a.condition || '').localeCompare(b.condition || ''));
            break;
        case 'dateAdded':
        default:
            sorted.sort((a, b) => new Date(b.addedAt || b.dateAdded || 0) - new Date(a.addedAt || a.dateAdded || 0));
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
    
    const hasCover = item.coverUrl && item.coverUrl.trim() !== '';

    modalBody.innerHTML = `
        <div class="modal-item-details" style="color: var(--text);">
            ${hasCover ? `<img src="${item.coverUrl}" alt="${escapeHtml(item.title)}" class="modal-image">` : ''}
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div><strong>Media Type:</strong> ${item.mediaType}</div>
                ${item.artistAuthor ? `<div><strong>Artist/Author:</strong> ${escapeHtml(item.artistAuthor)}</div>` : ''}
                ${item.year ? `<div><strong>Year:</strong> ${item.year}</div>` : ''}
                <div><strong>Condition:</strong> ${item.condition || 'N/A'}</div>
                <div><strong>Quantity:</strong> ${item.quantity || 1}</div>
                <div><strong>Estimated Value:</strong> $${parseFloat(item.estimatedValue || 0).toFixed(2)}</div>
                ${item.format ? `<div><strong>Format:</strong> ${escapeHtml(item.format)}</div>` : ''}
                ${item.barcode ? `<div><strong>Barcode:</strong> ${escapeHtml(item.barcode)}</div>` : ''}
                ${item.notes || item.description ? `<div><strong>Notes:</strong> ${escapeHtml(item.notes || item.description)}</div>` : ''}
                
                <hr style="border: none; border-top: 1px solid var(--border); margin: 12px 0;">
                
                <div style="background: var(--bg); padding: 16px; border-radius: 8px; border: 1px solid var(--border);">
                    <h4 style="margin-bottom: 12px;">List on Marketplace</h4>
                    <div style="display: flex; gap: 12px;">
                        <input type="number" id="listingPrice" placeholder="Listing Price ($)" step="0.01" min="0" style="flex: 1; padding: 8px; border-radius: 4px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text);">
                        <button class="btn btn-primary" onclick="listItemOnMarketplace()" style="padding: 8px 16px; font-size: 0.8rem;">List Item</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
}

// List item on marketplace
async function listItemOnMarketplace() {
    const price = parseFloat(document.getElementById('listingPrice').value);
    const userId = localStorage.getItem('userId');

    if (isNaN(price) || price <= 0) {
        alert('Please enter a valid listing price');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/marketplace/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sellerId: userId,
                itemId: currentItemId,
                price: price,
                currency: 'USD',
                status: 'active'
            })
        });

        if (response.ok) {
            alert('Item successfully listed on marketplace!');
            closeItemModal();
        } else {
            const error = await response.json();
            alert('Failed to list item: ' + (error.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error listing item:', error);
        alert('Error connecting to marketplace service');
    }
}

// Close item modal
function closeItemModal() {
    document.getElementById('itemModal').classList.add('hidden');
    currentItemId = null;
}

// Edit current item
function editCurrentItem() {
    if (!currentItemId) return;
    window.location.href = `edit-item.html?id=${currentItemId}`;
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
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('itemModal');
    if (e.target === modal) {
        closeItemModal();
    }
});
