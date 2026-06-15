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

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;

    const username = localStorage.getItem('username');
    const userGreeting = document.getElementById('userGreeting');
    if (userGreeting) {
        userGreeting.textContent = `Welcome, ${username}!`;
    }

    // Setup navigation listeners
    const navMap = {
        'logoutBtn': logout,
        'viewCollectionsBtn': 'collection.html',
        'viewWishlistBtn': 'wishlist.html',
        'exploreBtn': 'explore.html',
        'barcodeBtn': 'barcode.html',
        'addItemBtn': 'add-item.html',
        'connectFriendsBtn': 'friends.html',
        'browseMarketplaceBtn': 'marketplace.html',
        'myProfileBtn': 'profile.html',
        'adminPanelBtn': 'admin.html'
    };

    Object.entries(navMap).forEach(([id, destination]) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                if (typeof destination === 'function') {
                    destination();
                } else {
                    window.location.href = destination;
                }
            });
        }
    });

    // Show admin button for authorized administrators
    const adminUsernames = ['xpexdex', 'aditya'];
    if (username && adminUsernames.includes(username.toLowerCase())) {
        const adminBtn = document.getElementById('adminPanelBtn');
        if (adminBtn) adminBtn.classList.remove('hidden');
    }
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

// Helper function to escape HTML
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
