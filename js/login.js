/**
 * Login - JavaScript
 *
 * Håndterer pålogging via e-post og engangskode
 *
 * @module Login
 * @version 1.0.0
 */

import sharePointAPI from './sharepoint-api.js';

// ==========================================================================
// CONFIGURATION
// ==========================================================================

// Mock mode for testing - evalueres lazy for å sikre at env.js har lastet
const useMock = () => !window.ENV?.POWER_AUTOMATE_AUTH_SEND_CODE_URL;

// LocalStorage keys
const STORAGE_KEYS = {
    member: 'korportal-member',
    theme: 'korportal-theme'
};

// Mock member data for testing
// Roller: 'medlem', 'styre', 'admin'
const MOCK_MEMBERS = [
    {
        id: '1',
        email: 'sopran@test.no',
        name: 'Kari Nordmann',
        voice: 'Sopran 1',
        phone: '99887766',
        role: 'medlem'
    },
    {
        id: '2',
        email: 'tenor@test.no',
        name: 'Ola Hansen',
        voice: 'Tenor 1',
        phone: '99112233',
        role: 'styre'
    },
    {
        id: '3',
        email: 'alt@test.no',
        name: 'Anne Olsen',
        voice: 'Alt 2',
        phone: '99445566',
        role: 'medlem'
    },
    {
        id: '4',
        email: 'admin@test.no',
        name: 'Admin Bruker',
        voice: 'Bass 1',
        phone: '99000000',
        role: 'admin'
    }
];

// ==========================================================================
// THEME MANAGER
// ==========================================================================
class ThemeManager {
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
// LOGIN APP
// ==========================================================================
class LoginApp {
    constructor() {
        this.themeManager = new ThemeManager();
        this.currentEmail = null;
        this.mockCode = null; // For testing
        this.elements = {};
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.themeManager.init();

        // Check if already logged in
        const member = this.getMember();
        if (member) {
            this.showLoggedInState(member);
        }
    }

    cacheElements() {
        this.elements = {
            loader: document.getElementById('loader'),
            emailForm: document.getElementById('emailForm'),
            codeForm: document.getElementById('codeForm'),
            emailInput: document.getElementById('emailInput'),
            codeInput: document.getElementById('codeInput'),
            sendCodeBtn: document.getElementById('sendCodeBtn'),
            verifyCodeBtn: document.getElementById('verifyCodeBtn'),
            backBtn: document.getElementById('backBtn'),
            sentToEmail: document.getElementById('sentToEmail'),
            loginMessage: document.getElementById('loginMessage'),
            messageText: document.getElementById('messageText'),
            loginCard: document.querySelector('.login-card')
        };
    }

    bindEvents() {
        this.elements.emailForm?.addEventListener('submit', (e) => this.handleEmailSubmit(e));
        this.elements.codeForm?.addEventListener('submit', (e) => this.handleCodeSubmit(e));
        this.elements.backBtn?.addEventListener('click', () => this.showEmailForm());
    }

