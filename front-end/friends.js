const API_BASE_URL = 'http://localhost:8080/api';

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
    document.getElementById('addFriendForm').addEventListener('submit', handleAddFriend);

    // Load initial data
    loadFriends();
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

// Show form message
function showFormMessage(message, type = 'success') {
    const messageEl = document.getElementById('formMessage');
    messageEl.textContent = message;
    messageEl.className = `error-message ${type === 'success' ? 'success' : 'active'}`;
    if (type === 'success') {
        messageEl.style.backgroundColor = '#10b981';
    } else {
        messageEl.style.backgroundColor = '#ff4444';
    }
    messageEl.classList.remove('hidden');
    
    setTimeout(() => {
        messageEl.classList.add('hidden');
    }, 5000);
}

// Handle adding friend by username
async function handleAddFriend(e) {
    e.preventDefault();
    const friendUsername = document.getElementById('friendUsername').value.trim();
    const userId = localStorage.getItem('userId');

    if (!friendUsername) return;

    try {
        const response = await fetch(`${API_BASE_URL}/friends/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                friendUsername: friendUsername
            })
        });

        const data = await response.json();

        if (response.ok) {
            showFormMessage('✓ Friend added!', 'success');
            document.getElementById('addFriendForm').reset();
            loadFriends(); // Refresh list
        } else {
            showFormMessage(data.message || 'User not found', 'error');
        }
    } catch (error) {
        showFormMessage('Error connecting to server', 'error');
        console.error('Add friend error:', error);
    }
}

// Load friends list with profile data
async function loadFriends() {
    const userId = localStorage.getItem('userId');
    const friendsList = document.getElementById('friendsList');

    try {
        const response = await fetch(`${API_BASE_URL}/friends/list?userId=${encodeURIComponent(userId)}`);
        const data = await response.json();

        if (data.friends && data.friends.length > 0) {
            // Load profile info for each friend
            const friendCards = await Promise.all(data.friends.map(async (friend) => {
                const friendUsername = friend.username || friend.friendId;
                let profile = null;
                try {
                    const profileRes = await fetch(`${API_BASE_URL}/user/profile/public?username=${encodeURIComponent(friendUsername)}`);
                    if (profileRes.ok) profile = await profileRes.json();
                } catch (e) { /* profile unavailable */ }

                const displayName = profile?.displayName || friendUsername;
                const bio = profile?.bio || '';
                const avatarUrl = profile?.avatarUrl;
                const genres = (profile?.favoriteGenres || '').split(',').filter(g => g.trim()).slice(0, 3);

                const avatarHtml = avatarUrl
                    ? `<img src="${escapeHtml(avatarUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.outerHTML='<span style=\\'font-size:1.5rem\\'>👤</span>'">`
                    : '<span style="font-size:1.5rem;">👤</span>';

                return `
                    <div class="action-card" style="min-height: auto; padding: 20px; cursor: pointer; flex-direction: row; justify-content: flex-start; text-align: left;"
                         onclick="window.location.href='profile.html?user=${encodeURIComponent(friendUsername)}'">
                        <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), #b388ff); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 16px; overflow: hidden;">
                            ${avatarHtml}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 800; font-size: 1rem;">${escapeHtml(displayName)}</div>
                            <div style="font-size: 0.8rem; color: var(--muted);">@${escapeHtml(friendUsername)}</div>
                            ${bio ? `<div style="font-size: 0.75rem; color: var(--muted); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(bio)}</div>` : ''}
                            ${genres.length > 0 ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px;">${genres.map(g => `<span style="font-size:0.6rem;padding:2px 8px;border-radius:500px;background:rgba(124,77,255,0.1);color:var(--accent);font-weight:600;">${escapeHtml(g.trim())}</span>`).join('')}</div>` : ''}
                        </div>
                        <div style="color: var(--accent); font-size: 0.8rem; font-weight: 700; flex-shrink: 0;">View ›</div>
                    </div>
                `;
            }));
            friendsList.innerHTML = friendCards.join('');
        } else {
            friendsList.innerHTML = '<p style="color: var(--muted); text-align: center; padding: 20px;">You haven\'t added any friends yet.</p>';
        }
    } catch (error) {
        console.error('Error loading friends:', error);
        friendsList.innerHTML = '<p class="error-message">Error loading friends.</p>';
    }
}

<<<<<<< HEAD
// Load friends' collections
async function loadFriendsCollections() {
    const userId = localStorage.getItem('userId');
    const container = document.getElementById('friendsCollectionContainer');

    try {
        const response = await fetch(`${API_BASE_URL}/friends/collections?userId=${encodeURIComponent(userId)}`);
        const data = await response.json();

        if (data.items && data.items.length > 0) {
            container.innerHTML = data.items.map(item => `
                <div class="collection-item-card">
                    <div class="item-media-icon">
                        ${item.coverUrl ? `<img src="${item.coverUrl}" alt="${item.title}">` : getMediaIcon(item.mediaType)}
                    </div>
                    <div class="item-content">
                        <h3>${escapeHtml(item.title)}</h3>
                        <p class="item-artist">${escapeHtml(item.artistAuthor || '')}</p>
                        <div style="margin-top: 10px; font-size: 0.8rem; color: var(--muted);">
                            Owner: <a href="profile.html?user=${encodeURIComponent(item.friendUsername || item.friendId)}" 
                                      style="color: var(--accent); text-decoration: none; font-weight: 700;"
                                      onclick="event.stopPropagation()">
                                ${escapeHtml(item.friendUsername || item.friendId)}
                            </a>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p style="color: var(--muted); text-align: center; padding: 20px;">No updates from friends yet.</p>';
        }
    } catch (error) {
        console.error('Error loading friends collections:', error);
        container.innerHTML = '<p class="error-message">Error loading friend updates.</p>';
    }
}

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

// View a specific friend's collection
function viewFriendCollection(friendId, friendUsername) {
    window.location.href = `friend-collection.html?friendId=${encodeURIComponent(friendId)}&username=${encodeURIComponent(friendUsername)}`;
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
