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
        'exploreBtn': 'explore.html',
        'barcodeBtn': 'barcode.html',
        'addItemBtn': 'add-item.html',
        'connectFriendsBtn': 'friends.html',
        'browseMarketplaceBtn': 'marketplace.html',
        'myProfileBtn': 'profile.html',
        'testApiBtn': showApiTester,
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

    // Show admin button for Xpexdex only
    if (username && username.toLowerCase() === 'xpexdex') {
        const adminBtn = document.getElementById('adminPanelBtn');
        if (adminBtn) adminBtn.classList.remove('hidden');
    }

    // API Tester forms
    const helloForm = document.getElementById('helloForm');
    if (helloForm) {
        helloForm.addEventListener('submit', testHelloEndpoint);
    }

    const returnForm = document.getElementById('returnForm');
    if (returnForm) {
        returnForm.addEventListener('submit', testReturnEndpoint);
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

// Show API Tester
function showApiTester() {
    const mainContent = document.getElementById('mainContent');
    const apiTesterSection = document.getElementById('apiTesterSection');
    if (mainContent) mainContent.classList.add('hidden');
    if (apiTesterSection) apiTesterSection.classList.remove('hidden');
}

// Close API Tester
function closeApiTester() {
    const mainContent = document.getElementById('mainContent');
    const apiTesterSection = document.getElementById('apiTesterSection');
    if (apiTesterSection) apiTesterSection.classList.add('hidden');
    if (mainContent) mainContent.classList.remove('hidden');
}

// Test hello endpoint
async function testHelloEndpoint(e) {
    e.preventDefault();
    const name = document.getElementById('helloName').value.trim();
    const resultDiv = document.getElementById('helloResult');
    
    if (resultDiv) {
        resultDiv.innerHTML = 'Testing...';
        resultDiv.classList.remove('hidden');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/hello?name=${encodeURIComponent(name)}`);
        const data = await response.json();
        if (resultDiv) {
            resultDiv.innerHTML = `<strong>Response:</strong> <code>${escapeHtml(data.message)}</code>`;
        }
    } catch (error) {
        if (resultDiv) {
            resultDiv.innerHTML = `<strong>Error:</strong> ${error.message}`;
        }
    }
}

// Test return endpoint
async function testReturnEndpoint(e) {
    e.preventDefault();
    const params = document.getElementById('returnParams').value.trim();
    const resultDiv = document.getElementById('returnResult');
    
    if (!params) {
        alert('Please enter parameters');
        return;
    }
    
    if (resultDiv) {
        resultDiv.innerHTML = 'Testing...';
        resultDiv.classList.remove('hidden');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/return?${params}`);
        const data = await response.json();
        if (resultDiv) {
            resultDiv.innerHTML = `<strong>Response:</strong> <pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
        }
    } catch (error) {
        if (resultDiv) {
            resultDiv.innerHTML = `<strong>Error:</strong> ${error.message}`;
        }
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
