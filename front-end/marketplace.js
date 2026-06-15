const API_BASE_URL = 'http://34.48.220.234:8080/api';
let activeListings = [];
let myListings = [];
let selectedListingId = null;
let currentTab = 'browse';
let discogsSearchTimeout = null;

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
    document.getElementById('filterMediaType').addEventListener('change', filterListings);
    document.getElementById('sortListings').addEventListener('change', filterListings);

    // Discogs marketplace search
    const discogsInput = document.getElementById('discogsMarketplaceSearch');
    if (discogsInput) {
        discogsInput.addEventListener('input', () => {
            clearTimeout(discogsSearchTimeout);
            discogsSearchTimeout = setTimeout(searchDiscogsMarketplace, 300);
        });
    }

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

// ===== Tab Management =====

function switchTab(tab) {
    currentTab = tab;

    // Update tab button styles
    document.getElementById('tabBrowse').className = tab === 'browse' ? 'btn btn-primary' : 'btn btn-secondary';
    document.getElementById('tabMyListings').className = tab === 'mylistings' ? 'btn btn-primary' : 'btn btn-secondary';
    document.getElementById('tabDiscogsSearch').className = tab === 'discogs' ? 'btn btn-primary' : 'btn btn-secondary';

    // Show/hide tab content
    document.getElementById('browseTab').classList.toggle('hidden', tab !== 'browse');
    document.getElementById('myListingsTab').classList.toggle('hidden', tab !== 'mylistings');
    document.getElementById('discogsTab').classList.toggle('hidden', tab !== 'discogs');

    // Load data for the selected tab
    if (tab === 'mylistings') {
        loadMyListings();
    } else if (tab === 'browse') {
        loadMarketplace();
    }
}

// ===== Browse Tab =====

async function loadMarketplace() {
    try {
        const response = await fetch(`${API_BASE_URL}/marketplace/active`);
        const data = await response.json();

        if (!response.ok) {
            displayEmptyState();
            return;
        }

        activeListings = data.listings || [];
        filterListings();
    } catch (error) {
        console.error('Error loading marketplace:', error);
        displayEmptyState('Error loading marketplace data. Please try again later.');
    }
}

function filterListings() {
    const searchTerm = document.getElementById('marketplaceSearch').value.toLowerCase();
    const mediaType = document.getElementById('filterMediaType').value;
    const sortBy = document.getElementById('sortListings').value;

    let filtered = activeListings.filter(listing => {
        const matchesSearch = !searchTerm ||
            (listing.title && listing.title.toLowerCase().includes(searchTerm)) ||
            (listing.artist && listing.artist.toLowerCase().includes(searchTerm)) ||
            (listing.sellerUsername && listing.sellerUsername.toLowerCase().includes(searchTerm));
        
        const matchesType = !mediaType || listing.mediaType === mediaType;

        return matchesSearch && matchesType;
    });

    // Sort
    switch (sortBy) {
        case 'priceLow':
            filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
            break;
        case 'priceHigh':
            filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
            break;
        case 'titleAZ':
            filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
            break;
        case 'newest':
        default:
            filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            break;
    }

    displayListings(filtered);
}

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

// ===== My Listings Tab =====

