Example
-------
A full featured example using Deno.js

```js
import { TemplateEngine } from '../mod.js';

const helpers = {
    title(helper, context, hash, title) {
        return `<h1 id="${ hash.id }">${ title }</h1>`;
    },

    subtitle(helper, context, hash, title) {
        return `<h2 class="${ hash.class }">${ title }</h2>`;
    },

    link(helper, context, hash, label, href) {
        return `<a href="${ href }">${ label }</a>`;
    },

    advancedLink(helper, context, hash, label) {
        return `<a href="${ hash.href }" class="${ hash.class }">${ label }</a>`;
    },

    sum(helper, context, hash, ...positionals) {
        return positionals.reduce((sum, n) => {
            return sum + n;
        }, 0);
    },

    each(helper, context, hash, list) {
        const [ itemName, indexName ] = helper.blockParams;

        if (list && typeof list.reduce === 'function' && list.length > 0) {
            return list.reduce(function renderItem(str, item, index) {
                const subContext = {};

                subContext[itemName] = item;
                subContext[indexName] = index;

                return str + helper.renderPrimary(subContext);
            }, '');
        }

        return helper.renderInverse(context);
    },
};

async function main() {
    const engine = new TemplateEngine({
        useVerboseLogging: true,
        includeErrorMessages: true,
    });

    const example_html = await Deno.readTextFile('./example/example.html');
    const list_item_html = await Deno.readTextFile('./example/list-item.html');
    const footer_html = await Deno.readTextFile('./example/footer.html');

    engine.registerHelper('title', helpers.title);
    engine.registerHelper('subtitle', helpers.subtitle);
    engine.registerHelper('link', helpers.link);
    engine.registerHelper('advancedLink', helpers.advancedLink);
    engine.registerHelper('sum', helpers.sum);
    engine.registerHelper('each', helpers.each);

    engine.registerPartial('list_item', 'list-item.html', list_item_html);
    engine.registerPartial('footer', 'footer.html', footer_html);

    const template = engine.compileTemplate('example.html', example_html);

    const html = template({
        page: {
            class: 'home-page',
            title: 'The Home Page',
        },
        websites: [
            { url: 'http://1.example.com' },
            { url: 'http://2.example.com' },
        ],
        some_markup: '<script src="http://bad.actor.com/infection.js"></script>',
    });

    console.log('');
    console.log('--- HTML ---');
    console.log(html);
}

main().catch(function catchError(err) {
    console.error(err.stack); // eslint-disable-line no-console
});
```

Expressions
-----------
```html
<body class="{{ page.class }}" data="{foo:bar}">
    {{{ some_markup }}}
</body>
```
Everything between curly brackets `{{ ... }}` will be evalated as an expression. White space will be trimmed. Single curly brackets `{ ... }` are not evaluated and will be passed through.

### XML/HTML Encoding
There is an argument to be made that all expressions should convert literal XML/HTML syntax to encoded variations to provide some safety from accidental or malicious XML/HTML injection. This library does not do that (at least not yet), and so the triple curly brackets `{{{ ... }}}`, which would be used to avoid XML/HTML encoding, actually do nothing.

Partials
--------
Partials are an easy way to "import" a template into another one:

```html
<body class="{{ page.class }}" data="{ foo: bar }">
    {{> header}}
    {{> footer}}
</body>
```

Partials must be registered before the template function can be compiled:

```js

engine.registerPartial('header', 'header.html', list_item_html);
engine.registerPartial('footer', 'footer.html', footer_html);
```

The first argument to `registerPartial()` is the name of the partial, the second part is the filename used for error messages and logging, and the third argument should be the utf-8 template source String.

Helpers
-------
Helper functions are a powerful way to re-use and modularize template logic. Registering a helper function is required before rendering a template, but do not need to be registered before the template function is compiled.

