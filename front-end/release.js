const API_BASE_URL = 'http://localhost:8080/api';

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
    const id = params.get('id');
    if (id) loadRelease(parseInt(id));
    else document.getElementById('releaseContent').innerHTML = '<p style="text-align:center;padding:60px;color:#ef4444;">No release ID specified</p>';
});

async function loadRelease(discogsId) {
    try {
        const res = await fetch(`${API_BASE_URL}/discogs/release?id=${discogsId}`);
        const data = await res.json();
        if (!data || data.error) {
            document.getElementById('releaseContent').innerHTML = '<p style="text-align:center;padding:60px;color:#ef4444;">Release not found</p>';
            return;
        }
        const r = data.release || data;
        renderRelease(r);
        document.title = `${r.title} — Amadeus`;

        if (r.masterId && r.masterId > 0) loadRelated(r.masterId, r.discogsId);
    } catch (e) {
        document.getElementById('releaseContent').innerHTML = '<p style="text-align:center;padding:60px;color:#ef4444;">Error loading release</p>';
    }
}

function renderRelease(r) {
    const coverSrc = `${API_BASE_URL}/covers/${r.discogsId}`;
    const yearStr = r.year && r.year > 0 ? r.year : 'Unknown';
    const genres = (r.genres || '').split(',').filter(g => g.trim());
    const styles = (r.styles || '').split(',').filter(s => s.trim());
    const labels = (r.labels || '').split(',').filter(l => l.trim());

    document.getElementById('releaseContent').innerHTML = `
        <div style="display: grid; grid-template-columns: 300px 1fr; gap: 40px; align-items: start;">
            <!-- Cover Art -->
            <div style="position: sticky; top: 100px;">
                <div style="width: 100%; aspect-ratio: 1; border-radius: 16px; overflow: hidden; background: var(--bg); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center;">
                    <img src="${coverSrc}" alt="${escapeHtml(r.title)}" 
                         style="width: 100%; height: 100%; object-fit: cover;"
                         onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=\\'font-size:6rem\\'>${getFormatIcon(r.formats || '')}</span>'">
                </div>
                <p style="text-align: center; margin-top: 8px; font-size: 0.65rem; color: var(--muted);">Powered by Discogs</p>
            </div>

            <!-- Details -->
            <div>
                <h1 style="font-size: 2rem; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 4px;">${escapeHtml(r.title)}</h1>
                <h2 style="font-size: 1.2rem; font-weight: 400; margin-bottom: 24px;">
                    <a href="artist.html?name=${encodeURIComponent(r.artist || '')}" style="color: var(--accent); text-decoration: none;">${escapeHtml(r.artist || 'Unknown Artist')}</a>
                </h2>

                <!-- Tags -->
                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px;">
                    ${genres.map(g => `<span style="padding:4px 14px;border-radius:500px;background:rgba(124,77,255,0.1);color:var(--accent);font-size:0.75rem;font-weight:700;">${escapeHtml(g.trim())}</span>`).join('')}
                    ${styles.map(s => `<span style="padding:4px 14px;border-radius:500px;background:var(--bg);border:1px solid var(--border);color:var(--muted);font-size:0.75rem;font-weight:600;">${escapeHtml(s.trim())}</span>`).join('')}
                </div>

                <!-- Metadata Grid -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;">
                    <div class="feature-section" style="margin-bottom: 0; padding: 16px;">
                        <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: var(--muted); margin-bottom: 4px;">Year</div>
                        <div style="font-size: 1.3rem; font-weight: 800; color: var(--text);">${yearStr}</div>
                    </div>
                    <div class="feature-section" style="margin-bottom: 0; padding: 16px;">
                        <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: var(--muted); margin-bottom: 4px;">Format</div>
                        <div style="font-size: 1rem; font-weight: 700; color: var(--text);">${getFormatIcon(r.formats || '')} ${escapeHtml(r.formats || 'Unknown')}</div>
                    </div>
                    ${r.country ? `<div class="feature-section" style="margin-bottom: 0; padding: 16px;">
                        <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: var(--muted); margin-bottom: 4px;">Country</div>
                        <div style="font-size: 1rem; font-weight: 700; color: var(--text);">🌍 ${escapeHtml(r.country)}</div>
                    </div>` : ''}
                    ${labels.length > 0 ? `<div class="feature-section" style="margin-bottom: 0; padding: 16px;">
                        <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: var(--muted); margin-bottom: 4px;">Label</div>
                        <div style="font-size: 0.9rem; font-weight: 700; color: var(--text);">${labels.map(l => escapeHtml(l.trim())).join(', ')}</div>
                    </div>` : ''}
                    ${r.barcode ? `<div class="feature-section" style="margin-bottom: 0; padding: 16px;">
                        <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: var(--muted); margin-bottom: 4px;">Barcode</div>
                        <div style="font-size: 0.9rem; font-weight: 700; color: var(--text); font-family: monospace;">${escapeHtml(r.barcode)}</div>
                    </div>` : ''}
                    <div class="feature-section" style="margin-bottom: 0; padding: 16px;">
                        <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: var(--muted); margin-bottom: 4px;">Discogs ID</div>
                        <div style="font-size: 0.9rem; font-weight: 700; color: var(--accent); font-family: monospace;">${r.discogsId}</div>
                    </div>
                </div>

                <!-- Actions -->
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <a href="add-item.html" class="btn btn-primary" style="text-decoration: none;" onclick="sessionStorage.setItem('prefillDiscogsId','${r.discogsId}')">➕ Add to My Collection</a>
                    <a href="https://www.discogs.com/release/${r.discogsId}" target="_blank" class="btn btn-secondary" style="text-decoration: none;">🔗 View on Discogs</a>
                    <a href="artist.html?name=${encodeURIComponent(r.artist || '')}" class="btn btn-secondary" style="text-decoration: none;">👤 View Artist</a>
                </div>
            </div>
        </div>
    `;
}

