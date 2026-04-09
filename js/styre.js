/**
 * Styresider - Kammerkoret Utsikten
 * Medlemsadministrasjon og kommunikasjon for styret
 *
 * @module Styre
 * @version 1.0.0
 */

import { initPage } from './navigation.js';
import sharePointAPI from './sharepoint-api.js';

// ==========================================================================
// MOCK DATA
// ==========================================================================

const MOCK_MEMBERS = [
    {
        id: '1',
        name: 'Anna Johansen',
        email: 'anna.johansen@example.com',
        phone: '+47 901 23 456',
        voice: 'sopran 1',
        role: 'admin',
        kontingentBetalt: true,
        joinedAt: '2019-08-15'
    },
    {
        id: '2',
        name: 'Erik Berntsen',
        email: 'erik.berntsen@example.com',
        phone: '+47 912 34 567',
        voice: 'bass 1',
        role: 'styre',
        kontingentBetalt: true,
        joinedAt: '2020-01-10'
    },
    {
        id: '3',
        name: 'Marte Olsen',
        email: 'marte.olsen@example.com',
        phone: '+47 923 45 678',
        voice: 'alt 1',
        role: 'styre',
        kontingentBetalt: true,
        joinedAt: '2020-03-22'
    },
    {
        id: '4',
        name: 'Lars Pettersen',
        email: 'lars.pettersen@example.com',
        phone: '+47 934 56 789',
        voice: 'tenor 1',
        role: 'medlem',
        kontingentBetalt: true,
        joinedAt: '2021-09-01'
    },
    {
        id: '5',
        name: 'Sofie Dahl',
        email: 'sofie.dahl@example.com',
        phone: '+47 945 67 890',
        voice: 'sopran 2',
        role: 'medlem',
        kontingentBetalt: false,
        joinedAt: '2022-01-15'
    },
    {
        id: '6',
        name: 'Henrik Vik',
        email: 'henrik.vik@example.com',
        phone: '+47 956 78 901',
        voice: 'bass 2',
        role: 'medlem',
        kontingentBetalt: true,
        joinedAt: '2022-08-20'
    },
    {
        id: '7',
        name: 'Ingrid Strand',
        email: 'ingrid.strand@example.com',
        phone: '+47 967 89 012',
        voice: 'alt 2',
        role: 'medlem',
        kontingentBetalt: false,
        joinedAt: '2023-01-10'
    },
    {
        id: '8',
        name: 'Thomas Berg',
        email: 'thomas.berg@example.com',
        phone: '+47 978 90 123',
        voice: 'tenor 2',
        role: 'medlem',
        kontingentBetalt: true,
        joinedAt: '2023-06-01'
    },
    {
        id: '9',
        name: 'Kristine Haugen',
        email: 'kristine.haugen@example.com',
        phone: '',
        voice: 'sopran 1',
        role: 'medlem',
        kontingentBetalt: false,
        joinedAt: '2024-01-08'
    },
    {
        id: '10',
        name: 'Anders Lie',
        email: 'anders.lie@example.com',
        phone: '+47 989 01 234',
        voice: 'tenor 1',
        role: 'medlem',
        kontingentBetalt: true,
        joinedAt: '2024-08-19'
    }
];

// ==========================================================================
// STYRE APPLICATION
// ==========================================================================

class StyreApp {
    constructor() {
        this.members = [];
        this.filteredMembers = [];
        this.elements = {};
        this.nextId = 100;
    }

    async init() {
        const result = initPage({ requireAuth: true, requiredRole: 'styre' });
        if (!result) return;

        // Tøm cache for ferske data ved sidenavigasjon
        sharePointAPI.cache.clear();

        this.cacheElements();
        this.setCurrentYear();
        this.setupEventListeners();

        await this.loadMembers();
        this.hideLoader();
    }

