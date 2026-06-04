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
    loadCatalogCategories();
    loadUserCollections();
    document.getElementById('catalogItemForm').addEventListener('submit', createCatalogItem);
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
async function loadCatalogCategories() {
    try {
        const response = await fetch(`${API_BASE_URL}/catalog/categories`);
        const data = await response.json();
        const list = document.getElementById('categoryList');
        const categories = data.categories || [];
        list.innerHTML = categories.length
            ? categories.map(item => `<div class="history-item"><strong>${escapeHtml(item.name)}</strong><br><span>${escapeHtml(item.kind || 'media')}</span><br><small>${escapeHtml(item.description || '')}</small></div>`).join('')
            : '<p class="empty-message">No categories available yet.</p>';
    } catch (error) {
        document.getElementById('categoryList').innerHTML = '<p class="empty-message">Unable to load categories.</p>';
    }
}

async function loadUserCollections() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    try {
        const response = await fetch(`${API_BASE_URL}/collection/me?userId=${encodeURIComponent(userId)}`);
        const data = await response.json();
        const collections = data.collections || [];
        const target = document.getElementById('collectionsList');
        if (!target) return;
        target.innerHTML = collections.length
            ? collections.map(item => `<div class="history-item"><strong>${escapeHtml(item.itemId)}</strong><br>Visibility: ${escapeHtml(item.visibility || 'private')}</div>`).join('')
            : '<p class="empty-message">No personal collection entries yet.</p>';
    } catch (error) {
        const target = document.getElementById('collectionsList');
        if (target) target.innerHTML = '<p class="empty-message">Unable to load your collections.</p>';
    }
}

async function createCatalogItem(e) {
    e.preventDefault();
    const payload = {
        title: document.getElementById('catalogTitle').value.trim(),
        artist: document.getElementById('catalogArtist').value.trim(),
        categoryId: document.getElementById('catalogCategoryId').value.trim() || 'records',
        edition: document.getElementById('catalogEdition').value.trim(),
        submittedBy: localStorage.getItem('userId') || 'guest'
    };

    try {
        const response = await fetch(`${API_BASE_URL}/catalog/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        const resultDiv = document.getElementById('catalogItemResult');
        resultDiv.innerHTML = `<strong>Created:</strong> ${escapeHtml(JSON.stringify(data, null, 2))}`;
        resultDiv.classList.remove('hidden');
        if (response.ok) {
            document.getElementById('catalogItemForm').reset();
            loadUserCollections();
        }
    } catch (error) {
        const resultDiv = document.getElementById('catalogItemResult');
        resultDiv.innerHTML = `<strong>Error:</strong> ${escapeHtml(error.message)}`;
        resultDiv.classList.remove('hidden');
    }
}

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
