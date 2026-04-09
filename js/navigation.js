/**
 * Navigation Module - Korportal
 *
 * Felles modul for navigasjon, tema og rollebasert tilgangskontroll.
 * Henter navigasjon fra SharePoint via Power Automate, med fallback
 * til hardkodede menyelementer.
 *
 * @module Navigation
 * @version 2.0.0
 */

import sharePointAPI from './sharepoint-api.js';
import badgeManager from './badge-manager.js';

// ==========================================================================
// ROLLER
// ==========================================================================

/**
 * Tilgjengelige roller i systemet
 * Høyere nivå inkluderer lavere nivåer (admin > styre > medlem > anonym)
 */
export const ROLES = {
    ANONYM: 'anonym',
    MEDLEM: 'medlem',
    STYRE: 'styre',
    ADMIN: 'admin'
};

/**
 * Rollehierarki - hvilke roller som inkluderer andre
 */
const ROLE_HIERARCHY = {
    'admin': ['admin', 'styre', 'medlem', 'anonym'],
    'styre': ['styre', 'medlem', 'anonym'],
    'medlem': ['medlem', 'anonym'],
    'anonym': ['anonym']
};

/**
 * Sjekker om bruker har tilgang til en gitt rolle
 * @param {string} userRole - Brukerens rolle
 * @param {string} requiredRole - Påkrevd rolle for tilgang
 * @returns {boolean}
 */
export function hasRole(userRole, requiredRole) {
    if (!userRole || !requiredRole) return false;
    const allowedRoles = ROLE_HIERARCHY[userRole] || [];
    return allowedRoles.includes(requiredRole);
}

/**
 * Sjekker om bruker har tilgang til minst én av rollene
 * @param {string} userRole - Brukerens rolle
 * @param {string[]} requiredRoles - Liste med roller som gir tilgang
 * @returns {boolean}
 */
export function hasAnyRole(userRole, requiredRoles) {
    if (!requiredRoles || requiredRoles.length === 0) return true;
    return requiredRoles.some(role => hasRole(userRole, role));
}

// ==========================================================================
// NAVIGASJON
// ==========================================================================

/**
 * Fallback-navigasjon brukes når SharePoint-endepunktet ikke er konfigurert.
 * minRole angir laveste rolle som har tilgang (rollehierarki: admin > styre > medlem > anonym).
 */
const FALLBACK_NAV_ITEMS = [
    { title: 'Hjem', url: '/', icon: '🏠', minRole: 'anonym' },
    { title: 'Konserter', url: '/konserter.html', icon: '🎭', minRole: 'anonym' },
    { title: 'Musikk fra oss', url: '/musikk.html', icon: '🎧', minRole: 'anonym' },
    { title: 'Medlemmer', url: '/medlemmer.html', icon: '👥', minRole: 'medlem' },
    { title: 'Meldinger', url: '/meldinger.html', icon: '📢', minRole: 'medlem' },
    { title: 'Innlegg', url: '/innlegg.html', icon: '💬', minRole: 'medlem' },
    { title: 'Øvelse', url: '/ovelse.html', icon: '🎼', minRole: 'medlem' },
    { title: 'Nedlasting', url: '/nedlasting.html', icon: '📥', minRole: 'medlem' },
    { title: 'Notebibliotek', url: '/noter.html', icon: '🎵', minRole: 'medlem' },
    { title: 'Billetter', url: '/billetter.html', icon: '🎫', minRole: 'styre' },
    { title: 'Billettkontroll', url: '/billettkontroll.html', icon: '📱', minRole: 'styre' },
    { title: 'Styresider', url: '/styre.html', icon: '📋', minRole: 'styre' },
    { title: 'Administrasjon', url: '/admin.html', icon: '⚙️', minRole: 'admin' },
    { title: 'Dokumentasjon', url: '/docs/', icon: '📖', minRole: 'admin' },
    { title: 'Logg inn', url: '/login.html', icon: '🔑', minRole: 'anonym', hideWhenLoggedIn: true },
    { title: 'Logg ut', url: '#logout', icon: '🚪', minRole: 'medlem', isLogout: true }
];

/**
 * Cache for navigasjonselementer hentet fra SharePoint
 * @type {Array|null}
 */
let cachedNavItems = null;

/**
 * Henter navigasjonselementer fra SharePoint (eller fallback)
 * @returns {Promise<Array>} Navigasjonselementer
 */
async function loadNavItems() {
    if (cachedNavItems) return cachedNavItems;

    try {
        const items = await sharePointAPI.getNavigation();
        if (items && items.length > 0) {
            cachedNavItems = items;
            return cachedNavItems;
        }
    } catch (error) {
        console.warn('[Navigation] Kunne ikke hente navigasjon fra SharePoint, bruker fallback:', error.message);
    }

    cachedNavItems = FALLBACK_NAV_ITEMS;
    return cachedNavItems;
}

