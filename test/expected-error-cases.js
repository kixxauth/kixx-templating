import { AssertionError, assertEqual } from 'kixx-assert';
import tokenize from '../lib/tokenize.js';
import buildSyntaxTree from '../lib/build-syntax-tree.js';


{
    const source = [
        '<html>',
        '<head></head>',
        '  <body>',
        '  <article>',
        // We forgot the closing "}}"
        '    <h1>{{ article.title ',
        '  </article>',
        '  </body>',
        '</html>',
    ].join('\n');

    assertThrows(() => {
        createAndRenderTemplate('test-1', source, {});
    }, (error) => {
        assertEqual('Failed to close mustache from line 5', error.message);
        assertEqual('test-1', error.filename);
        assertEqual(5, error.lineNumber);
        assertEqual(8, error.startPosition);
    });
}

{
    const source = [
        '<html>',
        '<head></head>',
        '  <body>',
        '  <article>',
        // We forgot the closing "}}"
        '    <h1>{{ article.title </h1>>',
        '    <p>{{ article.subtitle }}</p>',
        '  </article>',
        '  </body>',
        '</html>',
    ].join('\n');

    assertThrows(() => {
        createAndRenderTemplate('test-2', source, {});
    }, (error) => {
        assertEqual('Failed to close mustache from line 5', error.message);
        assertEqual('test-2', error.filename);
        assertEqual(5, error.lineNumber);
        assertEqual(8, error.startPosition);
    });
}


function createAndRenderTemplate(name, source) {
    const tokens = tokenize(null, name, source);
    const tree = buildSyntaxTree(null, tokens);
    return tree;
}

function assertThrows(fn, check) {
    try {
        fn();
    } catch (error) {
        check(error);
        return;
    }

    throw new AssertionError('Expected createAndRenderTemplate() to throw', null, assertThrows);
}
