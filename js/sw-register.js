/**
 * Service Worker registrering med oppdateringsbanner
 * Importeres av alle sider for å sikre at brukere alltid får siste versjon.
 */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const reg = await navigator.serviceWorker.register('/sw.js');
            console.log('[SW] Registered:', reg.scope);

            // Sjekk for oppdateringer umiddelbart
            reg.update().catch(() => {});

            // Sjekk periodisk (hvert 30. minutt)
            setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);

            // Hvis det allerede venter en ny versjon
            if (reg.waiting) {
                showUpdateBanner(reg.waiting);
            }

            // Lytt på ny SW som venter på å aktiveres
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (!newWorker) return;

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // Ny versjon er lastet ned og klar - vis banner
                        showUpdateBanner(newWorker);
                    }
                });
            });

            // Reload når ny SW tar over
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    refreshing = true;
                    window.location.reload();
                }
            });
        } catch (err) {
            console.error('[SW] Registration failed:', err);
        }
    });
}

function showUpdateBanner(waitingWorker) {
    // Ikke vis hvis banner allerede finnes
    if (document.getElementById('sw-update-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'sw-update-banner';
    banner.innerHTML = `
        <span>Ny versjon tilgjengelig!</span>
        <button id="sw-update-btn">Oppdater nå</button>
        <button id="sw-update-dismiss" aria-label="Lukk">&times;</button>
    `;

    // Styling
    Object.assign(banner.style, {
        position: 'fixed',
        bottom: '0',
        left: '0',
        right: '0',
        background: 'var(--accent, #4a9eff)',
        color: '#fff',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        zIndex: '99999',
        fontFamily: 'inherit',
        fontSize: '14px',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.3)',
        animation: 'sw-slide-up 0.3s ease-out'
    });

    const style = document.createElement('style');
    style.textContent = `
        @keyframes sw-slide-up {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
        }
        #sw-update-btn {
            background: #fff;
            color: var(--accent, #4a9eff);
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
        }
        #sw-update-btn:active {
            opacity: 0.8;
        }
        #sw-update-dismiss {
            background: none;
            border: none;
            color: rgba(255,255,255,0.8);
            font-size: 20px;
            cursor: pointer;
            padding: 4px 8px;
            line-height: 1;
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(banner);

    document.getElementById('sw-update-btn').addEventListener('click', () => {
        waitingWorker.postMessage('skipWaiting');
        banner.textContent = 'Oppdaterer...';
    });

    document.getElementById('sw-update-dismiss').addEventListener('click', () => {
        banner.remove();
    });
}
