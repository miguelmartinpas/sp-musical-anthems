#!/usr/bin/env node
/**
 * Verifica que el registro de themes legales de este repo coincide con
 * `app-boilerplate/scripts/android-themes.js` (nombres y prefijos de correo).
 *
 * Uso: npm run check:legal
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..', '..', 'app-boilerplate');

let appThemes;
let nameFor;
try {
    ({ THEMES: appThemes, nameFor } = require(path.join(appRoot, 'scripts', 'android-themes.js')));
} catch (error) {
    console.error(`check:legal no pudo cargar ${path.join(appRoot, 'scripts', 'android-themes.js')}`);
    console.error(error.message);
    process.exit(1);
}

const { LEGAL_THEMES } = require('./legal-themes.js');

const expectedIds = appThemes
    .map((theme) => theme.id)
    .filter((id) => id.endsWith('-musical-anthems'));

const errors = [];
const localIds = LEGAL_THEMES.map((theme) => theme.id);

for (const id of expectedIds) {
    const entry = LEGAL_THEMES.find((theme) => theme.id === id);
    if (!entry) {
        errors.push(`${id}: ausente en scripts/legal-themes.js`);
        continue;
    }

    const expectedName = nameFor(id);
    if (entry.appName !== expectedName) {
        errors.push(`${id}: nombre "${entry.appName}" ≠ "${expectedName}" (android-themes.js)`);
    }

    const expectedPrefix = id.replace('-musical-anthems', '');
    if (entry.emailPrefix !== expectedPrefix) {
        errors.push(`${id}: prefijo "${entry.emailPrefix}" ≠ "${expectedPrefix}"`);
    }
}

for (const id of localIds) {
    if (!expectedIds.includes(id)) {
        errors.push(`${id}: sobra en scripts/legal-themes.js`);
    }
}

if (errors.length > 0) {
    console.error('check:legal falló:\n' + errors.map((error) => `  - ${error}`).join('\n'));
    process.exit(1);
}

console.log(`check:legal OK (${LEGAL_THEMES.length} themes)`);
