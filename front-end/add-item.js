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
    document.getElementById('addItemForm').addEventListener('submit', handleAddItem);
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
    messageEl.className = `form-message ${type}`;
    messageEl.classList.remove('hidden');
    
    if (type === 'success') {
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
    }
}

// Handle add item form submission
async function handleAddItem(e) {
    e.preventDefault();

    const userId = localStorage.getItem('userId');
    const title = document.getElementById('itemTitle').value.trim();
    const mediaType = document.getElementById('itemMediaType').value;
    const condition = document.getElementById('itemCondition').value;
    const quantity = parseInt(document.getElementById('itemQuantity').value);

    if (!title || !mediaType || !condition || !quantity) {
        showFormMessage('Please fill in all required fields', 'error');
        return;
    }

    // Build item object with all details
    const itemData = {
        title: title,
        mediaType: mediaType,
        artistAuthor: document.getElementById('itemArtistAuthor').value.trim(),
        releaseDate: document.getElementById('itemReleaseDate').value,
        description: document.getElementById('itemDescription').value.trim(),
        condition: condition,
        format: document.getElementById('itemFormat').value.trim(),
        genre: document.getElementById('itemGenre').value.trim(),
        language: document.getElementById('itemLanguage').value.trim(),
        pressLocation: document.getElementById('itemPressLocation').value.trim(),
        pressDate: document.getElementById('itemPressDate').value,
        isbn: document.getElementById('itemISBN').value.trim(),
        quantity: quantity,
        purchasePrice: parseFloat(document.getElementById('itemPurchasePrice').value) || 0,
        estimatedValue: parseFloat(document.getElementById('itemEstimatedValue').value) || 0,
        purchaseDate: document.getElementById('itemPurchaseDate').value,
        location: document.getElementById('itemLocation').value.trim(),
        isSigned: document.getElementById('itemIsSigned').checked,
        isRare: document.getElementById('itemIsRare').checked,
        isFirstEdition: document.getElementById('itemIsFirstEdition').checked,
        dateAdded: new Date().toISOString()
    };

    try {
        const response = await fetch(`${API_BASE_URL}/collection/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                title: title,
                collection: itemData
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showFormMessage(data.message || 'Failed to add item', 'error');
            return;
        }

        showFormMessage('✓ Item added successfully! Redirecting...', 'success');
    } catch (error) {
        showFormMessage(`Error: ${error.message}`, 'error');
        console.error('Error adding item:', error);
    }
}
