export function image(context, opts, ...positionals) {
    const srcset = positionals.join(', ');
    return `<img src="${ positionals[0] }" srcset="${ srcset }">`;
}
