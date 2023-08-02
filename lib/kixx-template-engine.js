import tokenize from './tokenize.js';
import buildSyntaxTree from './build-syntax-tree.js';
import createRenderFunction from './create-render-function.js';

export default class KixxTemplateEngine {

    #options = {};
    #partials = new Map();
    #helpers = new Map();
    #emitter = new EventEmitter();

    constructor(options) {
        this.#options.useVerboseLogging = Boolean(options.useVerboseLogging);
        this.#options.includeErrorMessages = Boolean(options.includeErrorMessages);
        Object.freeze(this.#options);
    }

    registerPartial(partialName, utf8String) {
        const render = this.compileTemplate(utf8String);
        this.#partials.set(partialName, render);
    }

    registerHelper(helperName, helperFunction) {
        this.#helpers.set(helperName, helperFunction);
    }

    compileTemplate(utf8String) {
        const options = this.#options;
        const partials = this.#partials;
        const helpers = this.#helpers;
        const emitter = this.#emitter;

        let res;

        res = tokenize(options, utf8String);

        if (res.errors.length > 0) {
            throw res.errors[0];
        }

        res = buildSyntaxTree(options, res.tokens);

        if (res.errors.length > 0) {
            throw res.errors[0];
        }

        res = createRenderFunction(options, emitter, partials, helpers, res.tree);

        if (res.errors.length > 0) {
            throw res.errors[0];
        }

        return res.render;
    }
}
