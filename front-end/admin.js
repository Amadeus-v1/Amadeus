const API_BASE_URL = 'http://localhost:8080/api';
const ADMIN_USERNAME = 'Xpexdex';

let importPolling = false;

// Check auth and admin access
function checkAuth() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function isAdmin() {
    const username = localStorage.getItem('username');
    return username && username.toLowerCase() === ADMIN_USERNAME.toLowerCase();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;

    const username = localStorage.getItem('username');
    document.getElementById('userGreeting').textContent = `Welcome, ${username}!`;
    document.getElementById('logoutBtn').addEventListener('click', logout);

    if (isAdmin()) {
        document.getElementById('adminContent').classList.remove('hidden');
        document.getElementById('accessDenied').classList.add('hidden');
        refreshDiscogsStatus();
        loadConfig();
    } else {
        document.getElementById('adminContent').classList.add('hidden');
        document.getElementById('accessDenied').classList.remove('hidden');
    }
});

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        window.location.href = 'login.html';
    }
}

// ===== Discogs Status =====

async function refreshDiscogsStatus() {
    const badge = document.getElementById('discogsStatusBadge');
    const recordCount = document.getElementById('discogsRecordCount');
    const dbStatus = document.getElementById('discogsDbStatus');
    const importState = document.getElementById('discogsImportState');

    try {
        const response = await fetch(`${API_BASE_URL}/discogs/status`);
        const data = await response.json();

        if (data.available) {
            badge.textContent = 'Online';
            badge.style.background = 'rgba(16, 185, 129, 0.15)';
            badge.style.color = '#10b981';
            recordCount.textContent = data.recordCount.toLocaleString();
            dbStatus.textContent = 'Active';
            dbStatus.style.color = '#10b981';
        } else {
            badge.textContent = 'No Data';
            badge.style.background = 'rgba(245, 158, 11, 0.15)';
            badge.style.color = '#f59e0b';
            recordCount.textContent = '0';
            dbStatus.textContent = 'Empty';
            dbStatus.style.color = '#f59e0b';
        }

        const status = data.importStatus;
        if (status && status.importing) {
            importState.textContent = status.status;
            importState.style.color = '#f59e0b';
            showImportProgress(status);
            if (!importPolling) startPolling();
        } else if (status && status.status === 'complete') {
            importState.textContent = 'Complete';
            importState.style.color = '#10b981';
            hideImportProgress();
        } else if (status && status.status === 'error') {
            importState.textContent = 'Error';
            importState.style.color = '#ef4444';
        } else {
            importState.textContent = 'Idle';
            importState.style.color = 'var(--muted)';
        }
    } catch (e) {
        badge.textContent = 'Offline';
        badge.style.background = 'rgba(239, 68, 68, 0.15)';
        badge.style.color = '#ef4444';
        recordCount.textContent = '—';
        dbStatus.textContent = 'Error';
        importState.textContent = '—';
    }
}

// ===== Import Controls =====

