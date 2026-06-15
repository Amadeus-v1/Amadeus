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
    const greeting = document.getElementById('userGreeting');
    if (greeting) greeting.textContent = `Welcome, ${username}!`;

    // Setup event listeners
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    
    const addFriendForm = document.getElementById('addFriendForm');
    if (addFriendForm) addFriendForm.addEventListener('submit', handleAddFriend);

    // Load initial data
    loadFriends();
});

// Logout handler
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

// Show form message
function showFormMessage(message, type = 'success') {
    const messageEl = document.getElementById('formMessage');
    if (!messageEl) return;
    
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
    if (!friendsList) return;

    try {
        const response = await fetch(`${API_BASE_URL}/friends/list?userId=${encodeURIComponent(userId)}`);
        if (!response.ok) throw new Error('Failed to fetch friends list');
        
        const data = await response.json();

        if (data.friends && data.friends.length > 0) {
            // Load profile info for each friend
            const friendCards = await Promise.all(data.friends.map(async (friend) => {
                const friendUsername = friend.username || friend.friendId;
                let profile = null;
                try {
                    const profileRes = await fetch(`${API_BASE_URL}/user/profile/public?username=${encodeURIComponent(friendUsername)}`);
                    if (profileRes.ok) profile = await profileRes.json();
                } catch (e) { 
                    console.warn(`Profile for ${friendUsername} unavailable`, e);
                }

                const displayName = profile?.displayName || friendUsername;
                const bio = profile?.bio || '';
                const avatarUrl = profile?.avatarUrl;
                const genres = (profile?.favoriteGenres || '').split(',').filter(g => g.trim()).slice(0, 3);

                const avatarHtml = avatarUrl
                    ? `<img src="${escapeHtml(avatarUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.outerHTML='<span style=\\'font-size:1.5rem\\'>👤</span>'">`
                    : '<span style="font-size:1.5rem;">👤</span>';

                const friendId = friend.friendId || friend.id;

                return `
                    <div class="action-card" style="min-height: auto; padding: 20px; flex-direction: row; justify-content: flex-start; text-align: left; cursor: default;">
                        <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), #b388ff); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 16px; overflow: hidden;">
                            ${avatarHtml}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 800; font-size: 1rem;">${escapeHtml(displayName)}</div>
                            <div style="font-size: 0.8rem; color: var(--muted);">@${escapeHtml(friendUsername)}</div>
                            ${bio ? `<div style="font-size: 0.75rem; color: var(--muted); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(bio)}</div>` : ''}
                            ${genres.length > 0 ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px;">${genres.map(g => `<span style="font-size:0.6rem;padding:2px 8px;border-radius:500px;background:rgba(124,77,255,0.1);color:var(--accent);font-weight:600;">${escapeHtml(g.trim())}</span>`).join('')}</div>` : ''}
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;">
                            <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.75rem;" onclick="viewFriendCollection('${friendId}', '${friendUsername}', 'collection')">Collection</button>
                            <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.75rem;" onclick="viewFriendCollection('${friendId}', '${friendUsername}', 'wishlist')">Wishlist</button>
                        </div>
                    </div>
                `;
            }));
            friendsList.innerHTML = friendCards.join('');
        } else {
            friendsList.innerHTML = '<p style="color: var(--muted); text-align: center; padding: 20px;">You haven\'t added any friends yet.</p>';
        }
    } catch (error) {
        console.error('Error loading friends:', error);
        friendsList.innerHTML = '<p class="error-message" style="color: #ff4444; text-align: center; padding: 20px;">Error loading friends. Please check your connection.</p>';
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

// View a specific friend's collection or wishlist
function viewFriendCollection(friendId, friendUsername, tab = 'collection') {
    window.location.href = `friend-collection.html?friendId=${encodeURIComponent(friendId)}&username=${encodeURIComponent(friendUsername)}&tab=${tab}`;
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
