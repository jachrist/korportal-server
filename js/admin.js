/**
 * Admin Page - Kammerkoret Utsikten
 * Administrasjonsside for konfigurasjon av korportalen
 *
 * @module Admin
 * @version 1.0.0
 */

import {
    ThemeManager,
    MenuManager,
    getCurrentUserRole,
    ROLES
} from './navigation.js';
import { getCurrentMember } from './member-utils.js';
import { initMusicXMLTools } from './musicxml-tools.js';
import { initWavMp3Tool } from './wav-mp3-tool.js';


// ==========================================================================
// CONSTANTS
// ==========================================================================
const APP_VERSION = '1.0.0';

// All Power Automate endpoints to check (env variable name -> display name)
const ENDPOINTS = [
    { name: 'Navigasjon', envKey: 'POWER_AUTOMATE_NAVIGATION_URL' },
    { name: 'Hurtiglenker', envKey: 'POWER_AUTOMATE_QUICKLINKS_URL' },
    { name: 'Kontaktpersoner', envKey: 'POWER_AUTOMATE_CONTACTS_URL' },
    { name: 'Konserter', envKey: 'POWER_AUTOMATE_CONCERTS_URL' },
    { name: 'Billettbestilling', envKey: 'POWER_AUTOMATE_TICKET_RESERVATIONS_URL' },
    { name: 'Musikk', envKey: 'POWER_AUTOMATE_MUSIC_URL' },
    { name: 'Meldinger', envKey: 'POWER_AUTOMATE_MESSAGES_URL' },
    { name: 'Ny melding', envKey: 'POWER_AUTOMATE_CREATE_MESSAGE_URL' },
    { name: 'Meldingskommentarer', envKey: 'POWER_AUTOMATE_MESSAGE_COMMENTS_URL' },
    { name: 'Innlegg', envKey: 'POWER_AUTOMATE_POSTS_URL' },
    { name: 'Nytt innlegg', envKey: 'POWER_AUTOMATE_CREATE_POST_URL' },
    { name: 'Innleggskommentarer', envKey: 'POWER_AUTOMATE_POST_COMMENTS_URL' },
    { name: 'Ovelsesdata', envKey: 'POWER_AUTOMATE_PRACTICE_URL' },
    { name: 'Sideskift', envKey: 'POWER_AUTOMATE_PRACTICE_PAGETURNS_URL' },
    { name: 'Nedlastinger', envKey: 'POWER_AUTOMATE_DOWNLOADS_URL' },
    { name: 'Medlemsside', envKey: 'POWER_AUTOMATE_MEMBERS_PAGE_URL' },
    { name: 'RSVP', envKey: 'POWER_AUTOMATE_MEMBERS_PAGE_RSVP_URL' },
    { name: 'Profil (hent)', envKey: 'POWER_AUTOMATE_PROFILE_URL' },
    { name: 'Profil (oppdater)', envKey: 'POWER_AUTOMATE_PROFILE_UPDATE_URL' },
    { name: 'Auth - Send kode', envKey: 'POWER_AUTOMATE_AUTH_SEND_CODE_URL' },
    { name: 'Auth - Verifiser', envKey: 'POWER_AUTOMATE_AUTH_VERIFY_CODE_URL' },
    { name: 'Billettadmin (hent)', envKey: 'POWER_AUTOMATE_TICKET_ADMIN_URL' },
    { name: 'Billettadmin (betalt)', envKey: 'POWER_AUTOMATE_TICKET_ADMIN_UPDATE_URL' },
    { name: 'Billettadmin (slett)', envKey: 'POWER_AUTOMATE_TICKET_ADMIN_DELETE_URL' },
    { name: 'Billettkontroll', envKey: 'POWER_AUTOMATE_TICKET_VALIDATE_URL' },
    { name: 'Filer (hent)', envKey: 'POWER_AUTOMATE_FILES_URL' },
    { name: 'Filer (oppdater)', envKey: 'POWER_AUTOMATE_FILES_UPDATE_URL' },
    { name: 'Filer (last opp)', envKey: 'POWER_AUTOMATE_FILES_UPLOAD_URL' },
    { name: 'Blob (last opp)', envKey: 'POWER_AUTOMATE_BLOB_UPLOAD_URL' },
    { name: 'Blob (tom)', envKey: 'POWER_AUTOMATE_BLOB_CLEAR_URL' },
    { name: 'Nytt arrangement', envKey: 'POWER_AUTOMATE_CREATE_EVENT_URL' },
    { name: 'Artikler', envKey: 'POWER_AUTOMATE_ARTICLES_URL' },
];

// ==========================================================================
// ADMIN APPLICATION
// ==========================================================================
class AdminApp {
    constructor() {
        this.themeManager = new ThemeManager();
        this.menuManager = new MenuManager();
        this.elements = {};
    }

    async init() {
        // Check admin access
        if (!this.checkAdminAccess()) {
            return;
        }

        this.cacheElements();
        this.setCurrentYear();
        this.themeManager.init();
        this.menuManager.init();

        this.setupEventListeners();
        this.updateSystemInfo();
        this.checkEndpoints();

        // Initialiser MusicXML-verktøy
        initMusicXMLTools();

        // Initialiser WAV→MP3-verktøy
        initWavMp3Tool();
    }