async function startImport() {
    const btn = document.getElementById('startImportBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Starting...';

    try {
        const response = await fetch(`${API_BASE_URL}/discogs/import`, { method: 'POST' });
        const data = await response.json();

        showImportProgress({ status: 'starting', recordsProcessed: 0 });
        startPolling();
    } catch (e) {
        btn.disabled = false;
        btn.textContent = '⬇️ Download & Import Latest Dump';
        alert('Failed to start import: ' + e.message);
    }
}

function startPolling() {
    if (importPolling) return;
    importPolling = true;
    pollImport();
}

async function pollImport() {
    if (!importPolling) return;

    try {
        const response = await fetch(`${API_BASE_URL}/discogs/status`);
        const data = await response.json();
        const status = data.importStatus;

        if (status.importing) {
            showImportProgress(status);
            setTimeout(pollImport, 2000);
        } else if (status.status === 'complete') {
            importPolling = false;
            hideImportProgress();
            refreshDiscogsStatus();
            
            const btn = document.getElementById('startImportBtn');
            btn.disabled = false;
            btn.textContent = '⬇️ Download & Import Latest Dump';
        } else if (status.status === 'error') {
            importPolling = false;
            const progressBar = document.getElementById('importProgressBar');
            const statusText = document.getElementById('importStatusText');
            statusText.textContent = `✗ Error: ${status.error || 'Unknown'}`;
            statusText.style.color = '#ef4444';
            
            const btn = document.getElementById('startImportBtn');
            btn.disabled = false;
            btn.textContent = '🔄 Retry Import';
        } else {
            importPolling = false;
            hideImportProgress();
        }
    } catch (e) {
        setTimeout(pollImport, 5000);
    }
}

function showImportProgress(status) {
    const progressBar = document.getElementById('importProgressBar');
    const statusText = document.getElementById('importStatusText');
    const counter = document.getElementById('importRecordCounter');
    const fill = document.getElementById('importProgressFill');

    progressBar.classList.remove('hidden');

    const statusMessages = {
        'starting': '⏳ Initializing import...',
        'downloading': '⬇️ Downloading Discogs data dump...',
        'parsing': '📀 Parsing XML & importing to database...',
    };

    statusText.textContent = statusMessages[status.status] || `Status: ${status.status}`;
    statusText.style.color = 'var(--text)';
    counter.textContent = `${(status.recordsProcessed || 0).toLocaleString()} records`;

    // Animate the progress bar indeterminately
    fill.style.width = status.status === 'parsing' ? '60%' : status.status === 'downloading' ? '20%' : '5%';
    
    const btn = document.getElementById('startImportBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Import in progress...';
}

function hideImportProgress() {
    const fill = document.getElementById('importProgressFill');
    fill.style.width = '100%';
    fill.style.animation = 'none';
    fill.style.background = '#10b981';

    const statusText = document.getElementById('importStatusText');
    statusText.textContent = '✓ Import complete!';
    statusText.style.color = '#10b981';
}

// ===== Server Configuration =====

async function loadConfig() {
    try {
        const res = await fetch(`${API_BASE_URL}/admin/config`);
        const data = await res.json();
        const config = data.config || {};

        // Show token status
        const tokenStatus = document.getElementById('tokenStatus');
        if (config.discogs_api_token) {
            tokenStatus.innerHTML = `<span style="color: #10b981;">✓ Token configured (${config.discogs_api_token})</span>`;
        } else {
            tokenStatus.innerHTML = `<span style="color: var(--muted);">No token set — using unauthenticated access (~25 req/min)</span>`;
        }

        // Show config list
        const configList = document.getElementById('configList');
        const entries = Object.entries(config);
        if (entries.length > 0) {
            configList.innerHTML = entries.map(([k, v]) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--card-bg); border-radius: 8px; margin-bottom: 4px; border: 1px solid var(--border);">
                    <code style="color: var(--accent); font-size: 0.8rem;">${escapeHtml(k)}</code>
                    <code style="color: var(--text); font-size: 0.8rem;">${escapeHtml(v)}</code>
                </div>
            `).join('');
        } else {
            configList.innerHTML = '<p style="color: var(--muted);">No configuration values set</p>';
        }

        // Cache info placeholder
        document.getElementById('cacheInfo').innerHTML = '<span style="color: var(--muted);">Cover art is cached automatically when releases are viewed. Cached images are stored in the <code style="color:var(--accent);">covers/</code> directory.</span>';

    } catch (e) {
        document.getElementById('configList').innerHTML = '<p style="color: #ef4444;">Error loading config</p>';
        document.getElementById('tokenStatus').innerHTML = '<span style="color: #ef4444;">Could not check token status</span>';
    }
}

async function saveDiscogsToken() {
    const input = document.getElementById('discogsTokenInput');
    const token = input.value.trim();
    if (!token) {
        document.getElementById('tokenStatus').innerHTML = '<span style="color: #ef4444;">Please enter a token</span>';
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/admin/config/set`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'discogs_api_token', value: token })
        });
        if (res.ok) {
            input.value = '';
            document.getElementById('tokenStatus').innerHTML = '<span style="color: #10b981;">✓ Token saved successfully! Cover art fetching will now use authenticated rate limits (~60 req/min)</span>';
            loadConfig();
        } else {
            document.getElementById('tokenStatus').innerHTML = '<span style="color: #ef4444;">Failed to save token</span>';
        }
    } catch (e) {
        document.getElementById('tokenStatus').innerHTML = '<span style="color: #ef4444;">Error saving token</span>';
    }
}

async function clearDiscogsToken() {
    try {
        const res = await fetch(`${API_BASE_URL}/admin/config/set`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'discogs_api_token', value: '' })
        });
        if (res.ok) {
            document.getElementById('discogsTokenInput').value = '';
            document.getElementById('tokenStatus').innerHTML = '<span style="color: var(--muted);">Token cleared — using unauthenticated access</span>';
            loadConfig();
        }
    } catch (e) {
        document.getElementById('tokenStatus').innerHTML = '<span style="color: #ef4444;">Error clearing token</span>';
    }
}

async function saveCustomConfig() {
    const key = document.getElementById('configKey').value.trim();
    const value = document.getElementById('configValue').value.trim();
    if (!key) return;

    try {
        const res = await fetch(`${API_BASE_URL}/admin/config/set`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value })
        });
        if (res.ok) {
            document.getElementById('configKey').value = '';
            document.getElementById('configValue').value = '';
            loadConfig();
        }
    } catch (e) {
        alert('Error saving config');
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}
