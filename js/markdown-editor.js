/**
 * Markdown Editor - Lightweight reusable editor component
 *
 * Wraps an existing textarea with a toolbar and optional preview pane.
 * No external dependencies, uses CSS variables for theming.
 *
 * @module MarkdownEditor
 * @version 1.0.0
 *
 * Usage:
 *   import { MarkdownEditor } from './markdown-editor.js';
 *   const editor = new MarkdownEditor(document.getElementById('myTextarea'));
 *   editor.init();
 */

import { parseMarkdown } from './parse-markdown.js';

export class MarkdownEditor {
    /**
     * @param {HTMLTextAreaElement} textarea - The textarea element to wrap
     * @param {Object} [options]
     * @param {boolean} [options.preview=true] - Show preview toggle button
     */
    constructor(textarea, options = {}) {
        this.textarea = textarea;
        this.options = { preview: true, ...options };
        this.wrapper = null;
        this.toolbar = null;
        this.previewPane = null;
        this.isPreviewing = false;
        this._built = false;
    }

    init() {
        if (this._built) return this;
        this._built = true;
        this._buildUI();
        this._bindEvents();
        return this;
    }

    // === Public API ===

    getValue() {
        return this.textarea.value;
    }

    setValue(text) {
        this.textarea.value = text;
        if (this.isPreviewing) this._renderPreview();
    }

    destroy() {
        if (!this._built) return;
        // Move textarea back outside wrapper
        this.wrapper.parentNode.insertBefore(this.textarea, this.wrapper);
        this.wrapper.remove();
        this.textarea.classList.remove('md-editor__textarea');
        this._built = false;
    }

    // === Internal ===

    _buildUI() {
        // Create wrapper
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'md-editor';

        // Insert wrapper where textarea is
        this.textarea.parentNode.insertBefore(this.wrapper, this.textarea);
        this.wrapper.appendChild(this.textarea);
        this.textarea.classList.add('md-editor__textarea');

        // Toolbar
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'md-editor__toolbar';
        this.toolbar.innerHTML = this._toolbarHTML();
        this.wrapper.insertBefore(this.toolbar, this.textarea);

        // Preview pane
        if (this.options.preview) {
            this.previewPane = document.createElement('div');
            this.previewPane.className = 'md-editor__preview';
            this.previewPane.hidden = true;
            this.wrapper.appendChild(this.previewPane);
        }
    }

    _toolbarHTML() {
        const btn = (action, label, title) =>
            `<button type="button" class="md-editor__btn" data-action="${action}" title="${title}" aria-label="${title}">${label}</button>`;
        const sep = '<span class="md-editor__sep"></span>';

        let html = '';
        html += btn('bold', '<b>B</b>', 'Fet (Ctrl+B)');
        html += btn('italic', '<i>I</i>', 'Kursiv (Ctrl+I)');
        html += sep;
        html += btn('h1', 'H1', 'Overskrift 1');
        html += btn('h2', 'H2', 'Overskrift 2');
        html += btn('h3', 'H3', 'Overskrift 3');
        html += sep;
        html += btn('link', '&#128279;', 'Lenke');
        html += btn('image', '&#128247;', 'Bilde');
        html += btn('ul', '&#8226;', 'Punktliste');
        html += btn('ol', '1.', 'Nummerert liste');

        if (this.options.preview) {
            html += sep;
            html += btn('preview', '&#128065;', 'Forhåndsvisning');
        }

        return html;
    }

