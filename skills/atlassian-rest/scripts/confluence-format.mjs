/**
 * Shared Markdown ↔ Confluence Storage Format conversion.
 *
 * Converts markdown to XHTML storage format using Confluence-native macros
 * (code blocks, panels, task lists, images) instead of plain HTML.
 *
 * Also converts Confluence storage format back to markdown for pull/diff.
 */

import { marked } from 'marked';

// ---------------------------------------------------------------------------
// Markdown → Confluence Storage Format
// ---------------------------------------------------------------------------

const ALERT_TO_MACRO = {
  NOTE: 'info',
  TIP: 'tip',
  IMPORTANT: 'info',
  WARNING: 'warning',
  CAUTION: 'warning',
};

/**
 * Convert markdown to Confluence storage format (XHTML with ac: macros).
 * If the content already starts with `<`, assume it is pre-formatted storage
 * format and return it as-is.
 */
export function markdownToStorage(markdown) {
  const content = markdown || '';
  if (content.startsWith('<')) return content;

  const renderer = new marked.Renderer();

  // -- Code blocks → Confluence code macro --------------------------------
  renderer.code = ({ text, lang }) => {
    const language = lang || 'none';
    return (
      `<ac:structured-macro ac:name="code">` +
      `<ac:parameter ac:name="language">${language}</ac:parameter>` +
      `<ac:plain-text-body><![CDATA[${text}]]></ac:plain-text-body>` +
      `</ac:structured-macro>`
    );
  };

  // -- Blockquotes: detect GitHub-style alerts → Confluence panel macros ---
  renderer.blockquote = function ({ tokens }) {
    const first = tokens[0];
    if (first?.type === 'paragraph' && first.tokens?.length > 0) {
      const firstInline = first.tokens[0];
      if (firstInline?.type === 'text') {
        const m = firstInline.text.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/);
        if (m) {
          const alertType = m[1];
          const macroName = ALERT_TO_MACRO[alertType];
          const title = alertType.charAt(0) + alertType.slice(1).toLowerCase();

          // Clone tokens so we can strip the alert marker without mutating input
          const modified = structuredClone(tokens);
          modified[0].tokens[0].text = firstInline.text.slice(m[0].length);
          // Also update raw/text on the paragraph token for marked internals
          if (modified[0].text) {
            modified[0].text = modified[0].text.replace(m[0], '');
          }
          if (modified[0].raw) {
            modified[0].raw = modified[0].raw.replace(m[0], '');
          }

          const innerHtml = this.parser.parse(modified);
          return (
            `<ac:structured-macro ac:name="${macroName}">` +
            `<ac:parameter ac:name="title">${title}</ac:parameter>` +
            `<ac:rich-text-body>${innerHtml}</ac:rich-text-body>` +
            `</ac:structured-macro>\n`
          );
        }
      }
    }
    // Default blockquote
    return `<blockquote>\n${this.parser.parse(tokens)}</blockquote>\n`;
  };

  // -- Images → Confluence image macro ------------------------------------
  renderer.image = ({ href, title, text }) => {
    const alt = escapeAttr(text || '');
    const titleAttr = title ? ` ac:title="${escapeAttr(title)}"` : '';

    if (href.startsWith('http://') || href.startsWith('https://')) {
      return (
        `<ac:image${titleAttr} ac:alt="${alt}">` +
        `<ri:url ri:value="${escapeAttr(href)}" />` +
        `</ac:image>`
      );
    }
    // Treat relative paths as attachment references
    return (
      `<ac:image${titleAttr} ac:alt="${alt}">` +
      `<ri:attachment ri:filename="${escapeAttr(href)}" />` +
      `</ac:image>`
    );
  };

  // -- Task lists → Confluence task-list macro ----------------------------
  renderer.checkbox = () => '';

  renderer.listitem = function (item) {
    const innerHtml = this.parser.parse(item.tokens);
    if (item.task) {
      const status = item.checked ? 'complete' : 'incomplete';
      return (
        `<ac:task>` +
        `<ac:task-status>${status}</ac:task-status>` +
        `<ac:task-body>${innerHtml}</ac:task-body>` +
        `</ac:task>\n`
      );
    }
    return `<li>${innerHtml}</li>\n`;
  };

  renderer.list = function (token) {
    let body = '';
    for (const item of token.items) {
      body += this.listitem(item);
    }
    if (body.includes('<ac:task>')) {
      return `<ac:task-list>\n${body}</ac:task-list>\n`;
    }
    const tag = token.ordered ? 'ol' : 'ul';
    const start = token.ordered && token.start !== 1 ? ` start="${token.start}"` : '';
    return `<${tag}${start}>\n${body}</${tag}>\n`;
  };

  return marked(content, { renderer });
}

