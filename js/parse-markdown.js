/**
 * Shared Markdown Parser
 *
 * Converts markdown text to HTML. Extracted from meldinger.js
 * for reuse across the editor preview and other modules.
 *
 * @module ParseMarkdown
 * @version 1.0.0
 */

/**
 * Parse markdown text into HTML
 * @param {string} text - Markdown source
 * @returns {string} HTML output
 */
export function parseMarkdown(text) {
    if (!text) return '';

    let html = text
        // Escape HTML first
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Headers
        .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold and italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        // Blockquotes
        .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
        // Ordered list items — eget tag (<oli>) så nummererte lister ikke slås
        // sammen med punktlister og beholder <ol>-nummereringen.
        .replace(/^\d+\. (.+)$/gm, '<oli>$1</oli>')
        // Unordered list items
        .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
        // Images (must come before links)
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        // Code
        .replace(/`([^`]+)`/g, '<code>$1</code>');

    // Grupper sammenhengende listeelementer FØR avsnitt/linjeskift-konvertering,
    // så hver kjøring beholder riktig type. <ol> tas først (mens elementene ennå
    // er <oli>), deretter <ul>; til slutt normaliseres <oli> → <li>.
    html = html
        .replace(/(?:<oli>.*?<\/oli>(?:\n(?=<oli>))?)+/g, (m) => '<ol>' + m.replace(/\n/g, '') + '</ol>')
        .replace(/(?:<li>.*?<\/li>(?:\n(?=<li>))?)+/g, (m) => '<ul>' + m.replace(/\n/g, '') + '</ul>')
        .replace(/<(\/?)oli>/g, '<$1li>');

    // Line breaks (double newline = paragraph, single = <br>)
    html = html
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

    // Wrap in paragraph
    html = '<p>' + html + '</p>';

    // Fix consecutive blockquotes
    html = html.replace(/<\/blockquote><br><blockquote>/g, '<br>');

    // Clean up empty paragraphs og løft blokk-elementer ut av <p>
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-4]>)/g, '$1');
    html = html.replace(/(<\/h[1-4]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<[uo]l>)/g, '$1');
    html = html.replace(/(<\/[uo]l>)<\/p>/g, '$1');
    html = html.replace(/<br>(<[uo]l>)/g, '$1');
    html = html.replace(/(<\/[uo]l>)<br>/g, '$1');
    html = html.replace(/<p>(<blockquote>)/g, '$1');
    html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');

    return html;
}

export default parseMarkdown;
