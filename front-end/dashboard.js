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
    document.getElementById('userGreeting').textContent = `Welcome, ${username}!`;

    // Setup event listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('testApiBtn').addEventListener('click', showApiTester);
    document.getElementById('viewCollectionsBtn').addEventListener('click', () => {
        window.location.href = 'collection.html';
    });
    document.getElementById('browseMarketplaceBtn').addEventListener('click', showComingSoon);
    document.getElementById('connectFriendsBtn').addEventListener('click', showComingSoon);

    // API Tester forms
    document.getElementById('helloForm').addEventListener('submit', testHelloEndpoint);
    document.getElementById('returnForm').addEventListener('submit', testReturnEndpoint);
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
    document.getElementById('mainContent').classList.add('hidden');
    document.getElementById('collectionsSection').classList.add('hidden');
    document.getElementById('apiTesterSection').classList.remove('hidden');
}

// Close API Tester
function closeApiTester() {
    document.getElementById('apiTesterSection').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
}

// Test hello endpoint
async function testHelloEndpoint(e) {
    e.preventDefault();
    const name = document.getElementById('helloName').value.trim();
    
    try {
        const response = await fetch(`${API_BASE_URL}/hello?name=${encodeURIComponent(name)}`);
        const data = await response.text();
        
        const resultDiv = document.getElementById('helloResult');
        resultDiv.innerHTML = `<strong>Response:</strong> <code>${escapeHtml(data)}</code>`;
        resultDiv.classList.remove('hidden');
    } catch (error) {
        const resultDiv = document.getElementById('helloResult');
        resultDiv.innerHTML = `<strong>Error:</strong> ${error.message}`;
        resultDiv.classList.remove('hidden');
    }
}

// Test return endpoint
async function testReturnEndpoint(e) {
    e.preventDefault();
    const params = document.getElementById('returnParams').value.trim();
    
    if (!params) {
        alert('Please enter parameters');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/return?${params}`);
        const data = await response.text();
        
        const resultDiv = document.getElementById('returnResult');
        resultDiv.innerHTML = `<strong>Response:</strong> <code>${escapeHtml(data)}</code>`;
        resultDiv.classList.remove('hidden');
    } catch (error) {
        const resultDiv = document.getElementById('returnResult');
        resultDiv.innerHTML = `<strong>Error:</strong> ${error.message}`;
        resultDiv.classList.remove('hidden');
    }
}

// Show coming soon
function showComingSoon() {
    alert('✨ This feature is coming soon! Stay tuned.');
}

// Helper function to escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