    // ==========================================================================
    // MEMBER STORAGE
    // ==========================================================================
    getMember() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.member);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    }

    saveMember(member) {
        localStorage.setItem(STORAGE_KEYS.member, JSON.stringify(member));
    }

    clearMember() {
        localStorage.removeItem(STORAGE_KEYS.member);
    }

    // ==========================================================================
    // API CALLS
    // ==========================================================================
    async sendCode(email) {
        if (useMock()) {
            return this.mockSendCode(email);
        }

        // Bruk SharePoint API
        try {
            return await sharePointAPI.sendAuthCode(email);
        } catch (error) {
            console.error('Feil ved sending av kode:', error);
            throw new Error('Nettverksfeil ved sending av kode');
        }
    }

    async verifyCode(email, code) {
        if (useMock()) {
            return this.mockVerifyCode(email, code);
        }

        // Bruk SharePoint API
        try {
            return await sharePointAPI.verifyAuthCode(email, code);
        } catch (error) {
            console.error('Feil ved verifisering av kode:', error);
            throw new Error('Nettverksfeil ved verifisering av kode');
        }
    }

    // ==========================================================================
    // MOCK API (for testing)
    // ==========================================================================
    mockSendCode(email) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const member = MOCK_MEMBERS.find(m =>
                    m.email.toLowerCase() === email.toLowerCase()
                );

                if (member) {
                    // Generate random 6-digit code
                    this.mockCode = String(Math.floor(100000 + Math.random() * 900000));
                    console.log('MOCK: Kode sendt til', email, '- Kode:', this.mockCode);
                    resolve({ success: true });
                } else {
                    resolve({
                        success: false,
                        error: 'E-postadressen er ikke registrert. Kontakt administrator.'
                    });
                }
            }, 1000);
        });
    }

    mockVerifyCode(email, code) {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (code === this.mockCode) {
                    const member = MOCK_MEMBERS.find(m =>
                        m.email.toLowerCase() === email.toLowerCase()
                    );
                    resolve({ success: true, member });
                } else {
                    resolve({
                        success: false,
                        error: 'Feil kode. Prøv igjen.'
                    });
                }
            }, 800);
        });
    }

    // ==========================================================================
    // FORM HANDLERS
    // ==========================================================================
    async handleEmailSubmit(e) {
        e.preventDefault();

        const email = this.elements.emailInput.value.trim();
        if (!email) return;

        this.setButtonLoading(this.elements.sendCodeBtn, true);
        this.hideMessage();

        try {
            const result = await this.sendCode(email);

            if (result.success) {
                this.currentEmail = email;
                this.showCodeForm();
            } else {
                this.showMessage(result.error || 'Kunne ikke sende kode', 'error');
            }
        } catch (error) {
            console.error('Error sending code:', error);
            this.showMessage('En feil oppstod. Prøv igjen senere.', 'error');
        } finally {
            this.setButtonLoading(this.elements.sendCodeBtn, false);
        }
    }

    async handleCodeSubmit(e) {
        e.preventDefault();

        const code = this.elements.codeInput.value.trim();
        if (!code) return;

        this.setButtonLoading(this.elements.verifyCodeBtn, true);
        this.hideMessage();

        try {
            const result = await this.verifyCode(this.currentEmail, code);

            if (result.success && result.member) {
                this.saveMember(result.member);
                this.showMessage('Innlogging vellykket!', 'success');

                // Redirect after short delay
                setTimeout(() => {
                    const redirect = new URLSearchParams(window.location.search).get('redirect');
                    window.location.href = redirect || '/';
                }, 1000);
            } else {
                this.showMessage(result.error || 'Feil kode', 'error');
            }
        } catch (error) {
            console.error('Error verifying code:', error);
            this.showMessage('En feil oppstod. Prøv igjen senere.', 'error');
        } finally {
            this.setButtonLoading(this.elements.verifyCodeBtn, false);
        }
    }

    // ==========================================================================
    // UI HELPERS
    // ==========================================================================
    showEmailForm() {
        this.elements.emailForm.hidden = false;
        this.elements.codeForm.hidden = true;
        this.elements.codeInput.value = '';
        this.hideMessage();
    }

    showCodeForm() {
        this.elements.emailForm.hidden = true;
        this.elements.codeForm.hidden = false;
        this.elements.sentToEmail.textContent = this.currentEmail;
        this.elements.codeInput.focus();
    }

    showLoggedInState(member) {
        const initials = member.name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

        this.elements.loginCard.innerHTML = `
            <div class="logged-in-card">
                <div class="user-avatar">${this.escapeHtml(initials)}</div>
                <div class="user-name">${this.escapeHtml(member.name)}</div>
                <div class="user-email">${this.escapeHtml(member.email)}</div>
                <div class="user-voice">${this.escapeHtml(member.voice || '')}</div>
                <div class="logged-in-actions">
                    <a href="/" class="login-btn">Gå til forsiden</a>
                    <a href="/meldinger.html" class="login-btn">Meldinger</a>
                    <a href="/innlegg.html" class="login-btn">Innlegg</a>
                    <a href="/ovelse.html" class="login-btn">Øvelse</a>
                    <a href="/nedlasting.html" class="login-btn">Last ned noter</a>
                    <button type="button" class="login-btn login-btn--secondary" id="logoutBtn">
                        Logg ut
                    </button>
                </div>
            </div>
        `;

        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            this.clearMember();
            window.location.reload();
        });
    }

    setButtonLoading(button, loading) {
        if (!button) return;

        const textEl = button.querySelector('.btn-text');
        const spinnerEl = button.querySelector('.btn-spinner');

        button.disabled = loading;
        if (textEl) textEl.hidden = loading;
        if (spinnerEl) spinnerEl.hidden = !loading;
    }

    showMessage(text, type = 'error') {
        if (this.elements.loginMessage && this.elements.messageText) {
            this.elements.messageText.textContent = text;
            this.elements.loginMessage.hidden = false;
            this.elements.loginMessage.className = `login-message ${type}`;
        }
    }

    hideMessage() {
        if (this.elements.loginMessage) {
            this.elements.loginMessage.hidden = true;
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// ==========================================================================
// INITIALIZE
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const app = new LoginApp();
    app.init();
});

// Export for use in other modules
export { LoginApp };
export default LoginApp;
