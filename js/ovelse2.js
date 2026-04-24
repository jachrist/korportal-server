/**
 * Ovelse2 - Compact layout wrapper
 * Imports the core PracticeApp from ovelse.js and adds settings panel logic.
 */

// Import everything from ovelse.js — it initializes PracticeApp on DOMContentLoaded
import './ovelse.js';

// Wait for DOM to add settings panel behavior
document.addEventListener('DOMContentLoaded', () => {
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsOverlay = document.getElementById('settingsOverlay');
    const settingsClose = document.getElementById('settingsClose');
    const settingsPanel = document.getElementById('settingsPanel');

    if (!settingsBtn || !settingsOverlay) return;

    // Open/close settings
    settingsBtn.addEventListener('click', () => {
        settingsOverlay.hidden = false;
    });

    settingsClose?.addEventListener('click', () => {
        settingsOverlay.hidden = true;
    });

    settingsOverlay.addEventListener('click', (e) => {
        if (e.target === settingsOverlay) {
            settingsOverlay.hidden = true;
        }
    });

    // Close settings after clicking a menu item (except toggles)
    settingsPanel?.querySelectorAll('.o2-settings__item').forEach(item => {
        item.addEventListener('click', () => {
            // Don't close for autoturn toggle
            if (item.id === 'autoTurnBtn') return;
            settingsOverlay.hidden = true;
        });
    });

    // Mode buttons in settings - highlight active
    const modeButtons = settingsPanel?.querySelectorAll('[data-mode]');
    function updateModeHighlight() {
        const current = localStorage.getItem('korportal-mode') || 'both';
        modeButtons?.forEach(btn => {
            btn.classList.toggle('o2-settings__item--active', btn.dataset.mode === current);
        });
    }
    modeButtons?.forEach(btn => {
        btn.addEventListener('click', () => {
            setTimeout(updateModeHighlight, 50);
        });
    });

    // Update autoturn badge
    function updateAutoTurnBadge() {
        const badge = document.getElementById('autoTurnBadge');
        if (!badge) return;
        const btn = document.getElementById('autoTurnBtn');
        const isOn = btn?.classList.contains('control-btn--active') ||
                     localStorage.getItem('korportal-autoturn') === 'true';
        badge.textContent = isOn ? 'På' : 'Av';
        badge.className = `o2-settings__badge${isOn ? ' o2-settings__badge--on' : ''}`;
    }

    document.getElementById('autoTurnBtn')?.addEventListener('click', () => {
        setTimeout(updateAutoTurnBadge, 50);
    });

    // Initial state
    setTimeout(() => {
        updateModeHighlight();
        updateAutoTurnBadge();
    }, 500);
});
