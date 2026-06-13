const API_BASE_URL = 'http://localhost:8080/api';
let wishlistItems = [];
let currentItem = null;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadWishlist();

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterWishlist);
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'login.html';
        });
    }

    const username = localStorage.getItem('username');
    const userGreeting = document.getElementById('userGreeting');
    if (userGreeting) {
        userGreeting.textContent = `Welcome, ${username}!`;
    }
});

function checkAuth() {
    if (!localStorage.getItem('userId')) {
        window.location.href = 'login.html';
    }
}

async function loadWishlist() {
    const userId = localStorage.getItem('userId');
    const container = document.getElementById('wishlistContainer');

    try {
        const response = await fetch(`${API_BASE_URL}/wishlist/list?userId=${userId}`);
        const data = await response.json();
        wishlistItems = data.items || [];
        
        displayWishlist(wishlistItems);
        updateStats();
    } catch (error) {
        console.error('Error loading wishlist:', error);
        container.innerHTML = '<p style="text-align: center; color: var(--accent);">Failed to load wishlist. Please try again.</p>';
    }
}

function displayWishlist(items) {
    const container = document.getElementById('wishlistContainer');
    if (items.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--muted); padding: 40px;">Your wishlist is empty. Explore to find items you want!</p>';
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="collection-item" onclick="showItemDetail('${item.id}')">
            <div class="item-image">
                <img src="${item.coverUrl || 'https://via.placeholder.com/150?text=No+Cover'}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/150?text=No+Cover'">
            </div>
            <div class="item-info">
                <h3 class="item-title">${escapeHtml(item.title)}</h3>
                <p class="item-artist">${escapeHtml(item.artist || 'Unknown Artist')}</p>
                <div class="item-meta">
                    <span class="badge">${item.mediaType}</span>
                    <span class="badge ${item.visibility === 'public' ? 'badge-public' : 'badge-private'}">${item.visibility}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function updateStats() {
    document.getElementById('totalWishlistItems').textContent = wishlistItems.length;
}

function filterWishlist() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const filtered = wishlistItems.filter(item => 
        item.title.toLowerCase().includes(query) || 
        (item.artist && item.artist.toLowerCase().includes(query))
    );
    displayWishlist(filtered);
}

function showItemDetail(itemId) {
    currentItem = wishlistItems.find(i => i.id === itemId);
    if (!currentItem) return;

    const modal = document.getElementById('itemModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    title.textContent = currentItem.title;
    body.innerHTML = `
        <div style="display: flex; gap: 24px; flex-wrap: wrap;">
            <img src="${currentItem.coverUrl || 'https://via.placeholder.com/150'}" style="width: 200px; height: 200px; object-fit: cover; border-radius: 8px;">
            <div style="flex: 1; min-width: 250px;">
                <p><strong>Artist:</strong> ${escapeHtml(currentItem.artist || 'Unknown')}</p>
                <p><strong>Media Type:</strong> ${currentItem.mediaType}</p>
                <p><strong>Format:</strong> ${currentItem.format || 'N/A'}</p>
                <p><strong>Year:</strong> ${currentItem.year || 'N/A'}</p>
                <p><strong>Visibility:</strong> 
                    <select id="editVisibility" onchange="updateVisibility(this.value)" style="padding: 4px; margin-left: 8px;">
                        <option value="public" ${currentItem.visibility === 'public' ? 'selected' : ''}>Public</option>
                        <option value="private" ${currentItem.visibility === 'private' ? 'selected' : ''}>Private</option>
                    </select>
                </p>
                <div style="margin-top: 16px;">
                    <strong>Notes:</strong>
                    <p style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin-top: 8px;">
                        ${escapeHtml(currentItem.notes || 'No notes added.')}
                    </p>
                </div>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
}

function closeItemModal() {
    document.getElementById('itemModal').classList.add('hidden');
    currentItem = null;
}

async function updateVisibility(newVisibility) {
    const userId = localStorage.getItem('userId');
    try {
        const response = await fetch(`${API_BASE_URL}/collection/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                itemId: currentItem.id,
                visibility: newVisibility
            })
        });

        if (response.ok) {
            currentItem.visibility = newVisibility;
            loadWishlist(); // Refresh list
        } else {
            alert('Failed to update visibility');
        }
    } catch (error) {
        console.error('Error updating visibility:', error);
    }
}

async function deleteWishlistItem() {
    if (!confirm('Remove this item from your wishlist?')) return;

    const userId = localStorage.getItem('userId');
    try {
        const response = await fetch(`${API_BASE_URL}/wishlist/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, itemId: currentItem.id })
        });

        if (response.ok) {
            closeItemModal();
            loadWishlist();
        } else {
            alert('Failed to remove item');
        }
    } catch (error) {
        console.error('Error deleting item:', error);
    }
}

async function moveToCollection() {
    if (!confirm('Moving this to your collection will remove it from your wishlist. Continue?')) return;

    const userId = localStorage.getItem('userId');
    try {
        // 1. Add to collection
        const addResponse = await fetch(`${API_BASE_URL}/collection/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                title: currentItem.title,
                artist: currentItem.artist,
                mediaType: currentItem.mediaType,
                format: currentItem.format,
                year: currentItem.year,
                coverUrl: currentItem.coverUrl,
                collection: {
                    condition: 'Near Mint',
                    quantity: 1,
                    visibility: currentItem.visibility,
                    notes: currentItem.notes
                }
            })
        });

        if (addResponse.ok) {
            // 2. Delete from wishlist
            await fetch(`${API_BASE_URL}/wishlist/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, itemId: currentItem.id })
            });
            
            closeItemModal();
            loadWishlist();
            alert('Successfully added to your collection!');
        } else {
            alert('Failed to add to collection');
        }
    } catch (error) {
        console.error('Error moving item:', error);
    }
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
