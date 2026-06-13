const API_BASE_URL = 'http://localhost:8080/api';
let friendItems = [];
let currentTab = 'collection';

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

    // Get parameters
    const params = new URLSearchParams(window.location.search);
    const friendId = params.get('friendId');
    const friendUsername = params.get('username');

    if (!friendId) {
        window.location.href = 'friends.html';
        return;
    }

    if (friendUsername) {
        document.getElementById('friendNameHeader').textContent = `📚 ${friendUsername}'s Library`;
    }

    // Setup event listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('searchInput').addEventListener('input', filterItems);

    // Load initial data
    loadTabData();
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

function switchTab(tab) {
    currentTab = tab;
    
    // Update UI
    const tabCollection = document.getElementById('tabCollection');
    const tabWishlist = document.getElementById('tabWishlist');
    
    if (tab === 'collection') {
        tabCollection.className = 'btn btn-primary';
        tabWishlist.className = 'btn btn-secondary';
    } else {
        tabCollection.className = 'btn btn-secondary';
        tabWishlist.className = 'btn btn-primary';
    }
    
    loadTabData();
}

async function loadTabData() {
    const params = new URLSearchParams(window.location.search);
    const friendId = params.get('friendId');
    const userId = localStorage.getItem('userId');
    const container = document.getElementById('itemsContainer');
    
    container.innerHTML = '<p style="text-align: center; color: var(--muted); padding: 40px;">Loading...</p>';

    const endpoint = currentTab === 'collection' ? 'friends/collection' : 'friends/wishlist';
    
    try {
        const response = await fetch(`${API_BASE_URL}/${endpoint}?userId=${encodeURIComponent(userId)}&friendId=${encodeURIComponent(friendId)}`);
        
        if (response.status === 403) {
            container.innerHTML = `
                <div style="text-align: center; padding: 48px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border);">
                    <div style="font-size: 3rem; margin-bottom: 16px;">🔒</div>
                    <h3>Access Denied</h3>
                    <p>You must be friends with this user to view their ${currentTab}.</p>
                </div>
            `;
            return;
        }

        const data = await response.json();
        friendItems = data.items || [];
        displayItems(friendItems);
    } catch (error) {
        console.error(`Error loading friend ${currentTab}:`, error);
        container.innerHTML = `<p class="error-message">Error loading ${currentTab}.</p>`;
    }
}

// Display items
function displayItems(items) {
    const container = document.getElementById('itemsContainer');
    
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 48px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border);">
                <div style="font-size: 3rem; margin-bottom: 16px;">📚</div>
                <h3>No public items</h3>
                <p>This user hasn't shared any items in their ${currentTab} yet.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => {
        const hasCover = item.coverUrl && item.coverUrl.trim() !== '';
        const mediaIcon = getMediaIcon(item.mediaType);
        
        return `
            <div class="collection-item-card" onclick="openItemModal('${item.id}')" style="cursor: pointer;">
                <div class="item-media-icon">
                    ${hasCover 
                        ? `<img src="${item.coverUrl}" alt="${escapeHtml(item.title)}" onerror="this.parentElement.innerHTML='${mediaIcon}'">` 
                        : mediaIcon
                    }
                </div>
                <div class="item-content">
                    <h3>${escapeHtml(item.title)}</h3>
                    ${item.artistAuthor ? `<p class="item-artist">${escapeHtml(item.artistAuthor)}</p>` : ''}
                    <div class="item-meta">
                        <span class="item-type">${item.mediaType}</span>
                        ${item.condition ? `<span class="item-condition">${item.condition}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Filter items
function filterItems() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    const filtered = friendItems.filter(item => {
        return !searchTerm || 
            item.title.toLowerCase().includes(searchTerm) ||
            (item.artistAuthor && item.artistAuthor.toLowerCase().includes(searchTerm));
    });

    displayItems(filtered);
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
        'Collectible': '✨'
    };
    return icons[mediaType] || '📦';
}

// Open item detail modal
function openItemModal(itemId) {
    const item = friendItems.find(i => i.id === itemId);
    if (!item) return;

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
                ${item.condition ? `<div><strong>Condition:</strong> ${item.condition}</div>` : ''}
                ${item.format ? `<div><strong>Format:</strong> ${escapeHtml(item.format)}</div>` : ''}
                ${item.notes || item.description ? `<div><strong>Notes:</strong> ${escapeHtml(item.notes || item.description)}</div>` : ''}
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
}

function closeItemModal() {
    document.getElementById('itemModal').classList.add('hidden');
}

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

document.addEventListener('click', (e) => {
    const modal = document.getElementById('itemModal');
    if (e.target === modal) {
        closeItemModal();
    }
});
