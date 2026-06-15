const API_BASE_URL = 'http://34.48.220.234:8080/api';
let allItems = [];
let currentItemId = null;
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
    document.getElementById('searchInput').addEventListener('input', handleSearchInput);
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

// ===== Search with Discogs Integration =====

function handleSearchInput() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    
    // Always filter local items immediately
    filterItems();

    // Debounce Discogs search for terms >= 3 chars
    clearTimeout(discogsSearchTimeout);
    if (searchTerm.length >= 3) {
        discogsSearchTimeout = setTimeout(() => searchDiscogs(searchTerm), 400);
    } else {
        // Remove any Discogs results section
        const discogsSection = document.getElementById('discogsResultsSection');
        if (discogsSection) discogsSection.remove();
    }
}

async function searchDiscogs(query) {
    try {
        const response = await fetch(`${API_BASE_URL}/discogs/search?q=${encodeURIComponent(query)}&limit=10`);
        const data = await response.json();
        const results = data.results || [];
        
        displayDiscogsResults(results, query);
    } catch (e) {
        // Discogs not available, silently skip
        console.log('[collection] Discogs search unavailable');
    }
}

function displayDiscogsResults(results, query) {
    // Remove existing section if any
    let section = document.getElementById('discogsResultsSection');
    if (section) section.remove();

    if (results.length === 0) return;

    const container = document.getElementById('collectionContainer');
    
    const sectionHtml = `
        <div id="discogsResultsSection" style="grid-column: 1 / -1; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border);">
                <span style="font-size: 1.2rem;">🎵</span>
                <h3 style="margin: 0; color: var(--text);">More results for "${escapeHtml(query)}"</h3>
                <span style="font-size: 0.7rem; padding: 3px 10px; border-radius: 500px; background: rgba(124,77,255,0.1); color: var(--accent); font-weight: 700;">${results.length} found</span>
                <span style="margin-left: auto; font-size: 0.6rem; color: var(--muted);">Powered by Discogs</span>
            </div>
            <div class="collections-list">
                ${results.map(r => renderDiscogsCard(r)).join('')}
            </div>
        </div>
    `;

    container.insertAdjacentHTML('afterbegin', sectionHtml);
}

