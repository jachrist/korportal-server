/**
 * Member Utilities
 *
 * Hjelpefunksjoner for medlemshåndtering på tvers av sider
 *
 * @module MemberUtils
 * @version 1.0.0
 */

const STORAGE_KEY = 'korportal-member';

/**
 * Henter innlogget medlem fra localStorage
 * @returns {Object|null} Medlemsobjekt eller null hvis ikke innlogget
 */
export function getCurrentMember() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
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
 * Henter medlemmets stemmegruppe
 * @returns {string|null}
 */
export function getMemberVoice() {
    const member = getCurrentMember();
    return member?.voice || null;
}

/**
 * Logger ut brukeren
 */
export function logout() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Omdirigerer til login hvis ikke innlogget
 * @param {string} returnUrl - URL å returnere til etter login
 */
export function requireLogin(returnUrl = window.location.href) {
    if (!isLoggedIn()) {
        const loginUrl = `/login.html?redirect=${encodeURIComponent(returnUrl)}`;
        window.location.href = loginUrl;
        return false;
    }
    return true;
}

/**
 * Oppretter en meny-lenke basert på innloggingsstatus
 * @returns {Object} Menyelement for login/profil
 */
export function getLoginMenuItem() {
    const member = getCurrentMember();

    if (member) {
        return {
            title: member.name || 'Min profil',
            url: '/login.html',
            icon: '👤'
        };
    }

    return {
        title: 'Logg inn',
        url: '/login.html',
        icon: '🔑'
    };
}

export default {
    getCurrentMember,
    isLoggedIn,
    getMemberVoice,
    logout,
    requireLogin,
    getLoginMenuItem
};
