/* global Deno */
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
