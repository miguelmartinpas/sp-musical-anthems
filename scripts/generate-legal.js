#!/usr/bin/env node
/**
 * Genera los index.html legales a partir del config/config.json.
 *
 * Lee legal.<section> (policy, terms), convierte cada markdown indicado en
 * HTML y lo escribe en docs/legal/<section>/<code>/index.html
 * (p. ej. docs/legal/policy/es-es/index.html, docs/legal/terms/es-es/index.html).
 *
 * Uso: node scripts/generate-legal.js   (o: npm run generate:legal)
 */

const fs = require('fs');
const path = require('path');
const {
    DEFAULT_THEME,
    LEGAL_THEMES,
    renderLegalPlaceholders,
} = require('./legal-themes');

const projectRoot = path.resolve(__dirname, '..');
const configPath = path.join(projectRoot, 'config', 'config.json');
const outputRoot = path.join(projectRoot, 'docs', 'legal');

const sections = ['policy', 'terms'];

// Solo se generan los themes cuyo id termina en "-musical-anthems".
const THEME_SUFFIX = '-musical-anthems';
const selectedThemes = LEGAL_THEMES.filter((theme) => theme.id.endsWith(THEME_SUFFIX));

// ---------------------------------------------------------------------------
// Conversión de markdown a HTML (subconjunto: encabezados, listas, tablas,
// citas, código, separadores, negrita, cursiva, enlaces, imágenes)
// ---------------------------------------------------------------------------

const escapeHtml = (text) =>
    text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

function renderInline(text) {
    let html = escapeHtml(text);

    // Imágenes: ![alt](src)
    html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, src) =>
        `<img src="${src}" alt="${alt}" />`
    );
    // Enlaces: [texto](url)
    html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) =>
        `<a href="${href}">${label}</a>`
    );
    // Negrita: **texto**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Cursiva: *texto*
    html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    // Código en línea: `codigo`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    return html;
}

function isTableSeparator(line) {
    return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function convertMarkdownToHtml(markdown) {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const body = [];
    let paragraphBuffer = [];

    const flushParagraph = () => {
        if (paragraphBuffer.length > 0) {
            body.push(`<p>${paragraphBuffer.map((line) => renderInline(line)).join('<br />')}</p>`);
            paragraphBuffer = [];
        }
    };

    let index = 0;
    while (index < lines.length) {
        const line = lines[index];

        // Código en bloque: ```
        const fenceMatch = line.match(/^\s*```/);
        if (fenceMatch) {
            flushParagraph();
            const codeLines = [];
            index += 1;
            while (index < lines.length && !/^\s*```/.test(lines[index])) {
                codeLines.push(lines[index]);
                index += 1;
            }
            index += 1; // cierra la valla
            body.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
            continue;
        }

        // Separador horizontal
        if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
            flushParagraph();
            body.push('<hr />');
            index += 1;
            continue;
        }

        // Tabla: | a | b | seguida de |---|---|
        if (line.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
            flushParagraph();
            const headerCells = splitTableRow(line);
            index += 2;
            const rows = [];
            while (index < lines.length && lines[index].includes('|') && lines[index].trim() !== '') {
                rows.push(splitTableRow(lines[index]));
                index += 1;
            }
            const headerHtml = headerCells
                .map((cell) => `<th>${renderInline(cell)}</th>`)
                .join('');
            const rowsHtml = rows
                .map((cells) =>
                    `<tr>${cells.map((cell) => `<td>${renderInline(cell)}</td>`).join('')}</tr>`
                )
                .join('\n');
            body.push(`<table>\n<thead><tr>${headerHtml}</tr></thead>\n<tbody>\n${rowsHtml}\n</tbody>\n</table>`);
            continue;
        }

        // Encabezados: # a ######
        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            flushParagraph();
            const level = headingMatch[1].length;
            body.push(`<h${level}>${renderInline(headingMatch[2].trim())}</h${level}>`);
            index += 1;
            continue;
        }

        // Listas: ordenadas (1., 1)) o sin orden (-, *, +), con soporte para
        // checkbox de tareas (- [ ] / - [x]). Agrupa los items consecutivos del
        // mismo tipo en un único <ul> u <ol>.
        const listMatch = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (listMatch) {
            flushParagraph();
            const type = /\d/.test(listMatch[2]) ? 'ol' : 'ul';
            const items = [];
            while (index < lines.length) {
                const current = lines[index];
                const itemMatch = current.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
                if (!itemMatch) break;
                if (/\d/.test(itemMatch[2]) ? type !== 'ol' : type !== 'ul') break;
                const text = itemMatch[3];
                const taskMatch = text.match(/^\[([ xX])\]\s+(.*)$/);
                if (taskMatch) {
                    const checked = taskMatch[1].toLowerCase() === 'x';
                    items.push(
                        `<li class="task-list-item"><input type="checkbox" disabled${checked ? ' checked' : ''} /> ` +
                        `${renderInline(taskMatch[2])}</li>`
                    );
                } else {
                    items.push(`<li>${renderInline(text)}</li>`);
                }
                index += 1;
            }
            body.push(`<${type}>\n${items.join('\n')}\n</${type}>`);
            continue;
        }

        // Cita: >
        if (/^\s*>\s?/.test(line)) {
            flushParagraph();
            const quoteLines = [];
            while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
                quoteLines.push(lines[index].replace(/^\s*>\s?/, ''));
                index += 1;
            }
            body.push(`<blockquote><p>${quoteLines.map((qLine) => renderInline(qLine)).join('<br />')}</p></blockquote>`);
            continue;
        }

        // Línea en blanco: cierra el párrafo actual
        if (line.trim() === '') {
            flushParagraph();
            index += 1;
            continue;
        }

        // Contenido de párrafo (varias líneas físicas = saltos de línea)
        paragraphBuffer.push(line);
        index += 1;
    }
    flushParagraph();

    return body.join('\n');
}