function renderDiscogsCard(r) {
    const formatIcon = getFormatIcon(r.formats || '');
    const yearStr = r.year && r.year > 0 ? r.year : '—';
    const safeJson = JSON.stringify(r).replace(/'/g, "&#39;").replace(/"/g, '&quot;');
    
    const coverSrc = `${API_BASE_URL}/covers/${r.discogsId}`;
    return `
        <div class="collection-item-card" onclick='openDiscogsModal(JSON.parse(this.dataset.release))' data-release='${JSON.stringify(r).replace(/'/g, "&#39;")}' style="cursor: pointer;">
            <div class="item-media-icon">
                <img src="${coverSrc}" alt="" style="width:100%;height:100%;object-fit:cover;"
                     onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=\\'font-size:4rem\\'>${formatIcon}</span>'">
            </div>
            <div class="item-content">
                <h3>${escapeHtml(r.title)}</h3>
                <p class="item-artist">
                    <a href="artist.html?name=${encodeURIComponent(r.artist || '')}" onclick="event.stopPropagation()" style="color:var(--accent);text-decoration:none;">${escapeHtml(r.artist || 'Unknown Artist')}</a>
                </p>
                <div class="item-meta">
                    ${r.formats ? `<span class="item-type">${escapeHtml(r.formats.split(',')[0])}</span>` : ''}
                    <span class="item-condition">${yearStr}</span>
                </div>
                ${r.genres ? `<div style="margin-top: 4px;"><span style="font-size: 0.65rem; padding: 2px 8px; border-radius: 500px; background: rgba(124,77,255,0.1); color: var(--accent);">${escapeHtml(r.genres)}</span></div>` : ''}
                <div class="item-footer">
                    <span style="color: var(--muted); font-size: 0.75rem;">${r.country ? '🌍 ' + escapeHtml(r.country) : ''}</span>
                    <span style="color: var(--accent); font-size: 0.75rem; font-weight: 700;">View Details ›</span>
                </div>
            </div>
        </div>
    `;
}

// ===== Discogs Detail Modal =====

function openDiscogsModal(release) {
    const modal = document.getElementById('itemModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    modalTitle.textContent = release.title;

    const formatIcon = getFormatIcon(release.formats || '');
    const yearStr = release.year && release.year > 0 ? release.year : 'Unknown';

    let relatedHtml = '';
    if (release.masterId && release.masterId > 0) {
        relatedHtml = `
            <div id="relatedReleases" style="margin-top: 16px;">
                <h4 style="margin-bottom: 12px; color: var(--text);">📦 Other Versions of This Album</h4>
                <div id="relatedList" style="color: var(--muted); font-size: 0.85rem;">Loading related releases...</div>
            </div>
        `;
    }

    const coverSrc = `${API_BASE_URL}/covers/${release.discogsId}`;
    modalBody.innerHTML = `
        <div class="modal-item-details" style="color: var(--text);">
            <div style="text-align: center; padding: 24px; background: var(--bg); border-radius: 12px; margin-bottom: 16px;">
                <img src="${coverSrc}" alt="" style="width:200px;height:200px;object-fit:cover;border-radius:12px;"
                     onerror="this.style.display='none'; this.insertAdjacentHTML('afterend','<span style=\\'font-size:5rem\\'>${formatIcon}</span>')">
                <div style="margin-top: 8px;">
                    <span style="font-size: 0.6rem; color: var(--muted);">Powered by Discogs</span>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div><strong>Title:</strong> ${escapeHtml(release.title)}</div>
                <div><strong>Artist:</strong> <a href="artist.html?name=${encodeURIComponent(release.artist || '')}" style="color:var(--accent);text-decoration:none;">${escapeHtml(release.artist || 'Unknown')}</a></div>
                <div><strong>Year:</strong> ${yearStr}</div>
                ${release.formats ? `<div><strong>Format:</strong> ${escapeHtml(release.formats)}</div>` : ''}
                ${release.genres ? `<div><strong>Genres:</strong> ${escapeHtml(release.genres)}</div>` : ''}
                ${release.styles ? `<div><strong>Styles:</strong> ${escapeHtml(release.styles)}</div>` : ''}
                ${release.labels ? `<div><strong>Label:</strong> ${escapeHtml(release.labels)}</div>` : ''}
                ${release.country ? `<div><strong>Country:</strong> 🌍 ${escapeHtml(release.country)}</div>` : ''}
                ${release.barcode ? `<div><strong>Barcode:</strong> <code style="color: var(--accent);">${escapeHtml(release.barcode)}</code></div>` : ''}

                <hr style="border: none; border-top: 1px solid var(--border); margin: 8px 0;">

                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <a href="release.html?id=${release.discogsId}" class="btn btn-primary" style="text-decoration: none; font-size: 0.85rem;">📄 Full Details</a>
                    <a href="add-item.html" class="btn btn-primary" style="text-decoration: none; font-size: 0.85rem;" onclick="storeDiscogsForAdd(${release.discogsId})">➕ Add to Collection</a>
                    <a href="https://www.discogs.com/release/${release.discogsId}" target="_blank" class="btn btn-secondary" style="text-decoration: none; font-size: 0.85rem;">🔗 Discogs</a>
                </div>

                ${relatedHtml}
            </div>
        </div>
    `;

    // Hide the default action buttons for Discogs items
    const actionBtns = modal.querySelectorAll('.feature-section > div:last-child');

    modal.classList.remove('hidden');

    // Load related releases if master ID exists
    if (release.masterId && release.masterId > 0) {
        loadRelatedReleases(release.masterId, release.discogsId);
    }
}

function storeDiscogsForAdd(discogsId) {
    // Store the discogs ID so add-item page can pre-fill
    sessionStorage.setItem('prefillDiscogsId', discogsId);
}

async function loadRelatedReleases(masterId, currentId) {
    const listEl = document.getElementById('relatedList');
    if (!listEl) return;

    try {
        const response = await fetch(`${API_BASE_URL}/discogs/related?masterId=${masterId}`);
        const data = await response.json();
        const releases = (data.releases || []).filter(r => r.discogsId !== currentId);

        if (releases.length === 0) {
            listEl.innerHTML = '<p style="color: var(--muted);">No other versions found.</p>';
            return;
        }

        listEl.innerHTML = releases.slice(0, 20).map(r => {
            const yearStr = r.year && r.year > 0 ? r.year : '—';
            return `
                <div onclick='openDiscogsModal(${JSON.stringify(r).replace(/'/g, "&#39;")})' 
                     style="display: flex; align-items: center; gap: 12px; padding: 10px; margin-bottom: 4px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; cursor: pointer; transition: border-color 0.2s;"
                     onmouseover="this.style.borderColor='var(--accent)'"
                     onmouseout="this.style.borderColor='var(--border)'">
                    <span style="font-size: 1.2rem;">${getFormatIcon(r.formats || '')}</span>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 700; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(r.title)}</div>
                        <div style="font-size: 0.75rem; color: var(--muted);">${yearStr} · ${escapeHtml(r.formats || '')} · ${escapeHtml(r.country || '')}</div>
                    </div>
                </div>
            `;
        }).join('');

        if (releases.length > 20) {
            listEl.innerHTML += `<p style="color: var(--muted); font-size: 0.8rem; margin-top: 8px;">...and ${releases.length - 20} more versions</p>`;
        }
    } catch (e) {
        listEl.innerHTML = '<p style="color: var(--muted);">Could not load related releases.</p>';
    }
}

function getFormatIcon(format) {
    if (!format) return '💿';
    const f = format.toLowerCase();
    if (f.includes('vinyl') || f.includes('lp') || f.includes('12"') || f.includes('7"') || f.includes('10"')) return '🎵';
    if (f.includes('cd')) return '💿';
    if (f.includes('cassette')) return '📼';
    if (f.includes('dvd')) return '🎬';
    if (f.includes('blu-ray') || f.includes('blu ray')) return '📀';
    return '💿';
}

// ===== Display Collection Items =====

function displayItems(items) {
    const container = document.getElementById('collectionContainer');
    
    if (!items || items.length === 0) {
        displayEmptyState();
        return;
    }

    container.innerHTML = items.map(item => {
        const hasCover = item.coverUrl && item.coverUrl.trim() !== '';
        const mediaIcon = getMediaIcon(item.mediaType);
        const isPrivate = item.visibility === 'private';
        
        return `
            <div class="collection-item-card">
                <div class="item-actions">
                    <button class="btn-icon" 
                            onclick="toggleVisibility('${item.id}', '${item.visibility}')" 
                            title="Click to make ${isPrivate ? 'Public' : 'Private'}"
                            style="margin-right: 4px; font-size: 0.9rem; background: ${isPrivate ? 'rgba(255,68,68,0.1)' : 'rgba(16,185,129,0.1)'};">
                        ${isPrivate ? '🔒' : '🔓'}
                    </button>
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

// Toggle item visibility
async function toggleVisibility(itemId, currentVisibility) {
    const userId = localStorage.getItem('userId');
    const newVisibility = currentVisibility === 'private' ? 'public' : 'private';
    
    try {
        const response = await fetch(`${API_BASE_URL}/collection/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                itemId: itemId,
                visibility: newVisibility
            })
        });

        if (response.ok) {
            // Update local state and redraw
            const item = allItems.find(i => i.id === itemId);
            if (item) item.visibility = newVisibility;
            displayItems(allItems);
        } else {
            alert('Failed to update visibility');
        }
    } catch (error) {
        console.error('Error toggling visibility:', error);
        alert('Network error while updating visibility');
    }
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