/**
 * Filtrerer navigasjonselementer basert på brukerens rolle
 * @param {string} userRole - Brukerens rolle
 * @param {Array} items - Navigasjonselementer å filtrere
 * @returns {Array} Filtrerte navigasjonselementer
 */
export function filterNavItemsByRole(userRole, items) {
    const loggedIn = isLoggedIn();

    return items.filter(item => {
        // Skjul element når bruker er innlogget (f.eks. "Logg inn")
        if (item.hideWhenLoggedIn && loggedIn) return false;

        // minRole: 'anonym' eller ikke satt = alle har tilgang
        const minRole = item.minRole || 'anonym';
        if (minRole === 'anonym') return true;

        // Sjekk om brukerens rolle oppfyller minimumskravet
        return hasRole(userRole, minRole);
    });
}

/**
 * @deprecated Bruk filterNavItemsByRole() i stedet
 */
export function getNavItemsForRole(userRole) {
    const items = cachedNavItems || FALLBACK_NAV_ITEMS;
    return filterNavItemsByRole(userRole, items);
}

// ==========================================================================
// STORAGE KEYS
// ==========================================================================

export const STORAGE_KEYS = {
    member: 'korportal-member',
    theme: 'korportal-theme'
};

// ==========================================================================
// MEMBER UTILS
// ==========================================================================

/**
 * Henter innlogget medlem fra localStorage
 * @returns {Object|null} Medlemsdata eller null
 */
export function getCurrentMember() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.member);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
}

/**
 * Sjekker om bruker er innlogget
 * @returns {boolean}
 */
export function isLoggedIn() {
    return getCurrentMember() !== null;
}

/**
 * Henter brukerens rolle
 * @returns {string} Brukerens rolle eller 'anonym' hvis ikke innlogget
 */
export function getCurrentUserRole() {
    const member = getCurrentMember();
    return member?.role || ROLES.ANONYM;
}

/**
 * Sjekker innlogging og omdirigerer til login hvis ikke innlogget
 * @param {string} redirectPath - Sti å omdirigere til etter innlogging
 * @returns {boolean} true hvis innlogget, false hvis omdirigert
 */
export function requireLogin(redirectPath) {
    if (!isLoggedIn()) {
        window.location.href = '/login.html?redirect=' + encodeURIComponent(redirectPath || window.location.pathname);
        return false;
    }
    return true;
}

/**
 * Sjekker om bruker har påkrevd rolle, omdirigerer hvis ikke
 * @param {string} requiredRole - Påkrevd rolle
 * @param {string} redirectPath - Sti å omdirigere til hvis ikke tilgang
 * @returns {boolean} true hvis tilgang, false hvis omdirigert
 */
export function requireRole(requiredRole, redirectPath = '/') {
    const userRole = getCurrentUserRole();
    if (!hasRole(userRole, requiredRole)) {
        window.location.href = redirectPath;
        return false;
    }
    return true;
}

// ==========================================================================
// THEME MANAGER
// ==========================================================================

export class ThemeManager {
    constructor() {
        this.storageKey = STORAGE_KEYS.theme;
        this.themeBtn = document.getElementById('themeBtn');
    }

    init() {
        const saved = localStorage.getItem(this.storageKey);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || (prefersDark ? 'dark' : 'light');
        this.setTheme(theme);
        this.themeBtn?.addEventListener('click', () => this.toggle());
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(this.storageKey, theme);
        if (this.themeBtn) {
            this.themeBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
        }
    }

    toggle() {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        this.setTheme(current === 'dark' ? 'light' : 'dark');
    }
}

// ==========================================================================
// MENU MANAGER
// ==========================================================================

export class MenuManager {
    constructor() {
        this.overlay = document.getElementById('menuOverlay');
        this.menuBtn = document.getElementById('menuBtn');
        this.closeBtn = document.getElementById('menuClose');
        this.menuList = document.getElementById('menuList');
        this.isOpen = false;
    }

