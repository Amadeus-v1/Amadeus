const API_BASE_URL = 'http://localhost:8080/api';
let allArtistReleases = [];

function checkAuth() {
    if (!localStorage.getItem('userId')) { window.location.href = 'login.html'; return false; }
    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    document.getElementById('userGreeting').textContent = `Welcome, ${localStorage.getItem('username')}!`;
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('Logout?')) { localStorage.clear(); window.location.href = 'login.html'; }
    });

    const params = new URLSearchParams(window.location.search);
    const name = params.get('name');
    if (name) {
        loadArtist(name);
    } else {
        document.getElementById('artistHeader').innerHTML = '<p style="color:#ef4444;">No artist specified</p>';
    }
});

async function loadArtist(name) {
    try {
        const res = await fetch(`${API_BASE_URL}/discogs/artist?name=${encodeURIComponent(name)}&limit=200`);
        const data = await res.json();

        allArtistReleases = data.releases || [];
        const count = data.count || allArtistReleases.length;

        // Render header
        const genres = collectGenres(allArtistReleases);
        document.getElementById('artistHeader').innerHTML = `
            <div style="display: flex; align-items: center; gap: 24px;">
                <div style="width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), #b388ff); display: flex; align-items: center; justify-content: center; font-size: 2.5rem; flex-shrink: 0;">👤</div>
                <div>
                    <h1 style="font-size: 2rem; font-weight: 800; letter-spacing: -0.5px;">${escapeHtml(name)}</h1>
                    <p style="color: var(--muted);">${count} release${count !== 1 ? 's' : ''} in database</p>
                    ${genres.length > 0 ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">${genres.slice(0,5).map(g => `<span style="padding:3px 10px;border-radius:500px;background:rgba(124,77,255,0.1);color:var(--accent);font-size:0.7rem;font-weight:600;">${escapeHtml(g)}</span>`).join('')}</div>` : ''}
                </div>
            </div>
        `;
        document.title = `${name} — Amadeus`;

        // Build filter options
        buildFilters(allArtistReleases);

        // Render
        renderArtistReleases(allArtistReleases);

    } catch (e) {
        document.getElementById('artistHeader').innerHTML = '<p style="color:#ef4444;">Error loading artist</p>';
    }
}

function buildFilters(releases) {
    const filterBar = document.getElementById('artistFilters');
    filterBar.classList.remove('hidden');
    filterBar.style.display = 'flex';

    // Formats
    const formats = new Set();
    releases.forEach(r => {
        if (r.formats) r.formats.split(',').forEach(f => { const t = f.trim(); if (t) formats.add(t); });
    });
    const fmtSelect = document.getElementById('artistFilterFormat');
    formats.forEach(f => {
        const o = document.createElement('option');
        o.value = f; o.textContent = f;
        fmtSelect.appendChild(o);
    });

    // Decades
    const decades = new Set();
    releases.forEach(r => {
        if (r.year > 0) decades.add(Math.floor(r.year / 10) * 10);
    });
    const decSelect = document.getElementById('artistFilterDecade');
    [...decades].sort((a,b) => b - a).forEach(d => {
        const o = document.createElement('option');
        o.value = d; o.textContent = d + 's';
        decSelect.appendChild(o);
    });

    fmtSelect.addEventListener('change', applyArtistFilters);
    decSelect.addEventListener('change', applyArtistFilters);
}

function applyArtistFilters() {
    const fmt = document.getElementById('artistFilterFormat').value.toLowerCase();
    const dec = document.getElementById('artistFilterDecade').value;

    let filtered = allArtistReleases;
    if (fmt) filtered = filtered.filter(r => (r.formats || '').toLowerCase().includes(fmt));
    if (dec) {
        const d = parseInt(dec);
        filtered = filtered.filter(r => r.year >= d && r.year < d + 10);
    }

    renderArtistReleases(filtered);
}

function renderArtistReleases(releases) {
    const container = document.getElementById('artistReleases');
    document.getElementById('artistCount').textContent = `Showing ${releases.length} release${releases.length !== 1 ? 's' : ''}`;

    if (releases.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:48px;color:var(--muted);grid-column:1/-1;">No releases match your filters</p>';
        return;
    }

    container.innerHTML = releases.map(r => {
        const coverSrc = `${API_BASE_URL}/covers/${r.discogsId}`;
        const yearStr = r.year && r.year > 0 ? r.year : '—';
        const icon = getFormatIcon(r.formats || '');

        return `
            <div class="collection-item-card" onclick="window.location.href='release.html?id=${r.discogsId}'" style="cursor:pointer;">
                <div class="item-media-icon">
                    <img src="${coverSrc}" alt="" style="width:100%;height:100%;object-fit:cover;"
                         onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=\\'font-size:3rem\\'>${icon}</span>'">
                </div>
                <div class="item-content">
                    <h3>${escapeHtml(r.title)}</h3>
                    <div class="item-meta">
                        ${r.formats ? `<span class="item-type">${escapeHtml((r.formats||'').split(',')[0])}</span>` : ''}
                        <span class="item-condition">${yearStr}</span>
                    </div>
                    <div class="item-footer">
                        <span style="color:var(--muted);font-size:0.7rem;">${r.country ? '🌍 '+escapeHtml(r.country) : ''}</span>
                        <span style="color:var(--accent);font-size:0.7rem;font-weight:700;">Details ›</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function collectGenres(releases) {
    const genreCount = {};
    releases.forEach(r => {
        if (r.genres) r.genres.split(',').forEach(g => {
            const t = g.trim();
            if (t) genreCount[t] = (genreCount[t] || 0) + 1;
        });
    });
    return Object.entries(genreCount).sort((a,b) => b[1] - a[1]).map(e => e[0]);
}

function getFormatIcon(f) {
    if (!f) return '💿';
    f = f.toLowerCase();
    if (f.includes('vinyl') || f.includes('lp')) return '🎵';
    if (f.includes('cd')) return '💿';
    if (f.includes('cassette')) return '📼';
    if (f.includes('dvd')) return '🎬';
    return '💿';
}

function escapeHtml(t) {
    if (!t) return '';
    return t.toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
