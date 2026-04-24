// API base URL — points to Render backend in production, localhost in dev
// On Vercel: window.ENV_API_URL is injected via index.html meta tag (optional)
// Fallback chain: meta tag → hardcoded Render URL → localhost
const API_BASE_URL = (function () {
  // Allow override via a <meta name="api-url"> tag in HTML (for flexibility)
  const meta = document.querySelector('meta[name="api-url"]');
  if (meta && meta.content) return meta.content.replace(/\/$/, '');
  // Detect local dev
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  // Production: Render backend
  return 'https://deployment-real-world.onrender.com';
})();