    cacheElements() {
        this.elements = {
            loader: document.getElementById('loader'),
            currentYear: document.getElementById('currentYear'),
            statTotal: document.getElementById('statTotal'),
            statActive: document.getElementById('statActive'),
            statVoiceGroups: document.getElementById('statVoiceGroups'),
            membersTableBody: document.getElementById('membersTableBody'),
            membersTableContainer: document.getElementById('membersTableContainer'),
            memberSearch: document.getElementById('memberSearch'),
            voiceFilter: document.getElementById('voiceFilter'),
            roleFilter: document.getElementById('roleFilter'),
            addMemberBtn: document.getElementById('addMemberBtn'),
            sendEmailBtn: document.getElementById('sendEmailBtn'),
            // Member modal
            memberModalOverlay: document.getElementById('memberModalOverlay'),
            memberModalTitle: document.getElementById('memberModalTitle'),
            memberModalClose: document.getElementById('memberModalClose'),
            memberForm: document.getElementById('memberForm'),
            memberFormId: document.getElementById('memberFormId'),
            memberName: document.getElementById('memberName'),
            memberEmail: document.getElementById('memberEmail'),
            memberPhone: document.getElementById('memberPhone'),
            memberVoice: document.getElementById('memberVoice'),
            memberRole: document.getElementById('memberRole'),
            memberKontingent: document.getElementById('memberKontingent'),
            memberFormCancel: document.getElementById('memberFormCancel'),
            memberFormSubmit: document.getElementById('memberFormSubmit'),
            // Email modal
            emailModalOverlay: document.getElementById('emailModalOverlay'),
            emailModalClose: document.getElementById('emailModalClose'),
            emailRecipientType: document.getElementById('emailRecipientType'),
            emailVoiceGroup: document.getElementById('emailVoiceGroup'),
            emailVoiceSelect: document.getElementById('emailVoiceSelect'),
            emailIndividualGroup: document.getElementById('emailIndividualGroup'),
            emailMemberList: document.getElementById('emailMemberList'),
            emailSubject: document.getElementById('emailSubject'),
            emailMessage: document.getElementById('emailMessage'),
            emailFormCancel: document.getElementById('emailFormCancel'),
            emailFormSubmit: document.getElementById('emailFormSubmit')
        };
    }

    setCurrentYear() {
        if (this.elements.currentYear) {
            this.elements.currentYear.textContent = new Date().getFullYear();
        }
    }

