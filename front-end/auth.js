const API_BASE_URL = 'http://localhost:8080/api';

// Toggle between login and register forms
function toggleForms(event) {
    event.preventDefault();
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    loginForm.classList.toggle('hidden');
    registerForm.classList.toggle('hidden');
    
    // Clear error messages
    document.getElementById('loginError').classList.add('hidden');
    document.getElementById('registerError').classList.add('hidden');
}

// Show error message
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
}

// Hide error message
function hideError(elementId) {
    document.getElementById(elementId).classList.add('hidden');
}

// Login handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError('loginError');

    const usernameOrEmail = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!usernameOrEmail || !password) {
        showError('loginError', 'Please fill in all fields');
        return;
    }

    try {
        const payload = {
            password: password
        };

        // Determine if it's email or username
        if (usernameOrEmail.includes('@')) {
            payload.email = usernameOrEmail;
        } else {
            payload.username = usernameOrEmail;
        }

        const response = await fetch(`${API_BASE_URL}/user/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            showError('loginError', data.message || 'Login failed');
            return;
        }

        // Store user data and token
        const user = data.user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('userId', user.id);
        localStorage.setItem('username', user.username);

        // Redirect to dashboard
        window.location.href = 'dashboard.html';
    } catch (error) {
        showError('loginError', `Error: ${error.message}`);
    }
});

// Register handler
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError('registerError');

    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regPasswordConfirm').value;

    // Validation
    if (!username || !email || !password || !confirmPassword) {
        showError('registerError', 'Please fill in all fields');
        return;
    }

    if (password !== confirmPassword) {
        showError('registerError', 'Passwords do not match');
        return;
    }

    if (password.length < 6) {
        showError('registerError', 'Password must be at least 6 characters');
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('registerError', 'Please enter a valid email');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/user/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showError('registerError', data.message || 'Registration failed');
            return;
        }

        // Store user data
        const user = data.user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('userId', user.id);
        localStorage.setItem('username', user.username);

        // Redirect to dashboard
        window.location.href = 'dashboard.html';
    } catch (error) {
        showError('registerError', `Error: ${error.message}`);
    }
});

// Check if user is already logged in
window.addEventListener('load', () => {
    const userId = localStorage.getItem('userId');
    if (userId) {
        // User is already logged in, redirect to dashboard
        window.location.href = 'dashboard.html';
    }
});
