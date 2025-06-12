import { AssertionError, assertEqual } from 'kixx-assert';
import tokenize from '../lib/tokenize.js';
import buildSyntaxTree from '../lib/build-syntax-tree.js';
import createRenderFunction from '../lib/create-render-function.js';


export default [
    function test1() {
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
            assertEqual('Failed to close mustache opened in test-1 on line 5', error.message);
            assertEqual('test-1', error.filename);
            assertEqual(5, error.lineNumber);
            assertEqual(8, error.startPosition);
        });
    },

    function test2() {
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
            assertEqual('Failed to close mustache opened in test-2 on line 5', error.message);
            assertEqual('test-2', error.filename);
            assertEqual(5, error.lineNumber);
            assertEqual(8, error.startPosition);
        });
    },

    function test3() {
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
            assertEqual('Failed to close comment opened in test-3 on line 6', error.message);
            assertEqual('test-3', error.filename);
            assertEqual(6, error.lineNumber);
            assertEqual(4, error.startPosition);
        });
    },

    function test4() {
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
            assertEqual('Failed to close comment opened in test-4 on line 6', error.message);
            assertEqual('test-4', error.filename);
            assertEqual(6, error.lineNumber);
            assertEqual(4, error.startPosition);
        });
    },

    function test5() {
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
            assertEqual('Failed to close block opened in test-5 on line 5', error.message);
            assertEqual('test-5', error.filename);
            assertEqual(5, error.lineNumber);
            assertEqual(6, error.startPosition);
        });
    },

    function test6() {
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
            assertEqual('Unclosed block params in expression in test-6 starting on line 5', error.message);
            assertEqual('test-6', error.filename);
            assertEqual(5, error.lineNumber);
            assertEqual(4, error.startPosition);
        });
    },

    function test7() {
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
            assertEqual('Unclosed string literal in expression in test-7 starting on line 5', error.message);
            assertEqual('test-7', error.filename);
            assertEqual(5, error.lineNumber);
            assertEqual(7, error.startPosition);
        });
    },

    function test8() {
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
            assertEqual('Unclosed bracket "[...]" in expression in test-8 starting on line 5', error.message);
            assertEqual('test-8', error.filename);
            assertEqual(5, error.lineNumber);
            assertEqual(12, error.startPosition);
        });
    },

    function test9() {
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
            assertEqual('No value defined for key/value after "=" in expression in test-9 starting on line 5', error.message);
            assertEqual('test-9', error.filename);
            assertEqual(5, error.lineNumber);
            assertEqual(12, error.startPosition);
        });
    },

    function test10() {
        const source = [
            '<html>',
            '<head></head>',
            '  <body>',
            '  <article>',
            // This helper function does not exist
            '    <figure>{{image images[0] }}</figure>',
            '  </article>',
            '  </body>',
            '</html>',
        ].join('\n');

        assertThrows(() => {
            createAndRenderTemplate('test-10', source, { images: [ '/foo/image.jpg' ] });
        }, (error) => {
            assertEqual('No helper named "image" in "test-10" on line 5', error.message);
            assertEqual('test-10', error.filename);
            assertEqual(5, error.lineNumber);
            assertEqual(14, error.startPosition);
        });
    },

    function test11() {
        // The image helper throws an error.
        const image = () => {
            throw new Error('Internal helper error');
        };

        const source = [
            '<html>',
            '<head></head>',
            '  <body>',
            '  <article>',
            '    <figure>{{image images[0] }}</figure>',
            '  </article>',
            '  </body>',
            '</html>',
        ].join('\n');

        const context = { images: [ '/foo/image.jpg' ] };
        const helpers = new Map([ [ 'image', image ] ]);

        assertThrows(() => {
            createAndRenderTemplate('test-11', source, context, helpers);
        }, (error) => {
            assertEqual('Error in helper "image" in "test-11" on line 5', error.message);
            assertEqual('Internal helper error', error.cause.message);
            assertEqual('test-11', error.filename);
            assertEqual(5, error.lineNumber);
            assertEqual(14, error.startPosition);
        });
    },

    function test12() {
        const source = [
            '<html>',
            '<head></head>',
            '  <body>',
            '    {{> article.html }}',
            '  </body>',
            '</html>',
        ].join('\n');

        assertThrows(() => {
            createAndRenderTemplate('test-12', source, {});
        }, (error) => {
            assertEqual('No partial named "article.html" in "test-12" on line 4', error.message);
            assertEqual('test-12', error.filename);
            assertEqual(4, error.lineNumber);
            assertEqual(6, error.startPosition);
        });
    },
];


function createAndRenderTemplate(name, source, context, helpers = new Map(), partials = new Map()) {
    const tokens = tokenize(null, name, source);
    const tree = buildSyntaxTree(null, tokens);
    const render = createRenderFunction(null, helpers, partials, tree);
    return render(context);
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
