const API_BASE_URL = 'http://localhost:8080/api';

let searchTimeout = null;
let currentOffset = 0;
let currentTotal = 0;
let allResults = [];

// Auth check
function checkAuth() {
    const userId = localStorage.getItem('userId');
    if (!userId) { window.location.href = 'login.html'; return false; }
    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    const username = localStorage.getItem('username');
    document.getElementById('userGreeting').textContent = `Welcome, ${username}!`;
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('Logout?')) { localStorage.clear(); window.location.href = 'login.html'; }
    });

    document.getElementById('exploreSearch').addEventListener('input', debounceSearch);
    document.getElementById('filterArtist').addEventListener('input', debounceSearch);
    document.getElementById('filterGenre').addEventListener('change', () => { currentOffset = 0; doSearch(); });
    document.getElementById('filterFormat').addEventListener('change', () => { currentOffset = 0; doSearch(); });
    document.getElementById('filterDecade').addEventListener('change', () => { currentOffset = 0; doSearch(); });
    document.getElementById('filterCountry').addEventListener('change', () => { currentOffset = 0; doSearch(); });

    loadGenres();
    loadCountries();
    renderGenreTags();
});

// ===== Genre Tag Cloud =====
const POPULAR_GENRES = ['Rock', 'Electronic', 'Pop', 'Jazz', 'Hip Hop', 'Classical', 'Folk, World, & Country', 'Funk / Soul', 'Blues', 'Reggae', 'Latin', 'Stage & Screen', 'Non-Music', 'Children\'s'];

function renderGenreTags() {
    const container = document.getElementById('genreTags');
    container.innerHTML = POPULAR_GENRES.map(g => `
        <button class="genre-tag" onclick="selectGenreTag('${escapeHtml(g)}')"
            style="padding: 6px 16px; border-radius: 500px; border: 1px solid var(--border); background: var(--card-bg); color: var(--text); font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s;"
            onmouseover="this.style.borderColor='var(--accent)'; this.style.color='var(--accent)'"
            onmouseout="this.style.borderColor='var(--border)'; this.style.color='var(--text)'">${escapeHtml(g)}</button>
    `).join('');
}

function selectGenreTag(genre) {
    document.getElementById('filterGenre').value = genre;
    document.getElementById('exploreSearch').value = '';
    currentOffset = 0;
    doSearch();
}

// ===== Load Filter Options =====
async function loadGenres() {
    try {
        const res = await fetch(`${API_BASE_URL}/discogs/genres`);
        const data = await res.json();
        const select = document.getElementById('filterGenre');
        (data.genres || []).forEach(g => {
            const opt = document.createElement('option');
            opt.value = g; opt.textContent = g;
            select.appendChild(opt);
        });
    } catch (e) { console.log('Genres unavailable'); }
}

async function loadCountries() {
    try {
        const res = await fetch(`${API_BASE_URL}/discogs/countries`);
        const data = await res.json();
        const select = document.getElementById('filterCountry');
        (data.countries || []).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            select.appendChild(opt);
        });
    } catch (e) { console.log('Countries unavailable'); }
}

// ===== Search Logic =====
function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { currentOffset = 0; doSearch(); }, 350);
}

async function doSearch() {
    const query = document.getElementById('exploreSearch').value.trim();
    const artist = document.getElementById('filterArtist').value.trim();
    const genre = document.getElementById('filterGenre').value;
    const format = document.getElementById('filterFormat').value;
    const decade = document.getElementById('filterDecade').value;
    const country = document.getElementById('filterCountry').value;

    if (!query && !artist && !genre && !format && !decade && !country) {
        document.getElementById('exploreResults').innerHTML = '';
        document.getElementById('emptyState').classList.remove('hidden');
        document.getElementById('loadMoreSection').classList.add('hidden');
        document.getElementById('resultCount').textContent = '';
        return;
    }

    document.getElementById('emptyState').classList.add('hidden');

    let params = new URLSearchParams();
    if (query) params.set('q', query);
    if (artist) params.set('artist', artist);
    if (genre) params.set('genre', genre);
    if (format) params.set('format', format);
    if (country) params.set('country', country);
    if (decade) {
        const [from, to] = decade.split('-');
        params.set('yearFrom', from);
        params.set('yearTo', to);
    }
    params.set('offset', currentOffset);
    params.set('limit', 20);

    if (currentOffset === 0) {
        document.getElementById('exploreResults').innerHTML = '<p style="text-align:center;padding:40px;color:var(--muted);animation:pulse 1.5s infinite;">Searching...</p>';
    }

    try {
        const res = await fetch(`${API_BASE_URL}/discogs/explore?${params}`);
        const data = await res.json();

        currentTotal = data.total || 0;
        const results = data.results || [];

        if (currentOffset === 0) {
            allResults = results;
        } else {
            allResults = allResults.concat(results);
        }

        renderResults(allResults);

        const showing = allResults.length;
        document.getElementById('resultCount').textContent = currentTotal > 0
            ? `Showing ${showing.toLocaleString()} of ${currentTotal.toLocaleString()} results`
            : 'No results found';

        if (showing < currentTotal) {
            document.getElementById('loadMoreSection').classList.remove('hidden');
        } else {
            document.getElementById('loadMoreSection').classList.add('hidden');
        }
    } catch (e) {
        document.getElementById('exploreResults').innerHTML = '<p style="text-align:center;padding:40px;color:#ef4444;">Error searching. Make sure the server is running and data is imported.</p>';
    }
}

