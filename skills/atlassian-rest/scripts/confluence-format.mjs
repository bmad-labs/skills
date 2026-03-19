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

const macroToAlert = { info: 'NOTE', tip: 'TIP', warning: 'WARNING', note: 'NOTE' };

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

  // -- Fix 1 & 2: Strip <colgroup>, <tbody>, <thead> wrappers ------------
  md = md.replace(/<colgroup>.*?<\/colgroup>/gs, '');
  md = md.replace(/<\/?tbody[^>]*>/gi, '');
  md = md.replace(/<\/?thead[^>]*>/gi, '');

  // -- Fix G: Extract code blocks to placeholders BEFORE any processing ---
  // This protects code content (e.g. generic types like <Repository<T>>)
  // from being stripped by stripHtmlTags() later.
  const codeBlocks = [];
  md = md.replace(
    /<ac:structured-macro ac:name="code"[^>]*>(?:\s*<ac:parameter[^>]*>[^<]*<\/ac:parameter>)*\s*<ac:plain-text-body><!\[CDATA\[(.*?)\]\]><\/ac:plain-text-body>\s*<\/ac:structured-macro>/gs,
    (_m, code) => {
      const langMatch = _m.match(/<ac:parameter ac:name="language">([^<]*)<\/ac:parameter>/);
      const lang = langMatch ? langMatch[1] : '';
      const placeholder = `\n\n\x00CODEBLOCK${codeBlocks.length}\x00\n\n`;
      codeBlocks.push('```' + lang + '\n' + code + '\n```');
      return placeholder;
    }
  );

  // -- Fix 14: Strip toc, children, recently-updated macros ---------------
  md = md.replace(
    /<ac:structured-macro ac:name="(toc|children|recently-updated)"[^>]*>.*?<\/ac:structured-macro>/gs,
    ''
  );
  // Also handle self-closing form
  md = md.replace(
    /<ac:structured-macro ac:name="(toc|children|recently-updated)"[^>]*\/>/gs,
    ''
  );

  // -- Fix 16: view-file macro → markdown link to attachment ---------------
  md = md.replace(
    /<ac:structured-macro ac:name="view-file"[^>]*>.*?<\/ac:structured-macro>/gs,
    (_m) => {
      const fnMatch = _m.match(/ri:filename="([^"]*)"/);
      if (fnMatch) {
        const filename = fnMatch[1];
        const encoded = filename.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/ /g, '%20');
        return `[${filename}](${encoded})`;
      }
      return '';
    }
  );

  // -- Fix 12: Jira macros → plain text reference -------------------------
  md = md.replace(
    /<ac:structured-macro ac:name="jira"[^>]*>\s*(?:<ac:parameter[^>]*>(.*?)<\/ac:parameter>\s*)*<\/ac:structured-macro>/gs,
    (_m) => {
      const keyMatch = _m.match(/<ac:parameter ac:name="key">(.*?)<\/ac:parameter>/);
      return keyMatch ? keyMatch[1] : '';
    }
  );

  // -- Fix 13: Expand macro → <details><summary> collapsible section ------
  const detailsBlocks = [];
  md = md.replace(
    /<ac:structured-macro ac:name="expand"[^>]*>\s*(?:<ac:parameter[^>]*>[^<]*<\/ac:parameter>\s*)*<ac:rich-text-body>(.*?)<\/ac:rich-text-body>\s*<\/ac:structured-macro>/gs,
    (_m, body) => {
      const titleMatch = _m.match(/<ac:parameter ac:name="title">(.*?)<\/ac:parameter>/);
      const title = titleMatch ? titleMatch[1] : 'Details';
      const bodyMd = convertInnerHtmlToMarkdown(body);
      const placeholder = `\n\n\x00DETAILSBLOCK${detailsBlocks.length}\x00\n\n`;
      detailsBlocks.push(`<details>\n<summary>${title}</summary>\n\n${bodyMd}\n\n</details>`);
      return placeholder;
    }
  );

  // -- Confluence panel macros → GitHub-style alerts ----------------------
  md = md.replace(
    /<ac:structured-macro ac:name="(info|tip|warning|note)"[^>]*>\s*(?:<ac:parameter ac:name="title">(.*?)<\/ac:parameter>\s*)?<ac:rich-text-body>(.*?)<\/ac:rich-text-body>\s*<\/ac:structured-macro>/gs,
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
  // Fix 7: Handle <ac:task-id> before <ac:task-status>
  md = md.replace(/<ac:task-list>(.*?)<\/ac:task-list>/gs, (_m, inner) => {
    const tasks = [
      ...inner.matchAll(
        /<ac:task>.*?<ac:task-status>(.*?)<\/ac:task-status>\s*<ac:task-body>(.*?)<\/ac:task-body>\s*<\/ac:task>/gs
      ),
    ];
    return tasks
      .map(([, status, body]) => {
        const checked = status === 'complete' ? 'x' : ' ';
        return `- [${checked}] ${htmlInlineToMarkdown(body)}`;
      })
      .join('\n');
  });

  // -- Fix D: Confluence image macros → markdown images (with \n\n) -------
  md = md.replace(
    /<ac:image([^>]*)>\s*<ri:url ri:value="([^"]*)"[^/]*\/>\s*<\/ac:image>/gs,
    (_m, attrs, url) => {
      const altMatch = attrs.match(/ac:alt="([^"]*)"/);
      const alt = (altMatch && altMatch[1]) || '';
      return `\n\n![${alt}](${url})\n\n`;
    }
  );
  md = md.replace(
    /<ac:image([^>]*)>\s*<ri:attachment ri:filename="([^"]*)"[^/]*\/>\s*<\/ac:image>/gs,
    (_m, attrs, filename) => {
      const altMatch = attrs.match(/ac:alt="([^"]*)"/);
      // Use filename as fallback alt text when alt is empty
      const alt = (altMatch && altMatch[1]) || filename;
      // URL-encode special characters in filenames for valid markdown links
      const encoded = filename.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/ /g, '%20');
      return `\n\n![${alt}](${encoded})\n\n`;
    }
  );

  // -- Fix C: Headings with attributes + \n\n around them -----------------
  md = md.replace(/<h(\d)[^>]*>(.*?)<\/h\d>/gi, (_m, level, text) =>
    '\n\n' + '#'.repeat(parseInt(level)) + ' ' + htmlInlineToMarkdown(text) + '\n\n'
  );

  // -- Fix F: Lists with \n\n around them ---------------------------------
  md = md.replace(/<ul[^>]*>(.*?)<\/ul>/gs, (_m, inner) => {
    const items = [...inner.matchAll(/<li[^>]*>(.*?)<\/li>/gs)].map(
      (m) => '- ' + htmlInlineToMarkdown(m[1])
    );
    return '\n\n' + items.join('\n') + '\n\n';
  });
  md = md.replace(/<ol[^>]*>(.*?)<\/ol>/gs, (_m, inner) => {
    const items = [...inner.matchAll(/<li[^>]*>(.*?)<\/li>/gs)].map(
      (m, idx) => `${idx + 1}. ` + htmlInlineToMarkdown(m[1])
    );
    return '\n\n' + items.join('\n') + '\n\n';
  });

  // -- Fix 3 & 4: Tables with attributes, <tr> with attributes ------------
  md = md.replace(/<table[^>]*>(.*?)<\/table>/gs, (_m, inner) => {
    const rows = [...inner.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].map((rowMatch) => {
      const cells = [...rowMatch[1].matchAll(/<t[hd](?:\s[^>]*)?>(.*?)<\/t[hd]>/gs)].map((c) =>
        htmlInlineToMarkdown(c[1])
      );
      return '| ' + cells.join(' | ') + ' |';
    });
    if (rows.length > 0) {
      const colCount = (rows[0].match(/\|/g) || []).length - 1;
      const sep = '| ' + Array(colCount).fill('---').join(' | ') + ' |';
      return '\n\n' + [rows[0], sep, ...rows.slice(1)].join('\n') + '\n\n';
    }
    return '';
  });

  // -- Fix 2: Clean up alert syntax that ended up inside table cells ------
  md = md.replace(/\| >? ?\[!(NOTE|TIP|WARNING|CAUTION)\] ?/g, '| ');

  // -- Blockquotes (preserve inline formatting) ---------------------------
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gs, (_m, inner) =>
    '> ' + htmlInlineToMarkdown(inner)
  );

  // -- Fix E: HR with \n\n around it --------------------------------------
  md = md.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');

  // -- Fix 10: Paragraphs with attributes, add newlines between them ------
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gs, (_m, inner) => htmlInlineToMarkdown(inner) + '\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // -- Fix 8: Top-level links with extra attributes -----------------------
  md = md.replace(/<a href="(.*?)"[^>]*>(.*?)<\/a>/g, '[$2]($1)');

  // -- Fix 15: Top-level spans with style ---------------------------------
  md = md.replace(/<span[^>]*>(.*?)<\/span>/gs, '$1');

  // -- Catch-all: unknown structured macros - preserve body content -------
  md = md.replace(
    /<ac:structured-macro ac:name="([^"]*)"[^>]*>(.*?)<\/ac:structured-macro>/gs,
    (_m, name, inner) => {
      const richBody = inner.match(/<ac:rich-text-body>(.*)<\/ac:rich-text-body>/s);
      if (richBody) return convertInnerHtmlToMarkdown(richBody[1]);
      const plainBody = inner.match(/<ac:plain-text-body><!\[CDATA\[(.*?)\]\]><\/ac:plain-text-body>/s);
      if (plainBody) return '\n\n```\n' + plainBody[1] + '\n```\n\n';
      return '';
    }
  );

  // -- Strip remaining HTML tags ------------------------------------------
  md = stripHtmlTags(md);

  // -- Fix 11: Decode HTML entities ---------------------------------------
  md = decodeEntities(md);

  // -- Fix 5: Escape stray < > that could be misinterpreted as HTML ------
  // Code blocks are still placeholders, so their <> are safe.
  md = md.replace(/</g, '\\<').replace(/>/g, '\\>');

  // -- Restore details/expand blocks BEFORE code blocks --------------------
  // (details blocks may contain code block placeholders that need restoring)
  md = md.replace(/\x00DETAILSBLOCK(\d+)\x00/g, (_, i) => detailsBlocks[parseInt(i)]);

  // -- Fix G: Restore code blocks from placeholders -----------------------
  md = md.replace(/\x00CODEBLOCK(\d+)\x00/g, (_, i) => codeBlocks[parseInt(i)]);

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
  // Fix B: <p> tags → newlines to preserve paragraph separation
  md = md.replace(/<\/p>/gi, '\n');
  md = md.replace(/<p[^>]*>/gi, '');
  // Fix 15: Strip <span> with style, preserving content
  md = md.replace(/<span[^>]*>(.*?)<\/span>/gs, '$1');
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/g, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/g, '*$1*');
  // Fix trailing space inside bold/italic markers: **text ** → **text**
  md = md.replace(/\*\*(\S.*?) \*\*/g, '**$1**');
  md = md.replace(/\*(\S.*?) \*/g, '*$1*');
  md = md.replace(/<code[^>]*>(.*?)<\/code>/g, '`$1`');
  // Fix 8: Links with extra attributes
  md = md.replace(/<a href="(.*?)"[^>]*>(.*?)<\/a>/g, '[$2]($1)');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = stripHtmlTags(md);
  // Fix A: Collapse horizontal whitespace only, preserve newlines
  md = md.replace(/[^\S\n]+/g, ' ');
  md = md.replace(/ *\n */g, '\n');
  md = md.trim();
  return md;
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

  // Extract code blocks to placeholders first (same as main function)
  const codeBlocks = [];
  md = md.replace(
    /<ac:structured-macro ac:name="code"[^>]*>(?:\s*<ac:parameter[^>]*>[^<]*<\/ac:parameter>)*\s*<ac:plain-text-body><!\[CDATA\[(.*?)\]\]><\/ac:plain-text-body>\s*<\/ac:structured-macro>/gs,
    (_m, code) => {
      const langMatch = _m.match(/<ac:parameter ac:name="language">([^<]*)<\/ac:parameter>/);
      const lang = langMatch ? langMatch[1] : '';
      const placeholder = `\n\n\x00INNERCODEBLOCK${codeBlocks.length}\x00\n\n`;
      codeBlocks.push('```' + lang + '\n' + code + '\n```');
      return placeholder;
    }
  );

  // Handle image macros (attachment and URL)
  md = md.replace(
    /<ac:image([^>]*)>\s*<ri:attachment ri:filename="([^"]*)"[^/]*\/>\s*<\/ac:image>/gs,
    (_m, attrs, filename) => {
      const altMatch = attrs.match(/ac:alt="([^"]*)"/);
      const alt = (altMatch && altMatch[1]) || filename;
      const encoded = filename.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/ /g, '%20');
      return `\n\n![${alt}](${encoded})\n\n`;
    }
  );
  md = md.replace(
    /<ac:image([^>]*)>\s*<ri:url ri:value="([^"]*)"[^/]*\/>\s*<\/ac:image>/gs,
    (_m, attrs, url) => {
      const altMatch = attrs.match(/ac:alt="([^"]*)"/);
      const alt = (altMatch && altMatch[1]) || '';
      return `\n\n![${alt}](${url})\n\n`;
    }
  );

  // Handle view-file macros → markdown link
  md = md.replace(
    /<ac:structured-macro ac:name="view-file"[^>]*>.*?<\/ac:structured-macro>/gs,
    (_m) => {
      const fnMatch = _m.match(/ri:filename="([^"]*)"/);
      if (fnMatch) {
        const filename = fnMatch[1];
        const encoded = filename.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/ /g, '%20');
        return `[${filename}](${encoded})`;
      }
      return '';
    }
  );

  // Strip toc/children/recently-updated macros
  md = md.replace(/<ac:structured-macro ac:name="(toc|children|recently-updated)"[^>]*>.*?<\/ac:structured-macro>/gs, '');
  md = md.replace(/<ac:structured-macro ac:name="(toc|children|recently-updated)"[^>]*\/>/gs, '');

  // Jira macros → plain text key
  md = md.replace(
    /<ac:structured-macro ac:name="jira"[^>]*>\s*(?:<ac:parameter[^>]*>(.*?)<\/ac:parameter>\s*)*<\/ac:structured-macro>/gs,
    (_m) => {
      const keyMatch = _m.match(/<ac:parameter ac:name="key">(.*?)<\/ac:parameter>/);
      return keyMatch ? keyMatch[1] : '';
    }
  );

  // Panel macros (info/tip/warning/note) → GitHub alerts
  md = md.replace(
    /<ac:structured-macro ac:name="(info|tip|warning|note)"[^>]*>\s*(?:<ac:parameter ac:name="title">(.*?)<\/ac:parameter>\s*)?<ac:rich-text-body>(.*?)<\/ac:rich-text-body>\s*<\/ac:structured-macro>/gs,
    (_m, type, title, body) => {
      let alertType = macroToAlert[type] || 'NOTE';
      if (title) {
        const upper = title.toUpperCase();
        if (upper in ALERT_TO_MACRO) alertType = upper;
      }
      const innerMd = htmlInlineToMarkdown(body);
      const lines = innerMd.split('\n').filter((l) => l.trim() !== '');
      if (lines.length === 0) return `> [!${alertType}]\n`;
      return lines
        .map((line, i) => (i === 0 ? `> [!${alertType}] ${line}` : `> ${line}`))
        .join('\n');
    }
  );

  // Task lists
  md = md.replace(/<ac:task-list>(.*?)<\/ac:task-list>/gs, (_m, inner) => {
    const tasks = [...inner.matchAll(
      /<ac:task>.*?<ac:task-status>(.*?)<\/ac:task-status>\s*<ac:task-body>(.*?)<\/ac:task-body>\s*<\/ac:task>/gs
    )];
    return tasks.map(([, status, body]) => {
      const checked = status === 'complete' ? 'x' : ' ';
      return `- [${checked}] ${htmlInlineToMarkdown(body)}`;
    }).join('\n');
  });

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gs, (_m, inner) =>
    '> ' + htmlInlineToMarkdown(inner)
  );

  // HR
  md = md.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');

  // Handle tables
  md = md.replace(/<colgroup>.*?<\/colgroup>/gs, '');
  md = md.replace(/<\/?tbody[^>]*>/gi, '');
  md = md.replace(/<\/?thead[^>]*>/gi, '');
  md = md.replace(/<table[^>]*>(.*?)<\/table>/gs, (_m, inner) => {
    const rows = [...inner.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].map((rowMatch) => {
      const cells = [...rowMatch[1].matchAll(/<t[hd](?:\s[^>]*)?>(.*?)<\/t[hd]>/gs)].map((c) =>
        htmlInlineToMarkdown(c[1])
      );
      return '| ' + cells.join(' | ') + ' |';
    });
    if (rows.length > 0) {
      const colCount = (rows[0].match(/\|/g) || []).length - 1;
      const sep = '| ' + Array(colCount).fill('---').join(' | ') + ' |';
      return '\n\n' + [rows[0], sep, ...rows.slice(1)].join('\n') + '\n\n';
    }
    return '';
  });

  // Links with extra attributes
  md = md.replace(/<a href="(.*?)"[^>]*>(.*?)<\/a>/g, '[$2]($1)');

  // Fix C: Headings with \n\n around them
  md = md.replace(/<h(\d)[^>]*>(.*?)<\/h\d>/gi, (_m, level, text) =>
    '\n\n' + '#'.repeat(parseInt(level)) + ' ' + htmlInlineToMarkdown(text) + '\n\n'
  );
  // Fix F: Lists with \n\n around them
  md = md.replace(/<ul[^>]*>(.*?)<\/ul>/gs, (_m, inner) => {
    const items = [...inner.matchAll(/<li[^>]*>(.*?)<\/li>/gs)].map(
      (m) => '- ' + htmlInlineToMarkdown(m[1])
    );
    return '\n\n' + items.join('\n') + '\n\n';
  });
  md = md.replace(/<ol[^>]*>(.*?)<\/ol>/gs, (_m, inner) => {
    const items = [...inner.matchAll(/<li[^>]*>(.*?)<\/li>/gs)].map(
      (m, idx) => `${idx + 1}. ` + htmlInlineToMarkdown(m[1])
    );
    return '\n\n' + items.join('\n') + '\n\n';
  });
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gs, (_m, inner) => htmlInlineToMarkdown(inner) + '\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  // Strip spans
  md = md.replace(/<span[^>]*>(.*?)<\/span>/gs, '$1');

  // Catch-all: unknown structured macros - preserve body content
  md = md.replace(
    /<ac:structured-macro ac:name="([^"]*)"[^>]*>(.*?)<\/ac:structured-macro>/gs,
    (_m, name, inner) => {
      const richBody = inner.match(/<ac:rich-text-body>(.*)<\/ac:rich-text-body>/s);
      if (richBody) return htmlInlineToMarkdown(richBody[1]);
      const plainBody = inner.match(/<ac:plain-text-body><!\[CDATA\[(.*?)\]\]><\/ac:plain-text-body>/s);
      if (plainBody) return '\n\n```\n' + plainBody[1] + '\n```\n\n';
      return '';
    }
  );

  md = stripHtmlTags(md);
  md = decodeEntities(md);

  // Restore code blocks
  md = md.replace(/\x00INNERCODEBLOCK(\d+)\x00/g, (_, i) => codeBlocks[parseInt(i)]);

  md = md.replace(/\n{3,}/g, '\n\n').trim();
  return md;
}

/**
 * Decode HTML entities to their character equivalents.
 */
function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, '\u2019').replace(/&lsquo;/g, '\u2018')
    .replace(/&rdquo;/g, '\u201D').replace(/&ldquo;/g, '\u201C')
    .replace(/&mdash;/g, '\u2014').replace(/&ndash;/g, '\u2013')
    .replace(/&rarr;/g, '\u2192').replace(/&larr;/g, '\u2190')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}
