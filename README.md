Kixx Templating
===============
A simple and robust text template engine for JavaScript environments.

Created by [Kris Walker](https://www.kriswalker.me) 2017 - 2023.

Environment Support
-------------------
Requires an ES2022 compliant environment.

| Env     | Version    |
|---------|------------|
| ECMA    | >= ES2022  |
| Node.js | >= 16.13.2 |
| Deno    | >= 1.36.1  |

Installation
------------
Download the contents of the `lib/` directory and `mod.js` file to your vendor folder and import them with your `dependencies.js` file:

```js
import * as KixxTemplating from './vendor/kixx-templating/mod.js';
import * as SomeOtherDependency from './vendor/some-other-dependency/mod.js';

export {
    KixxTemplating,
    SomeOtherDependency
};
```

Usage
-----
Given the `dependencies.js` file above, use Kixx Templating like this:

```js
import { KixxTemplating } from './dependencies.js';

async function main() {
    const engine = new KixxTemplating.TemplateEngine({
        useVerboseLogging: true,
        includeErrorMessages: true,
    });

    // Register a simple helper to render a link with a href and label.
    engine.registerHelper('link', function link(helper, context, hash, label, href) {
        return `<a href="${ href }">${ label }</a>`;
    });

    // Register a more complex helper to loop over iterable data.
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

    // Register the first partial.
    const list_item_html = await Deno.readTextFile('./example/list-item.html');
    engine.registerPartial('list_item', 'list-item.html', list_item_html);

    // Register a second partial.
    const footer_html = await Deno.readTextFile('./example/footer.html');
    engine.registerPartial('footer', 'footer.html', footer_html);

    // Read in the source text file and compile it into a template.
    const example_html = await Deno.readTextFile('./example/example.html');
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
```

Copyright and License
---------------------
Copyright: (c) 2023 - 2024 by Kris Walker (www.kriswalker.me)

Unless otherwise indicated, all source code is licensed under the MIT license. See MIT-LICENSE for details.
