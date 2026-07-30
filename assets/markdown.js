/** Small Markdown → HTML renderer for lead posting notes (no deps). */
(() => {
  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function inline(text) {
    let s = escapeHtml(text);
    const slots = [];
    const park = (html) => {
      const token = `\u0000${slots.length}\u0000`;
      slots.push(html);
      return token;
    };

    // code first so markup inside ticks stays literal
    s = s.replace(/`([^`]+)`/g, (_, code) => park(`<code class="md-code">${code}</code>`));

    // links (parked so later _italic_ cannot mangle target="_blank" or hrefs)
    s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (_, label, href) =>
      park(
        `<a class="md-link" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
      )
    );
    s = s.replace(/(^|[^"'\u0000>])(https?:\/\/[^\s<]+)/g, (_, pre, raw) => {
      let url = raw;
      let trail = "";
      const trim = /[),.;:!?]+$/;
      while (trim.test(url)) {
        trail = url.slice(-1) + trail;
        url = url.slice(0, -1);
      }
      if (!url) return pre + raw;
      return (
        pre +
        park(
          `<a class="md-link" href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
        ) +
        trail
      );
    });

    // bold then italic (after links are parked)
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="md-strong">$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong class="md-strong">$1</strong>');
    s = s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em class="md-em">$1</em>');
    s = s.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em class="md-em">$1</em>');

    // trailing double-spaces → soft break (common in posting headers)
    s = s.replace(/ {2}\n/g, "<br />\n");

    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[Number(i)] || "");
    return s;
  }

  function isTableSep(line) {
    return /^\s*\|?[\s-:|]+\|[\s-:|]*\|?\s*$/.test(line) && /-/.test(line);
  }

  function parseTable(lines, start) {
    const rows = [];
    let i = start;
    while (i < lines.length && /^\s*\|/.test(lines[i])) {
      rows.push(lines[i]);
      i += 1;
    }
    if (rows.length < 2 || !isTableSep(rows[1])) return null;

    const split = (row) =>
      row
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());

    const header = split(rows[0]);
    const aligns = split(rows[1]).map((cell) => {
      const left = cell.startsWith(":");
      const right = cell.endsWith(":");
      if (left && right) return "center";
      if (right) return "right";
      return "left";
    });
    const body = rows.slice(2).map(split);

    let html = '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
    header.forEach((cell, idx) => {
      html += `<th style="text-align:${aligns[idx] || "left"}">${inline(cell)}</th>`;
    });
    html += "</tr></thead><tbody>";
    for (const row of body) {
      html += "<tr>";
      header.forEach((_, idx) => {
        html += `<td style="text-align:${aligns[idx] || "left"}">${inline(row[idx] || "")}</td>`;
      });
      html += "</tr>";
    }
    html += "</tbody></table></div>";
    return { html, next: i };
  }

  function renderMarkdown(src, emptyMessage) {
    if (!src || !String(src).trim()) {
      const msg = emptyMessage || "(No posting.md)";
      return `<p class="md-p md-empty">${escapeHtml(msg)}</p>`;
    }

    const lines = String(src).replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let i = 0;
    let para = [];

    const flushPara = () => {
      if (!para.length) return;
      const text = para.join("\n").trim();
      para = [];
      if (text) out.push(`<p class="md-p">${inline(text)}</p>`);
    };

    while (i < lines.length) {
      const line = lines[i];

      // fenced code
      if (/^```/.test(line)) {
        flushPara();
        const lang = line.slice(3).trim();
        i += 1;
        const code = [];
        while (i < lines.length && !/^```/.test(lines[i])) {
          code.push(lines[i]);
          i += 1;
        }
        i += 1; // closing fence
        out.push(
          `<pre class="md-pre" data-lang="${escapeHtml(lang)}"><code class="md-code-block">${escapeHtml(code.join("\n"))}</code></pre>`
        );
        continue;
      }

      // table
      if (/^\s*\|/.test(line)) {
        const table = parseTable(lines, i);
        if (table) {
          flushPara();
          out.push(table.html);
          i = table.next;
          continue;
        }
      }

      // hr
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        flushPara();
        out.push('<hr class="md-hr" />');
        i += 1;
        continue;
      }

      // headings
      const heading = /^(#{1,4})\s+(.+)$/.exec(line);
      if (heading) {
        flushPara();
        const level = heading[1].length;
        out.push(`<h${level} class="md-h md-h${level}">${inline(heading[2])}</h${level}>`);
        i += 1;
        continue;
      }

      // blockquote (consecutive)
      if (/^\s*>\s?/.test(line)) {
        flushPara();
        const quote = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^\s*>\s?/, ""));
          i += 1;
        }
        out.push(`<blockquote class="md-quote">${inline(quote.join("\n"))}</blockquote>`);
        continue;
      }

      // unordered list
      if (/^\s*[-*+]\s+/.test(line)) {
        flushPara();
        out.push('<ul class="md-ul">');
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          out.push(`<li class="md-li">${inline(lines[i].replace(/^\s*[-*+]\s+/, ""))}</li>`);
          i += 1;
        }
        out.push("</ul>");
        continue;
      }

      // ordered list
      if (/^\s*\d+\.\s+/.test(line)) {
        flushPara();
        out.push('<ol class="md-ol">');
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          out.push(`<li class="md-li">${inline(lines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`);
          i += 1;
        }
        out.push("</ol>");
        continue;
      }

      // blank line
      if (/^\s*$/.test(line)) {
        flushPara();
        i += 1;
        continue;
      }

      para.push(line);
      i += 1;
    }

    flushPara();
    return out.join("\n");
  }

  window.renderMarkdown = renderMarkdown;
})();