// ===== Collection Item Modal =====

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
                <div><strong>Visibility:</strong> ${item.visibility === 'private' ? '🔒 Private' : '🔓 Public'}</div>
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
                
                <div id="sellSection" style="background: var(--bg); padding: 16px; border-radius: 8px; border: 1px solid var(--border);">
                    <h4 style="margin-bottom: 4px;">List on Marketplace</h4>
                    <p style="font-size: 0.75rem; color: var(--muted); margin-bottom: 12px;">1% platform fee applies to all sales</p>
                    <div style="display: flex; gap: 12px;">
                        <input type="number" id="listingPrice" placeholder="Listing Price ($)" step="0.01" min="0" style="flex: 1; padding: 8px; border-radius: 4px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text);">
                        <button id="listingBtn" class="btn btn-primary" onclick="listItemOnMarketplace()" style="padding: 8px 16px; font-size: 0.8rem;">List Item</button>
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

    const fee = (price * 0.01).toFixed(2);
    const payout = (price - parseFloat(fee)).toFixed(2);

    if (!confirm(`List this item for $${price.toFixed(2)} on the marketplace?\n\nPlatform fee (1%): $${fee}\nYou'll receive: $${payout}`)) {
        return;
    }

    const listBtn = document.querySelector('#listingBtn');
    if (listBtn) {
        listBtn.disabled = true;
        listBtn.textContent = 'Listing...';
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
            const sellSection = document.getElementById('sellSection');
            if (sellSection) {
                sellSection.innerHTML = `
                    <div style="text-align: center; padding: 16px; background: rgba(16,185,129,0.08); border-radius: 8px; border: 1px solid #10b981;">
                        <p style="color: #10b981; font-weight: 700;">✓ Listed for $${price.toFixed(2)}</p>
                        <p style="font-size: 0.75rem; color: var(--muted); margin-top: 4px;">Fee: $${fee} · Payout: $${payout}</p>
                        <p style="font-size: 0.8rem; color: var(--muted); margin-top: 4px;">View it in <a href="marketplace.html" style="color: var(--accent);">Marketplace</a></p>
                    </div>
                `;
            }
        } else {
            const error = await response.json();
            alert('Failed to list item: ' + (error.message || 'Unknown error'));
            if (listBtn) {
                listBtn.disabled = false;
                listBtn.textContent = 'List Item';
            }
        }
    } catch (error) {
        console.error('Error listing item:', error);
        alert('Error connecting to marketplace service');
        if (listBtn) {
            listBtn.disabled = false;
            listBtn.textContent = 'List Item';
        }
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
