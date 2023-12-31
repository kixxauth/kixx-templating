import EventEmitter from './event-emitter.js';
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

    on(eventName, handler) {
        this.#emitter.on(eventName, handler);
        return this;
    }

    off(eventName, handler) {
        this.#emitter.off(eventName, handler);
        return this;
    }

    registerPartial(partialName, filename, utf8String) {
        const render = this.compileTemplate(filename, utf8String);
        this.#partials.set(partialName, render);
        return this;
    }

    registerHelper(helperName, helperFunction) {
        this.#helpers.set(helperName, helperFunction);
        return this;
    }

    compileTemplate(filename, utf8String) {
        const options = this.#options;
        const partials = this.#partials;
        const helpers = this.#helpers;
        const emitter = this.#emitter;

        let res;

        res = tokenize(options, filename, utf8String);

        if (res.errors.length > 0) {
            throw res.errors[0];
        }

        res = buildSyntaxTree(options, res.tokens);

        if (res.errors.length > 0) {
            if (options.useVerboseLogging) {
                this.printErrors(res.errors);
            }
            throw res.errors[0];
        }

        res = createRenderFunction(options, emitter, partials, helpers, res.tree);

        if (res.errors.length > 0) {
            if (options.useVerboseLogging) {
                this.printErrors(res.errors);
            }
            throw res.errors[0];
        }

        return res.render;
    }

    printErrors(errors) {
        errors.forEach(function printError(err) {
            if (err.toString && typeof err.toString === 'function') {
                // eslint-disable-next-line no-console
                console.error(err.toString());
            } else {
                // eslint-disable-next-line no-console
                console.error(err.stack);
            }
        });
    }
}