// ---------------------------------------------------------------------------
// Confluence Storage Format → Markdown
// ---------------------------------------------------------------------------

/**
 * Convert Confluence storage format (XHTML) back to markdown.
 */
export function storageToMarkdown(html) {
  let md = html || '';

  // -- Confluence panel macros → GitHub-style alerts ----------------------
  const macroToAlert = { info: 'NOTE', tip: 'TIP', warning: 'WARNING', note: 'NOTE' };
  md = md.replace(
    /<ac:structured-macro ac:name="(info|tip|warning|note)">\s*(?:<ac:parameter ac:name="title">(.*?)<\/ac:parameter>\s*)?<ac:rich-text-body>(.*?)<\/ac:rich-text-body>\s*<\/ac:structured-macro>/gs,
    (_m, type, title, body) => {
      // Use a more specific alert type if the title tells us
      let alertType = macroToAlert[type] || 'NOTE';
      if (title) {
        const upper = title.toUpperCase();
        if (upper in ALERT_TO_MACRO) alertType = upper;
      }
      const innerMd = convertInnerHtmlToMarkdown(body);
      const lines = innerMd.split('\n').filter((l) => l.trim() !== '');
      if (lines.length === 0) return `> [!${alertType}]\n`;
      return lines
        .map((line, i) => (i === 0 ? `> [!${alertType}] ${line}` : `> ${line}`))
        .join('\n');
    }
  );

  // -- Confluence task-list → markdown checkboxes -------------------------
  md = md.replace(/<ac:task-list>(.*?)<\/ac:task-list>/gs, (_m, inner) => {
    const tasks = [
      ...inner.matchAll(
        /<ac:task>\s*<ac:task-status>(.*?)<\/ac:task-status>\s*<ac:task-body>(.*?)<\/ac:task-body>\s*<\/ac:task>/gs
      ),
    ];
    return tasks
      .map(([, status, body]) => {
        const checked = status === 'complete' ? 'x' : ' ';
        return `- [${checked}] ${htmlInlineToMarkdown(body)}`;
      })
      .join('\n');
  });

  // -- Confluence image macros → markdown images --------------------------
  md = md.replace(
    /<ac:image([^>]*)>\s*<ri:url ri:value="([^"]*)"[^/]*\/>\s*<\/ac:image>/gs,
    (_m, attrs, url) => {
      const altMatch = attrs.match(/ac:alt="([^"]*)"/);
      return `![${altMatch ? altMatch[1] : ''}](${url})`;
    }
  );
  md = md.replace(
    /<ac:image([^>]*)>\s*<ri:attachment ri:filename="([^"]*)"[^/]*\/>\s*<\/ac:image>/gs,
    (_m, attrs, filename) => {
      const altMatch = attrs.match(/ac:alt="([^"]*)"/);
      return `![${altMatch ? altMatch[1] : ''}](${filename})`;
    }
  );

  // -- Headings (preserve inline formatting) ------------------------------
  md = md.replace(/<h(\d)>(.*?)<\/h\d>/gi, (_m, level, text) =>
    '#'.repeat(parseInt(level)) + ' ' + htmlInlineToMarkdown(text)
  );

  // -- Code blocks (Confluence macro) -------------------------------------
  md = md.replace(
    /<ac:structured-macro ac:name="code">.*?<ac:parameter ac:name="language">(.*?)<\/ac:parameter>.*?<ac:plain-text-body><!\[CDATA\[(.*?)\]\]><\/ac:plain-text-body>.*?<\/ac:structured-macro>/gs,
    (_m, lang, code) => '```' + (lang || '') + '\n' + code + '\n```'
  );

  // -- Lists (preserve inline formatting) ---------------------------------
  md = md.replace(/<ul>(.*?)<\/ul>/gs, (_m, inner) => {
    const items = [...inner.matchAll(/<li>(.*?)<\/li>/gs)].map(
      (m) => '- ' + htmlInlineToMarkdown(m[1])
    );
    return items.join('\n');
  });
  md = md.replace(/<ol>(.*?)<\/ol>/gs, (_m, inner) => {
    const items = [...inner.matchAll(/<li>(.*?)<\/li>/gs)].map(
      (m, idx) => `${idx + 1}. ` + htmlInlineToMarkdown(m[1])
    );
    return items.join('\n');
  });

  // -- Tables (preserve inline formatting) --------------------------------
  md = md.replace(/<table>(.*?)<\/table>/gs, (_m, inner) => {
    const rows = [...inner.matchAll(/<tr>(.*?)<\/tr>/gs)].map((rowMatch) => {
      const cells = [...rowMatch[1].matchAll(/<t[hd](?:\s[^>]*)?>(.*?)<\/t[hd]>/gs)].map((c) =>
        htmlInlineToMarkdown(c[1])
      );
      return '| ' + cells.join(' | ') + ' |';
    });
    if (rows.length > 0) {
      const colCount = (rows[0].match(/\|/g) || []).length - 1;
      const sep = '| ' + Array(colCount).fill('---').join(' | ') + ' |';
      return [rows[0], sep, ...rows.slice(1)].join('\n');
    }
    return '';
  });

  // -- Blockquotes (preserve inline formatting) ---------------------------
  md = md.replace(/<blockquote>(.*?)<\/blockquote>/gs, (_m, inner) =>
    '> ' + htmlInlineToMarkdown(inner)
  );

  // -- HR -----------------------------------------------------------------
  md = md.replace(/<hr\s*\/?>/gi, '---');

  // -- Paragraphs (preserve inline formatting) ----------------------------
  md = md.replace(/<p>(.*?)<\/p>/gs, (_m, inner) => htmlInlineToMarkdown(inner));
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // -- Strip remaining HTML tags ------------------------------------------
  md = stripHtmlTags(md);

  // -- Clean up extra blank lines -----------------------------------------
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  return md;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Convert inline HTML formatting to markdown, then strip remaining tags.
 */