    checkAdminAccess() {
        const role = getCurrentUserRole();
        if (role !== ROLES.ADMIN) {
            // Redirect non-admins to home
            window.location.href = '/';
            return false;
        }
        return true;
    }

    cacheElements() {
        this.elements = {
            loader: document.getElementById('loader'),
            currentYear: document.getElementById('currentYear'),
            dataStatus: document.getElementById('dataStatus'),
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            endpointStatus: document.getElementById('endpointStatus'),
            endpointList: document.getElementById('endpointList'),
            clearCacheBtn: document.getElementById('clearCacheBtn'),
            refreshSwBtn: document.getElementById('refreshSwBtn'),
            appVersion: document.getElementById('appVersion'),
            currentUser: document.getElementById('currentUser'),
            currentRole: document.getElementById('currentRole'),
            swStatus: document.getElementById('swStatus'),
        };
    }

    setCurrentYear() {
        if (this.elements.currentYear) {
            this.elements.currentYear.textContent = new Date().getFullYear();
        }
    }

    setupEventListeners() {
        // Clear cache button
        this.elements.clearCacheBtn?.addEventListener('click', () => {
            this.clearCache();
        });

        // Refresh service worker button
        this.elements.refreshSwBtn?.addEventListener('click', () => {
            this.refreshServiceWorker();
        });
    }

    checkEndpoints() {
        const env = window.ENV || {};

        let configured = 0;
        let total = ENDPOINTS.length;

        this.elements.endpointList.innerHTML = ENDPOINTS.map(ep => {
            const url = env[ep.envKey];
            const isConfigured = !!url;
            if (isConfigured) configured++;

            const badgeClass = isConfigured ? 'badge--ok' : 'badge--missing';
            const badgeText = isConfigured ? 'Konfigurert' : 'Ikke konfigurert';

            return `
                <div class="endpoint-item">
                    <span class="endpoint-name">${ep.name}</span>
                    <span class="endpoint-badge ${badgeClass}">${badgeText}</span>
                </div>
            `;
        }).join('');

        // Update summary
        if (configured === total) {
            this.elements.statusIndicator.className = 'status-indicator status--live';
            this.elements.statusText.textContent = `Alle ${total} endepunkter er konfigurert`;
        } else {
            this.elements.statusIndicator.className = 'status-indicator status--partial';
            this.elements.statusText.textContent = `${configured} av ${total} endepunkter konfigurert`;
        }
    }

    updateSystemInfo() {
        // App version
        this.elements.appVersion.textContent = APP_VERSION;

        // Current user
        const member = getCurrentMember();
        this.elements.currentUser.textContent = member?.name || '-';
        this.elements.currentRole.textContent = this.formatRole(member?.role);

        // Service worker status
        this.checkServiceWorkerStatus();
    }

    formatRole(role) {
        const roleNames = {
            admin: 'Administrator',
            styre: 'Styremedlem',
            medlem: 'Medlem',
            anonym: 'Ikke innlogget'
        };
        return roleNames[role] || role || '-';
    }

    async checkServiceWorkerStatus() {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                if (registration.waiting) {
                    this.elements.swStatus.textContent = 'Oppdatering venter';
                } else if (registration.active) {
                    this.elements.swStatus.textContent = 'Aktiv';
                } else {
                    this.elements.swStatus.textContent = 'Installerer...';
                }
            } else {
                this.elements.swStatus.textContent = 'Ikke registrert';
            }
        } else {
            this.elements.swStatus.textContent = 'Ikke støttet';
        }
    }

    async clearCache() {
        try {
            // Clear all caches
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));

            // Clear localStorage API cache (if any)
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('korportal_cache_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));

            this.showToast('Cache er tømt', 'success');
        } catch (error) {
            console.error('Failed to clear cache:', error);
            this.showToast('Kunne ikke tømme cache', 'error');
        }
    }

    async refreshServiceWorker() {
        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    // Tell waiting SW to skip waiting
                    if (registration.waiting) {
                        registration.waiting.postMessage('skipWaiting');
                    }
                    // Force update check
                    await registration.update();
                    this.showToast('Service Worker oppdatert. Last siden på nytt.', 'success');
                    this.checkServiceWorkerStatus();
                } else {
                    this.showToast('Ingen Service Worker registrert', 'error');
                }
            }
        } catch (error) {
            console.error('Failed to refresh SW:', error);
            this.showToast('Kunne ikke oppdatere Service Worker', 'error');
        }
    }

    showToast(message, type = 'success') {
        // Remove existing toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        // Create new toast
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Show toast
        requestAnimationFrame(() => {
            toast.classList.add('toast--visible');
        });

        // Hide and remove after delay
        setTimeout(() => {
            toast.classList.remove('toast--visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    const app = new AdminApp();
    app.init();
});

export { AdminApp };
export default AdminApp;