async function loadMyListings() {
    const userId = localStorage.getItem('userId');
    const container = document.getElementById('myListingsContainer');

    try {
        const response = await fetch(`${API_BASE_URL}/marketplace/user?userId=${encodeURIComponent(userId)}`);
        const data = await response.json();

        myListings = data.listings || [];

        if (myListings.length === 0) {
            container.innerHTML = `
                <div class="empty-collection" style="text-align: center; padding: 48px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border); width: 100%;">
                    <div style="font-size: 3rem; margin-bottom: 16px;">📋</div>
                    <h3 style="color: var(--text);">No listings yet</h3>
                    <p style="color: var(--text); margin-bottom: 24px;">Go to your collection to list items for sale.</p>
                    <a href="collection.html" class="btn btn-primary" style="text-decoration: none;">Go to Collection</a>
                </div>
            `;
            return;
        }

        container.innerHTML = myListings.map(listing => {
            const hasCover = listing.coverUrl && listing.coverUrl.trim() !== '';
            const mediaIcon = getMediaIcon(listing.mediaType);
            const statusColor = listing.status === 'active' ? '#10b981' : listing.status === 'sold' ? '#f59e0b' : '#ef4444';
            const statusLabel = listing.status.charAt(0).toUpperCase() + listing.status.slice(1);

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
                            <h3 style="margin: 0;">${escapeHtml(listing.title || 'Unknown Item')}</h3>
                            <span style="color: var(--accent); font-weight: 800; font-size: 1.2rem;">$${parseFloat(listing.price || 0).toFixed(2)}</span>
                        </div>
                        <p class="item-artist">${escapeHtml(listing.artist || 'Unknown Artist')}</p>
                        <div class="item-meta">
                            <span class="item-type">${listing.mediaType || 'Media'}</span>
                            <span style="font-size: 0.75rem; padding: 4px 10px; border-radius: 500px; font-weight: 700; background: ${statusColor}20; color: ${statusColor};">${statusLabel}</span>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--muted); margin-top: 8px;">
                            Listed: ${new Date(listing.createdAt).toLocaleDateString()}
                        </div>
                        <div class="item-footer" style="padding-top: 16px;">
                            ${listing.status === 'active' 
                                ? `<button class="btn btn-secondary btn-full" onclick="cancelListing('${listing.id}')" style="font-size: 0.8rem; color: #ef4444; border-color: #ef4444;">Cancel Listing</button>`
                                : `<button class="btn btn-secondary btn-full" disabled style="opacity: 0.5; cursor: not-allowed; font-size: 0.8rem;">${statusLabel}</button>`
                            }
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading my listings:', error);
        container.innerHTML = `<p style="text-align: center; color: var(--muted); padding: 40px;">Error loading your listings.</p>`;
    }
}

async function cancelListing(listingId) {
    if (!confirm('Are you sure you want to cancel this listing?')) return;

    const userId = localStorage.getItem('userId');

    try {
        const response = await fetch(`${API_BASE_URL}/marketplace/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                listingId: listingId,
                sellerId: userId
            })
        });

        if (response.ok) {
            alert('Listing cancelled successfully.');
            loadMyListings();
        } else {
            const error = await response.json();
            alert('Failed to cancel: ' + (error.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error cancelling listing:', error);
        alert('Error connecting to server');
    }
}

// ===== Discogs Marketplace Search =====

async function searchDiscogsMarketplace() {
    const query = document.getElementById('discogsMarketplaceSearch').value.trim();
    const container = document.getElementById('discogsMarketplaceResults');

    if (!query || query.length < 2) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--muted);">
                <div style="font-size: 3rem; margin-bottom: 16px;">🎵</div>
                <p>Search the Discogs catalog to discover releases</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `<p style="text-align: center; padding: 24px; color: var(--muted);">Searching Discogs...</p>`;

    try {
        const response = await fetch(`${API_BASE_URL}/discogs/search?q=${encodeURIComponent(query)}&limit=20`);
        const data = await response.json();

        const results = data.results || [];
        if (results.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--muted);">
                    <p>No results found for "<strong>${escapeHtml(query)}</strong>"</p>
                </div>
            `;
            return;
        }

        container.innerHTML = results.map(r => {
            const formatIcon = getFormatIcon(r.formats || '');
            const yearStr = r.year && r.year > 0 ? r.year : '—';
            return `
                <div style="display: flex; align-items: center; gap: 16px; padding: 16px; margin-bottom: 8px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; transition: all 0.2s ease;"
                     onmouseover="this.style.borderColor='var(--accent)'"
                     onmouseout="this.style.borderColor='var(--border)'">
                    <div style="font-size: 2.5rem; flex-shrink: 0; width: 56px; text-align: center;">${formatIcon}</div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 700; color: var(--text);">${escapeHtml(r.title)}</div>
                        <div style="font-size: 0.85rem; color: var(--muted);">${escapeHtml(r.artist || 'Unknown Artist')}</div>
                        <div style="display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap;">
                            <span style="font-size: 0.7rem; padding: 2px 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 500px; color: var(--muted);">${yearStr}</span>
                            ${r.formats ? `<span style="font-size: 0.7rem; padding: 2px 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 500px; color: var(--muted);">${escapeHtml(r.formats)}</span>` : ''}
                            ${r.genres ? `<span style="font-size: 0.7rem; padding: 2px 8px; background: rgba(124,77,255,0.1); border-radius: 500px; color: var(--accent);">${escapeHtml(r.genres)}</span>` : ''}
                            ${r.country ? `<span style="font-size: 0.7rem; padding: 2px 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 500px; color: var(--muted);">🌍 ${escapeHtml(r.country)}</span>` : ''}
                        </div>
                    </div>
                    <a href="add-item.html" class="btn btn-primary" style="font-size: 0.7rem; padding: 8px 16px; text-decoration: none; flex-shrink: 0;">Add to Collection</a>
                </div>
            `;
        }).join('');

    } catch (e) {
        container.innerHTML = `<p style="text-align: center; padding: 24px; color: #ef4444;">Error searching Discogs. Make sure data is imported.</p>`;
    }
}

function getFormatIcon(format) {
    const f = format.toLowerCase();
    if (f.includes('vinyl') || f.includes('lp') || f.includes('12"') || f.includes('7"') || f.includes('10"')) return '🎵';
    if (f.includes('cd')) return '💿';
    if (f.includes('cassette')) return '📼';
    if (f.includes('dvd')) return '🎬';
    if (f.includes('blu-ray') || f.includes('blu ray')) return '📀';
    return '💿';
}

// ===== Purchase Logic =====

function openBuyModal(listingId) {
    const listing = activeListings.find(l => l.id === listingId);
    if (!listing) return;

    selectedListingId = listingId;
    const modal = document.getElementById('buyModal');
    const modalBody = document.getElementById('buyModalBody');
    const modalTitle = document.getElementById('buyModalTitle');

    const price = parseFloat(listing.price);
    const platformFee = (price * 0.01);
    const sellerPayout = price - platformFee;

    modalTitle.textContent = `Purchase: ${listing.title}`;
    modalBody.innerHTML = `
        <div style="color: var(--text);">
            <p>You are about to purchase this item from <strong>${escapeHtml(listing.sellerUsername)}</strong>.</p>
            <div style="margin: 20px 0; padding: 16px; background: var(--bg); border-radius: 8px; border-left: 4px solid var(--accent);">
                <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 8px;">Order Summary</div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Item:</span>
                    <span>${escapeHtml(listing.title)}</span>
                </div>
                ${listing.artist ? `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Artist:</span>
                    <span>${escapeHtml(listing.artist)}</span>
                </div>` : ''}
                ${listing.condition ? `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Condition:</span>
                    <span>${escapeHtml(listing.condition)}</span>
                </div>` : ''}
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Item Price:</span>
                    <span>$${price.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.85rem; color: var(--muted);">
                    <span>Platform Fee (1%):</span>
                    <span>$${platformFee.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.85rem; color: var(--muted);">
                    <span>Seller Receives:</span>
                    <span>$${sellerPayout.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: 700; border-top: 1px solid var(--border); margin-top: 8px; padding-top: 8px;">
                    <span>Total Charge:</span>
                    <span style="color: var(--accent);">$${price.toFixed(2)}</span>
                </div>
            </div>
            <p style="font-size: 0.85rem; color: var(--muted);">Clicking "Confirm Buy" will process your purchase and record the transaction.</p>
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
            const responseData = await response.json();
            const saleData = responseData.sale || responseData;
            closeBuyModal();
            // Show success inline with fee breakdown
            const container = document.getElementById('marketplaceContainer');
            const fee = saleData.platformFee !== undefined ? saleData.platformFee.toFixed(2) : (parseFloat(listing.price) * 0.01).toFixed(2);
            const payout = saleData.payoutAmount !== undefined ? saleData.payoutAmount.toFixed(2) : (parseFloat(listing.price) * 0.99).toFixed(2);
            const successHtml = `
                <div style="text-align: center; padding: 32px; background: rgba(16,185,129,0.08); border: 1px solid #10b981; border-radius: 12px; margin-bottom: 24px;">
                    <div style="font-size: 3rem; margin-bottom: 12px;">🎉</div>
                    <h3 style="color: #10b981; margin-bottom: 8px;">Purchase Successful!</h3>
                    <p style="color: var(--text);">You bought <strong>${escapeHtml(listing.title)}</strong> for <strong>$${parseFloat(listing.price).toFixed(2)}</strong></p>
                    <p style="font-size: 0.8rem; color: var(--muted); margin-top: 8px;">Platform fee: $${fee} · Seller payout: $${payout}</p>
                    <p style="font-size: 0.75rem; color: var(--muted); margin-top: 4px;">Sale ID: ${saleData.saleId || 'N/A'}</p>
                </div>
            `;
            container.insertAdjacentHTML('afterbegin', successHtml);
            
            // Refresh after brief delay
            setTimeout(() => loadMarketplace(), 3000);
        } else {
            const error = await response.json();
            alert('Purchase failed: ' + (error.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error confirming purchase:', error);
        alert('Error connecting to marketplace service');
    }
}

// ===== Helpers =====

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