    setupEventListeners() {
        // Filter/search
        this.elements.memberSearch?.addEventListener('input', () => this.applyFilters());
        this.elements.voiceFilter?.addEventListener('change', () => this.applyFilters());
        this.elements.roleFilter?.addEventListener('change', () => this.applyFilters());

        // Buttons
        this.elements.addMemberBtn?.addEventListener('click', () => this.openMemberModal());
        this.elements.sendEmailBtn?.addEventListener('click', () => this.openEmailModal());

        // Member modal
        this.elements.memberModalClose?.addEventListener('click', () => this.closeMemberModal());
        this.elements.memberFormCancel?.addEventListener('click', () => this.closeMemberModal());
        this.elements.memberModalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.memberModalOverlay) this.closeMemberModal();
        });
        this.elements.memberForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitMemberForm();
        });

        // Email modal
        this.elements.emailModalClose?.addEventListener('click', () => this.closeEmailModal());
        this.elements.emailFormCancel?.addEventListener('click', () => this.closeEmailModal());
        this.elements.emailModalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.emailModalOverlay) this.closeEmailModal();
        });
        this.elements.emailRecipientType?.addEventListener('change', () => this.updateRecipientUI());
        this.elements.emailFormSubmit?.addEventListener('click', () => this.sendEmail());
    }

    hideLoader() {
        if (this.elements.loader) {
            this.elements.loader.style.display = 'none';
        }
    }

    useMock() {
        return !window.ENV?.POWER_AUTOMATE_STYRE_MEMBERS_URL;
    }

    // =========================================================================
    // DATA
    // =========================================================================

    async loadMembers() {
        try {
            let data;
            if (this.useMock()) {
                data = MOCK_MEMBERS;
            } else {
                data = await sharePointAPI.getStyreMembers();
            }

            this.members = data;
            this.populateVoiceFilters();
            this.applyFilters();
            this.renderStats();
        } catch (error) {
            console.error('[Styre] Feil ved lasting av medlemmer:', error);
            this.showToast('Kunne ikke laste medlemmer', 'error');
        }
    }

    populateVoiceFilters() {
        const voices = [...new Set(this.members.map(m => m.voice).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'no'));

        // Table voice filter
        this.elements.voiceFilter.innerHTML = '<option value="">Alle stemmegrupper</option>' +
            voices.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');

        // Email voice select
        this.elements.emailVoiceSelect.innerHTML = '<option value="">Velg stemmegruppe</option>' +
            voices.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    }

    // =========================================================================
    // RENDERING
    // =========================================================================

    renderStats() {
        const total = this.members.length;
        const voices = new Set(this.members.map(m => m.voice).filter(Boolean));

        this.elements.statTotal.textContent = total;
        this.elements.statActive.textContent = total;
        this.elements.statVoiceGroups.textContent = voices.size;
    }

    renderMembersTable() {
        if (this.filteredMembers.length === 0) {
            this.elements.membersTableBody.innerHTML = `
                <tr>
                    <td colspan="8">
                        <div class="styre-empty">
                            <div class="styre-empty__icon">👤</div>
                            <h2 class="styre-empty__title">Ingen medlemmer funnet</h2>
                            <p class="styre-empty__text">Prøv å endre søk eller filter</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        this.elements.membersTableBody.innerHTML = this.filteredMembers.map(m => `
            <tr>
                <td data-label="Navn">${escapeHtml(m.name)}</td>
                <td data-label="E-post">${escapeHtml(m.email)}</td>
                <td data-label="Telefon">${escapeHtml(m.phone || '-')}</td>
                <td data-label="Stemmegruppe"><span class="voice-badge">${escapeHtml(m.voice)}</span></td>
                <td data-label="Rolle"><span class="role-badge role-badge--${m.role}">${escapeHtml(m.role)}</span></td>
                <td data-label="Medlem siden">${this.formatDate(m.joinedAt)}</td>
                <td data-label="Kontingent betalt" class="td-kontingent">
                    <input type="checkbox" class="kontingent-checkbox" data-id="${escapeHtml(String(m.id))}" ${m.kontingentBetalt ? 'checked' : ''}>
                </td>
                <td data-label="Handlinger">
                    <button class="styre-btn styre-btn--edit edit-member-btn" data-id="${escapeHtml(String(m.id))}">Rediger</button>
                    <button class="styre-btn styre-btn--danger delete-member-btn" data-id="${escapeHtml(String(m.id))}">Slett</button>
                </td>
            </tr>
        `).join('');

        // Bind action buttons
        this.elements.membersTableBody.querySelectorAll('.edit-member-btn').forEach(btn => {
            btn.addEventListener('click', () => this.openMemberModal(btn.dataset.id));
        });
        this.elements.membersTableBody.querySelectorAll('.delete-member-btn').forEach(btn => {
            btn.addEventListener('click', () => this.deleteMember(btn.dataset.id));
        });
        this.elements.membersTableBody.querySelectorAll('.kontingent-checkbox').forEach(cb => {
            cb.addEventListener('change', () => this.toggleKontingent(cb.dataset.id, cb.checked));
        });
    }

    // =========================================================================
    // FILTER / SEARCH
    // =========================================================================

    applyFilters() {
        const search = (this.elements.memberSearch?.value || '').toLowerCase().trim();
        const voiceFilter = this.elements.voiceFilter?.value || '';
        const roleFilter = this.elements.roleFilter?.value || '';

        this.filteredMembers = this.members.filter(m => {
            if (search && !m.name.toLowerCase().includes(search) && !m.email.toLowerCase().includes(search)) {
                return false;
            }
            if (voiceFilter && m.voice !== voiceFilter) return false;
            if (roleFilter && m.role !== roleFilter) return false;
            return true;
        });

        this.filteredMembers.sort((a, b) => a.name.localeCompare(b.name, 'no'));
        this.renderMembersTable();
    }

    // =========================================================================
    // MEMBER MODAL (Create / Edit)
    // =========================================================================

    openMemberModal(id) {
        if (id) {
            const member = this.members.find(m => String(m.id) === String(id));
            if (!member) return;
            this.elements.memberModalTitle.textContent = 'Rediger medlem';
            this.elements.memberFormId.value = member.id;
            this.elements.memberName.value = member.name;
            this.elements.memberEmail.value = member.email;
            this.elements.memberPhone.value = member.phone || '';
            this.elements.memberVoice.value = member.voice;
            this.elements.memberRole.value = member.role;
            this.elements.memberKontingent.checked = !!member.kontingentBetalt;
        } else {
            this.elements.memberModalTitle.textContent = 'Registrer nytt medlem';
            this.elements.memberForm.reset();
            this.elements.memberFormId.value = '';
        }
        this.elements.memberModalOverlay.classList.add('active');
        this.elements.memberModalOverlay.setAttribute('aria-hidden', 'false');
    }

    closeMemberModal() {
        this.elements.memberModalOverlay.classList.remove('active');
        this.elements.memberModalOverlay.setAttribute('aria-hidden', 'true');
    }

    async submitMemberForm() {
        const id = this.elements.memberFormId.value;
        const data = {
            name: this.elements.memberName.value.trim(),
            email: this.elements.memberEmail.value.trim(),
            phone: this.elements.memberPhone.value.trim(),
            voice: this.elements.memberVoice.value,
            role: this.elements.memberRole.value,
            kontingentBetalt: this.elements.memberKontingent.checked
        };

        if (!data.name || !data.email || !data.voice || !data.role) {
            this.showToast('Fyll inn alle obligatoriske felt', 'error');
            return;
        }

        this.elements.memberFormSubmit.disabled = true;
        this.elements.memberFormSubmit.textContent = 'Lagrer...';

        try {
            if (id) {
                // Update
                if (!this.useMock()) {
                    await sharePointAPI.updateStyremember(id, data);
                }
                const idx = this.members.findIndex(m => String(m.id) === String(id));
                if (idx !== -1) {
                    this.members[idx] = { ...this.members[idx], ...data };
                }
                this.showToast('Medlem oppdatert', 'success');
            } else {
                // Create
                const newMember = {
                    id: String(this.nextId++),
                    ...data,
                    joinedAt: new Date().toISOString().split('T')[0]
                };

                if (!this.useMock()) {
                    const response = await sharePointAPI.registerStyremember(data);
                    if (response?.id) newMember.id = String(response.id);
                }

                this.members.push(newMember);
                this.showToast('Nytt medlem registrert', 'success');
            }

            this.closeMemberModal();
            this.populateVoiceFilters();
            this.applyFilters();
            this.renderStats();
        } catch (error) {
            console.error('[Styre] Feil ved lagring:', error);
            this.showToast('Kunne ikke lagre medlem', 'error');
        } finally {
            this.elements.memberFormSubmit.disabled = false;
            this.elements.memberFormSubmit.textContent = 'Lagre';
        }
    }

    // =========================================================================
    // DELETE MEMBER
    // =========================================================================

    async deleteMember(id) {
        const member = this.members.find(m => String(m.id) === String(id));
        if (!member) return;

        const confirmed = confirm(`Er du sikker på at du vil slette ${member.name}?`);
        if (!confirmed) return;

        const btn = this.elements.membersTableBody.querySelector(`.delete-member-btn[data-id="${id}"]`);
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Sletter...';
        }

        try {
            if (!this.useMock()) {
                await sharePointAPI.deleteStyremember(id);
            }

            this.members = this.members.filter(m => String(m.id) !== String(id));
            this.populateVoiceFilters();
            this.applyFilters();
            this.renderStats();
            this.showToast('Medlem slettet', 'success');
        } catch (error) {
            console.error('[Styre] Feil ved sletting:', error);
            this.showToast('Kunne ikke slette medlemmet', 'error');
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Slett';
            }
        }
    }

    // =========================================================================
    // TOGGLE KONTINGENT
    // =========================================================================

    async toggleKontingent(id, checked) {
        const member = this.members.find(m => String(m.id) === String(id));
        if (!member) return;

        member.kontingentBetalt = checked;

        try {
            if (!this.useMock()) {
                await sharePointAPI.updateStyremember(id, { kontingentBetalt: checked });
            }
        } catch (error) {
            console.error('[Styre] Feil ved oppdatering av kontingent:', error);
            member.kontingentBetalt = !checked;
            const cb = this.elements.membersTableBody.querySelector(`.kontingent-checkbox[data-id="${id}"]`);
            if (cb) cb.checked = !checked;
            this.showToast('Kunne ikke oppdatere kontingent', 'error');
        }
    }

    // =========================================================================
    // EMAIL MODAL
    // =========================================================================

    openEmailModal() {
        this.elements.emailRecipientType.value = 'all';
        this.elements.emailSubject.value = '';
        this.elements.emailMessage.value = '';
        this.updateRecipientUI();
        this.populateEmailMemberList();
        this.elements.emailModalOverlay.classList.add('active');
        this.elements.emailModalOverlay.setAttribute('aria-hidden', 'false');
    }

    closeEmailModal() {
        this.elements.emailModalOverlay.classList.remove('active');
        this.elements.emailModalOverlay.setAttribute('aria-hidden', 'true');
    }

    updateRecipientUI() {
        const type = this.elements.emailRecipientType.value;
        this.elements.emailVoiceGroup.style.display = type === 'voice' ? '' : 'none';
        this.elements.emailIndividualGroup.style.display = type === 'individual' ? '' : 'none';
    }

    populateEmailMemberList() {
        this.elements.emailMemberList.innerHTML = this.members
            .sort((a, b) => a.name.localeCompare(b.name, 'no'))
            .map(m => `
                <label class="styre-checkbox-item">
                    <input type="checkbox" value="${escapeHtml(m.email)}" data-name="${escapeHtml(m.name)}">
                    ${escapeHtml(m.name)} (${escapeHtml(m.voice)})
                </label>
            `).join('');
    }

    getSelectedRecipients() {
        const type = this.elements.emailRecipientType.value;

        if (type === 'all') {
            return this.members.map(m => m.email);
        }

        if (type === 'unpaid') {
            return this.members.filter(m => !m.kontingentBetalt).map(m => m.email);
        }

        if (type === 'voice') {
            const voice = this.elements.emailVoiceSelect.value;
            if (!voice) return [];
            return this.members.filter(m => m.voice === voice).map(m => m.email);
        }

        if (type === 'individual') {
            const checked = this.elements.emailMemberList.querySelectorAll('input[type="checkbox"]:checked');
            return [...checked].map(cb => cb.value);
        }

        return [];
    }

    async sendEmail() {
        const recipients = this.getSelectedRecipients();
        const subject = this.elements.emailSubject.value.trim();
        const message = this.elements.emailMessage.value.trim();

        if (recipients.length === 0) {
            this.showToast('Velg minst én mottaker', 'error');
            return;
        }
        if (!subject) {
            this.showToast('Skriv inn et emne', 'error');
            return;
        }
        if (!message) {
            this.showToast('Skriv inn en melding', 'error');
            return;
        }

        const confirmed = confirm(`Sende e-post til ${recipients.length} mottaker${recipients.length > 1 ? 'e' : ''}?`);
        if (!confirmed) return;

        this.elements.emailFormSubmit.disabled = true;
        this.elements.emailFormSubmit.textContent = 'Sender...';

        try {
            if (!this.useMock()) {
                await sharePointAPI.sendStyreEmail({ recipients, subject, message });
            }

            this.closeEmailModal();
            this.showToast(`E-post sendt til ${recipients.length} mottaker${recipients.length > 1 ? 'e' : ''}`, 'success');
        } catch (error) {
            console.error('[Styre] Feil ved sending av e-post:', error);
            this.showToast('Kunne ikke sende e-post', 'error');
        } finally {
            this.elements.emailFormSubmit.disabled = false;
            this.elements.emailFormSubmit.textContent = 'Send e-post';
        }
    }

    // =========================================================================
    // UTILS
    // =========================================================================

    formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('nb-NO', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    }

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
    const app = new StyreApp();
    app.init();
});

export { StyreApp };
export default StyreApp;
