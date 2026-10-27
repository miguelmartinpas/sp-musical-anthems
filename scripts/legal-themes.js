'use strict';

/**
 * Registro de identidad legal por theme.
 *
 * Debe coincidir con `nameFor()` y los prefijos de correo (`emailPrefix`) de
 * `app-boilerplate/scripts/android-themes.js` (ver `npm run check:legal`).
 */

const DEFAULT_THEME = 'sp-musical-anthems';

const LEGAL_THEMES = [
    { id: 'sp-musical-anthems', appName: 'Himnos Españoles', emailPrefix: 'sp' },
    { id: 'c-musical-anthems', appName: 'Himnos revolucionarios', emailPrefix: 'c' },
    { id: 'ca-musical-anthems', appName: 'Himne català', emailPrefix: 'ca' },
    { id: 'e-musical-anthems', appName: 'Eusko Abendaren Ereserkia', emailPrefix: 'e' },
    { id: 'gl-musical-anthems', appName: 'Himno galego', emailPrefix: 'gl' },
    { id: 'an-musical-anthems', appName: 'Himno Andaluz', emailPrefix: 'an' },
    { id: 'popular-christmas-music', appName: 'Popular Christmas Music', emailPrefix: 'pcm' },
];

const THEME_IDS = LEGAL_THEMES.map((theme) => theme.id);

function themeFor(themeId) {
    const theme = LEGAL_THEMES.find((item) => item.id === themeId);
    if (!theme) {
        throw new Error(`Theme legal desconocido: "${themeId}"`);
    }
    return theme;
}

function supportEmailFor(emailPrefix) {
    return emailPrefix
        ? `musical.anthems+${emailPrefix}.support@proton.me`
        : 'musical.anthems+support@proton.me';
}

// `{{#anthems}}…{{/anthems}}`: todos los themes de este repo (incluido
// popular-christmas-music, `anthems: true` en el boilerplate) llevan la cláusula de
// retirada de contenido, así que el cuerpo se muestra siempre y solo se eliminan los marcadores.
const ANTHEMS_BLOCK = /\{\{#anthems\}\}([\s\S]*?)\{\{\/anthems\}\}\n?/g;

function renderLegalPlaceholders(markdown, themeId = DEFAULT_THEME) {
    const theme = themeFor(themeId);
    return markdown
        .replace(ANTHEMS_BLOCK, (_match, body) => `${body}\n`)
        .split('{{appName}}')
        .join(theme.appName)
        .split('{{supportEmail}}')
        .join(supportEmailFor(theme.emailPrefix));
}

module.exports = {
    DEFAULT_THEME,
    LEGAL_THEMES,
    THEME_IDS,
    renderLegalPlaceholders,
    supportEmailFor,
    themeFor,
};