function loadMore() {
    currentOffset += 20;
    doSearch();
}

function clearFilters() {
    document.getElementById('exploreSearch').value = '';
    document.getElementById('filterArtist').value = '';
    document.getElementById('filterGenre').value = '';
    document.getElementById('filterFormat').value = '';
    document.getElementById('filterDecade').value = '';
    document.getElementById('filterCountry').value = '';
    currentOffset = 0;
    allResults = [];
    document.getElementById('exploreResults').innerHTML = '';
    document.getElementById('emptyState').classList.remove('hidden');
    document.getElementById('loadMoreSection').classList.add('hidden');
    document.getElementById('resultCount').textContent = '';
}

// ===== Render Results =====
function renderResults(results) {
    const container = document.getElementById('exploreResults');
    if (results.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:48px;color:var(--muted);grid-column:1/-1;"><div style="font-size:3rem;margin-bottom:12px;">🔇</div><p>No releases found matching your criteria</p></div>';
        return;
    }

    container.innerHTML = results.map(r => {
        const yearStr = r.year && r.year > 0 ? r.year : '—';
        const coverSrc = `${API_BASE_URL}/covers/${r.discogsId}`;
        const icon = getFormatIcon(r.formats || '');
        const genreTags = (r.genres || '').split(',').filter(g => g.trim()).slice(0, 2);

        return `
            <div class="collection-item-card" onclick="window.location.href='release.html?id=${r.discogsId}'" style="cursor:pointer;">
                <div class="item-media-icon">
                    <img src="${coverSrc}" alt="" style="width:100%;height:100%;object-fit:cover;"
                         onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=\\'font-size:4rem\\'>${icon}</span>'">
                </div>
                <div class="item-content">
                    <h3>${escapeHtml(r.title)}</h3>
                    <p class="item-artist">
                        <a href="artist.html?name=${encodeURIComponent(r.artist || '')}" 
                           onclick="event.stopPropagation()" 
                           style="color:var(--accent);text-decoration:none;">${escapeHtml(r.artist || 'Unknown')}</a>
                    </p>
                    <div class="item-meta">
                        ${r.formats ? `<span class="item-type">${escapeHtml((r.formats || '').split(',')[0])}</span>` : ''}
                        <span class="item-condition">${yearStr}</span>
                    </div>
                    ${genreTags.length > 0 ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;">${genreTags.map(g => `<span style="font-size:0.6rem;padding:2px 6px;border-radius:500px;background:rgba(124,77,255,0.1);color:var(--accent);">${escapeHtml(g.trim())}</span>`).join('')}</div>` : ''}
                    <div class="item-footer">
                        <span style="color:var(--muted);font-size:0.7rem;">${r.country ? '🌍 ' + escapeHtml(r.country) : ''}</span>
                        <span style="color:var(--accent);font-size:0.7rem;font-weight:700;">Details ›</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ===== Helpers =====
function getFormatIcon(format) {
    if (!format) return '💿';
    const f = format.toLowerCase();
    if (f.includes('vinyl') || f.includes('lp') || f.includes('12"') || f.includes('7"')) return '🎵';
    if (f.includes('cd')) return '💿';
    if (f.includes('cassette')) return '📼';
    if (f.includes('dvd')) return '🎬';
    if (f.includes('blu-ray')) return '📀';
    return '💿';
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}
