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
                <div class="friend-card" onclick="viewFriendCollection('${friend.friendId}', '${escapeHtml(friend.username)}')" style="cursor: pointer; transition: transform 0.2s;">
                    <div class="friend-avatar" aria-hidden="true">👤</div>
                    <div class="friend-summary">
                        <div class="friend-name">${escapeHtml(friend.username || friend.friendId)}</div>
                        <div class="friend-status">${friend.accepted ? 'Following' : 'Pending'}</div>
                    </div>
                    <div style="margin-left: auto; color: var(--accent); font-weight: bold;">View Collection →</div>
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