    init() {
        this.menuBtn?.addEventListener('click', () => this.open());
        this.closeBtn?.addEventListener('click', () => this.close());
        this.overlay?.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        });
        // Bygg meny med fallback-data umiddelbart, oppdater fra SharePoint asynkront
        this.buildMenu(FALLBACK_NAV_ITEMS);
        this.loadAndBuildMenu();

        // Oppdater badges når badgeManager endres
        badgeManager.onChange(() => this._updateBadges());
        this._updateBadges();
    }

    /**
     * Henter navigasjon fra SharePoint og bygger menyen på nytt
     */
    async loadAndBuildMenu() {
        try {
            const items = await loadNavItems();
            this.buildMenu(items);
        } catch (error) {
            console.warn('[MenuManager] Feil ved lasting av navigasjon:', error.message);
        }
    }

    open() {
        this.isOpen = true;
        this.overlay?.classList.add('open');
        this.overlay?.setAttribute('aria-hidden', 'false');
        this.menuBtn?.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
    }

    close() {
        this.isOpen = false;
        this.overlay?.classList.remove('open');
        this.overlay?.setAttribute('aria-hidden', 'true');
        this.menuBtn?.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    buildMenu(navItems = null) {
        if (!this.menuList) return;

        const userRole = getCurrentUserRole();
        const allItems = navItems || cachedNavItems || FALLBACK_NAV_ITEMS;
        const items = filterNavItemsByRole(userRole, allItems);
        const currentPath = window.location.pathname;

        this.menuList.innerHTML = items.map(item => {
            const isActive = currentPath === item.url ||
                (item.url !== '/' && currentPath.startsWith(item.url.replace('.html', '')));
            const activeClass = isActive ? ' uts-menuItem--active' : '';
            const target = item.openInNewTab ? ' target="_blank" rel="noopener noreferrer"' : '';
            const logoutAttr = item.isLogout ? ' data-logout="true"' : '';

            return `
                <a href="${escapeHtml(item.url)}" class="uts-menuItem${activeClass}"${target}${logoutAttr}>
                    <span class="uts-menuItem__icon">${item.icon || '📄'}</span>
                    <span>${escapeHtml(item.title)}</span>
                    <span class="uts-menuItem__badge" data-badge-url="${escapeHtml(item.url)}" hidden></span>
                </a>
            `;
        }).join('');

        // Håndter klikk på menyelementer
        this.menuList.querySelectorAll('.uts-menuItem').forEach(el => {
            el.addEventListener('click', (e) => {
                // Håndter utlogging
                if (el.dataset.logout === 'true') {
                    e.preventDefault();
                    this.handleLogout();
                }
                this.close();
            });
        });
    }

    /**
     * Oppdaterer badge-elementer i menyen uten full rebuild + hamburger-prikk
     */
    _updateBadges() {
        const counts = badgeManager.getCountsByUrl();

        // Oppdater badge-spans i menyen
        document.querySelectorAll('.uts-menuItem__badge[data-badge-url]').forEach(el => {
            const url = el.dataset.badgeUrl;
            const count = counts[url] || 0;
            if (count > 0) {
                el.textContent = String(count);
                el.hidden = false;
            } else {
                el.hidden = true;
            }
        });

        // Hamburger-prikk
        const total = badgeManager.getTotalCount();
        if (this.menuBtn) {
            this.menuBtn.classList.toggle('uts-btnIcon--has-badge', total > 0);
        }
    }

    /**
     * Håndterer utlogging
     */
    handleLogout() {
        badgeManager.clear();
        localStorage.removeItem(STORAGE_KEYS.member);
        window.location.href = '/';
    }

    /**
     * Bygger meny med standard navigasjonselementer
     */
    buildDefaultMenu() {
        this.loadAndBuildMenu();
    }
}

/**
 * Escaper HTML for sikker visning
 * @param {string} str - Tekst som skal escapes
 * @returns {string} Escaped tekst
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ==========================================================================
// INITIALISERING
// ==========================================================================

/**
 * Initialiserer tema og meny for en side
 * @returns {{ themeManager: ThemeManager, menuManager: MenuManager }}
 */
export function initNavigation() {
    const themeManager = new ThemeManager();
    const menuManager = new MenuManager();

    themeManager.init();
    menuManager.init();

    return { themeManager, menuManager };
}

/**
 * Initialiserer side med innloggingskrav
 * @param {Object} options - Alternativer
 * @param {boolean} options.requireAuth - Krev innlogging (standard: true)
 * @param {string} options.requiredRole - Krev spesifikk rolle
 * @returns {{ themeManager: ThemeManager, menuManager: MenuManager, member: Object }|null}
 */
export function initPage(options = {}) {
    const { requireAuth = true, requiredRole = null } = options;

    // Sjekk innlogging
    if (requireAuth && !requireLogin()) {
        return null;
    }

    // Sjekk rolle
    if (requiredRole && !requireRole(requiredRole)) {
        return null;
    }

    // Initialiser navigasjon
    const { themeManager, menuManager } = initNavigation();
    const member = getCurrentMember();

    return { themeManager, menuManager, member };
}
