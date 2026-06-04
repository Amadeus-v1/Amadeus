const API_BASE_URL = 'http://localhost:8080/api';
let requestHistory = [];

// Load history from localStorage
function loadHistory() {
    const saved = localStorage.getItem('requestHistory');
    if (saved) {
        requestHistory = JSON.parse(saved);
        renderHistory();
    }
}

// Save history to localStorage
function saveHistory() {
    localStorage.setItem('requestHistory', JSON.stringify(requestHistory));
}

// Add request to history
function addToHistory(endpoint, request, response, status) {
    const timestamp = new Date().toLocaleTimeString();
    requestHistory.unshift({
        timestamp,
        endpoint,
        request,
        response,
        status
    });
    // Keep only last 20 requests
    if (requestHistory.length > 20) {
        requestHistory.pop();
    }
    saveHistory();
    renderHistory();
}

// Render request history
function renderHistory() {
    const historyContainer = document.getElementById('history');
    const clearBtn = document.getElementById('clearHistory');

    if (requestHistory.length === 0) {
        historyContainer.innerHTML = '<p class="empty-message">No requests made yet</p>';
        clearBtn.style.display = 'none';
        return;
    }

    clearBtn.style.display = 'block';
    historyContainer.innerHTML = requestHistory.map((item, index) => `
        <div class="history-item">
            <div class="history-time">${item.timestamp}</div>
            <div class="history-request">
                <strong>${item.endpoint}</strong> - Status: <span class="response-status ${item.status === 200 ? 'success' : 'error'}">${item.status}</span>
            </div>
            <div style="color: #666; font-size: 0.9rem; margin-top: 4px;">
                Request: ${item.request}<br>
                Response: ${item.response.substring(0, 100)}${item.response.length > 100 ? '...' : ''}
            </div>
        </div>
    `).join('');
}

// Display response in the UI
function displayResponse(elementId, status, response, isSuccess) {
    const responseBox = document.getElementById(elementId);
    responseBox.classList.remove('hidden');
    responseBox.classList.toggle('success', isSuccess);
    responseBox.classList.toggle('error', !isSuccess);

    const statusClass = isSuccess ? 'success' : 'error';
    responseBox.innerHTML = `
        <div class="response-header">
            <span>Response</span>
            <span class="response-status ${statusClass}">${status}</span>
        </div>
        <div class="response-content">${response}</div>
    `;
}

// Handle Hello endpoint
document.getElementById('helloForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('nameInput');
    const name = nameInput.value.trim();

    if (!name) {
        displayResponse('helloResponse', 400, 'Error: Name cannot be empty', false);
        return;
    }

    try {
        const url = `${API_BASE_URL}/hello?name=${encodeURIComponent(name)}`;
        const response = await fetch(url);
        const data = await response.text();

        addToHistory('/api/hello', `name=${name}`, data, response.status);
        displayResponse('helloResponse', response.status, data, response.ok);

        if (response.ok) {
            nameInput.value = '';
        }
    } catch (error) {
        const errorMsg = `Error: ${error.message}`;
        addToHistory('/api/hello', `name=${name}`, errorMsg, 0);
        displayResponse('helloResponse', 0, errorMsg, false);
    }
});

// Handle Return Parameters endpoint
document.getElementById('returnForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const parametersInput = document.getElementById('parametersInput');
    const params = parametersInput.value.trim();

    if (!params) {
        displayResponse('returnResponse', 400, 'Error: Please enter at least one parameter', false);
        return;
    }

    try {
        const url = `${API_BASE_URL}/return?${params}`;
        const response = await fetch(url);
        const data = await response.text();

        addToHistory('/api/return', params, data, response.status);
        displayResponse('returnResponse', response.status, data, response.ok);

        if (response.ok) {
            parametersInput.value = '';
        }
    } catch (error) {
        const errorMsg = `Error: ${error.message}`;
        addToHistory('/api/return', params, errorMsg, 0);
        displayResponse('returnResponse', 0, errorMsg, false);
    }
});

// Clear history
document.getElementById('clearHistory').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the request history?')) {
        requestHistory = [];
        saveHistory();
        renderHistory();
    }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    console.log(`Frontend connected. Backend API available at ${API_BASE_URL}`);
});

// Check if backend is available on page load
window.addEventListener('load', async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/hello?name=Test`, {
            method: 'GET',
        });
        console.log('✓ Backend is reachable');
    } catch (error) {
        console.warn('⚠ Backend is not reachable at ' + API_BASE_URL);
        console.warn('Make sure the Java server is running on port 8080');
    }
});
