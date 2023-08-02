import EventEmitter from './lib/event-emitter.js';
import KixxTemplateEngine from './lib/kixx-template-engine.js';
import tokenize from './lib/tokenize.js';
import buildSyntaxTree from './lib/build-syntax-tree.js';
import createRenderFunction from './lib/create-render-function.js';

export default {
    KixxTemplateEngine,
    EventEmitter,
    tokenize,
    buildSyntaxTree,
    createRenderFunction,
};