export function htmlInlineToMarkdown(html) {
  let md = html || '';
  md = md.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
  md = md.replace(/<em>(.*?)<\/em>/g, '*$1*');
  md = md.replace(/<code>(.*?)<\/code>/g, '`$1`');
  md = md.replace(/<a href="(.*?)">(.*?)<\/a>/g, '[$2]($1)');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  return stripHtmlTags(md);
}

/**
 * Strip all HTML tags from text.
 */
export function stripHtmlTags(text) {
  return (text || '').replace(/<[^>]+>/g, '');
}

/**
 * Escape a string for use in an XML/HTML attribute value.
 */
function escapeAttr(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Convert inner HTML from a Confluence macro body back to markdown.
 * Applies the same pipeline as storageToMarkdown but without the macro handlers
 * (to avoid infinite recursion on nested macros of the same type).
 */
function convertInnerHtmlToMarkdown(html) {
  let md = html || '';
  md = md.replace(/<h(\d)>(.*?)<\/h\d>/gi, (_m, level, text) =>
    '#'.repeat(parseInt(level)) + ' ' + htmlInlineToMarkdown(text)
  );
  md = md.replace(/<ul>(.*?)<\/ul>/gs, (_m, inner) => {
    const items = [...inner.matchAll(/<li>(.*?)<\/li>/gs)].map(
      (m) => '- ' + htmlInlineToMarkdown(m[1])
    );
    return items.join('\n');
  });
  md = md.replace(/<ol>(.*?)<\/ol>/gs, (_m, inner) => {
    const items = [...inner.matchAll(/<li>(.*?)<\/li>/gs)].map(
      (m, idx) => `${idx + 1}. ` + htmlInlineToMarkdown(m[1])
    );
    return items.join('\n');
  });
  md = md.replace(/<p>(.*?)<\/p>/gs, (_m, inner) => htmlInlineToMarkdown(inner));
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = stripHtmlTags(md);
  md = md.replace(/\n{3,}/g, '\n\n').trim();
  return md;
}
