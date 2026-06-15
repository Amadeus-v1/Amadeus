const API_BASE_URL = 'http://localhost:8080/api';
let currentProfile = null;
let isOwnProfile = true;

function checkAuth() {
    if (!localStorage.getItem('userId')) { window.location.href = 'login.html'; return false; }
    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    const myUsername = localStorage.getItem('username');
    const myUserId = localStorage.getItem('userId');
    document.getElementById('userGreeting').textContent = `Welcome, ${myUsername}!`;
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('Logout?')) { localStorage.clear(); window.location.href = 'login.html'; }
    });

    // Determine if viewing own or someone else's profile
    const params = new URLSearchParams(window.location.search);
    const viewUser = params.get('user');

    if (viewUser && viewUser.toLowerCase() !== myUsername.toLowerCase()) {
        isOwnProfile = false;
        loadPublicProfile(viewUser);
    } else {
        isOwnProfile = true;
        loadOwnProfile(myUserId);
    }

    document.getElementById('editForm').addEventListener('submit', saveProfile);
});

async function loadOwnProfile(userId) {
    try {
        const res = await fetch(`${API_BASE_URL}/user/profile?userId=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error('Failed');
        currentProfile = await res.json();
        renderProfile(currentProfile, true);
        loadCollectionStats(userId);
        loadRecentItems(userId);
    } catch (e) {
        document.getElementById('profileHeader').innerHTML = '<p style="color:#ef4444;">Error loading profile</p>';
    }
}

async function loadPublicProfile(username) {
    try {
        const res = await fetch(`${API_BASE_URL}/user/profile/public?username=${encodeURIComponent(username)}`);
        if (!res.ok) throw new Error('Not found');
        currentProfile = await res.json();
        renderProfile(currentProfile, false);
        loadCollectionStats(currentProfile.id);
        loadRecentItems(currentProfile.id);
    } catch (e) {
        document.getElementById('profileHeader').innerHTML = '<p style="color:#ef4444;">User not found</p>';
    }
}

function renderProfile(p, editable) {
    const displayName = p.displayName || p.username;
    const avatarUrl = p.avatarUrl;
    const avatarHtml = avatarUrl
        ? `<img src="${escapeHtml(avatarUrl)}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.outerHTML='<span style=\\'font-size:3rem\\'>👤</span>'">`
        : '<span style="font-size:3rem;">👤</span>';

    document.getElementById('profileHeader').innerHTML = `
        <div style="display: flex; align-items: center; gap: 24px; text-align: left;">
            <div style="width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), #b388ff); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden;">
                ${avatarHtml}
            </div>
            <div style="flex: 1;">
                <h1 style="font-size: 1.8rem; font-weight: 800; letter-spacing: -0.5px;">${escapeHtml(displayName)}</h1>
                <p style="color: var(--muted); font-size: 0.9rem;">@${escapeHtml(p.username)}</p>
            </div>
            ${editable ? '<button class="btn btn-secondary" onclick="openEditModal()" style="flex-shrink:0;">✏️ Edit Profile</button>' : `<a href="friends.html" class="btn btn-primary" style="text-decoration:none;flex-shrink:0;">👥 Add Friend</a>`}
        </div>
    `;
    document.title = `${displayName} — Amadeus`;

    // Bio
    const bio = p.bio || (editable ? 'Click "Edit Profile" to add a bio.' : 'No bio set.');
    document.getElementById('profileBio').textContent = bio;

    // Genres
    const genres = (p.favoriteGenres || '').split(',').filter(g => g.trim());
    const genresContainer = document.getElementById('profileGenres');
    if (genres.length > 0) {
        genresContainer.innerHTML = genres.map(g => `<span style="padding:4px 14px;border-radius:500px;background:rgba(124,77,255,0.1);color:var(--accent);font-size:0.8rem;font-weight:600;">${escapeHtml(g.trim())}</span>`).join('');
    } else {
        genresContainer.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;">No favorite genres set</p>';
    }

    // Created
    const created = p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown';
    document.getElementById('profileCreated').textContent = created;

    document.getElementById('profileContent').classList.remove('hidden');
    document.getElementById('profileContent').style.display = 'grid';
}

async function loadCollectionStats(userId) {
    const statsContainer = document.getElementById('profileStats');
    try {
        // Fix: Use /collection/list instead of /collection/me to get the correct items array
        const res = await fetch(`${API_BASE_URL}/collection/list?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();
        const items = data.items || [];
        const totalItems = items.reduce((sum, i) => sum + (parseInt(i.quantity) || 1), 0);
        const totalValue = items.reduce((sum, i) => sum + ((parseFloat(i.estimatedValue) || 0) * (parseInt(i.quantity) || 1)), 0);
        const mediaTypes = new Set(items.map(i => i.mediaType).filter(Boolean));

        statsContainer.innerHTML = `
            <div style="text-align: center; padding: 12px; background: var(--bg); border-radius: 12px;">
                <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent);">${totalItems}</div>
                <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: var(--muted);">Items</div>
            </div>
            <div style="text-align: center; padding: 12px; background: var(--bg); border-radius: 12px;">
                <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent);">$${totalValue.toFixed(0)}</div>
                <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: var(--muted);">Value</div>
            </div>
            <div style="text-align: center; padding: 12px; background: var(--bg); border-radius: 12px;">
                <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent);">${mediaTypes.size}</div>
                <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: var(--muted);">Types</div>
            </div>
            <div style="text-align: center; padding: 12px; background: var(--bg); border-radius: 12px;">
                <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent);">${items.filter(i => (i.condition||'').includes('Mint')).length}</div>
                <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: var(--muted);">Mint</div>
            </div>
        `;
    } catch (e) {
        statsContainer.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;">Collection stats unavailable</p>';
    }
}

async function loadRecentItems(userId) {
    const container = document.getElementById('profileRecent');
    try {
        // Fix: Use /collection/list instead of /collection/me
        const res = await fetch(`${API_BASE_URL}/collection/list?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();
        const items = (data.items || []).slice(0, 6);

        if (items.length === 0) {
            container.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;">No items yet</p>';
            return;
        }

        container.innerHTML = items.map(item => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:8px;background:var(--bg);margin-bottom:6px;">
                <span style="font-size:1.5rem;">${getMediaIcon(item.mediaType)}</span>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.title)}</div>
                    <div style="font-size:0.75rem;color:var(--muted);">${escapeHtml(item.artistAuthor || '')}</div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;">Error loading items</p>';
    }
}

// ===== Edit Modal =====
function openEditModal() {
    if (!currentProfile) return;
    document.getElementById('editDisplayName').value = currentProfile.displayName || '';
    document.getElementById('editBio').value = currentProfile.bio || '';
    document.getElementById('editAvatarUrl').value = currentProfile.avatarUrl || '';
    document.getElementById('editGenres').value = currentProfile.favoriteGenres || '';
    document.getElementById('editModal').classList.remove('hidden');
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').classList.add('hidden');
    document.getElementById('editModal').style.display = 'none';
}

async function saveProfile(e) {
    e.preventDefault();
    const userId = localStorage.getItem('userId');
    const payload = {
        userId: userId,
        displayName: document.getElementById('editDisplayName').value.trim(),
        bio: document.getElementById('editBio').value.trim(),
        avatarUrl: document.getElementById('editAvatarUrl').value.trim(),
        favoriteGenres: document.getElementById('editGenres').value.trim()
    };

    try {
        const res = await fetch(`${API_BASE_URL}/user/profile/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            const data = await res.json();
            currentProfile = data.profile || currentProfile;
            renderProfile(currentProfile, true);
            closeEditModal();
        } else {
            alert('Failed to save profile');
        }
    } catch (e) {
        alert('Error saving profile');
    }
}

// ===== Helpers =====
function getMediaIcon(mediaType) {
    const icons = { 'Book': '📖', 'Vinyl': '🎵', 'CD': '💿', 'DVD': '🎬', 'Blu-ray': '📀', 'Cassette': '📼', 'Video Game': '🎮', 'Collectible': '✨' };
    return icons[mediaType] || '📦';
}

function escapeHtml(t) {
    if (!t) return '';
    return t.toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
