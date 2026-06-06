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
    loadFriendsCollections();
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
            showFormMessage('✓ Friend request sent!', 'success');
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

// Load friends list
async function loadFriends() {
    const userId = localStorage.getItem('userId');
    const friendsList = document.getElementById('friendsList');

    try {
        const response = await fetch(`${API_BASE_URL}/friends/list?userId=${encodeURIComponent(userId)}`);
        const data = await response.json();

        if (data.friends && data.friends.length > 0) {
            friendsList.innerHTML = data.friends.map(friend => `
                <div class="action-card" style="min-height: auto; padding: 20px; flex-direction: row; justify-content: flex-start; text-align: left;">
                    <div style="font-size: 2rem; margin-right: 16px;">👤</div>
                    <div>
                        <div class="action-title" style="font-size: 1.1rem;">${escapeHtml(friend.username || friend.friendId)}</div>
                        <div class="action-desc">${friend.accepted ? 'Following' : 'Pending'}</div>
                    </div>
                </div>
            `).join('');
        } else {
            friendsList.innerHTML = '<p style="color: var(--muted); text-align: center; padding: 20px;">You haven\'t added any friends yet.</p>';
        }
    } catch (error) {
        console.error('Error loading friends:', error);
        friendsList.innerHTML = '<p class="error-message">Error loading friends.</p>';
    }
}

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
                        <p class="item-artist">${escapeHtml(item.artist || '')}</p>
                        <div style="margin-top: 10px; font-size: 0.8rem; color: var(--muted);">
                            Owner: <strong>${escapeHtml(item.friendUsername || item.friendId)}</strong>
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
