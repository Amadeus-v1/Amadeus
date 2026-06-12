const API_BASE_URL = 'http://localhost:8080/api';

let discogsAvailable = false;
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
    document.getElementById('addItemForm').addEventListener('submit', handleAddItem);
    
    // Live preview for cover URL
    const coverUrlInput = document.getElementById('itemCoverUrl');
    if (coverUrlInput) {
        coverUrlInput.addEventListener('input', updateCoverPreview);
    }

    // Discogs search
    const discogsInput = document.getElementById('discogsSearchInput');
    if (discogsInput) {
        discogsInput.addEventListener('input', debounceDiscogsSearch);
    }

    // Check Discogs status
    checkDiscogsStatus();

    // Check if we have a prefilled Discogs ID
    const prefillId = sessionStorage.getItem('prefillDiscogsId');
    if (prefillId) {
        sessionStorage.removeItem('prefillDiscogsId');
        loadAndPrefillRelease(prefillId);
    }
});

async function loadAndPrefillRelease(discogsId) {
    try {
        const res = await fetch(`${API_BASE_URL}/discogs/release?id=${discogsId}`);
        const data = await res.json();
        const r = data.release || data;
        if (r && !r.error) {
            selectDiscogsResult(r);
        }
    } catch (e) {
        console.error('Failed to load prefilled release', e);
    }
}

// ===== Discogs Integration =====

async function checkDiscogsStatus() {
    const statusBadge = document.getElementById('discogsStatus');
    const importBanner = document.getElementById('discogsImportBanner');
    const searchInput = document.getElementById('discogsSearchInput');

    try {
        const response = await fetch(`${API_BASE_URL}/discogs/status`);
        const data = await response.json();

        discogsAvailable = data.available;

        if (data.available) {
            const count = data.recordCount;
            statusBadge.textContent = `${count.toLocaleString()} releases`;
            statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
            statusBadge.style.color = '#10b981';
            if (importBanner) importBanner.classList.add('hidden');
            searchInput.disabled = false;
            searchInput.placeholder = '🔍 Search by artist, album title, or barcode...';
        } else {
            statusBadge.textContent = 'Not imported';
            statusBadge.style.background = 'rgba(245, 158, 11, 0.15)';
            statusBadge.style.color = '#f59e0b';
            if (importBanner) importBanner.classList.remove('hidden');
            searchInput.disabled = true;
            searchInput.placeholder = 'Discogs data not imported yet...';
        }
    } catch (e) {
        statusBadge.textContent = 'Offline';
        statusBadge.style.background = 'rgba(239, 68, 68, 0.15)';
        statusBadge.style.color = '#ef4444';
        searchInput.disabled = true;
    }
}

function debounceDiscogsSearch() {
    clearTimeout(discogsSearchTimeout);
    discogsSearchTimeout = setTimeout(searchDiscogs, 300);
}

async function searchDiscogs() {
    const query = document.getElementById('discogsSearchInput').value.trim();
    const resultsContainer = document.getElementById('discogsResults');
    const searchingEl = document.getElementById('discogsSearching');

    if (!query || query.length < 2) {
        resultsContainer.innerHTML = '';
        searchingEl.classList.add('hidden');
        return;
    }

    if (!discogsAvailable) return;

    searchingEl.classList.remove('hidden');

    try {
        const response = await fetch(`${API_BASE_URL}/discogs/search?q=${encodeURIComponent(query)}&limit=15`);
        const data = await response.json();
        searchingEl.classList.add('hidden');

        const results = data.results || [];
        if (results.length === 0) {
            resultsContainer.innerHTML = `
                <div style="text-align: center; padding: 24px; color: var(--muted);">
                    <p>No results found for "<strong>${escapeHtml(query)}</strong>"</p>
                    <p style="font-size: 0.8rem; margin-top: 8px;">Try a different search term, or add the item manually below.</p>
                </div>
            `;
            return;
        }

        resultsContainer.innerHTML = results.map(r => {
            const formatIcon = getFormatIcon(r.formats || '');
            const yearStr = r.year && r.year > 0 ? r.year : '—';
            return `
                <div class="discogs-result" onclick='selectDiscogsResult(${JSON.stringify(r).replace(/'/g, "&#39;")})' 
                     style="display: flex; align-items: center; gap: 16px; padding: 14px; margin-bottom: 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 12px; cursor: pointer; transition: all 0.2s ease;"
                     onmouseover="this.style.borderColor='var(--accent)'; this.style.transform='translateX(4px)'"
                     onmouseout="this.style.borderColor='var(--border)'; this.style.transform='none'">
                    <div style="font-size: 2rem; flex-shrink: 0; width: 48px; text-align: center;">${formatIcon}</div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(r.title)}</div>
                        <div style="font-size: 0.85rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(r.artist || 'Unknown Artist')}</div>
                        <div style="display: flex; gap: 8px; margin-top: 4px; flex-wrap: wrap;">
                            <span style="font-size: 0.7rem; padding: 2px 8px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 500px; color: var(--muted);">${yearStr}</span>
                            ${r.formats ? `<span style="font-size: 0.7rem; padding: 2px 8px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 500px; color: var(--muted);">${escapeHtml(r.formats)}</span>` : ''}
                            ${r.genres ? `<span style="font-size: 0.7rem; padding: 2px 8px; background: rgba(124,77,255,0.1); border-radius: 500px; color: var(--accent);">${escapeHtml(r.genres)}</span>` : ''}
                            ${r.country ? `<span style="font-size: 0.7rem; padding: 2px 8px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 500px; color: var(--muted);">🌍 ${escapeHtml(r.country)}</span>` : ''}
                        </div>
                    </div>
                    <div style="flex-shrink: 0; color: var(--accent); font-weight: 700; font-size: 0.75rem; text-transform: uppercase;">Use ›</div>
                </div>
            `;
        }).join('');

    } catch (e) {
        searchingEl.classList.add('hidden');
        resultsContainer.innerHTML = `<div style="text-align: center; padding: 16px; color: #ef4444;">Error searching Discogs: ${e.message}</div>`;
    }
}

