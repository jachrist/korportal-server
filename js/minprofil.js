/**
 * Min profil - Profilside
 * Kammerkoret Utsikten
 *
 * Håndterer visning og oppdatering av brukerens profil,
 * e-postvarsler og app-innstillinger.
 */

import { initPage } from './navigation.js';

// ============================================================================
// Access control
// ============================================================================
const result = initPage({ requireAuth: true, requiredRole: 'gjest' });
if (!result) {
    document.getElementById('loader')?.classList.remove('active');
}

// ============================================================================
// DOM Elements
// ============================================================================
const elements = {
    loader: document.getElementById('loader'),
    toast: document.getElementById('toast'),
    currentYear: document.getElementById('currentYear'),
    nameInput: document.getElementById('nameInput'),
    emailInput: document.getElementById('emailInput'),
    phoneInput: document.getElementById('phoneInput'),
    voiceInput: document.getElementById('voiceInput'),
    notifyPosts: document.getElementById('notifyPosts'),
    notifyEvents: document.getElementById('notifyEvents'),
    notifyMessages: document.getElementById('notifyMessages'),
    themeSelect: document.getElementById('themeSelect'),
    saveProfileBtn: document.getElementById('saveProfileBtn')
};

// ============================================================================
// Utility Functions
// ============================================================================

function showToast(message, type = 'success') {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.className = `toast toast--visible toast--${type}`;
    setTimeout(() => {
        elements.toast.classList.remove('toast--visible');
    }, 3000);
}

function showLoader() {
    elements.loader?.classList.add('active');
}

function hideLoader() {
    elements.loader?.classList.remove('active');
}

// ============================================================================
// Form Population
// ============================================================================

function populateForm(data) {
    if (elements.nameInput) elements.nameInput.value = data.navn || '';
    if (elements.emailInput) elements.emailInput.value = data.epost || '';
    if (elements.phoneInput) elements.phoneInput.value = data.telefon || '';
    if (elements.voiceInput) elements.voiceInput.value = data.stemme || '';

    // E-postvarsler
    const varsler = data.varsler || {};
    if (elements.notifyPosts) elements.notifyPosts.checked = !!varsler.innlegg;
    if (elements.notifyEvents) elements.notifyEvents.checked = !!varsler.arrangementer;
    if (elements.notifyMessages) elements.notifyMessages.checked = !!varsler.meldinger;

    // Tema
    const tema = data.preferanser?.tema || 'dark';
    if (elements.themeSelect) elements.themeSelect.value = tema;

    // Synk tema fra server til localStorage hvis ulik
    const currentTheme = localStorage.getItem('korportal-theme');
    if (currentTheme !== tema) {
        localStorage.setItem('korportal-theme', tema);
        document.documentElement.setAttribute('data-theme', tema);
    }
}

// ============================================================================
// Data Loading
// ============================================================================

async function loadProfile() {
    showLoader();

    try {
        const apiUrl = window.ENV?.POWER_AUTOMATE_PROFILE_URL;

        if (apiUrl) {
            // Hent e-post fra innlogget bruker
            const member = JSON.parse(localStorage.getItem('korportal-member') || '{}');
            const epost = member.email || member.epost || '';

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ epost })
            });
            if (!response.ok) throw new Error('Kunne ikke hente profil');
            const raw = await response.json();
            // Pakk ut Power Automate-format: { body: [...] } eller { data: [...] }
            const items = raw?.body || raw?.data || raw;
            const data = Array.isArray(items) ? items[0] : items;
            if (data) populateForm(data);
        } else {
            // Fallback: fyll inn fra localStorage
            const member = JSON.parse(localStorage.getItem('korportal-member') || '{}');
            const tema = localStorage.getItem('korportal-theme') || 'dark';
            populateForm({
                navn: member.name || member.navn || '',
                epost: member.email || member.epost || '',
                telefon: member.phone || member.telefon || '',
                stemme: member.voice || member.stemme || '',
                varsler: {
                    innlegg: true,
                    arrangementer: true,
                    meldinger: true
                },
                preferanser: { tema }
            });
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showToast('Kunne ikke laste profil', 'error');

        // Fallback til localStorage ved feil
        const member = JSON.parse(localStorage.getItem('korportal-member') || '{}');
        const tema = localStorage.getItem('korportal-theme') || 'dark';
        populateForm({
            navn: member.name || member.navn || '',
            epost: member.email || member.epost || '',
            telefon: member.phone || member.telefon || '',
            stemme: member.voice || member.stemme || '',
            varsler: { innlegg: true, arrangementer: true, meldinger: true },
            preferanser: { tema }
        });
    } finally {
        hideLoader();
    }
}

// ============================================================================
// Save Profile
// ============================================================================

async function saveProfile() {
    const payload = {
        epost: elements.emailInput?.value || '',
        navn: elements.nameInput?.value || '',
        telefon: elements.phoneInput?.value || '',
        stemme: elements.voiceInput?.value || '',
        varsler: {
            innlegg: !!elements.notifyPosts?.checked,
            arrangementer: !!elements.notifyEvents?.checked,
            meldinger: !!elements.notifyMessages?.checked
        },
        preferanser: {
            tema: elements.themeSelect?.value || 'dark'
        }
    };

    showLoader();

    try {
        const apiUrl = window.ENV?.POWER_AUTOMATE_PROFILE_UPDATE_URL;

        if (apiUrl) {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error('Kunne ikke lagre profil');
        }

        // Oppdater localStorage med ny data (behold begge nøkkelsett for kompatibilitet)
        const member = JSON.parse(localStorage.getItem('korportal-member') || '{}');
        member.name = payload.navn;
        member.navn = payload.navn;
        member.email = payload.epost;
        member.epost = payload.epost;
        member.phone = payload.telefon;
        member.telefon = payload.telefon;
        member.voice = payload.stemme;
        member.stemme = payload.stemme;
        localStorage.setItem('korportal-member', JSON.stringify(member));

        // Oppdater tema i localStorage og på siden
        const tema = payload.preferanser.tema;
        localStorage.setItem('korportal-theme', tema);
        document.documentElement.setAttribute('data-theme', tema);

        showToast('Profil oppdatert');
    } catch (error) {
        console.error('Error saving profile:', error);
        showToast('Kunne ikke lagre profil', 'error');
    } finally {
        hideLoader();
    }
}

// ============================================================================
// Event Listeners
// ============================================================================

function initEventListeners() {
    elements.saveProfileBtn?.addEventListener('click', saveProfile);
}

// ============================================================================
// Initialize
// ============================================================================

function init() {
    if (!result) return;

    if (elements.currentYear) {
        elements.currentYear.textContent = new Date().getFullYear();
    }

    initEventListeners();
    loadProfile();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