// ---------------------------------------------------------------------------
// Plantilla HTML
// ---------------------------------------------------------------------------

function buildDocument(code, content) {
    const h1Match = content.match(/<h1>([\s\S]*?)<\/h1>/);
    const title = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : code;

    return `<!DOCTYPE html>
<html lang="${code}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  :root { color-scheme: light; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    line-height: 1.6;
    color: #1f2328;
    background-color: #ffffff;
    max-width: 760px;
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
  }
  h1, h2, h3, h4, h5, h6 { margin-top: 1.8rem; margin-bottom: 0.6rem; line-height: 1.25; }
  h1 { font-size: 2rem; margin-top: 0.5rem; padding-bottom: 0.3rem; border-bottom: 1px solid #d8dee4; }
  h2 { font-size: 1.5rem; padding-bottom: 0.2rem; border-bottom: 1px solid #d8dee4; }
  a { color: #0969da; }
  img { max-width: 100%; }
  code {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    font-size: 0.9em;
    background-color: #f0f1f2;
    padding: 0.15em 0.35em;
    border-radius: 4px;
  }
  pre {
    background-color: #f6f8fa;
    padding: 1rem;
    overflow-x: auto;
    border-radius: 6px;
  }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #d8dee4; padding: 0.5rem 0.75rem; text-align: left; }
  th { background-color: #f6f8fa; }
  blockquote {
    margin: 0;
    padding: 0.25rem 1rem;
    border-left: 4px solid #d8dee4;
    color: #57606a;
  }
  hr { border: none; border-top: 1px solid #d8dee4; margin: 1.5rem 0; }
  ul, ol { padding-left: 1.5rem; }
</style>
</head>
<body>
${content}
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Índices de redirección
// ---------------------------------------------------------------------------

function buildRedirectPage(target) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="refresh" content="0; url='${target}'" />
<title>Redirigiendo...</title>
<script>window.location.replace('${target}');</script>
</head>
<body>
<p>Redirigiendo a <a href="${target}">${target}</a>...</p>
</body>
</html>
`;
}



function writeFile(filePath, html) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, html, 'utf8');
}

function writeRedirect(filePath, target) {
    writeFile(filePath, buildRedirectPage(target));
    console.log(`[redirect] ${path.relative(projectRoot, filePath)} -> ${target}`);
}

function assertPlaceholdersResolved(markdown, section, themeId, code) {
    const pending = ['{{appName}}', '{{supportEmail}}', '{{#anthems}}', '{{/anthems}}'].filter((token) => markdown.includes(token));
    if (pending.length > 0) {
        throw new Error(
            `${section}/${themeId}/${code}: quedan tokens sin sustituir (${pending.join(', ')})`
        );
    }
}

// ---------------------------------------------------------------------------
// Generación de la salida
// ---------------------------------------------------------------------------

function generate() {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const generatedFiles = [];

    for (const section of sections) {
        const items = config?.legal?.[section];
        if (!Array.isArray(items)) {
            console.warn(`[aviso] config.legal.${section} no es un array; se omite.`);
            continue;
        }

        const locales = items.map((item) => item?.code).filter(Boolean);
        const defaultLocale = locales.includes('en-uk') ? 'en-uk' : locales[0] ?? 'en-uk';

        for (const theme of selectedThemes) {
            for (const item of items) {
                if (!item?.code || !item?.source) {
                    console.warn(`[aviso] ${section}: entrada sin code/source; se omite.`, item);
                    continue;
                }

                // Las rutas del config son relativas a la raíz del proyecto
                const sourcePath = path.resolve(projectRoot, item.source);
                if (!fs.existsSync(sourcePath)) {
                    console.error(`[error] ${section}/${item.code}: no existe el fichero de origen ${sourcePath}`);
                    continue;
                }

                const sourceMarkdown = fs.readFileSync(sourcePath, 'utf8');
                const markdown = renderLegalPlaceholders(sourceMarkdown, theme.id);
                assertPlaceholdersResolved(markdown, section, theme.id, item.code);

                const content = convertMarkdownToHtml(markdown);
                const outputPath = path.join(outputRoot, section, theme.id, item.code, 'index.html');

                writeFile(outputPath, buildDocument(item.code, content));
                generatedFiles.push(path.relative(projectRoot, outputPath));
                console.log(
                    `[ok] ${path.relative(projectRoot, outputPath)}  <-  ${path.relative(projectRoot, sourcePath)}`
                );
            }

            writeRedirect(
                path.join(outputRoot, section, theme.id, 'index.html'),
                `${defaultLocale}/index.html`
            );
        }

        // Índice de la sección: redirige al theme por defecto.
        writeRedirect(
            path.join(outputRoot, section, 'index.html'),
            `${DEFAULT_THEME}/${defaultLocale}/index.html`
        );
    }

    writeRedirect(path.join(outputRoot, 'index.html'), 'policy/index.html');

    console.log(`\nSe han generado ${generatedFiles.length} páginas legales por theme en docs/legal/`);
}

generate();