function selectDiscogsResult(release) {
    document.getElementById('itemTitle').value = release.title || '';
    document.getElementById('itemArtistAuthor').value = release.artist || '';

    if (release.year && release.year > 0) {
        document.getElementById('itemReleaseDate').value = `${release.year}-01-01`;
    }

    const format = (release.formats || '').toLowerCase();
    const mediaTypeSelect = document.getElementById('itemMediaType');
    if (format.includes('vinyl') || format.includes('lp') || format.includes('12"') || format.includes('7"') || format.includes('10"')) {
        mediaTypeSelect.value = 'Vinyl';
    } else if (format.includes('cd')) {
        mediaTypeSelect.value = 'CD';
    } else if (format.includes('cassette')) {
        mediaTypeSelect.value = 'Cassette';
    } else if (format.includes('dvd')) {
        mediaTypeSelect.value = 'DVD';
    } else if (format.includes('blu-ray') || format.includes('blu ray')) {
        mediaTypeSelect.value = 'Blu-ray';
    } else {
        mediaTypeSelect.value = 'CD';
    }

    document.getElementById('itemFormat').value = release.formats || '';

    // Set cover URL to the cover art proxy endpoint
    const coverUrlInput = document.getElementById('itemCoverUrl');
    if (coverUrlInput) {
        coverUrlInput.value = `${API_BASE_URL}/covers/${release.discogsId}`;
        updateCoverPreview();
    }

    const notes = [];
    if (release.genres) notes.push(`Genres: ${release.genres}`);
    if (release.styles) notes.push(`Styles: ${release.styles}`);
    if (release.labels) notes.push(`Label: ${release.labels}`);
    if (release.country) notes.push(`Country: ${release.country}`);
    notes.push(`Discogs ID: ${release.discogsId}`);
    if (release.masterId && release.masterId > 0) notes.push(`Master ID: ${release.masterId}`);
    document.getElementById('itemDescription').value = notes.join('\n');

    const formSection = document.querySelector('#addItemForm .feature-section');
    if (formSection) {
        formSection.style.borderColor = 'var(--accent)';
        formSection.style.transition = 'border-color 0.3s ease';
        setTimeout(() => { formSection.style.borderColor = ''; }, 3000);
    }

    document.getElementById('discogsResults').innerHTML = `
        <div style="text-align: center; padding: 16px; color: #10b981; font-weight: 700; background: rgba(16,185,129,0.08); border-radius: 12px;">
            ✓ "${escapeHtml(release.title)}" selected — fill in condition & value below, then add to collection.
        </div>
    `;

    document.getElementById('addItemForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
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

// Update cover preview
function updateCoverPreview() {
    const url = document.getElementById('itemCoverUrl').value.trim();
    const previewContainer = document.getElementById('coverPreviewContainer');
    
    if (url) {
        previewContainer.innerHTML = `<img src="${url}" alt="Preview" style="max-height: 100%; max-width: 100%; border-radius: 4px;" onerror="this.parentElement.innerHTML='<span style=\\'color: #ff4444; font-size: 0.8rem;\\'>Invalid Image URL</span>'">`;
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

// Handle add item form submission
async function handleAddItem(e) {
    e.preventDefault();

    const userId = localStorage.getItem('userId');
    const title = document.getElementById('itemTitle').value.trim();
    const mediaType = document.getElementById('itemMediaType').value;
    const condition = document.getElementById('itemCondition').value;
    const quantity = parseInt(document.getElementById('itemQuantity').value) || 1;
    const estimatedValue = parseFloat(document.getElementById('itemEstimatedValue').value) || 0;
    const coverUrl = document.getElementById('itemCoverUrl').value.trim();

    if (!title || !mediaType || !condition) {
        showFormMessage('Please fill in all required fields', 'error');
        return;
    }

    const releaseDate = document.getElementById('itemReleaseDate').value;
    const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : 0;

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
