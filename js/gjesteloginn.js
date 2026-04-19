/**
 * Gjesteinnlogging - Kammerkoret Utsikten
 *
 * Flyt:
 * 1. Gjest oppgir passord + e-post
 * 2. Backend validerer passord, oppretter gjest-medlem om nødvendig, sender kode
 * 3. Gjest verifiserer kode (samme endepunkt som vanlig login)
 * 4. Gjest lagres i localStorage med role='gjest' og guestAnledning
 */

const STORAGE_KEY = 'korportal-member';

// Theme
const themeBtn = document.getElementById('themeBtn');
const savedTheme = localStorage.getItem('korportal-theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
themeBtn.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
themeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('korportal-theme', next);
    themeBtn.textContent = next === 'dark' ? '🌙' : '☀️';
});

// Check if already logged in
const existing = localStorage.getItem(STORAGE_KEY);
if (existing) {
    window.location.href = '/ovelse.html';
}

// Elements
const passwordForm = document.getElementById('passwordForm');
const codeForm = document.getElementById('codeForm');
const passwordInput = document.getElementById('passwordInput');
const guestEmailInput = document.getElementById('guestEmailInput');
const codeInput = document.getElementById('codeInput');
const sentToEmail = document.getElementById('sentToEmail');
const loginMessage = document.getElementById('loginMessage');
const messageText = document.getElementById('messageText');
const backBtn = document.getElementById('backBtn');

let currentEmail = '';

function showMessage(text, isError = false) {
    messageText.textContent = text;
    loginMessage.hidden = false;
    loginMessage.className = `login-message ${isError ? 'login-message--error' : 'login-message--success'}`;
}

function hideMessage() {
    loginMessage.hidden = true;
}

// Step 1: Send guest code
passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const password = passwordInput.value.trim();
    const email = guestEmailInput.value.trim().toLowerCase();
    if (!password || !email) return;

    const btn = document.getElementById('guestSendCodeBtn');
    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Sender...';

    try {
        const url = window.ENV?.POWER_AUTOMATE_AUTH_SEND_CODE_URL?.replace('/send-kode', '/gjest-send-kode') || '/api/auth/gjest-send-kode';
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        const result = data.body || data;

        if (!response.ok || result.success === false) {
            showMessage(result.error || 'Feil ved sending av kode.', true);
            return;
        }

        currentEmail = email;
        passwordForm.hidden = true;
        codeForm.hidden = false;
        sentToEmail.textContent = email;
        codeInput.focus();
    } catch (err) {
        console.error('Guest send code error:', err);
        showMessage('Nettverksfeil. Prøv igjen.', true);
    } finally {
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Send påloggingskode';
    }
});

// Step 2: Verify code
codeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const code = codeInput.value.trim();
    if (!code) return;

    const btn = document.getElementById('verifyCodeBtn');
    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Verifiserer...';

    try {
        const url = window.ENV?.POWER_AUTOMATE_AUTH_VERIFY_CODE_URL || '/api/auth/verifiser-kode';
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentEmail, code }),
        });
        const data = await response.json();
        const result = data.body || data;

        if (!response.ok || result.success === false) {
            showMessage(result.error || 'Feil kode.', true);
            return;
        }

        // Save member to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result.member));

        // Redirect to practice page
        window.location.href = '/ovelse.html';
    } catch (err) {
        console.error('Guest verify error:', err);
        showMessage('Nettverksfeil. Prøv igjen.', true);
    } finally {
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Bekreft kode';
    }
});

// Back button
backBtn.addEventListener('click', () => {
    codeForm.hidden = true;
    passwordForm.hidden = false;
    codeInput.value = '';
    hideMessage();
});
