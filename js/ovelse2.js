/**
 * Ovelse2 - Compact layout wrapper
 * Imports the core PracticeApp from ovelse.js and adds settings panel logic.
 */

import './ovelse.js';

document.addEventListener('DOMContentLoaded', () => {
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsOverlay = document.getElementById('settingsOverlay');
    const settingsClose = document.getElementById('settingsClose');
    const settingsPanel = document.getElementById('settingsPanel');

    if (!settingsBtn || !settingsOverlay) return;

    function openSettings() { settingsOverlay.hidden = false; updateModeHighlight(); updateAutoTurnBadge(); }
    function closeSettings() { settingsOverlay.hidden = true; }

    settingsBtn.addEventListener('click', openSettings);
    settingsClose?.addEventListener('click', closeSettings);
    settingsOverlay.addEventListener('click', (e) => { if (e.target === settingsOverlay) closeSettings(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !settingsOverlay.hidden) closeSettings(); });

    // Close settings after clicking most items
    settingsPanel?.querySelectorAll('.o2-settings__item').forEach(item => {
        item.addEventListener('click', () => {
            // Keep open for autoturn toggle
            if (item.id === 'autoTurnBtn') {
                setTimeout(updateAutoTurnBadge, 50);
                return;
            }
            // Update mode highlight then close
            if (item.dataset.mode) {
                setTimeout(() => { updateModeHighlight(); closeSettings(); }, 50);
            } else {
                closeSettings();
            }
        });
    });

    // Mode highlighting
    function updateModeHighlight() {
        const current = localStorage.getItem('korportal-mode') || 'both';
        settingsPanel?.querySelectorAll('[data-mode]').forEach(btn => {
            btn.classList.toggle('o2-settings__item--active', btn.dataset.mode === current);
        });
    }

    // Autoturn badge
    function updateAutoTurnBadge() {
        const badge = document.getElementById('autoTurnBadge');
        if (!badge) return;
        const isOn = localStorage.getItem('korportal-autoturn') === 'true';
        badge.textContent = isOn ? 'På' : 'Av';
        badge.className = `o2-settings__badge${isOn ? ' o2-settings__badge--on' : ''}`;
    }

    // Wake Lock - keep screen on
    let wakeLock = null;
    const wakeLockBtn = document.getElementById('wakeLockBtn');
    const wakeLockBadge = document.getElementById('wakeLockBadge');

    function updateWakeLockBadge() {
        if (!wakeLockBadge) return;
        const isOn = wakeLock !== null;
        wakeLockBadge.textContent = isOn ? 'På' : 'Av';
        wakeLockBadge.className = `o2-settings__badge${isOn ? ' o2-settings__badge--on' : ''}`;
    }

    async function toggleWakeLock() {
        if (!('wakeLock' in navigator)) {
            alert('Denne nettleseren støtter ikke skjermlås-funksjon.');
            return;
        }

        if (wakeLock) {
            await wakeLock.release();
            wakeLock = null;
        } else {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                wakeLock.addEventListener('release', () => {
                    wakeLock = null;
                    updateWakeLockBadge();
                });
            } catch (err) {
                console.error('Wake lock error:', err);
                alert('Kunne ikke holde skjermen på: ' + err.message);
            }
        }
        updateWakeLockBadge();
    }

    wakeLockBtn?.addEventListener('click', () => {
        toggleWakeLock();
    });

    // Re-acquire wake lock when page becomes visible again (iOS releases it on tab switch)
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && wakeLock === null && localStorage.getItem('korportal-wakelock') === 'true') {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                wakeLock.addEventListener('release', () => { wakeLock = null; updateWakeLockBadge(); });
                updateWakeLockBadge();
            } catch { /* ignore */ }
        }
    });

    // Persist wake lock preference
    const origToggle = toggleWakeLock;
    wakeLockBtn?.addEventListener('click', () => {
        localStorage.setItem('korportal-wakelock', wakeLock ? 'true' : 'false');
    });

    // Auto-enable if previously on
    if ('wakeLock' in navigator && localStorage.getItem('korportal-wakelock') === 'true') {
        navigator.wakeLock.request('screen').then(wl => {
            wakeLock = wl;
            wl.addEventListener('release', () => { wakeLock = null; updateWakeLockBadge(); });
            updateWakeLockBadge();
        }).catch(() => {});
    }

    // Initial state
    setTimeout(() => { updateModeHighlight(); updateAutoTurnBadge(); updateWakeLockBadge(); }, 500);
});
