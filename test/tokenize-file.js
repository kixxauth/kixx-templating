import process from 'node:process';
import path from 'node:path';
import tokenize from '../lib/tokenize.js';
import { readUtf8File, saveTokensFile } from './shared.js';


async function main() {
    const filepath = path.resolve(process.argv[2]);
    const dirpath = path.dirname(filepath);
    const filename = path.basename(filepath);

    const utf8 = await readUtf8File(filepath);
    const tokens = tokenize(null, filename, utf8);

    await saveTokensFile(dirpath, filename, tokens);
}

// eslint-disable-next-line no-console
main().catch((err) => console.error(err));
