import fsp from 'node:fs/promises';
import path from 'node:path';

import { EOL } from 'node:os';


export async function readFixtureFiles(dirpath) {
    const sourceFileExtensions = [
        '.html',
        '.css',
        '.js',
    ];

    const entries = await fsp.readdir(dirpath);

    const sourceFileNames = entries.filter((entry) => {
        return sourceFileExtensions.includes(path.extname(entry));
    });

    const promises = sourceFileNames.map((filename) => {
        return loadFile(path.join(dirpath, filename));
    });

    return Promise.all(promises);
}

export async function loadFile(filepath) {
    const dirpath = path.dirname(filepath);
    const filename = path.basename(filepath);
    const templateName = templateNameFromFilename(filename);
    const tokensFilename = tokensFilenameFromTemplateName(templateName);
    const treeFilename = treeFilenameFromTemplateName(templateName);

    const source = await readUtf8File(filepath);
    const tokensJSON = await readUtf8File(path.join(dirpath, tokensFilename));
    const astJSON = await readUtf8File(path.join(dirpath, treeFilename));

    return {
        filename,
        source,
        tokens: JSON.parse(tokensJSON),
        AST: JSON.parse(astJSON),
    };
}

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
