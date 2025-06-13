import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert, assertEqual, assertArray, assertFalsy, AssertionError } from 'kixx-assert';
import tokenize from '../lib/tokenize.js';
import buildSyntaxTree from '../lib/build-syntax-tree.js';
import expectedErrorCases from './expected-error-cases.js';
import { readUtf8File, readFixtureFiles } from './shared.js';
import templateContext from './template-context.js';
import * as templateEngine from './template-engine.js';
import * as customHelpers from './custom-helpers.js';
import { each_helper } from '../lib/helpers/each.js';
import { ifequal_helper } from '../lib/helpers/if-equal.js';
import { ifempty_helper } from '../lib/helpers/if-empty.js';


const TEST_DIR_URL = new URL('./', import.meta.url);


async function main() {
    expectedErrorCases.forEach((testCase) => {
        testCase();
    });

    await checkTemplateFileOutputs();
    await renderTemplates();
}

async function renderTemplates() {
    const partials = [
        'html-header.html',
        'site-header.html',
        'site-footer.html',
        'styles.css',
        'script.js',
        'book.html',
    ];

    const testDir = fileURLToPath(TEST_DIR_URL);
    const partialDir = path.join(testDir, 'partials');
    const templateDir = path.join(testDir, 'templates');

    templateEngine.registerHelper('each', each_helper);
    templateEngine.registerHelper('ifEqual', ifequal_helper);
    templateEngine.registerHelper('ifEmpty', ifempty_helper);

    for (const helperName of Object.keys(customHelpers)) {
        templateEngine.registerHelper(helperName, customHelpers[helperName]);
    }

    for (const partialName of partials) {
        // eslint-disable-next-line no-await-in-loop
        const utf8 = await readUtf8File(path.join(partialDir, partialName));
        templateEngine.registerPartial(partialName, utf8);
    }

    const baseTemplateSource = await readUtf8File(path.join(templateDir, 'base.html'));
    const homeTemplateSource = await readUtf8File(path.join(templateDir, 'home.html'));

    const renderBase = templateEngine.compileTemplate('base.html', baseTemplateSource);
    const renderHome = templateEngine.compileTemplate('home.html', homeTemplateSource);

    const body = renderHome(templateContext);

    const newContext = Object.assign({}, templateContext, { body });

    const html = renderBase(newContext);
    const expectedHtml = await readUtf8File(path.join(testDir, 'output-snapshot.html'));

    if (expectedHtml !== html) {
        console.log(html); // eslint-disable-line no-console
        throw new AssertionError('HTML output does not match expected HTML snapshot');
    }
}

async function checkTemplateFileOutputs() {
    let templates;

    templates = await readTemplatesFrom('partials');
    for (const files of templates) {
        assertTemplate(files);
    }

    templates = await readTemplatesFrom('templates');
    for (const files of templates) {
        assertTemplate(files);
    }
}

function readTemplatesFrom(dirname) {
    const url = new URL(`./${ dirname }/`, TEST_DIR_URL);
    return readFixtureFiles(fileURLToPath(url));
}

function assertTemplate(files) {
    const expectedTokens = files.tokens;
    const expectedAST = files.AST;
    const tokens = tokenize(null, files.filename, files.source);
    const ast = buildSyntaxTree(null, tokens);

    assertObjectsEqual('tokens', files.filename, expectedTokens, tokens);
    assertObjectsEqual('ast', files.filename, expectedAST, ast);
}

function assertObjectsEqual(type, filename, a, b, keyname = 'ROOT') {
    if (a === b) {
        return;
    }

    const name = `${ filename }:${ type } keyname:${ keyname }`;

    assertEqual(typeof a, typeof b, `Type mismatch at ${ name }`);

    if (Array.isArray(a)) {
        assertArray(b, `Array type mismatch at ${ name }`);
        assertEqual(a.length, b.length, `Array length mismatch at ${ name }`);
        for (let i = 0; i < a.length; i += 1) {
            assertObjectsEqual(type, filename, a[i], b[i], `${ keyname }[${ i }]`);
        }
        return;
    }

    if (typeof a === 'object') {
        assertFalsy(a === null || b === null, `Object/null mismatch at ${ name }`);
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        assertEqual(aKeys.length, bKeys.length, `Object key count mismatch at ${ name }`);
        for (const key of aKeys) {
            assert(key in b, `Object missing expected key "${ key }" at ${ name }`);
            assertObjectsEqual(type, filename, a[key], b[key], `${ keyname }.${ key }`);
        }
        return;
    }

    assertEqual(a, b, `Values are not equal at ${ name }`);
}


main().then(() => {
    // eslint-disable-next-line no-console
    console.log('All tests passed');
    process.exit(0);
}, (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
});