    _bindEvents() {
        // Toolbar button clicks
        this.toolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            e.preventDefault();
            this._handleAction(btn.dataset.action);
        });

        // Keyboard shortcuts
        this.textarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                this._handleAction('bold');
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                e.preventDefault();
                this._handleAction('italic');
            }
        });

        // Tab key inserts spaces instead of leaving textarea
        this.textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                this._insertAtCursor('    ');
            }
        });
    }

    _handleAction(action) {
        switch (action) {
            case 'bold':
                this._wrapSelection('**', '**');
                break;
            case 'italic':
                this._wrapSelection('*', '*');
                break;
            case 'h1':
                this._prefixLine('# ');
                break;
            case 'h2':
                this._prefixLine('## ');
                break;
            case 'h3':
                this._prefixLine('### ');
                break;
            case 'link':
                this._insertLink();
                break;
            case 'image':
                this._insertImage();
                break;
            case 'ul':
                this._prefixLine('- ');
                break;
            case 'ol':
                this._prefixLine('1. ');
                break;
            case 'preview':
                this._togglePreview();
                break;
        }
    }

    _wrapSelection(before, after) {
        const ta = this.textarea;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const text = ta.value;
        const selected = text.substring(start, end);

        // If selection is already wrapped, unwrap it
        const prevBefore = text.substring(start - before.length, start);
        const nextAfter = text.substring(end, end + after.length);
        if (prevBefore === before && nextAfter === after) {
            ta.value = text.substring(0, start - before.length) + selected + text.substring(end + after.length);
            ta.selectionStart = start - before.length;
            ta.selectionEnd = end - before.length;
            ta.focus();
            return;
        }

        const replacement = before + (selected || 'tekst') + after;
        ta.value = text.substring(0, start) + replacement + text.substring(end);

        // Select the inserted/wrapped text (without markers)
        if (selected) {
            ta.selectionStart = start + before.length;
            ta.selectionEnd = start + before.length + selected.length;
        } else {
            ta.selectionStart = start + before.length;
            ta.selectionEnd = start + before.length + 5; // length of 'tekst'
        }
        ta.focus();
    }

    _prefixLine(prefix) {
        const ta = this.textarea;
        const start = ta.selectionStart;
        const text = ta.value;

        // Find start of current line
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = text.indexOf('\n', start);
        const actualEnd = lineEnd === -1 ? text.length : lineEnd;
        const line = text.substring(lineStart, actualEnd);

        // Toggle: if line already starts with prefix, remove it
        if (line.startsWith(prefix)) {
            ta.value = text.substring(0, lineStart) + line.substring(prefix.length) + text.substring(actualEnd);
            ta.selectionStart = ta.selectionEnd = start - prefix.length;
        } else {
            // Remove any existing header prefix before adding new one
            const cleaned = line.replace(/^#{1,4} /, '').replace(/^- /, '').replace(/^\d+\. /, '').replace(/^\* /, '');
            ta.value = text.substring(0, lineStart) + prefix + cleaned + text.substring(actualEnd);
            ta.selectionStart = ta.selectionEnd = lineStart + prefix.length + cleaned.length;
        }
        ta.focus();
    }

    _insertLink() {
        const ta = this.textarea;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const text = ta.value;
        const selected = text.substring(start, end);

        const linkText = selected || 'lenketekst';
        const insertion = `[${linkText}](url)`;
        ta.value = text.substring(0, start) + insertion + text.substring(end);

        // Select 'url' so user can type the URL
        const urlStart = start + linkText.length + 3; // [text](
        ta.selectionStart = urlStart;
        ta.selectionEnd = urlStart + 3; // 'url'
        ta.focus();
    }

    _insertImage() {
        const ta = this.textarea;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const text = ta.value;
        const selected = text.substring(start, end);

        const altText = selected || 'bildetekst';
        const insertion = `![${altText}](url)`;
        ta.value = text.substring(0, start) + insertion + text.substring(end);

        // Select 'url' so user can paste the image URL
        const urlStart = start + altText.length + 4; // ![text](
        ta.selectionStart = urlStart;
        ta.selectionEnd = urlStart + 3; // 'url'
        ta.focus();
    }

    _insertAtCursor(str) {
        const ta = this.textarea;
        const start = ta.selectionStart;
        const text = ta.value;
        ta.value = text.substring(0, start) + str + text.substring(start);
        ta.selectionStart = ta.selectionEnd = start + str.length;
        ta.focus();
    }

    _togglePreview() {
        this.isPreviewing = !this.isPreviewing;
        const previewBtn = this.toolbar.querySelector('[data-action="preview"]');

        if (this.isPreviewing) {
            this._renderPreview();
            this.previewPane.hidden = false;
            this.textarea.hidden = true;
            previewBtn?.classList.add('md-editor__btn--active');
        } else {
            this.previewPane.hidden = true;
            this.textarea.hidden = false;
            previewBtn?.classList.remove('md-editor__btn--active');
            this.textarea.focus();
        }
    }

    _renderPreview() {
        if (!this.previewPane) return;
        const raw = this.textarea.value;
        this.previewPane.innerHTML = raw ? parseMarkdown(raw) : '<p style="color:var(--muted)">Ingen innhold å forhåndsvise</p>';
    }
}

export default MarkdownEditor;