```js
const engine = new TemplateEngine({
    useVerboseLogging: true,
    includeErrorMessages: true,
});

// Register a simple inline helper to render a link with a href and label.
engine.registerHelper('link', function link(helper, context, hash, label, href) {
    return `<a href="${ href }">${ label }</a>`;
});

// Create a block helper which understands an {{ else }} block using renderInverse()
engine.registerHelper('each', function each(helper, context, hash, list) {
    const [ itemName, indexName ] = helper.blockParams;

    if (list && typeof list.reduce === 'function' && list.length > 0) {
        return list.reduce(function renderItem(str, item, index) {
            const subContext = {};

            subContext[itemName] = item;
            subContext[indexName] = index;

            return str + helper.renderPrimary(subContext);
        }, '');
    }

    return helper.renderInverse(context);
});
```

The first argument to `registerHelper()` is a string which identifies the helper. The second argument is the helper function definition.

The helper can then be used like this:

```html
<body class="{{ page.class }}" data="{foo:bar}">
    <p>See {{link "website" website.url }}.</p>
</body>
```

Helper names cannot be nested. So, `linkHelpers.ahref` will not work.

Helpers take precedence and are dereferenced before context data. So, when using this data:

```js
const data = {
    title: 'Foo Bar',
    link: 'http://mysite.example.com',
    website: { label: 'My Site', url: 'http://mysite.example.com' }
};
```

The template renderer will look up and use the "link" helper before using the "link" property from the context data.

### Inline and Block Helpers
Helpers can be used in 2 different flavors. Which flavor is used depends on how the helper is invoked in the template source, not the helper definition.

The first flavor is inline:

```html
<p>See {{link "website" website.url }}.</p>
```

The second is as a block (using the "#" to indicate a block invocation):

```html
{{#each websites as |website index| }}
    <p><a href="${ website.url }" class="${ page.class }">Link index: ${ index }</a></p>
{{ else }}
    <p>No websites listed for {{page.title}}</p>
{{/each}}
```

### Defining Helpers
A helper is simply a function with the following signature:
```js
function (helperUtils, context, namedArgs, ...positionalArgs) {
}
```
The return value of a helper function will be cast to a String.

The arguments passed to the helper function are:

#### helperUtils

__helperUtils.blockParams__
The `blockParams` utility is only relevant for block helpers. It contains an Array of String parameter names which were passed into the block.

__helperUtils.renderPrimary(context)__

The `renderPrimary(context)` utility is only relevant for block helpers. It will render the block defined before the `{{ else }}` statement in the source text, if there is one. You can define and pass in a custom context object which will override the global context using `Object.assign()`.

__helperUtils.renderInverse(context)__

The `renderInverse(context)` utility is only relevant for block helpers. It will render the block defined after the `{{ else }}` statement in the source text. Like `renderPrimary(context)` you can define and pass in a custom context object which will override the global context using `Object.assign()`. The `renderInverse(context)` utility is useful for cases like this when you want to render alternate text based on a condition (if the iterable is empty in this case):

```html
{{#each websites as |website index| }}
    <p><a href="${ website.url }" class="${ page.class }">Link index: ${ index }</a></p>
{{ else }}
    <p>No websites listed for {{page.title}}</p>
{{/each}}
```

#### context
The current context data object.

#### namedArg
Named arguments passed into the helper. These arguments may contain references as well as literal values. If double quotes are used then the literal will be interpreted as a String. Otherwise the engine will attempt to cast it as `true`, `false`, `null`, or a Number before attempting to dereference it from the contxt data.

An example invoking the advancedLink helper with a positional string literal argument and named arguments using both a context reference and string literal:

```html
    <p>See {{advancedLink "another website" href=websites[1].url class="foo"}}.</p>
```

### positionalArgs
Positional arguments passed into the helper. These arguments may contain references as well as literal values. If double quotes are used then the literal will be interpreted as a String. Otherwise the engine will attempt to cast it as `true`, `false`, `null`, or a Number before attempting to dereference it from the contxt data.

An example invoking the advancedLink helper with a positional string literal argument and named arguments using both a context reference and string literal:

```html
    <p>See {{advancedLink "another website" href=websites[1].url class="foo"}}.</p>
```
