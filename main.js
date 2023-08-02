/* globals Deno */
import tokenize from './lib/tokenize.js';
import buildSyntaxTree from './lib/build-syntax-tree.js';
import createRenderFunction from './lib/create-render-function.js';

// TODO: Will bring this back
/*
class TemplateEngine {
    compileTemplate(utf8) {
        const tokens = tokenize(utf8);

        tokens.errors.forEach((err) => {
            console.error(err.toString());
        });

        if (tokens.errors.length > 0) {
            throw tokens.errors[0];
        }

        const ast = buildSyntaxTree(tokens.tokens);

        ast.errors.forEach((err) => {
            console.error(err.toString());
        });

        if (ast.errors.length > 0) {
            throw ast.errors[0];
        }
    }
}
*/

const emitter = {
    emit(type, err) {
        console.error(`emit ${ type }:`, err);
    },
};

// Used for scope testing below
const baz = 3; // eslint-disable-line no-unused-vars

function createFunction() {

    /* eslint-disable */
    const body = [
        'const parts = [];',
        'function push(s) { parts.push(s); }',
        'with (data) {',
        // Will be "object" unless there is a `console` member on the data object.
        'push(`typeof console: ${typeof console}`);',
        // Will be undefined
        'push(`typeof this.console: ${typeof this.console}`);',
        // Will be number
        'push(`typeof foo: ${typeof foo}`);',
        // Will be undefined; not on the data object.
        'push(`typeof bar: ${typeof bar}`);',
        // Will be undefined; cannot access module values.
        'push(`typeof baz: ${typeof baz}`);',
        // Will be string; getting this off the data object.
        'push(`typeof foobar: ${typeof foobar}`);',
        // Will be undefined; not available on the context.
        'push(`typeof this.foo: ${typeof this.foo}`);',
        // Will be number; is defined on the context
        'push(`typeof this.bar: ${typeof this.bar}`);',
        // Will be undefined; cannot access module values.
        'push(`typeof this.baz: ${typeof this.baz}`);',
        // Will be number; defined on the context.
        'push(`typeof this.foobar: ${typeof this.foobar}`);',
        '}',
        'return parts.join("\\n");',
    ].join('\n');

    return new Function('data', body);
    /* eslint-enable */
}

// eslint-disable-next-line no-unused-vars
function main_testFunctionScope() {
    const data = { foo: 1, console: 'foo', foobar: 'three' };
    const context = { bar: 2, foobar: 3 };

    const fn = createFunction().bind(context);

    console.log(fn(data));
}

async function main() {
    const utf8 = await Deno.readTextFile('./example.html');
    const { tokens } = tokenize(utf8);

    // Uncomment to view raw tokens
    // tokens.forEach((item) => {
    //     console.log(item);
    // });

    // Uncomment to save the AST as JSON.
    const { tree, errors } = buildSyntaxTree(tokens);

    errors.forEach((err) => {
        console.log(err.toString());
    });

    await Deno.writeTextFile('./ast.json', JSON.stringify(tree, null, 2));

    const options = {
        useVerboseLogging: true,
        includeErrorMessages: true,
    };

    createRenderFunction(options, emitter, new Map(), new Map(), tree);
}

main();
