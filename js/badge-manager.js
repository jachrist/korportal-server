/**
 * Badge Manager - Korportal
 *
 * Sporer nye/endrede elementer og viser badge-tall i navigasjonsmenyen
 * og på PWA-ikonet via navigator.setAppBadge.
 *
 * @module BadgeManager
 * @version 1.0.0
 */

const STORAGE_PREFIX = 'korportal_badge_';
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutter

const SECTIONS = {
    meldinger:  { url: '/meldinger.html', timestampField: 'publishedAt' },
    innlegg:    { url: '/innlegg.html',   timestampField: 'createdAt' },
    konserter:  { url: '/konserter.html', timestampField: 'date' },
    medlemmer:  { url: '/medlemmer.html', timestampField: 'date' }
};

class BadgeManager {
    constructor() {
        this._counts = {};
        this._listeners = [];

        // Initialiser counts fra localStorage
        for (const section of Object.keys(SECTIONS)) {
            const stored = localStorage.getItem(`${STORAGE_PREFIX}count_${section}`);
            this._counts[section] = stored ? parseInt(stored, 10) || 0 : 0;
        }
    }

    /**
     * Tell nye elementer for en seksjon basert på lastSeen-tidsstempel.
     * Oppdaterer IKKE lastSeen (det gjør markSeen).
     */
    checkAndUpdate(section, items, timestampField) {
        if (!SECTIONS[section] || !Array.isArray(items)) return;

        const lastSeenKey = `${STORAGE_PREFIX}lastSeen_${section}`;
        const lastSeen = localStorage.getItem(lastSeenKey);
        const lastSeenDate = lastSeen ? new Date(lastSeen) : null;

        let count = 0;
        if (lastSeenDate) {
            count = items.filter(item => {
                const ts = item[timestampField || SECTIONS[section].timestampField];
                return ts && new Date(ts) > lastSeenDate;
            }).length;
        }
        // Hvis ingen lastSeen finnes, vis 0 (bruker har aldri besøkt)

        this._counts[section] = count;
        localStorage.setItem(`${STORAGE_PREFIX}count_${section}`, String(count));

        this._notify();
        this._updateAppBadge();
    }

    /**
     * Marker en seksjon som sett - nullstiller badge-tall.
     */
    markSeen(section) {
        if (!SECTIONS[section]) return;

        localStorage.setItem(`${STORAGE_PREFIX}lastSeen_${section}`, new Date().toISOString());
        this._counts[section] = 0;
        localStorage.setItem(`${STORAGE_PREFIX}count_${section}`, '0');

        this._notify();
        this._updateAppBadge();
    }

    /**
     * Sjekk om det er tid for en ny badge-sjekk (throttle).
     */
    shouldCheck() {
        const lastCheck = localStorage.getItem(`${STORAGE_PREFIX}lastCheck`);
        if (!lastCheck) return true;
        return (Date.now() - parseInt(lastCheck, 10)) > CHECK_INTERVAL_MS;
    }

    /**
     * Marker at en sjekk ble utført nå.
     */
    markChecked() {
        localStorage.setItem(`${STORAGE_PREFIX}lastCheck`, String(Date.now()));
    }

    /**
     * Returnerer badge-tall per URL for menyrendering.
     * @returns {Object} f.eks. { '/meldinger.html': 3, '/innlegg.html': 0 }
     */
    getCountsByUrl() {
        const result = {};
        for (const [section, config] of Object.entries(SECTIONS)) {
            result[config.url] = this._counts[section] || 0;
        }
        return result;
    }

    /**
     * Total sum av alle badge-tall.
     */
    getTotalCount() {
        return Object.values(this._counts).reduce((sum, c) => sum + c, 0);
    }

    /**
     * Registrer en callback som kalles ved endringer.
     */
    onChange(callback) {
        if (typeof callback === 'function') {
            this._listeners.push(callback);
        }
    }

    /**
     * Rydd opp all badge-data fra localStorage (for utlogging).
     */
    clear() {
        for (const section of Object.keys(SECTIONS)) {
            localStorage.removeItem(`${STORAGE_PREFIX}lastSeen_${section}`);
            localStorage.removeItem(`${STORAGE_PREFIX}count_${section}`);
            this._counts[section] = 0;
        }
        localStorage.removeItem(`${STORAGE_PREFIX}lastCheck`);
        this._notify();
        this._updateAppBadge();
    }

    /** @private */
    _notify() {
        for (const cb of this._listeners) {
            try { cb(); } catch (e) { console.error('[BadgeManager] Listener error:', e); }
        }
    }

    /** @private */
    _updateAppBadge() {
        const total = this.getTotalCount();
        if ('setAppBadge' in navigator) {
            if (total > 0) {
                navigator.setAppBadge(total).catch(() => {});
            } else {
                navigator.clearAppBadge().catch(() => {});
            }
        }
    }
}

// Singleton
const badgeManager = new BadgeManager();
export default badgeManager;
