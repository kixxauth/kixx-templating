/* global Deno */
import KixxTemplating from '../main.js';

const helpers = {
    title(context, opts, positionals, named) {
        const title = positionals[0];
        return `<h1 id="${ named.id }">${ title }</h1>`;
    },

    subtitle(context, opts, positionals, named) {
        const title = positionals[0];
        return `<h2 class="${ named.class }">${ title }</h2>`;
    },

    link(context, opts, positionals) {
        const [ label, href ] = positionals;
        return `<a href="${ href }">${ label }</a>`;
    },

    advancedLink(context, opts, positionals, named) {
        const [ label ] = positionals;
        return `<a href="${ named.href }" class="${ named.class }">${ label }</a>`;
    },

    sum(context, opts, positionals) {
        return positionals.reduce((sum, n) => {
            return sum + n;
        }, 0);
    },

    each(context, opts, positionals, named) {
        return `this will be an each`;
    },
};

async function main() {
    const engine = new KixxTemplating.TemplateEngine({
        useVerboseLogging: true,
        includeErrorMessages: true,
    });

    const example_html = await Deno.readTextFile('./example/example.html');
    const footer_html = await Deno.readTextFile('./example/footer.html');

    engine.registerHelper('title', helpers.title);
    engine.registerHelper('subtitle', helpers.subtitle);
    engine.registerHelper('link', helpers.link);
    engine.registerHelper('advancedLink', helpers.advancedLink);
    engine.registerHelper('sum', helpers.sum);
    engine.registerHelper('each', helpers.each);

    engine.registerPartial('footer', 'footer.html', footer_html);

    const template = engine.compileTemplate('example.html', example_html);

    const html = template({});

    console.log('');
    console.log('--- HTML ---');
    console.log(html);
}

main().catch(function catchError(err) {
    console.error(err.stack); // eslint-disable-line no-console
});
