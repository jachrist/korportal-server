/**
 * Billettkontroll Page - Kammerkoret Utsikten
 * QR-kode skanning og innsjekk av billetter ved konsertinngang
 *
 * @module Billettkontroll
 * @version 1.0.0
 */

import { initPage } from './navigation.js';
import sharePointAPI from './sharepoint-api.js';

// ==========================================================================
// MOCK DATA
// ==========================================================================

const MOCK_TICKETS = {
    'REF-001': { isPaid: true, isCheckedIn: false },
    'REF-002': { isPaid: true, isCheckedIn: true },
    'REF-003': { isPaid: true, isCheckedIn: false },
    'REF-004': { isPaid: true, isCheckedIn: false },
    'REF-005': { isPaid: false, isCheckedIn: false }
};

// ==========================================================================
// BILLETTKONTROLL APPLICATION
// ==========================================================================

class BillettkontrollApp {
    constructor() {
        this.scanner = null;
        this.isScanning = false;
        this.sessionStats = { checkedIn: 0, scanned: 0, invalid: 0 };
        this.elements = {};
    }

    async init() {
        const result = initPage({ requireAuth: true, requiredRole: 'styre' });
        if (!result) return;

        this.cacheElements();
        this.setCurrentYear();
        this.setupEventListeners();
        this.hideLoader();

        await this.initScanner();
    }

    cacheElements() {
        this.elements = {
            loader: document.getElementById('loader'),
            currentYear: document.getElementById('currentYear'),
            statCheckedIn: document.getElementById('statCheckedIn'),
            statScanned: document.getElementById('statScanned'),
            statInvalid: document.getElementById('statInvalid'),
            scannerSection: document.getElementById('scannerSection'),
            scannerViewfinder: document.getElementById('scannerViewfinder'),
            scannerHint: document.getElementById('scannerHint'),
            resultCard: document.getElementById('resultCard'),
            resultStatus: document.getElementById('resultStatus'),
            scanNextBtn: document.getElementById('scanNextBtn'),
            manualRefInput: document.getElementById('manualRefInput'),
            manualCheckBtn: document.getElementById('manualCheckBtn')
        };
    }

    setCurrentYear() {
        if (this.elements.currentYear) {
            this.elements.currentYear.textContent = new Date().getFullYear();
        }
    }