async function loadRelated(masterId, currentId) {
    const section = document.getElementById('relatedSection');
    const grid = document.getElementById('relatedGrid');
    try {
        const res = await fetch(`${API_BASE_URL}/discogs/related?masterId=${masterId}`);
        const data = await res.json();
        const releases = (data.releases || []).filter(r => r.discogsId !== currentId);
        if (releases.length === 0) return;

        section.classList.remove('hidden');
        grid.innerHTML = releases.slice(0, 12).map(r => {
            const coverSrc = `${API_BASE_URL}/covers/${r.discogsId}`;
            const yearStr = r.year && r.year > 0 ? r.year : '—';
            return `
                <div class="collection-item-card" onclick="window.location.href='release.html?id=${r.discogsId}'" style="cursor:pointer;">
                    <div class="item-media-icon">
                        <img src="${coverSrc}" alt="" style="width:100%;height:100%;object-fit:cover;"
                             onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=\\'font-size:3rem\\'>${getFormatIcon(r.formats || '')}</span>'">
                    </div>
                    <div class="item-content">
                        <h3>${escapeHtml(r.title)}</h3>
                        <div class="item-meta">
                            ${r.formats ? `<span class="item-type">${escapeHtml((r.formats||'').split(',')[0])}</span>` : ''}
                            <span class="item-condition">${yearStr}</span>
                        </div>
                        <div class="item-footer">
                            <span style="color:var(--muted);font-size:0.7rem;">${r.country ? '🌍 '+escapeHtml(r.country) : ''}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        if (releases.length > 12) {
            grid.innerHTML += `<p style="grid-column:1/-1;text-align:center;color:var(--muted);font-size:0.85rem;">...and ${releases.length - 12} more versions</p>`;
        }
    } catch (e) { console.log('Related releases unavailable'); }
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
