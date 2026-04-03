// auth.js - Shared auth utilities used across all pages

/**
 * Show a toast notification with icon and auto-dismiss progress bar
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    // Icon map
    const icons = {
        success: '✓',
        error: '✗',
        info: 'ℹ'
    };

    toast.className = type;
    toast.innerHTML = `<span style="font-size:1.1em;font-weight:700;opacity:0.9;">${icons[type] || ''}</span> ${message}`;
    toast.classList.remove('hidden');

    // Auto-hide after 4 seconds
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => toast.classList.add('hidden'), 4000);
}

/**
 * Logout: clear localStorage and redirect to login
 */
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

/**
 * Get the stored JWT token
 */
function getToken() {
    return localStorage.getItem('token');
}

/**
 * Get the stored user object
 */
function getUser() {
    try {
        return JSON.parse(localStorage.getItem('user'));
    } catch {
        return null;
    }
}

/**
 * Check if user is authenticated; redirect if not
 */
function requireAuth(role) {
    const user = getUser();
    if (!user || !getToken()) {
        window.location.href = 'login.html';
        return null;
    }
    if (role && user.role !== role) {
        if (user.role === 'admin') window.location.href = 'admin.html';
        else if (user.role === 'teacher') window.location.href = 'teacher.html';
        else window.location.href = 'student.html';
        return null;
    }
    return user;
}

/**
 * Common fetch wrapper with auth header
 */
async function apiFetch(url, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    if (res.status === 401) {
        showToast('Session expired. Please log in again.', 'error');
        setTimeout(() => logout(), 1500);
    }
    return data;
}

/**
 * Toggle sidebar on mobile
 */
function toggleSidebar() {
    const sidebar = document.querySelector('.dashboard-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (!sidebar) return;
    sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('show');
}

/**
 * Close sidebar on mobile (when clicking overlay or navigating)
 */
function closeSidebar() {
    const sidebar = document.querySelector('.dashboard-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
}

/**
 * Get greeting based on time of day
 */
function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

/**
 * Get formatted date string
 */
function getFormattedDate() {
    return new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

/**
 * Hide the page loader splash screen
 */
function hidePageLoader() {
    const loader = document.getElementById('pageLoader');
    if (loader) {
        setTimeout(() => {
            loader.classList.add('hide');
            setTimeout(() => loader.remove(), 400);
        }, 300);
    }
}

/**
 * Global fetch interceptor — redirects to offline page when server is unreachable
 * Only triggers for API calls, not CDN/external requests
 */
(function () {
    const _fetch = window.fetch;
    window.fetch = async function (...args) {
        try {
            const res = await _fetch(...args);
            return res;
        } catch (err) {
            const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
            // Only intercept same-origin API calls
            if (url.startsWith('/api/')) {
                sessionStorage.setItem('offlineFrom', window.location.href);
                sessionStorage.setItem('offlineError', err.message || 'Network error');
                window.location.href = '/client/pages/offline.html';
            }
            throw err;
        }
    };
})();
