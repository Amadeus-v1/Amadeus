const API_BASE_URL = 'http://localhost:8080/api';
let activeListings = [];
let selectedListingId = null;

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
    document.getElementById('marketplaceSearch').addEventListener('input', filterListings);

    // Load listings
    loadMarketplace();
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

// Load marketplace listings from backend
async function loadMarketplace() {
    try {
        const response = await fetch(`${API_BASE_URL}/marketplace/active`);
        const data = await response.json();

        if (!response.ok) {
            displayEmptyState();
            return;
        }

        activeListings = data.listings || [];
        displayListings(activeListings);
    } catch (error) {
        console.error('Error loading marketplace:', error);
        displayEmptyState('Error loading marketplace data. Please try again later.');
    }
}

// Display listings in grid
function displayListings(listings) {
    const container = document.getElementById('marketplaceContainer');
    
    if (!listings || listings.length === 0) {
        displayEmptyState();
        return;
    }

    const currentUserId = localStorage.getItem('userId');

    container.innerHTML = listings.map(listing => {
        const hasCover = listing.coverUrl && listing.coverUrl.trim() !== '';
        const mediaIcon = getMediaIcon(listing.mediaType);
        const isOwnListing = listing.sellerId === currentUserId;
        
        return `
            <div class="collection-item-card">
                <div class="item-media-icon">
                    ${hasCover 
                        ? `<img src="${listing.coverUrl}" alt="${escapeHtml(listing.title)}" onerror="this.parentElement.innerHTML='${mediaIcon}'">` 
                        : mediaIcon
                    }
                </div>
                <div class="item-content">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <h3 style="margin: 0;">${escapeHtml(listing.title)}</h3>
                        <span style="color: var(--accent); font-weight: 800; font-size: 1.2rem;">$${parseFloat(listing.price || 0).toFixed(2)}</span>
                    </div>
                    <p class="item-artist">${escapeHtml(listing.artist || 'Unknown Artist')}</p>
                    <div class="item-meta">
                        <span class="item-type">${listing.mediaType || 'Media'}</span>
                        <span class="item-condition">${listing.condition || 'N/A'}</span>
                    </div>
                    <div style="margin-top: 12px; font-size: 0.85rem; color: var(--muted);">
                        Seller: <strong>${escapeHtml(listing.sellerUsername || 'Unknown')}</strong>
                        ${isOwnListing ? ' <span style="color: var(--accent); font-style: italic;">(You)</span>' : ''}
                    </div>
                    <div class="item-footer" style="padding-top: 16px;">
                        ${isOwnListing 
                            ? `<button class="btn btn-secondary btn-full" disabled style="opacity: 0.6; cursor: not-allowed;">Your Listing</button>`
                            : `<button class="btn btn-primary btn-full" onclick="openBuyModal('${listing.id}')">Buy Now</button>`
                        }
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Display empty state
function displayEmptyState(message = 'No active listings found in the marketplace.') {
    const container = document.getElementById('marketplaceContainer');
    container.innerHTML = `
        <div class="empty-collection" style="text-align: center; padding: 48px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border); width: 100%;">
            <div style="font-size: 3rem; margin-bottom: 16px;">🛒</div>
            <h3 style="color: var(--text);">Marketplace is quiet</h3>
            <p style="color: var(--text); margin-bottom: 24px;">${message}</p>
            <a href="collection.html" class="btn btn-secondary" style="text-decoration: none;">Sell Something</a>
        </div>
    `;
}

// Filter listings by search
function filterListings() {
    const searchTerm = document.getElementById('marketplaceSearch').value.toLowerCase();
    const filtered = activeListings.filter(listing => 
        listing.title.toLowerCase().includes(searchTerm) ||
        (listing.artist && listing.artist.toLowerCase().includes(searchTerm)) ||
        (listing.sellerUsername && listing.sellerUsername.toLowerCase().includes(searchTerm))
    );
    displayListings(filtered);
}

// Purchase logic
function openBuyModal(listingId) {
    const listing = activeListings.find(l => l.id === listingId);
    if (!listing) return;

    selectedListingId = listingId;
    const modal = document.getElementById('buyModal');
    const modalBody = document.getElementById('buyModalBody');
    const modalTitle = document.getElementById('buyModalTitle');

    modalTitle.textContent = `Purchase: ${listing.title}`;
    modalBody.innerHTML = `
        <div style="color: var(--text);">
            <p>You are about to purchase this item from <strong>${escapeHtml(listing.sellerUsername)}</strong>.</p>
            <div style="margin: 20px 0; padding: 16px; background: var(--bg); border-radius: 8px; border-left: 4px solid var(--accent);">
                <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 4px;">Order Summary</div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Item Subtotal:</span>
                    <span>$${parseFloat(listing.price).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: 700; border-top: 1px solid var(--border); margin-top: 8px; padding-top: 8px;">
                    <span>Total Charge:</span>
                    <span style="color: var(--accent);">$${parseFloat(listing.price).toFixed(2)}</span>
                </div>
            </div>
            <p style="font-size: 0.85rem; color: var(--muted);">Clicking "Confirm Buy" will process your mock purchase.</p>
        </div>
    `;

    modal.classList.remove('hidden');
}

function closeBuyModal() {
    document.getElementById('buyModal').classList.add('hidden');
    selectedListingId = null;
}

async function confirmPurchase() {
    if (!selectedListingId) return;
    
    const listing = activeListings.find(l => l.id === selectedListingId);
    const userId = localStorage.getItem('userId');

    try {
        const response = await fetch(`${API_BASE_URL}/marketplace/sale`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                listingId: selectedListingId,
                buyerId: userId,
                sellerId: listing.sellerId,
                price: listing.price
            })
        });

        if (response.ok) {
            alert('🎉 Congratulations! Your purchase was successful.');
            closeBuyModal();
            loadMarketplace(); // Refresh listings
        } else {
            const error = await response.json();
            alert('Purchase failed: ' + (error.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error confirming purchase:', error);
        alert('Error connecting to marketplace service');
    }
}

// Icon helper
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

// HTML Escaper
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

// Close modal on outside click
document.addEventListener('click', (e) => {
    const modal = document.getElementById('buyModal');
    if (e.target === modal) {
        closeBuyModal();
    }
});
