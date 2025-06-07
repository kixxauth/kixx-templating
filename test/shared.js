import fsp from 'node:fs/promises';
import path from 'node:path';

import { EOL } from 'node:os';


export function readUtf8File(filepath) {
    return fsp.readFile(filepath, { encoding: 'utf8' });
}

export async function saveTokensFile(directory, sourceFilename, tokens) {
    const name = templateNameFromFilename(sourceFilename);
    const tokensFilename = tokensFilenameFromTemplateName(name);
    const filepath = path.join(directory, tokensFilename);
    const json = tokens.map((t) => JSON.stringify(t)).join(`,${ EOL }`);
    await fsp.writeFile(filepath, `[${ EOL }${ json }${ EOL }]`, { encoding: 'utf8' });
}

export function templateNameFromFilename(filename) {
    return filename.replace(/.[a-z]+$/, '');
}

export function tokensFilenameFromTemplateName(name) {
    return `${ name }.tokens.json`;
}
