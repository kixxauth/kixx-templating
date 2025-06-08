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

export async function saveSyntaxTreeFile(directory, sourceFilename, tree) {
    const name = templateNameFromFilename(sourceFilename);
    const tokensFilename = treeFilenameFromTemplateName(name);
    const filepath = path.join(directory, tokensFilename);
    const json = JSON.stringify(tree, null, 2);
    await fsp.writeFile(filepath, json, { encoding: 'utf8' });
}

export function templateNameFromFilename(filename) {
    return filename.replace(/.[a-z]+$/, '');
}

export function tokensFilenameFromTemplateName(name) {
    return `${ name }.tokens.json`;
}

export function treeFilenameFromTemplateName(name) {
    return `${ name }.tree.json`;
}