    setupEventListeners() {
        this.elements.scanNextBtn?.addEventListener('click', () => this.resetAndScan());
        this.elements.manualCheckBtn?.addEventListener('click', () => this.handleManualCheck());
        this.elements.manualRefInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleManualCheck();
        });
    }

    hideLoader() {
        if (this.elements.loader) {
            this.elements.loader.style.display = 'none';
        }
    }

    useMock() {
        return !window.ENV?.POWER_AUTOMATE_TICKET_VALIDATE_URL;
    }

    // =========================================================================
    // SCANNER
    // =========================================================================

    async initScanner() {
        if (typeof Html5Qrcode === 'undefined') {
            this.elements.scannerHint.textContent =
                'QR-skanner kunne ikke lastes. Bruk manuell innlegging nedenfor.';
            this.elements.scannerViewfinder.innerHTML =
                '<div style="padding:2rem;text-align:center;color:var(--muted);">Kamera ikke tilgjengelig</div>';
            return;
        }

        try {
            this.scanner = new Html5Qrcode('scannerViewfinder');
            await this.startScanning();
        } catch (error) {
            console.error('[Billettkontroll] Scanner init feil:', error);
            this.elements.scannerHint.textContent =
                'Kunne ikke starte kamera. Sjekk tillatelser eller bruk manuell innlegging.';
        }
    }

    async startScanning() {
        if (!this.scanner) return;

        this.isScanning = true;
        this.elements.scannerHint.textContent = 'Pek kameraet mot QR-koden på billetten';

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        };

        try {
            await this.scanner.start(
                { facingMode: 'environment' },
                config,
                (decodedText) => this.onScanSuccess(decodedText),
                () => { /* ignorerer kontinuerlige skanningsfeil */ }
            );
        } catch (error) {
            console.error('[Billettkontroll] Kamera-feil:', error);
            this.elements.scannerHint.textContent =
                'Kameratilgang nektet. Tillat kamera i nettleserinnstillingene, eller bruk manuell innlegging.';
            this.isScanning = false;
        }
    }

    async stopScanning() {
        if (this.scanner && this.isScanning) {
            try {
                await this.scanner.stop();
            } catch {
                // Ignorer stopp-feil
            }
            this.isScanning = false;
        }
    }

    async onScanSuccess(decodedText) {
        await this.stopScanning();

        // Haptisk tilbakemelding
        if (navigator.vibrate) navigator.vibrate(100);

        await this.validateReference(decodedText.trim());
    }

    // =========================================================================
    // VALIDATION
    // =========================================================================

    async validateReference(referenceNumber) {
        if (!referenceNumber) return;

        this.sessionStats.scanned++;
        this.updateStats();

        try {
            let result;

            if (this.useMock()) {
                await new Promise(r => setTimeout(r, 500));
                result = this.mockValidate(referenceNumber);
            } else {
                result = await sharePointAPI.validateTicket(referenceNumber);
            }

            this.showResult(result);

        } catch (error) {
            console.error('[Billettkontroll] Valideringsfeil:', error);
            this.showResult({
                status: 'error',
                message: 'Kunne ikke validere billett. Prøv igjen.'
            });
        }
    }

    mockValidate(referenceNumber) {
        const ticket = MOCK_TICKETS[referenceNumber];

        if (!ticket) {
            return { status: 'not_found', message: 'Ukjent billett' };
        }

        if (!ticket.isPaid) {
            return { status: 'not_paid', message: 'Ikke betalt' };
        }

        if (ticket.isCheckedIn) {
            return { status: 'already_checked_in', message: 'Allerede sjekket inn' };
        }

        // Marker som innsjekket lokalt (simulerer backend-oppdatering)
        ticket.isCheckedIn = true;
        ticket.checkinTime = new Date().toISOString();

        return { status: 'valid', message: 'Gyldig billett — sjekket inn' };
    }

    // =========================================================================
    // RENDERING
    // =========================================================================

    showResult(result) {
        const card = this.elements.resultCard;
        if (!card) return;

        card.classList.remove('result-card--valid', 'result-card--already', 'result-card--invalid');

        const STATUS_CONFIG = {
            valid:              { icon: '✅', class: 'result-card--valid',   stat: 'checkedIn' },
            already_checked_in: { icon: '⚠️', class: 'result-card--already', stat: 'invalid' },
            not_paid:           { icon: '🚨', class: 'result-card--invalid', stat: 'invalid' },
            not_found:          { icon: '❌', class: 'result-card--invalid', stat: 'invalid' }
        };

        const config = STATUS_CONFIG[result.status] || STATUS_CONFIG.not_found;

        this.sessionStats[config.stat]++;
        this.updateStats();

        this.elements.resultStatus.innerHTML = `
            <span class="result-card__icon">${config.icon}</span>
            <span class="result-card__title">${escapeHtml(result.message)}</span>
        `;
        card.classList.add(config.class);
        card.hidden = false;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    async resetAndScan() {
        this.elements.resultCard.hidden = true;
        await this.startScanning();
    }

    handleManualCheck() {
        const ref = this.elements.manualRefInput?.value?.trim();
        if (!ref) return;

        this.elements.manualRefInput.value = '';

        this.stopScanning().then(() => {
            this.validateReference(ref);
        });
    }

    // =========================================================================
    // STATS
    // =========================================================================

    updateStats() {
        this.elements.statCheckedIn.textContent = this.sessionStats.checkedIn;
        this.elements.statScanned.textContent = this.sessionStats.scanned;
        this.elements.statInvalid.textContent = this.sessionStats.invalid;
    }

    // =========================================================================
    // UTILS
    // =========================================================================

    showToast(message, type = 'success') {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('toast--visible');
        });

        setTimeout(() => {
            toast.classList.remove('toast--visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// ==========================================================================
// UTILITY
// ==========================================================================

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ==========================================================================
// INIT
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const app = new BillettkontrollApp();
    app.init();
});

export { BillettkontrollApp };
export default BillettkontrollApp;
