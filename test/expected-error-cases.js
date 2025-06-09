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
        assertEqual('Failed to close mustache opened on line 5', error.message);
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
        assertEqual('Failed to close mustache opened on line 5', error.message);
        assertEqual('test-2', error.filename);
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
        '    <h1>{{ article.title }}',
        // We forgot the closing "--}}"
        '    {{!-- Forgot to properly close this comment }}',
        '  </article>',
        '  </body>',
        '</html>',
    ].join('\n');

    assertThrows(() => {
        createAndRenderTemplate('test-3', source, {});
    }, (error) => {
        assertEqual('Failed to close comment opened on line 6', error.message);
        assertEqual('test-3', error.filename);
        assertEqual(6, error.lineNumber);
        assertEqual(4, error.startPosition);
    });
}

{
    const source = [
        '<html>',
        '<head></head>',
        '  <body>',
        '  <article>',
        '    <p>{{ article.subtitle }}</p>',
        // We forgot the closing "--}}"
        '    {{!-- Forgot to properly close this comment }}',
        '  </article>',
        '  </body>',
        '  {{!-- End of body --}}',
        '</html>',
    ].join('\n');

    assertThrows(() => {
        createAndRenderTemplate('test-4', source, {});
    }, (error) => {
        assertEqual('Failed to close comment opened on line 6', error.message);
        assertEqual('test-4', error.filename);
        assertEqual(6, error.lineNumber);
        assertEqual(4, error.startPosition);
    });
}

{
    const source = [
        '<html>',
        '<head></head>',
        '  <body>',
        '  <article>',
        '    {{#if article }}', // We forgot to close this block
        '    <p>{{ article.subtitle }}</p>',
        '  </article>',
        '  </body>',
        '</html>',
    ].join('\n');

    assertThrows(() => {
        createAndRenderTemplate('test-5', source, {});
    }, (error) => {
        assertEqual('Failed to close block opened on line 5', error.message);
        assertEqual('test-5', error.filename);
        assertEqual(5, error.lineNumber);
        assertEqual(6, error.startPosition);
    });
}

{
    const source = [
        '<html>',
        '<head></head>',
        '  <body>',
        '  <ul>',
        '    {{#each articles as |article }}', // We forgot to close the block params
        '    <p>{{ article.subtitle }}</p>',
        '    {{/each}}',
        '  </ul>',
        '  </body>',
        '</html>',
    ].join('\n');

    assertThrows(() => {
        createAndRenderTemplate('test-6', source, {});
    }, (error) => {
        assertEqual('Unclosed block params in expression starting on line 5', error.message);
        assertEqual('test-6', error.filename);
        assertEqual(5, error.lineNumber);
        assertEqual(4, error.startPosition);
    });
}

{
    const source = [
        '<html>',
        '<head></head>',
        '  <body>',
        '  <article>',
        // We forgot to close the string literal:
        '    <p>{{ format_date article.pubdate format="DATE_MED }}</p>',
        '  </article>',
        '  </body>',
        '</html>',
    ].join('\n');

    assertThrows(() => {
        createAndRenderTemplate('test-7', source, {});
    }, (error) => {
        assertEqual('Unclosed string literal in expression starting on line 5', error.message);
        assertEqual('test-7', error.filename);
        assertEqual(5, error.lineNumber);
        assertEqual(7, error.startPosition);
    });
}

{
    const source = [
        '<html>',
        '<head></head>',
        '  <body>',
        '  <article>',
        // We forgot to close the bracket "[":
        '    <figure>{{image images[2 format="large"}}</figure>',
        '  </article>',
        '  </body>',
        '</html>',
    ].join('\n');

    assertThrows(() => {
        createAndRenderTemplate('test-8', source, {});
    }, (error) => {
        assertEqual('Unclosed bracket "[...]" in expression starting on line 5', error.message);
        assertEqual('test-8', error.filename);
        assertEqual(5, error.lineNumber);
        assertEqual(12, error.startPosition);
    });
}

{
    const source = [
        '<html>',
        '<head></head>',
        '  <body>',
        '  <article>',
        // We forgot to close the bracket "[":
        '    <figure>{{image images[2] format=}}</figure>',
        '  </article>',
        '  </body>',
        '</html>',
    ].join('\n');

    assertThrows(() => {
        createAndRenderTemplate('test-9', source, {});
    }, (error) => {
        assertEqual('No value defined for key/value after "=" in expression starting on line 5', error.message);
        assertEqual('test-9', error.filename);
        assertEqual(5, error.lineNumber);
        assertEqual(12, error.startPosition);
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
