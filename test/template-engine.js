import { tokenize, buildSyntaxTree, createRenderFunction } from '../mod.js';


const helpers = new Map();
const partials = new Map();


export async function registerHelper(name, fn) {
    helpers.set(name, fn);
}

export async function registerPartial(name, source) {
    const tokens = tokenize(null, name, source);
    const tree = buildSyntaxTree(null, tokens);
    const partial = createRenderFunction(null, helpers, partials, tree);
    partials.set(name, partial);
}

export function compileTemplate(name, source) {
    const tokens = tokenize(null, name, source);
    const tree = buildSyntaxTree(null, tokens);
    return createRenderFunction(null, helpers, partials, tree);
}
