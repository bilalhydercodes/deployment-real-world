// Simple in-memory cache — no Redis needed at this scale
// Automatically expires entries after TTL (seconds)
// Safe for single-instance Render deployments

const store = new Map();

const cache = {
    /**
     * Get a cached value. Returns null if missing or expired.
     */
    get(key) {
        const entry = store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            store.delete(key);
            return null;
        }
        return entry.value;
    },

    /**
     * Set a value with TTL in seconds (default 60s)
     */
    set(key, value, ttlSeconds = 60) {
        store.set(key, {
            value,
            expiresAt: Date.now() + ttlSeconds * 1000,
        });
    },

    /**
     * Invalidate a specific key or all keys matching a prefix
     */
    del(keyOrPrefix) {
        for (const key of store.keys()) {
            if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
                store.delete(key);
            }
        }
    },

    /** Clear everything (use on logout or major data change) */
    clear() {
        store.clear();
    },

    /** How many entries are cached right now */
    size() {
        return store.size;
    },
};

module.exports = cache;
